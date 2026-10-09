import type { z } from '@/src/shared/validacao/zod-ptbr'
import { ValidacaoError, falha, ok, type Result } from '@/src/shared/kernel'
import {
    DESCRICOES_RELATORIO,
    type CampoFiltro,
    type DescricaoRelatorio,
    type OpcaoFiltro,
    type SlugRelatorio
} from '../domain/catalogo'
import { hojeEmSaoPaulo, intervaloUtc, validarPeriodo, type IntervaloUtc, type Periodo } from '../domain/periodo'
import type { AlteracaoCampo } from '../domain/diff-auditoria'
import type { Coluna } from '../infrastructure/planilha'

/**
 * Definição de um relatório (specs/023-central-relatorios, research D2,
 * data-model.md §1).
 *
 * **Uma definição alimenta a prévia e a exportação.** Antes desta feature, as
 * colunas da tela e as da planilha eram declaradas duas vezes e já tinham
 * divergido. Aqui as colunas são uma lista só: a prévia recebe as células já
 * formatadas no servidor (funções não atravessam a fronteira com o cliente) e
 * a planilha recebe as mesmas células.
 */

export type Celula = string | number | null

export type ItemResumo = { rotulo: string; valor: string | number }

export type FiltroDescrito = { rotulo: string; valor: string }

/** Diferença de um campo na trilha de auditoria (R-17) — regra em `domain/diff-auditoria.ts`. */
export type { AlteracaoCampo }

export type LinhaRelatorio = { celulas: Celula[]; detalhe?: AlteracaoCampo[] }

/** O que cada consulta recebe: filtros já validados e o período resolvido. */
export type ConsultaRelatorio<F> = {
    filtros: F
    /** `null` em relatórios sem período (FR-005). */
    periodo: Periodo | null
    intervalo: IntervaloUtc | null
    /** Data civil de hoje em Brasília — base de validades e prazos. */
    hoje: string
    agora: Date
}

export type Janela = { limite: number; deslocamento: number }

export type DefinicaoRelatorio<F, L> = {
    slug: SlugRelatorio
    camposFiltro: readonly CampoFiltro[]
    /**
     * Converte os parâmetros da URL nos filtros do relatório. Filtro opcional
     * inválido deve virar ausente (`.catch(undefined)`) — a URL é editável e um
     * valor velho não pode derrubar o relatório. Filtro com regra própria (ex.:
     * horizonte de 1 a 365 dias) pode falhar: a mensagem vai para o campo.
     */
    esquemaFiltros: z.ZodType<F>
    colunas: readonly Coluna<L>[]
    contar(consulta: ConsultaRelatorio<F>): Promise<number>
    /** Sempre paginado: a prévia pede uma página, a exportação pede lotes. */
    carregar(consulta: ConsultaRelatorio<F>, janela: Janela): Promise<L[]>
    resumo?(consulta: ConsultaRelatorio<F>): Promise<ItemResumo[]>
    detalhe?(linha: L): AlteracaoCampo[]
    /**
     * Filtros aplicados em pt-BR, para o cabeçalho do arquivo (FR-008). Recebe
     * as opções dinâmicas para escrever "Habilidade: Embarcação", não o id.
     */
    descreverFiltros(filtros: F, opcoes: Record<string, OpcaoFiltro[]>): FiltroDescrito[]
    /** Opções que dependem do banco (habilidades, atividades, autores…). */
    opcoesFiltros?(): Promise<Record<string, OpcaoFiltro[]>>
}

/** Identidade tipada: preserva a inferência de `F` e `L` sem anotação manual. */
export function definirRelatorio<F, L>(definicao: DefinicaoRelatorio<F, L>): DefinicaoRelatorio<F, L> {
    return definicao
}

/** Uma consulta pronta para executar, com os filtros já validados e capturados. */
export type ConsultaPreparada = {
    periodo: Periodo | null
    /** Só a exportação precisa — e só ela paga a leitura das opções dinâmicas. */
    descreverFiltros(): Promise<FiltroDescrito[]>
    contar(): Promise<number>
    linhas(janela: Janela): Promise<LinhaRelatorio[]>
    resumo(): Promise<ItemResumo[]>
}

