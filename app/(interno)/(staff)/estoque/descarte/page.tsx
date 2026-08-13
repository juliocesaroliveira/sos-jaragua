import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import { listarItens } from '@/src/modules/estoque/presentation/queries/estoque'
import { DescarteForm } from './descarte-form'
import { exigirAcessoA } from '@/src/shared/auth/sessao'

export const metadata: Metadata = {
    title: 'Descarte — SOS Jaraguá'
}

/** BR-EST-05 / DESIGN.md §9.4 — baixa de estoque por descarte (EST-11). */
export default function DescartePage() {
    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Descarte</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Baixa de itens vencidos, avariados ou inutilizados.
                </p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={4} altura="h-16" />}>
                <Formulario />
            </Suspense>
        </div>
    )
}

async function Formulario() {
    // Checagem autoritativa: o `proxy.ts` deixa passar quando o cache de
    // sessão em cookie não está disponível, e `(staff)/layout.tsx` só exige
    // ROLES_STAFF (DESIGN.md §6.2).
    await exigirAcessoA('/estoque/descarte')

    const itens = await listarItens()
    return <DescarteForm itens={itens} />
}
