import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import { buscarAtividadeDetalhada } from '@/src/modules/voluntariado/presentation/queries/atividades'
import { listarVoluntariosAprovados } from '@/src/modules/voluntariado/presentation/queries/candidaturas'
import { listarHabilidades } from '@/src/modules/voluntariado/presentation/queries/lookups'
import { PainelEscala } from './painel-escala'

export const metadata: Metadata = {
    title: 'Escala da atividade — SOS Jaraguá'
}

type Props = {
    params: Promise<{ id: string }>
    searchParams: Promise<{ habilidade?: string }>
}

/** Painel Kanban/lista de turnos de uma atividade (VOL-11). */
export default function AtividadePage({ params, searchParams }: Props) {
    return (
        <div className="flex flex-col gap-6">
            <Suspense fallback={<SkeletonLista linhas={5} altura="h-20" />}>
                <Painel params={params} searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

async function Painel({ params, searchParams }: Props) {
    const { id } = await params
    const { habilidade } = await searchParams

    const atividade = await buscarAtividadeDetalhada(id)
    if (!atividade) notFound()

    const [voluntarios, habilidades] = await Promise.all([listarVoluntariosAprovados(habilidade), listarHabilidades()])

    return (
        <PainelEscala
            atividade={atividade}
            voluntarios={voluntarios}
            habilidades={habilidades}
            habilidadeSelecionada={habilidade}
        />
    )
}