/**
 * Relatório no registro, com `F` e `L` apagados.
 *
 * O registro guarda relatórios de tipos diferentes lado a lado; em vez de
 * `DefinicaoRelatorio<any, any>`, `registrar` fecha a definição em funções que
 * só falam de tipos comuns (`Celula`, `LinhaRelatorio`). Quem chama nunca vê
 * `F` nem `L`, e nenhum `any` é necessário.
 */
export type RelatorioRegistrado = DescricaoRelatorio & {
    camposFiltro: readonly CampoFiltro[]
    colunas: readonly { cabecalho: string; largura?: number }[]
    preparar(parametros: Record<string, string | undefined>, agora: Date): Result<ConsultaPreparada, ValidacaoError>
    opcoesFiltros(): Promise<Record<string, OpcaoFiltro[]>>
}

export function registrar<F, L>(definicao: DefinicaoRelatorio<F, L>): RelatorioRegistrado {
    const descricao = DESCRICOES_RELATORIO[definicao.slug]

    function formatar(linha: L): LinhaRelatorio {
        const celulas = definicao.colunas.map((c) => c.valor(linha) ?? null)
        const detalhe = definicao.detalhe?.(linha)
        return detalhe && detalhe.length > 0 ? { celulas, detalhe } : { celulas }
    }

    return {
        ...descricao,
        camposFiltro: definicao.camposFiltro,
        colunas: definicao.colunas.map(({ cabecalho, largura }) => ({ cabecalho, largura })),

        preparar(parametros, agora) {
            let periodo: Periodo | null = null
            if (descricao.usaPeriodo) {
                const resultado = validarPeriodo({ de: parametros.de, ate: parametros.ate }, agora)
                if (!resultado.ok) {
                    return falha(new ValidacaoError(resultado.erro, { campos: { [resultado.campo]: resultado.erro } }))
                }
                periodo = resultado.periodo
            }

            const filtros = definicao.esquemaFiltros.safeParse(parametros)
            if (!filtros.success) {
                const campos: Record<string, string> = {}
                for (const problema of filtros.error.issues) {
                    const campo = String(problema.path[0] ?? 'filtros')
                    campos[campo] ??= problema.message
                }
                return falha(new ValidacaoError(Object.values(campos)[0] ?? 'Filtro inválido.', { campos }))
            }

            const consulta: ConsultaRelatorio<F> = {
                filtros: filtros.data,
                periodo,
                intervalo: periodo ? intervaloUtc(periodo) : null,
                hoje: hojeEmSaoPaulo(agora),
                agora
            }

            return ok({
                periodo,
                descreverFiltros: async () =>
                    definicao.descreverFiltros(
                        filtros.data,
                        definicao.opcoesFiltros ? await definicao.opcoesFiltros() : {}
                    ),
                contar: () => definicao.contar(consulta),
                linhas: async (janela) => (await definicao.carregar(consulta, janela)).map(formatar),
                resumo: async () => (definicao.resumo ? definicao.resumo(consulta) : [])
            })
        },

        opcoesFiltros: async () => (definicao.opcoesFiltros ? definicao.opcoesFiltros() : {})
    }
}

/**
 * Para relatórios pequenos e agregados (capacidade, demanda de kits, estoque
 * crítico): a consulta devolve tudo e a página é recortada em memória.
 */
/** Rótulo da opção escolhida num filtro dinâmico; o próprio valor se a opção sumiu. */
export function rotuloDaOpcao(opcoes: Record<string, OpcaoFiltro[]>, campo: string, valor: string): string {
    return opcoes[campo]?.find((o) => o.valor === valor)?.rotulo ?? valor
}

export function recortar<T>(linhas: T[], { limite, deslocamento }: Janela): T[] {
    return linhas.slice(deslocamento, deslocamento + limite)
}
