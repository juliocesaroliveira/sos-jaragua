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
    /** Histórico de saídas paginado — aba "Saídas" de `/relatorios`. */
    estoqueSaidas: 'estoque:saidas',
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
    lookups: 'lookups',
    /**
     * Listagem paginada de habilidades (Gestão de Habilidades, `/habilidades`).
     *
     * Separada de `lookups` porque são dois consumidores com ciclos diferentes:
     * esta muda a cada operação da tela e é paginada; `lookups` alimenta o
     * formulário de candidatura e o filtro de alocação. Toda escrita de
     * habilidade invalida **as duas** — sem isso, uma habilidade recém-criada
     * não apareceria na candidatura (017, research.md D6).
     */
    habilidadesListagem: 'habilidades:listagem',
    /** Listagem paginada de contas (Gestão de Usuários, `/admin`). */
    identidadeListagem: 'identidade:listagem'
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
