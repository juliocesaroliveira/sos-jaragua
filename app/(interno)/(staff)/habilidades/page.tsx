import { HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import { exigirAcessoA } from '@/src/shared/auth/sessao'
import { normalizarPaginacao } from '@/src/shared/paginacao'
import { chaveHabilidades } from '@/src/shared/query'
import { estadoHidratado } from '@/src/shared/query/hidratacao'
import { listarHabilidadesPaginado } from '@/src/modules/voluntariado/presentation/queries/habilidades'
import { TabelaHabilidades } from './tabela-habilidades'

export const metadata: Metadata = {
    title: 'Habilidades — SOS Jaraguá'
}

/**
 * O segmento lê sessão para a checagem granular de role, então não é
 * prerenderizável — mesmo racional de `(staff)/layout.tsx`.
 */
export const instant = false

type Props = {
    searchParams: Promise<{ page?: string; pageSize?: string }>
}

/**
 * Gestão de Habilidades (017-gestao-habilidades) — liberada a
 * `membro_defesa_civil`, `coordenador` e `administrador`.
 *
 * `(staff)/layout.tsx` já exige sessão + `ROLES_STAFF`; `exigirAcessoA` aplica
 * a regra específica de `REGRAS_DE_ROTA['/habilidades']` (defesa em
 * profundidade, contracts/ui-habilidades.md R-01.3).
 */
export default async function HabilidadesPage({ searchParams }: Props) {
    await exigirAcessoA('/habilidades')

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Habilidades</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Competências que os voluntários podem declarar na candidatura.
                </p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={6} />}>
                <Conteudo searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

/**
 * Resolve a primeira página no servidor e a entrega já no cache do cliente. A
 * chave usa os parâmetros **da URL** — fixá-los numa constante faria
 * `?pageSize=5` hidratar uma chave que o `useQuery` não procura, disparando um
 * POST redundante no primeiro render.
 */
async function Conteudo({ searchParams }: Props) {
    const params = normalizarPaginacao(await searchParams)
    const pagina = await listarHabilidadesPaginado(params)

    return (
        <HydrationBoundary state={estadoHidratado([{ chave: chaveHabilidades(params), dados: pagina }])}>
            <TabelaHabilidades />
        </HydrationBoundary>
    )
}
