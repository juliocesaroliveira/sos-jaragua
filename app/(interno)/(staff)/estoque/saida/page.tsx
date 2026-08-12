import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import { listarItens, listarKitsComReceita } from '@/src/modules/estoque/presentation/queries/estoque'
import { SaidaForm } from './saida-form'

export const metadata: Metadata = {
    title: 'Saída de itens — SOS Jaraguá'
}

/** BR-EST-04 / DESIGN.md §9.3 — saída de itens avulsos ou kits (EST-09). */
export default function SaidaPage() {
    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Saída de itens</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Registre a entrega à população. Saídas de kit deduzem cada componente da receita.
                </p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={5} altura="h-16" />}>
                <Formulario />
            </Suspense>
        </div>
    )
}

async function Formulario() {
    const [itens, kits] = await Promise.all([listarItens(), listarKitsComReceita(true)])
    return <SaidaForm itens={itens} kits={kits} />
}
