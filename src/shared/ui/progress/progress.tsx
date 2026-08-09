'use client'

import { Progress as Ark } from '@ark-ui/react/progress'
import { cn } from '../cn'

/**
 * Progress/ProgressCircle sobre o primitivo Ark (DESIGN_SYSTEM.md §4.12).
 * Uso: percentual de capacidade atendida ("Kits Possíveis" × "Kits
 * Necessários", BR-INT-02).
 */
export type TomProgresso = 'primary' | 'success' | 'warning' | 'danger'

const TOM_BARRA: Record<TomProgresso, string> = {
    primary: 'bg-primary-600 dark:bg-primary-500',
    success: 'bg-success-600 dark:bg-success-500',
    warning: 'bg-warning-500',
    danger: 'bg-danger-600 dark:bg-danger-500'
}

const TOM_TRACO: Record<TomProgresso, string> = {
    primary: 'stroke-primary-600 dark:stroke-primary-500',
    success: 'stroke-success-600 dark:stroke-success-500',
    warning: 'stroke-warning-500',
    danger: 'stroke-danger-600 dark:stroke-danger-500'
}

export interface ProgressProps {
    label: string
    value: number
    max?: number
    tom?: TomProgresso
    /** Exibe o valor formatado ao lado do rótulo. */
    mostrarValor?: boolean
}

export function Progress({ label, value, max = 100, tom = 'primary', mostrarValor = true }: ProgressProps) {
    return (
        <Ark.Root value={value} max={max} className="flex w-full flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
                <Ark.Label className="text-sm font-medium text-foreground">{label}</Ark.Label>
                {mostrarValor && <Ark.ValueText className="text-sm text-neutral-500 dark:text-neutral-400" />}
            </div>
            <Ark.Track className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <Ark.Range className={cn('h-full rounded-full transition-[width]', TOM_BARRA[tom])} />
            </Ark.Track>
        </Ark.Root>
    )
}

export interface ProgressCircleProps {
    label: string
    value: number
    max?: number
    tom?: TomProgresso
    tamanho?: number
}

export function ProgressCircle({ label, value, max = 100, tom = 'primary', tamanho = 96 }: ProgressCircleProps) {
    return (
        <Ark.Root value={value} max={max} className="flex flex-col items-center gap-2">
            <div className="relative" style={{ width: tamanho, height: tamanho }}>
                <Ark.Circle
                    className="size-full -rotate-90"
                    style={{ '--size': `${tamanho}px`, '--thickness': '8px' } as React.CSSProperties}
                >
                    <Ark.CircleTrack className="stroke-neutral-200 dark:stroke-neutral-800" />
                    <Ark.CircleRange className={TOM_TRACO[tom]} />
                </Ark.Circle>
                <Ark.ValueText className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-foreground" />
            </div>
            <Ark.Label className="text-sm font-medium text-foreground">{label}</Ark.Label>
        </Ark.Root>
    )
}
