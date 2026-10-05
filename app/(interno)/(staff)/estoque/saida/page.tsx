import type { Metadata } from 'next'
import { SaidaForm } from './saida-form'

export const metadata: Metadata = {
    title: 'Saída de itens — SOS Jaraguá'
}

/**
 * BR-EST-04 / DESIGN.md §9.3 — saída de itens avulsos ou kits (EST-09).
 *
 * Sem leitura no servidor: itens e kits são escolhidos por Lookup (021), que
 * busca sob demanda — a tela não carrega mais o catálogo inteiro para montar
 * selects, e por isso também não precisa de `Suspense`.
 */
export default function SaidaPage() {
    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Saída de itens</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Registre a entrega à população. Saídas de kit deduzem cada componente da receita.
                </p>
            </header>

            <SaidaForm />
        </div>
    )
}
