import 'server-only'
import { PassThrough, Readable } from 'node:stream'
import ExcelJS from 'exceljs'

/**
 * Geração de planilhas (DESIGN.md §14, §16).
 *
 * XLSX vem do `exceljs` (DESIGN.md §19: o `xlsx`/SheetJS do npm tem CVE alto
 * sem correção publicada). **CSV é gerado aqui**, e não por biblioteca, por
 * causa do público-alvo: o Excel em pt-BR espera `;` como separador e um
 * BOM UTF-8 para renderizar acentos. Um CSV com vírgula e sem BOM abre como
 * uma coluna só e com "Ã§" no lugar de "ç" — inútil para quem vai imprimir e
 * levar a campo.
 *
 * Duas formas de saída (specs/023-central-relatorios, research D8):
 * - `gerarCsv`/`gerarXlsx` montam o arquivo inteiro em memória — servem ao
 *   pacote de contingência, que é pequeno e de várias abas;
 * - `streamCsv`/`streamXlsx` escrevem lote a lote num `ReadableStream` — servem
 *   à exportação de relatórios, que pode passar de 4,5 MB (limite de corpo de
 *   resposta das funções da Vercel, que **não** vale para streaming).
 */
export type Coluna<T> = {
    cabecalho: string
    valor: (linha: T) => string | number | null | undefined
    /** Largura sugerida em caracteres, para o XLSX. */
    largura?: number
}

/** Par rótulo/valor das linhas que identificam o documento (FR-008). */
export type LinhaIdentificacao = { rotulo: string; valor: string | number }

export type Aba<T> = {
    nome: string
    colunas: Coluna<T>[]
    linhas: T[]
    /**
     * Relatório, período, filtros, quem gerou e quando — antes da tabela
     * (FR-008). Ausente, a aba começa direto no cabeçalho da tabela, como o
     * pacote de contingência sempre fez.
     */
    cabecalhoDocumento?: LinhaIdentificacao[]
    /** Totais do relatório, logo após a identificação. */
    resumo?: LinhaIdentificacao[]
}

/** Aba sem as linhas — as linhas chegam em lotes, pelo stream. */
export type AbaEmLotes<T> = Omit<Aba<T>, 'linhas'>

const SEPARADOR_CSV = ';'
const QUEBRA_CSV = '\r\n'
/** O BOM faz o Excel reconhecer UTF-8 — sem ele, acentos quebram. */
const BOM_UTF8 = '﻿'

export function gerarCsv<T>(aba: Aba<T>): string {
    const linhas = aba.linhas.map((linha) => linhaCsv(aba.colunas, linha))
    return BOM_UTF8 + [...preambuloCsv(aba), ...linhas].join(QUEBRA_CSV)
}

/**
 * Um workbook com uma ou mais abas. As abas em branco do pacote de contingência
 * (DESIGN.md §15) são apenas abas com `linhas: []` — só os cabeçalhos.
 */
export async function gerarXlsx<T>(abas: Aba<T>[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook()

    for (const aba of abas) {
        const planilha = workbook.addWorksheet(limitarNomeAba(aba.nome), {
            views: [congelarAte(linhaDoCabecalho(aba))]
        })
        escreverPreambulo(planilha, aba)
        for (const linha of aba.linhas) {
            planilha.addRow(aba.colunas.map((c) => normalizarParaCelula(c.valor(linha))))
        }
    }

    return Buffer.from(await workbook.xlsx.writeBuffer())
}

/**
 * CSV transmitido em lotes. O conteúdo é byte a byte o mesmo de `gerarCsv`
 * com as mesmas linhas — só não precisa delas todas na memória.
 */
export function streamCsv<T>(aba: AbaEmLotes<T>, lotes: AsyncIterable<T[]>): ReadableStream<Uint8Array> {
    const codificador = new TextEncoder()
    const iterador = lotes[Symbol.asyncIterator]()
    let preambuloEnviado = false

    return new ReadableStream<Uint8Array>({
        async pull(controle) {
            if (!preambuloEnviado) {
                preambuloEnviado = true
                controle.enqueue(codificador.encode(BOM_UTF8 + preambuloCsv(aba).join(QUEBRA_CSV)))
                return
            }
            const { done, value } = await iterador.next()
            if (done) {
                controle.close()
                return
            }
            if (value.length === 0) return
            const bloco = value.map((linha) => QUEBRA_CSV + linhaCsv(aba.colunas, linha)).join('')
            controle.enqueue(codificador.encode(bloco))
        },
        async cancel() {
            await iterador.return?.()
        }
    })
}

/**
 * XLSX transmitido em lotes, pelo `WorkbookWriter` de streaming do `exceljs`:
 * cada linha é gravada e liberada (`commit`) assim que chega.
 *
 * Um erro no meio (ex.: a consulta de um lote falhou) aborta o stream — o
 * download chega incompleto e o navegador o marca como falho, em vez de
 * entregar uma planilha truncada que parece inteira.
 */
export function streamXlsx<T>(aba: AbaEmLotes<T>, lotes: AsyncIterable<T[]>): ReadableStream<Uint8Array> {
    const saida = new PassThrough()

    void (async () => {
        try {
            const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
                stream: saida,
                useStyles: true,
                useSharedStrings: true
            })
            const planilha = workbook.addWorksheet(limitarNomeAba(aba.nome), {
                views: [congelarAte(linhaDoCabecalho(aba))]
            })
            escreverPreambulo(planilha, aba, (linha) => linha.commit())

            for await (const lote of lotes) {
                for (const linha of lote) {
                    planilha.addRow(aba.colunas.map((c) => normalizarParaCelula(c.valor(linha)))).commit()
                }
            }

            planilha.commit()
            await workbook.commit()
        } catch (erro) {
            saida.destroy(erro instanceof Error ? erro : new Error(String(erro)))
        }
    })()

    return Readable.toWeb(saida) as ReadableStream<Uint8Array>
}

