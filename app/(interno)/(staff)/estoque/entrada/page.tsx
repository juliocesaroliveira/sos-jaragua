import type { Metadata } from 'next'
import { limiarEstoqueMinimoGlobal } from '@/src/shared/config/limiares-alerta'
import { EntradaForm } from './entrada-form'

export const metadata: Metadata = {
    title: 'Entrada de doações — SOS Jaraguá'
}

/**
 * BR-EST-01 / DESIGN.md §9.1 — recebimento de materiais (EST-04).
 *
 * Sem leitura no servidor: item e kit de destinação são escolhidos por Lookup
 * (021), que busca sob demanda — por isso a tela não precisa mais de `Suspense`.
 */
export default function EntradaPage() {
    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Entrada de doações</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Registre os materiais recebidos no centro de distribuição.
                </p>
            </header>

            {/* Para o texto de apoio do mínimo do item novo (feature 020). */}
            <EntradaForm limiarGlobal={limiarEstoqueMinimoGlobal()} />
        </div>
    )
}
