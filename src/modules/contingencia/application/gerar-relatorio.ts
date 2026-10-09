import { DomainError, falha, ok, type Result } from '@/src/shared/kernel'
import { clampPagina, normalizarPaginacao } from '@/src/shared/paginacao/esquema'
import { formatarPeriodo } from '../domain/periodo'
import type { AbaEmLotes, Coluna } from '../infrastructure/planilha'
import type { Celula, ItemResumo, LinhaRelatorio, RelatorioRegistrado } from './definicao-relatorio'
import { formatarDataHora } from './formatacao'

/**
 * Caso de uso único da central de relatórios (specs/023-central-relatorios).
 *
 * A Server Action (prévia) e o Route Handler (exportação) chamam este caso de
 * uso — e só ele —, que é o que garante que a tela e o arquivo mostram o mesmo
 * recorte dos mesmos dados (research D2).
 */

/** Teto de linhas exportáveis (SC-004, research D8). */
export const LIMITE_EXPORTACAO = 50_000

/** Linhas lidas por vez na exportação: nunca o conjunto inteiro na memória. */
export const TAMANHO_LOTE = 2_000

export type PaginaRelatorio = {
    colunas: string[]
    rows: LinhaRelatorio[]
    totalCount: number
    page: number
    pageSize: number
    resumo: ItemResumo[]
    excedeLimiteExportacao: boolean
}

export type ExportacaoRelatorio = {
    aba: AbaEmLotes<Celula[]>
    totalLinhas: number
    lotes: AsyncIterable<Celula[][]>
}

const NUMERO = new Intl.NumberFormat('pt-BR')

export class GerarRelatorioUseCase {
    constructor(
        private readonly obterRelatorio: (slug: unknown) => RelatorioRegistrado | undefined,
        private readonly tamanhoLote: number = TAMANHO_LOTE
    ) {}

    /** Uma página da prévia (FR-006). */
    async pagina(
        slug: unknown,
        entrada: Record<string, unknown>,
        agora: Date = new Date()
    ): Promise<Result<PaginaRelatorio, DomainError>> {
        const relatorio = this.obterRelatorio(slug)
        if (!relatorio) return falha(relatorioInvalido())

        const preparada = relatorio.preparar(paraParametros(entrada), agora)
        if (!preparada.ok) return preparada
        const consulta = preparada.valor

        return capturarErroDeDominio(async () => {
            const { page, pageSize } = normalizarPaginacao(entrada)
            const totalCount = await consulta.contar()
            const pageEfetiva = clampPagina({ page, pageSize, totalCount })

            const [rows, resumo] = await Promise.all([
                totalCount === 0
                    ? Promise.resolve([])
                    : consulta.linhas({ limite: pageSize, deslocamento: (pageEfetiva - 1) * pageSize }),
                consulta.resumo()
            ])

            return {
                colunas: relatorio.colunas.map((c) => c.cabecalho),
                rows,
                totalCount,
                page: pageEfetiva,
                pageSize,
                resumo,
                excedeLimiteExportacao: totalCount > LIMITE_EXPORTACAO
            }
        })
    }

    /**
     * O arquivo inteiro do filtro aplicado (FR-007), em lotes.
     *
     * Conta antes de começar: acima do teto, recusa com uma mensagem que diz o
     * que fazer, em vez de começar um download que vai estourar no meio.
     */
    async completo(
        slug: unknown,
        entrada: Record<string, unknown>,
        ator: { nome: string },
        agora: Date = new Date()
    ): Promise<Result<ExportacaoRelatorio, DomainError>> {
        const relatorio = this.obterRelatorio(slug)
        if (!relatorio) return falha(relatorioInvalido())

        const preparada = relatorio.preparar(paraParametros(entrada), agora)
        if (!preparada.ok) return preparada
        const consulta = preparada.valor

        return capturarErroDeDominio(async () => {
            const totalLinhas = await consulta.contar()
            if (totalLinhas > LIMITE_EXPORTACAO) {
                throw new DomainError(
                    'limite_exportacao',
                    `O relatório tem ${NUMERO.format(totalLinhas)} linhas, acima do limite de ${NUMERO.format(LIMITE_EXPORTACAO)} para exportação. Reduza o período.`
                )
            }

            const [resumo, filtrosDescritos] = await Promise.all([consulta.resumo(), consulta.descreverFiltros()])
            const colunas: Coluna<Celula[]>[] = relatorio.colunas.map((c, indice) => ({
                cabecalho: c.cabecalho,
                largura: c.largura,
                valor: (celulas) => celulas[indice]
            }))

            const aba: AbaEmLotes<Celula[]> = {
                nome: relatorio.nome,
                colunas,
                // Ordem de data-model.md §3.
                cabecalhoDocumento: [
                    { rotulo: 'Relatório', valor: relatorio.nome },
                    { rotulo: 'Período', valor: consulta.periodo ? formatarPeriodo(consulta.periodo) : '—' },
                    ...filtrosDescritos,
                    { rotulo: 'Gerado em', valor: formatarDataHora(agora) },
                    { rotulo: 'Gerado por', valor: ator.nome },
                    { rotulo: 'Total de linhas', valor: String(totalLinhas) }
                ],
                resumo
            }

            return { aba, totalLinhas, lotes: this.emLotes(consulta.linhas, totalLinhas) }
        })
    }

    private async *emLotes(
        linhas: (janela: { limite: number; deslocamento: number }) => Promise<LinhaRelatorio[]>,
        total: number
    ): AsyncIterable<Celula[][]> {
        for (let deslocamento = 0; deslocamento < total; deslocamento += this.tamanhoLote) {
            const lote = await linhas({ limite: this.tamanhoLote, deslocamento })
            if (lote.length === 0) return
            yield lote.map((linha) => linha.celulas)
            if (lote.length < this.tamanhoLote) return
        }
    }
}

function relatorioInvalido(): DomainError {
    return new DomainError('relatorio_invalido', 'Relatório não encontrado.')
}

/**
 * Parâmetros da URL ou do payload da action como texto. Só valores escalares
 * passam: um array (`?de=a&de=b`) ou objeto não é um filtro válido.
 */
function paraParametros(entrada: Record<string, unknown>): Record<string, string | undefined> {
    const parametros: Record<string, string | undefined> = {}
    for (const [chave, valor] of Object.entries(entrada)) {
        if (typeof valor === 'string') parametros[chave] = valor
        else if (typeof valor === 'number' || typeof valor === 'boolean') parametros[chave] = String(valor)
    }
    return parametros
}

/**
 * Erros de domínio lançados pelas consultas (ex.: base de auditoria fora do
 * ar) viram falha tipada; o resto — bug — continua sendo exceção.
 */
async function capturarErroDeDominio<T>(executar: () => Promise<T>): Promise<Result<T, DomainError>> {
    try {
        return ok(await executar())
    } catch (erro) {
        if (erro instanceof DomainError) return falha(erro)
        throw erro
    }
}