// -- Preâmbulo (identificação + resumo + cabeçalho da tabela) ------------------

function temPreambulo<T>(aba: AbaEmLotes<T>): boolean {
    return (aba.cabecalhoDocumento?.length ?? 0) + (aba.resumo?.length ?? 0) > 0
}

/** Linha (1-based) do cabeçalho da tabela — é até ela que o painel congela. */
function linhaDoCabecalho<T>(aba: AbaEmLotes<T>): number {
    if (!temPreambulo(aba)) return 1
    // identificação + resumo + linha em branco + cabeçalho
    return (aba.cabecalhoDocumento?.length ?? 0) + (aba.resumo?.length ?? 0) + 2
}

function congelarAte(linha: number): Partial<ExcelJS.WorksheetView> {
    // Congela o cabeçalho: planilhas de estoque ficam longas e a pessoa
    // perde a referência da coluna ao rolar. Com o documento identificado no
    // topo, congela até o cabeçalho da tabela — a identificação fica junto.
    return { state: 'frozen', xSplit: 0, ySplit: linha }
}

function escreverPreambulo<T>(
    planilha: ExcelJS.Worksheet,
    aba: AbaEmLotes<T>,
    aoEscrever: (linha: ExcelJS.Row) => void = () => {}
): void {
    if (!temPreambulo(aba)) {
        // Caminho de sempre: `columns` com `header` grava o cabeçalho na linha 1.
        planilha.columns = aba.colunas.map((c) => ({ header: c.cabecalho, width: largura(c) }))
        aoEscrever(planilha.getRow(1))
        return
    }

    planilha.columns = aba.colunas.map((c) => ({ width: largura(c) }))
    for (const { rotulo, valor } of [...(aba.cabecalhoDocumento ?? []), ...(aba.resumo ?? [])]) {
        const linha = planilha.addRow([rotulo, valor])
        linha.getCell(1).font = { bold: true }
        aoEscrever(linha)
    }
    aoEscrever(planilha.addRow([]))
    const cabecalho = planilha.addRow(aba.colunas.map((c) => c.cabecalho))
    cabecalho.font = { bold: true }
    aoEscrever(cabecalho)
}

function preambuloCsv<T>(aba: AbaEmLotes<T>): string[] {
    const cabecalho = aba.colunas.map((c) => escaparCsv(c.cabecalho)).join(SEPARADOR_CSV)
    if (!temPreambulo(aba)) return [cabecalho]

    const identificacao = [...(aba.cabecalhoDocumento ?? []), ...(aba.resumo ?? [])].map(
        ({ rotulo, valor }) => `${escaparCsv(paraTextoCsv(rotulo))}${SEPARADOR_CSV}${escaparCsv(paraTextoCsv(valor))}`
    )
    return [...identificacao, '', cabecalho]
}

function linhaCsv<T>(colunas: Coluna<T>[], linha: T): string {
    return colunas.map((c) => escaparCsv(paraTextoCsv(c.valor(linha)))).join(SEPARADOR_CSV)
}

// -- Células -------------------------------------------------------------------

function largura<T>(coluna: Coluna<T>): number {
    return coluna.largura ?? Math.max(12, coluna.cabecalho.length + 2)
}

/**
 * Excel rejeita nomes de aba com mais de 31 caracteres ou com `[]:*?/\`.
 * O `exceljs` **lança erro** com esses caracteres, então a limpeza aqui é
 * obrigatória, não só defensiva.
 */
function limitarNomeAba(nome: string): string {
    return nome.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31)
}

function paraTextoCsv(valor: string | number | null | undefined): string {
    if (valor === null || valor === undefined) return ''
    // Decimal em pt-BR usa vírgula — e como o separador de campo é `;`, não há
    // ambiguidade. Número negativo é número: não passa pela proteção abaixo.
    if (typeof valor === 'number') return String(valor).replace('.', ',')
    return neutralizarFormula(valor)
}

/**
 * Proteção contra injeção de fórmula em CSV (FR-011, OWASP "CSV Injection").
 *
 * Destino, motivo e nomes são texto livre digitado por gente; um destino
 * `=HYPERLINK(...)` viraria uma fórmula ativa ao abrir o arquivo no Excel. O
 * apóstrofo inicial faz a planilha tratar a célula como texto. Só o CSV
 * precisa disto: no XLSX a célula de texto é gravada como string, e o `exceljs`
 * só cria fórmula quando recebe `{ formula }` explicitamente.
 */
function neutralizarFormula(texto: string): string {
    return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto
}

function normalizarParaCelula(valor: string | number | null | undefined): string | number | null {
    if (valor === null || valor === undefined) return null
    return valor
}

function escaparCsv(valor: string): string {
    // Aspas duplas, separador ou quebra de linha exigem envolver em aspas e
    // duplicar as aspas internas (RFC 4180).
    if (/["\r\n;]/.test(valor)) return `"${valor.replaceAll('"', '""')}"`
    return valor
}

/** Nome de arquivo com data, para o operador não sobrescrever downloads. */
export function nomeDeArquivo(prefixo: string, extensao: string, agora = new Date()): string {
    const data = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(agora)
    const hora = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit'
    })
        .format(agora)
        .replace(':', 'h')
    return `${prefixo}-${data}-${hora}.${extensao}`
}
