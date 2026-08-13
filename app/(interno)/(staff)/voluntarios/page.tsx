import { HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import { normalizarPaginacao } from '@/src/shared/paginacao/esquema'
import { chaveVoluntarios } from '@/src/shared/query'
import { estadoHidratado } from '@/src/shared/query/hidratacao'
import {
    listarVoluntarios,
    type StatusVoluntarioFiltro
} from '@/src/modules/voluntariado/presentation/queries/candidaturas'
import { listarHabilidades } from '@/src/modules/voluntariado/presentation/queries/lookups'
import { TabelaVoluntarios } from './tabela-voluntarios'

export const metadata: Metadata = {
    title: 'Voluntários — SOS Jaraguá'
}

const STATUS_VALIDOS = ['pendente', 'aprovado', 'rejeitado'] as const

type Props = {
    searchParams: Promise<{ page?: string; pageSize?: string; status?: string; habilidade?: string }>
}

/** VOL-12 — base de voluntários com paginação server-side e filtros. */
export default function VoluntariosPage({ searchParams }: Props) {
    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Voluntários</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Base cadastral, filtrável por status e habilidade.
                </p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={6} />}>
                <Conteudo searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

/**
 * Primeira página resolvida no servidor e hidratada no cache do cliente com a
 * mesma `queryKey` do `useQuery` — filtros incluídos, senão abrir a tela já
 * filtrada dispararia um POST redundante (L-05.2).
 */
async function Conteudo({ searchParams }: Props) {
    const params = await searchParams

    const status = STATUS_VALIDOS.includes(params.status as StatusVoluntarioFiltro)
        ? (params.status as StatusVoluntarioFiltro)
        : undefined
    const filtros = { status, habilidadeId: params.habilidade }
    const consulta = { ...normalizarPaginacao(params), ...filtros }

    const [pagina, habilidades] = await Promise.all([listarVoluntarios(consulta), listarHabilidades()])

    return (
        <HydrationBoundary state={estadoHidratado([{ chave: chaveVoluntarios(consulta), dados: pagina }])}>
            <TabelaVoluntarios habilidades={habilidades} filtros={filtros} />
        </HydrationBoundary>
    )
}
