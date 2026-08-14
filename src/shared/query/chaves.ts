import { CACHE_TAGS } from '@/src/shared/cache'
import type { ParametrosPaginacao } from '@/src/shared/paginacao'

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
export const RAIZ_SAIDAS = raizDe(CACHE_TAGS.estoqueSaidas)

/**
 * `pageSize` faz parte da chave tanto aqui quanto no `'use cache'` do servidor:
 * 5, 10, 20 e 50 são entradas de cache distintas (contrato L-03.2).
 */
export function chaveUsuarios(params: ParametrosPaginacao) {
    return [...RAIZ_USUARIOS, params] as const
}

export function chaveVoluntarios(params: ParametrosPaginacao & { status?: string; habilidadeId?: string }) {
    return [...RAIZ_VOLUNTARIOS, params] as const
}

export function chaveEstoque(params: ParametrosPaginacao & { categoria?: string }) {
    return [...RAIZ_ESTOQUE, params] as const
}

export function chaveSaidas(params: ParametrosPaginacao) {
    return [...RAIZ_SAIDAS, params] as const
}
