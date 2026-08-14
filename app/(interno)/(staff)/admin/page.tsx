import { HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import { exigirAcessoA } from '@/src/shared/auth/sessao'
import { normalizarPaginacao } from '@/src/shared/paginacao/esquema'
import { chaveUsuarios } from '@/src/shared/query'
import { estadoHidratado } from '@/src/shared/query/hidratacao'
import { listarUsuarios } from '@/src/modules/identidade/presentation/queries/usuarios'
import { TabelaUsuarios } from './tabela-usuarios'

export const metadata: Metadata = {
    title: 'Usuários — SOS Jaraguá'
}

/**
 * O segmento lê sessão para a checagem granular de role (linha abaixo), então
 * não é prerenderizável — mesmo racional de `(staff)/layout.tsx`.
 */
export const instant = false

type Props = {
    searchParams: Promise<{ page?: string; pageSize?: string }>
}

/**
 * Gestão de Usuários (006-user-management-page) — restrita a `administrador`.
 *
 * `(staff)/layout.tsx` já exige sessão + `ROLES_STAFF`; `exigirAcessoA`
 * estreita para `administrador`, a partir da regra já existente em
 * `REGRAS_DE_ROTA['/admin']` (defesa em profundidade, contracts/gestao-usuarios.md A-01).
 */
export default async function AdminPage({ searchParams }: Props) {
    await exigirAcessoA('/admin')

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Usuários</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Todas as contas cadastradas no sistema.
                </p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={6} />}>
                <Conteudo searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

/**
 * Resolve a primeira página no servidor e a entrega já no cache do cliente
 * (007-datatable-server-pagination, L-05). A chave usa os parâmetros **da
 * URL** — fixá-los numa constante faria `?pageSize=5` hidratar uma chave que o
 * `useQuery` não procura, disparando um POST redundante no primeiro render.
 */
async function Conteudo({ searchParams }: Props) {
    const params = normalizarPaginacao(await searchParams)
    const pagina = await listarUsuarios(params)

    return (
        <HydrationBoundary state={estadoHidratado([{ chave: chaveUsuarios(params), dados: pagina }])}>
            <TabelaUsuarios />
        </HydrationBoundary>
    )
}
