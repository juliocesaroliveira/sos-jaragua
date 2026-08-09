import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import { listarAtividades } from '@/src/modules/voluntariado/presentation/queries/atividades'
import { listarCategoriasAtividade } from '@/src/modules/voluntariado/presentation/queries/lookups'
import { GestaoAtividades } from './gestao-atividades'

export const metadata: Metadata = {
    title: 'Atividades — SOS Jaraguá'
}

/** BRD §3.3 — cadastro e acompanhamento de atividades (VOL-08/09). */
export default function AtividadesPage() {
    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Atividades</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Necessidades de campo e suas escalas de voluntários.
                </p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={4} altura="h-24" />}>
                <Lista />
            </Suspense>
        </div>
    )
}

async function Lista() {
    const [atividades, categorias] = await Promise.all([listarAtividades(), listarCategoriasAtividade()])
    return <GestaoAtividades atividades={atividades} categorias={categorias} />
}
