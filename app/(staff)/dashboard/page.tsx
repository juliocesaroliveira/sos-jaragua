import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Painel — SOS Jaraguá'
}

/**
 * Painel de crise. Os indicadores "Kits Necessários"/"Kits Possíveis"
 * (BR-INT-01/BR-INT-02) são montados no módulo de Logística — ver LOG-06.
 */
export default function DashboardPage() {
    return (
        <div className="flex flex-col gap-6">
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Painel de crise</h1>
            <p className="text-base text-neutral-500 dark:text-neutral-400">
                Os indicadores de demanda e capacidade serão exibidos aqui.
            </p>
        </div>
    )
}
