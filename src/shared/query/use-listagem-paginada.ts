'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useParametrosListagem } from '@/src/shared/paginacao'
import type { PaginaDe, ParametrosPaginacao } from '@/src/shared/paginacao'
import type { ResultadoAction } from '@/src/shared/kernel'

/**
 * Liga uma listagem paginada à sua Server Function de leitura
 * (007-datatable-server-pagination, L-04).
 *
 * Existe para que as quatro telas de listagem compartilhem exatamente o mesmo
 * comportamento — antes cada uma reimplementava `navegar()` e montava o
 * `Pagination` à mão, e a menor divergência entre elas já era invisível na
 * revisão.
 *
 * Sem prefetch das páginas vizinhas: Server Actions são POST e o Next as
 * serializa, então um prefetch especulativo competiria com a navegação real do
 * usuário (L-04.4).
 */
export function useListagemPaginada<T, F extends Record<string, unknown> = Record<string, never>>({
    chave,
    buscar,
    filtros,
    prefixo
}: {
    /** Construtor de `queryKey` — precisa espelhar a `cacheTag` do servidor. */
    chave: (params: ParametrosPaginacao & F) => readonly unknown[]
    buscar: (entrada: ParametrosPaginacao & F) => Promise<ResultadoAction<PaginaDe<T>>>
    filtros?: F
    /** Distingue duas tabelas paginadas na mesma rota (abas de `/relatorios`). */
    prefixo?: string
}) {
    const { page, pageSize, irParaPagina, definirTamanhoPagina, navegar } = useParametrosListagem(prefixo)
    const params = { page, pageSize, ...((filtros ?? {}) as F) }

    const query = useQuery({
        queryKey: chave(params),
        queryFn: async () => {
            const resultado = await buscar(params)
            // O envelope `ResultadoAction` não lança; o TanStack Query precisa
            // de uma exceção para tratar como erro e habilitar o `refetch`.
            if (!resultado.ok) throw new Error(resultado.erro.mensagem)
            return resultado.valor
        },
        // Manter a página anterior em tela evita o skeleton a cada clique e é o
        // que faz o rodapé permanecer montado durante a troca (FR-013/FR-020).
        // A primeira página vem hidratada do Server Component (L-05), com a
        // mesma queryKey — por isso não há `initialData` aqui: ele valeria para
        // toda chave, inclusive as das páginas seguintes.
        placeholderData: keepPreviousData
    })

    const pagina = query.data

    return {
        rows: pagina?.rows ?? [],
        totalCount: pagina?.totalCount ?? 0,
        /** Só no primeiro carregamento — trocas de página usam `atualizando`. */
        carregando: query.isPending,
        atualizando: query.isPlaceholderData || query.isFetching,
        erro: query.error,
        refetch: query.refetch,
        navegar,
        paginacao: {
            // `pagina.page` e não `page`: se o servidor corrigiu a entrada, o
            // rodapé precisa anunciar a página que está de fato em tela.
            page: pagina?.page ?? page,
            pageSize: pagina?.pageSize ?? pageSize,
            totalCount: pagina?.totalCount ?? 0,
            onPageChange: irParaPagina,
            onPageSizeChange: definirTamanhoPagina
        }
    }
}
