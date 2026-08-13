import 'server-only'
import * as XLSX from 'xlsx'

/**
 * Geração de planilhas (DESIGN.md §14, §16).
 *
 * XLSX vem do SheetJS; **CSV é gerado aqui**, e não pelo `XLSX.utils.sheet_to_csv`,
 * por causa do público-alvo: o Excel em pt-BR espera `;` como separador e um
 * BOM UTF-8 para renderizar acentos. Um CSV com vírgula e sem BOM abre como
 * uma coluna só e com "Ã§" no lugar de "ç" — inútil para quem vai imprimir e
 * levar a campo.
 */
export type Coluna<T> = {
    cabecalho: string
    valor: (linha: T) => string | number | null | undefined
    /** Largura sugerida em caracteres, para o XLSX. */
    largura?: number
}

export type Aba<T> = {
    nome: string
    colunas: Coluna<T>[]
    linhas: T[]
}

const SEPARADOR_CSV = ';'
/** O BOM faz o Excel reconhecer UTF-8 — sem ele, acentos quebram. */
const BOM_UTF8 = '﻿'

export function gerarCsv<T>(aba: Aba<T>): string {
    const cabecalho = aba.colunas.map((c) => escaparCsv(c.cabecalho)).join(SEPARADOR_CSV)
    const corpo = aba.linhas.map((linha) =>
        aba.colunas.map((c) => escaparCsv(formatarValor(c.valor(linha)))).join(SEPARADOR_CSV)
    )
    return BOM_UTF8 + [cabecalho, ...corpo].join('\r\n')
}

/**
 * Um workbook com uma ou mais abas. As abas em branco do pacote de contingência
 * (DESIGN.md §15) são apenas abas com `linhas: []` — só os cabeçalhos.
 */
export function gerarXlsx<T>(abas: Aba<T>[]): Buffer {
    const workbook = XLSX.utils.book_new()

    for (const aba of abas) {
        const matriz: (string | number | null)[][] = [
            aba.colunas.map((c) => c.cabecalho),
            ...aba.linhas.map((linha) => aba.colunas.map((c) => normalizarParaCelula(c.valor(linha))))
        ]

        const planilha = XLSX.utils.aoa_to_sheet(matriz)
        planilha['!cols'] = aba.colunas.map((c) => ({ wch: c.largura ?? Math.max(12, c.cabecalho.length + 2) }))
        // Congela o cabeçalho: planilhas de estoque ficam longas e a pessoa
        // perde a referência da coluna ao rolar.
        planilha['!freeze'] = { xSplit: 0, ySplit: 1 }

        XLSX.utils.book_append_sheet(workbook, planilha, limitarNomeAba(aba.nome))
    }

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

/** Excel rejeita nomes de aba com mais de 31 caracteres ou com `[]:*?/\`. */
function limitarNomeAba(nome: string): string {
    return nome.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31)
}

function formatarValor(valor: string | number | null | undefined): string {
    if (valor === null || valor === undefined) return ''
    // Decimal em pt-BR usa vírgula — e como o separador de campo é `;`, não há
    // ambiguidade.
    if (typeof valor === 'number') return String(valor).replace('.', ',')
    return valor
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
