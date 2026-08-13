import type { ReactNode } from 'react'
import { cn } from '../cn'

/**
 * Badge/Tag de status — componente próprio (Ark UI não tem primitivo de badge,
 * é só estilo). DESIGN_SYSTEM.md §4.11.
 *
 * As cores vêm **exclusivamente** do mapeamento da §3, via os helpers
 * `corDeStatus*` abaixo. Nenhuma tela deve escolher a cor por conta própria.
 */
export type CorBadge = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

const CORES: Record<CorBadge, string> = {
    neutral: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300',
    primary: 'bg-primary-100 text-primary-800 dark:bg-primary-950 dark:text-primary-300',
    success: 'bg-success-100 text-success-800 dark:bg-success-950 dark:text-success-300',
    warning: 'bg-warning-100 text-warning-800 dark:bg-warning-950 dark:text-warning-300',
    danger: 'bg-danger-100 text-danger-800 dark:bg-danger-950 dark:text-danger-300',
    info: 'bg-info-100 text-info-800 dark:bg-info-950 dark:text-info-300'
}

export interface BadgeProps {
    cor?: CorBadge
    children: ReactNode
}

export function Badge({ cor = 'neutral', children }: BadgeProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
                CORES[cor]
            )}
        >
            {children}
        </span>
    )
}

// -- Mapeamento semântico status → cor (DESIGN_SYSTEM.md §3) ------------------

export const COR_STATUS_VOLUNTARIO = {
    pendente: 'warning',
    aprovado: 'success',
    rejeitado: 'danger'
} as const satisfies Record<string, CorBadge>

export const COR_STATUS_ATIVIDADE = {
    aberta: 'info',
    encerrada: 'neutral',
    cancelada: 'danger'
} as const satisfies Record<string, CorBadge>

export const COR_STATUS_ALOCACAO = {
    confirmado: 'success',
    cancelado: 'danger'
} as const satisfies Record<string, CorBadge>

export const COR_TIPO_SAIDA = {
    avulso: 'neutral',
    kit: 'primary'
} as const satisfies Record<string, CorBadge>

export const COR_STATUS_ENVIO = {
    pendente: 'warning',
    enviado: 'success',
    falhou: 'danger'
} as const satisfies Record<string, CorBadge>

// -- Rótulos em pt-BR (NFR §2.2) ---------------------------------------------

export const ROTULO_STATUS_VOLUNTARIO = {
    pendente: 'Pendente',
    aprovado: 'Aprovado',
    rejeitado: 'Rejeitado'
} as const

export const ROTULO_STATUS_ATIVIDADE = {
    aberta: 'Aberta',
    encerrada: 'Encerrada',
    cancelada: 'Cancelada'
} as const

export const ROTULO_STATUS_ALOCACAO = {
    confirmado: 'Confirmado',
    cancelado: 'Cancelado'
} as const

export const ROTULO_TIPO_SAIDA = {
    avulso: 'Avulso',
    kit: 'Kit'
} as const
