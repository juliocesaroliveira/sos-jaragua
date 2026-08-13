import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import { exigirAcessoA } from '@/src/shared/auth/sessao'
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

const TAMANHO_PAGINA = 20

type Props = {
    searchParams: Promise<{ page?: string }>
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

async function Conteudo({ searchParams }: Props) {
    const params = await searchParams
    const page = Math.max(1, Number(params.page) || 1)

    const { rows, totalCount } = await listarUsuarios({ page, pageSize: TAMANHO_PAGINA })

    return <TabelaUsuarios rows={rows} totalCount={totalCount} page={page} pageSize={TAMANHO_PAGINA} />
}
