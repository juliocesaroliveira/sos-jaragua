import type { Classificacao } from './catalogo'
import type { Modo } from './grafo'

/**
 * Objetos de valor da prévia e da execução (data-model §4). Transitórios: vivem
 * durante a requisição e na tela, nunca no banco — a trilha de auditoria guarda
 * o resumo deles.
 */

export type AcaoDangerZone = 'resetar_tabela' | 'excluir_selecionados'

export type PedidoAcao = {
    acao: AcaoDangerZone
    tabela: string
    /** Só em `excluir_selecionados` (1..500). Chave composta serializada como `a|b`. */
    chaves?: readonly string[]
    /** Exigido quando há dependentes de histórico (FR-011). */
    modo?: Modo
}

/** Modo efetivo: sem dependentes de histórico, os dois modos dão o mesmo resultado. */
export type ModoEfetivo = Modo | 'sem_dependentes'

/**
 * Contagens por tabela e por vínculo — o critério de divergência entre prévia e
 * execução (FR-015, research D7).
 */
export type ImpressaoDigital = Record<string, { apagar: number; redirecionar: Record<string, number> }>

/** Uma tabela atingida, uma vez só na árvore. */
export type NoImpacto = {
    tabela: string
    rotulo: string
    /** 0 = a tabela escolhida; 1 = dependente direto; … */
    nivel: number
    /** Vínculo pelo qual foi alcançada primeiro (`filho.coluna → pai`); `null` na raiz. */
    via: string | null
    classificacao: Classificacao | null
    apagar: number
    redirecionar: number
}

export type Redirecionamento = {
    vinculo: string
    tabela: string
    coluna: string
    quantidade: number
    /** "vazio" ou o rótulo do registro padrão. */
    valorPadrao: string
}

export type RegistroPreservado = { tabela: string; descricao: string; motivo: string }

export type SaldoPrevisto = { itemId: string; item: string; atual: number; resultante: number; negativo: boolean }

export type Amostra = { tabela: string; itens: string[]; restante: number }

export type Ambiente = 'production' | 'preview' | 'development'

export type Previa = {
    pedido: PedidoAcao
    /** `null` enquanto a escolha cascata/preservação está pendente (FR-011). */
    modo: ModoEfetivo | null
    temDependentes: boolean
    /** Totais de cada opção, para o passo de escolha do modo (U-05 passo 2). */
    opcoes: { cascata: { apagar: number; alterar: number }; preservacao: { apagar: number; alterar: number } } | null
    arvore: NoImpacto[]
    /** Apagados em qualquer modo (FR-013). */
    inseparaveis: NoImpacto[]
    redirecionamentos: Redirecionamento[]
    preservados: RegistroPreservado[]
    saldos: SaldoPrevisto[]
    amostras: Amostra[]
    consequencias: string[]
    alertas: string[]
    ambiente: Ambiente
    totalApagar: number
    totalAlterar: number
    textoConfirmacao: string
    impressaoDigital: ImpressaoDigital
}

export type ResultadoExecucao = {
    execucaoId: string
    contagens: ImpressaoDigital
    saldos: SaldoPrevisto[]
    duracaoMs: number
    /** Para a invalidação de cache por id na apresentação (research D12). */
    invalidar: { atividades: string[]; usuarios: string[] }
}

/** Texto que o administrador precisa digitar exatamente (FR-014). */
export function textoConfirmacao(pedido: Pick<PedidoAcao, 'acao' | 'tabela' | 'chaves'>): string {
    return pedido.acao === 'resetar_tabela'
        ? `RESETAR ${pedido.tabela}`
        : `EXCLUIR ${pedido.chaves?.length ?? 0} DE ${pedido.tabela}`
}

function normalizar(impressao: ImpressaoDigital): string {
    const entradas = Object.entries(impressao)
        .map(([tabela, { apagar, redirecionar }]) => {
            const redir = Object.entries(redirecionar)
                .filter(([, n]) => n > 0)
                .sort(([a], [b]) => a.localeCompare(b))
            return [tabela, apagar, redir] as const
        })
        .filter(([, apagar, redir]) => apagar > 0 || redir.length > 0)
        .sort(([a], [b]) => a.localeCompare(b))
    return JSON.stringify(entradas)
}

/** Igualdade estrutural; contagem zero equivale a ausência. */
export function mesmasContagens(a: ImpressaoDigital, b: ImpressaoDigital): boolean {
    return normalizar(a) === normalizar(b)
}

/**
 * Há escolha a fazer? Só se algum dependente **de histórico** for atingido —
 * com apenas inseparáveis, cascata e preservação apagam exatamente o mesmo
 * (FR-011, análise U1).
 */
export function temDependentesHistoricos(arvore: readonly NoImpacto[]): boolean {
    return arvore.some((no) => no.classificacao === 'historico' && no.apagar + no.redirecionar > 0)
}

export const TAMANHO_AMOSTRA = 5

/** Amostra de até 5 rótulos, com o restante calculado sobre o total real. */
export function truncarAmostra(rotulos: readonly string[], total: number): { itens: string[]; restante: number } {
    const itens = rotulos.slice(0, TAMANHO_AMOSTRA)
    return { itens, restante: Math.max(0, total - itens.length) }
}
