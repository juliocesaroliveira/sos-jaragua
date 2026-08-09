import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import { listarCandidaturasPendentes } from '@/src/modules/voluntariado/presentation/queries/candidaturas'
import { FilaTriagem } from './fila-triagem'

export const metadata: Metadata = {
    title: 'Cadastros pendentes — SOS Jaraguá'
}

/** BR-VOL-01/02 — fila de triagem de candidaturas (VOL-04). */
export default function CadastrosPendentesPage() {
    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Cadastros pendentes</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Candidaturas aguardando triagem, da mais antiga para a mais recente.
                </p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={4} altura="h-24" />}>
                <Fila />
            </Suspense>
        </div>
    )
}

async function Fila() {
    const candidaturas = await listarCandidaturasPendentes()
    return <FilaTriagem candidaturas={candidaturas} />
}
