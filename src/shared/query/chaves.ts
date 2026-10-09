import { CACHE_TAGS } from '@/src/shared/cache'
import type { ParametrosPaginacao } from '@/src/shared/paginacao/esquema'

/**
 * `queryKey`s do TanStack Query espelhando o catálogo de `cacheTag`
 * (`estoque:listagem` ↔ `['estoque','listagem', …]`) — convenção declarada em
 * `src/shared/cache/tags.ts` e finalmente exercida em
 * 007-datatable-server-pagination.
 *
 * Manter o espelho importa porque a mesma escrita precisa invalidar os dois
 * caches: `updateTag(CACHE_TAGS.x)` no servidor e `invalidateQueries` no
 * cliente. Derivar a chave da tag torna impossível os dois divergirem.
 */
function raizDe(tag: string): string[] {
    return tag.split(':')
}

/** Raízes usadas em `invalidateQueries` — invalidam todas as páginas/filtros. */
export const RAIZ_USUARIOS = raizDe(CACHE_TAGS.identidadeListagem)
export const RAIZ_VOLUNTARIOS = raizDe(CACHE_TAGS.voluntariadoListagem)
export const RAIZ_ESTOQUE = raizDe(CACHE_TAGS.estoqueListagem)
export const RAIZ_HABILIDADES = raizDe(CACHE_TAGS.habilidadesListagem)

/**
 * `pageSize` faz parte da chave tanto aqui quanto no `'use cache'` do servidor:
 * 5, 10, 20 e 50 são entradas de cache distintas (contrato L-03.2).
 */
export function chaveUsuarios(params: ParametrosPaginacao) {
    return [...RAIZ_USUARIOS, params] as const
}

export function chaveHabilidades(params: ParametrosPaginacao) {
    return [...RAIZ_HABILIDADES, params] as const
}

export function chaveVoluntarios(params: ParametrosPaginacao & { status?: string; habilidadeId?: string }) {
    return [...RAIZ_VOLUNTARIOS, params] as const
}

export function chaveEstoque(params: ParametrosPaginacao & { categoria?: string }) {
    return [...RAIZ_ESTOQUE, params] as const
}

/**
 * Sino de notificações (012-notificacoes-tempo-real).
 *
 * **Duas divergências deliberadas** em relação às chaves acima:
 *
 * 1. **Não deriva de `CACHE_TAGS`.** Notificações são por-usuário e nunca são
 *    cacheadas no servidor (DESIGN.md §7), então não existe — e não deve
 *    existir — uma `cacheTag` correspondente para espelhar. A convenção de
 *    espelho vale para o que é cacheado; forçá-la aqui exigiria criar uma tag
 *    que ninguém pode usar.
 * 2. **Não inclui `userId`.** O destinatário é decidido pela sessão no
 *    servidor; colocá-lo na chave sugeriria que o cliente escolhe de quem são
 *    as notificações, que é exatamente o que o endpoint proíbe. O isolamento
 *    entre usuários vem do `QueryClient` ser por aba, não da chave.
 */
export function chaveNotificacoes() {
    return ['notificacoes'] as const
}

/**
 * Prévia de um relatório da central (023-central-relatorios, research D5).
 *
 * Também não deriva de `CACHE_TAGS`: relatórios não são cacheados no servidor
 * (FR-009), então não há tag para espelhar. `params` traz a página e os
 * filtros da URL — o mesmo objeto que a página hidrata no servidor, para a
 * primeira página não gerar um POST redundante.
 */
export const RAIZ_RELATORIOS = ['relatorios'] as const

export function chaveRelatorio(slug: string, params: Record<string, unknown>) {
    return [...RAIZ_RELATORIOS, slug, params] as const
}

/**
 * Sugestões e páginas do componente Lookup (021-componente-lookup).
 *
 * Também não deriva de `CACHE_TAGS`: as leituras do Lookup não são cacheadas
 * no servidor (o termo muda a cada tecla), então não há tag para espelhar. O
 * que o cliente precisa é invalidar **todos** os Lookups abertos depois de uma
 * escrita que mexe em saldo ou cadastro — por isso uma raiz única, `['lookup']`
 * (contracts/leituras-lookup.md L-07). `fonte` separa itens de kits.
 */
export const RAIZ_LOOKUP = ['lookup'] as const

export function chaveLookup(fonte: string, tipo: 'sugestoes' | 'pagina', params: Record<string, unknown>) {
    return [...RAIZ_LOOKUP, fonte, tipo, params] as const
}
