'use client'

import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { TAMANHO_PAGINA_PADRAO, type TamanhoPagina } from '@/src/shared/paginacao/constantes'
import type { PaginaDe, ParametrosPaginacao } from '@/src/shared/paginacao/esquema'
import type { ResultadoAction } from '@/src/shared/kernel'

/**
 * Irmão de `useListagemPaginada` com a página em estado local, não na URL
 * (021-componente-lookup, research R3).
 *
 * Existe para listagens que vivem dentro de outra tela — a tabela do diálogo
 * do Lookup. Escrever `page` na URL de um formulário faria um recarregamento
 * reabrir a paginação de um diálogo fechado, e dois Lookups na mesma tela
 * disputariam os mesmos parâmetros. O resto do contrato é o mesmo: envelope
 * `ResultadoAction` vira exceção, página anterior fica em tela durante a troca.
 */
export function useListagemLocal<T, F extends Record<string, unknown> = Record<string, never>>({
    chave,
    buscar,
    filtros,
    pageSizeInicial = TAMANHO_PAGINA_PADRAO,
    habilitado = true
}: {
    chave: (params: ParametrosPaginacao & F) => readonly unknown[]
    buscar: (entrada: ParametrosPaginacao & F) => Promise<ResultadoAction<PaginaDe<T>>>
    filtros?: F
    pageSizeInicial?: TamanhoPagina
    habilitado?: boolean
}) {
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState<number>(pageSizeInicial)

    /**
     * Filtro novo volta à primeira página (FR-007): a página 4 de "todos os
     * itens" raramente existe para "água". Ajuste de estado durante o render,
     * e não em efeito, para não buscar uma vez com a página antiga.
     */
    const assinaturaFiltros = JSON.stringify(filtros ?? {})
    const [filtrosAnteriores, setFiltrosAnteriores] = useState(assinaturaFiltros)
    if (filtrosAnteriores !== assinaturaFiltros) {
        setFiltrosAnteriores(assinaturaFiltros)
        setPage(1)
    }

    const params = { page, pageSize, ...((filtros ?? {}) as F) }

    const query = useQuery({
        queryKey: chave(params),
        queryFn: async () => {
            const resultado = await buscar(params)
            if (!resultado.ok) throw new Error(resultado.erro.mensagem)
            return resultado.valor
        },
        enabled: habilitado,
        placeholderData: keepPreviousData
    })

    const pagina = query.data

    return {
        rows: pagina?.rows ?? [],
        totalCount: pagina?.totalCount ?? 0,
        carregando: query.isPending,
        atualizando: query.isPlaceholderData || query.isFetching,
        erro: query.error,
        refetch: query.refetch,
        paginacao: {
            page: pagina?.page ?? page,
            pageSize: pagina?.pageSize ?? pageSize,
            totalCount: pagina?.totalCount ?? 0,
            onPageChange: setPage,
            onPageSizeChange: (tamanho: TamanhoPagina) => {
                setPageSize(tamanho)
                setPage(1)
            }
        }
    }
}
