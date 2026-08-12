import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import { listarItens, listarKitsComReceita } from '@/src/modules/estoque/presentation/queries/estoque'
import { GestaoKits } from './gestao-kits'

export const metadata: Metadata = {
    title: 'Kits — SOS Jaraguá'
}

/** BR-EST-02/BR-EST-03 — CRUD de kits e composição da receita (EST-06). */
export default function KitsPage() {
    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Kits</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Composição dos kits de sobrevivência e quantos são montáveis com o saldo atual.
                </p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={3} altura="h-32" />}>
                <Conteudo />
            </Suspense>
        </div>
    )
}

async function Conteudo() {
    const [kits, itens] = await Promise.all([listarKitsComReceita(), listarItens()])
    return <GestaoKits kits={kits} itens={itens} />
}
