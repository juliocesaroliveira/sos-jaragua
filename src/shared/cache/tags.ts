/**
 * Catálogo único de `cacheTag`s (DESIGN.md §7).
 *
 * Toda leitura cacheada declara sua tag daqui e toda mutação invalida a partir
 * daqui — nunca com strings literais espalhadas, para que a relação
 * "quem invalida o quê" continue verificável em um único arquivo.
 *
 * Convenção: o `queryKey` do TanStack Query espelha a tag
 * (`estoque:itens` ↔ `['estoque', 'itens', ...]`, DESIGN.md §8).
 */
export const CACHE_TAGS = {
    /** Catálogo de itens — autocomplete da Entrada (BR-EST-01). */
    estoqueItens: 'estoque:itens',
    /** Saldo materializado por item. */
    estoqueSaldo: 'estoque:saldo',
    /** Listagem paginada de estoque (TanStack Table). */
    estoqueListagem: 'estoque:listagem',
    /** Receitas de kit — afetam a capacidade calculada no dashboard. */
    estoqueKits: 'estoque:kits',
    /** Indicadores "Kits Necessários"/"Kits Possíveis" (BR-INT-02). */
    dashboardKits: 'dashboard:kits',
    /** Fila de candidaturas com `status = 'pendente'` (BR-VOL-01). */
    voluntariadoPendentes: 'voluntariado:pendentes',
    /** Listagem paginada de voluntários. */
    voluntariadoListagem: 'voluntariado:listagem',
    /** Lista de atividades (CRUD do Coordenador). */
    atividades: 'atividades:lista',
    /** Tabelas lookup livres (habilidade, atividade_categoria). */
    lookups: 'lookups'
} as const

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS]

/** Kanban de uma atividade específica — tag por id (DESIGN.md §7). */
export function tagAtividade(atividadeId: string): string {
    return `atividades:${atividadeId}`
}

/** Notificações não lidas de um usuário específico. */
export function tagNotificacoesUsuario(userId: string): string {
    return `notificacoes:${userId}`
}
