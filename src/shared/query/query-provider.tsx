'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

/**
 * Provider do TanStack Query (007-datatable-server-pagination, D4).
 *
 * A dependência já estava no `package.json` e a constituição já a exigia
 * ("Client-side data: TanStack Query + Server Actions"), mas nenhum
 * `QueryClient` existia no repositório — as listagens paginavam por navegação
 * de rota. Este provider é o que fecha essa lacuna.
 *
 * O cliente é criado dentro de `useState` e não em módulo: um `QueryClient` de
 * escopo de módulo seria compartilhado entre requisições no servidor, vazando
 * dados de um usuário para outro.
 *
 * Montado em `app/(interno)/layout.tsx`, não no layout raiz — `/login` e
 * `/cadastro` não paginam nada e não devem pagar o bundle.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // Voltar a uma página já visitada não deve piscar um
                        // estado de carregamento vazio (FR-020).
                        staleTime: 30_000,
                        gcTime: 5 * 60_000,
                        // Listagens operacionais não precisam refazer a busca a
                        // cada troca de janela — em campo isso só gasta rede.
                        refetchOnWindowFocus: false,
                        retry: 1
                    }
                }
            })
    )

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
