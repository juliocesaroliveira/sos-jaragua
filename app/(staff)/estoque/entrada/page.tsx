import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import { listarKitsComReceita } from '@/src/modules/estoque/presentation/queries/estoque'
import { EntradaForm } from './entrada-form'

export const metadata: Metadata = {
    title: 'Entrada de doações — SOS Jaraguá'
}

/** BR-EST-01 / DESIGN.md §9.1 — recebimento de materiais (EST-04). */
export default function EntradaPage() {
    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Entrada de doações</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Registre os materiais recebidos no centro de distribuição.
                </p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={6} altura="h-16" />}>
                <Formulario />
            </Suspense>
        </div>
    )
}

async function Formulario() {
    const kits = await listarKitsComReceita(true)
    return <EntradaForm kits={kits.map((k) => ({ id: k.id, nome: k.nome }))} />
}
