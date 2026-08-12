import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import {
    listarVoluntarios,
    type StatusVoluntarioFiltro
} from '@/src/modules/voluntariado/presentation/queries/candidaturas'
import { listarHabilidades } from '@/src/modules/voluntariado/presentation/queries/lookups'
import { TabelaVoluntarios } from './tabela-voluntarios'

export const metadata: Metadata = {
    title: 'Voluntários — SOS Jaraguá'
}

const TAMANHO_PAGINA = 20
const STATUS_VALIDOS = ['pendente', 'aprovado', 'rejeitado'] as const

type Props = {
    searchParams: Promise<{ page?: string; status?: string; habilidade?: string }>
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

async function Conteudo({ searchParams }: Props) {
    const params = await searchParams

    const page = Math.max(1, Number(params.page) || 1)
    const status = STATUS_VALIDOS.includes(params.status as StatusVoluntarioFiltro)
        ? (params.status as StatusVoluntarioFiltro)
        : undefined

    const [{ rows, totalCount }, habilidades] = await Promise.all([
        listarVoluntarios({ page, pageSize: TAMANHO_PAGINA, status, habilidadeId: params.habilidade }),
        listarHabilidades()
    ])

    return (
        <TabelaVoluntarios
            rows={rows}
            totalCount={totalCount}
            page={page}
            pageSize={TAMANHO_PAGINA}
            habilidades={habilidades}
            filtros={{ status, habilidadeId: params.habilidade }}
        />
    )
}
