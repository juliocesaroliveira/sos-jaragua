import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import { inventarioParaExportacao, saidasParaExportacao } from '@/src/modules/estoque/presentation/queries/estoque'
import { PainelRelatorios } from './painel-relatorios'

export const metadata: Metadata = {
    title: 'Relatórios — SOS Jaraguá'
}

/** BR-REL-01 (REL-03) + BR-CON-01 (CON-02). */
export default function RelatoriosPage() {
    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Relatórios</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Inventário e histórico de saídas para prestação de contas, em CSV ou XLSX.
                </p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={6} />}>
                <Conteudo />
            </Suspense>
        </div>
    )
}

async function Conteudo() {
    const [inventario, saidas] = await Promise.all([inventarioParaExportacao(), saidasParaExportacao()])
    return <PainelRelatorios inventario={inventario} saidas={saidas} />
}
