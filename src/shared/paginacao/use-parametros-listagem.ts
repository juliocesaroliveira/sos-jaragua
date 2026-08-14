'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { normalizarPaginacao, type ParametrosPaginacao } from './esquema'
import type { TamanhoPagina } from './constantes'

/**
 * Estado de listagem que vive na URL (007-datatable-server-pagination, D9).
 *
 * Substitui a função `navegar()` que estava duplicada em `tabela-usuarios`,
 * `tabela-voluntarios` e `tabela-estoque`. A URL é a fonte de verdade para que
 * a visão seja compartilhável e sobreviva a um recarregamento (FR-011).
 *
 * `replace` e não `push`: um clique de página não deve virar um passo no
 * histórico — sair da tela com "voltar" percorreria todas as páginas visitadas.
 * `scroll: false` mantém o rodapé sob o cursor de quem acabou de clicar nele.
 *
 * Um `prefixo` permite duas tabelas paginadas na mesma rota sem colisão
 * (é o caso das abas de `/relatorios`).
 */
export function useParametrosListagem(prefixo = '') {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const chavePage = prefixo ? `${prefixo}Page` : 'page'
    const chavePageSize = prefixo ? `${prefixo}PageSize` : 'pageSize'

    const paginacao: ParametrosPaginacao = useMemo(
        () =>
            normalizarPaginacao({
                page: searchParams.get(chavePage) ?? undefined,
                pageSize: searchParams.get(chavePageSize) ?? undefined
            }),
        [searchParams, chavePage, chavePageSize]
    )

    const navegar = useCallback(
        (mudancas: Record<string, string | undefined>) => {
            const params = new URLSearchParams(searchParams.toString())
            for (const [chave, valor] of Object.entries(mudancas)) {
                if (valor) params.set(chave, valor)
                else params.delete(chave)
            }
            const query = params.toString()
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        },
        [router, pathname, searchParams]
    )

    /** Troca de página preserva `pageSize` e todos os filtros da URL (FR-019). */
    const irParaPagina = useCallback(
        (page: number) => navegar({ [chavePage]: page > 1 ? String(page) : undefined }),
        [navegar, chavePage]
    )

    /** Trocar o tamanho volta para a primeira página (FR-005). */
    const definirTamanhoPagina = useCallback(
        (pageSize: TamanhoPagina) =>
            navegar({
                [chavePage]: undefined,
                [chavePageSize]: String(pageSize)
            }),
        [navegar, chavePage, chavePageSize]
    )

    return { ...paginacao, navegar, irParaPagina, definirTamanhoPagina }
}
