import type { ReactNode } from 'react'
import { cn } from '../cn'

/**
 * StatCard — componente próprio (DESIGN_SYSTEM.md §4.12), usado nos indicadores
 * do dashboard (BR-INT-02: "Kits Necessários" e "Kits Possíveis").
 *
 * O valor é o elemento dominante do card: quem lê está sob estresse e precisa
 * do número, não da decoração.
 */
export type TomStatCard = 'neutral' | 'success' | 'warning' | 'danger' | 'primary'

const TOM_VALOR: Record<TomStatCard, string> = {
    neutral: 'text-foreground',
    primary: 'text-primary-600 dark:text-primary-400',
    success: 'text-success-700 dark:text-success-400',
    warning: 'text-warning-700 dark:text-warning-400',
    danger: 'text-danger-700 dark:text-danger-400'
}

export interface StatCardProps {
    label: string
    valor: string | number
    /** Ex.: "kits", "famílias" — unidade ao lado do número. */
    unidade?: string
    apoio?: string
    icone?: ReactNode
    tom?: TomStatCard
    /** Conteúdo extra abaixo do valor (ex.: um `Progress`). */
    children?: ReactNode
}

export function StatCard({ label, valor, unidade, apoio, icone, tom = 'neutral', children }: StatCardProps) {
    return (
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <header className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{label}</h3>
                {icone && <span className="text-neutral-400">{icone}</span>}
            </header>
            <p className="flex items-baseline gap-1.5">
                <span className={cn('text-3xl font-bold tracking-tight md:text-4xl', TOM_VALOR[tom])}>{valor}</span>
                {unidade && <span className="text-sm text-neutral-500 dark:text-neutral-400">{unidade}</span>}
            </p>
            {apoio && <p className="text-sm text-neutral-500 dark:text-neutral-400">{apoio}</p>}
            {children}
        </section>
    )
}
