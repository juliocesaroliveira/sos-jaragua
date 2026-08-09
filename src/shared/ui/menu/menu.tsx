'use client'

import { Menu as Ark } from '@ark-ui/react/menu'
import { Portal } from '@ark-ui/react/portal'
import type { ReactNode } from 'react'
import { ANEL_FOCO, CLASSE_FLUTUANTE, cn } from '../cn'

/**
 * Menu sobre o primitivo Ark (DESIGN_SYSTEM.md §4.10).
 * Ações contextuais de linha de tabela/card — Aprovar, Rejeitar, Editar,
 * Cancelar.
 */
export type ItemMenu = {
    value: string
    label: string
    icone?: ReactNode
    disabled?: boolean
    /** Aplica cor de perigo — ações destrutivas (§3). */
    destrutivo?: boolean
    onSelect?: () => void
}

export interface MenuProps {
    gatilho: ReactNode
    itens: readonly ItemMenu[]
    posicao?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'
}

export function Menu({ gatilho, itens, posicao = 'bottom-end' }: MenuProps) {
    return (
        <Ark.Root
            positioning={{ placement: posicao }}
            onSelect={(detalhe) => itens.find((i) => i.value === detalhe.value)?.onSelect?.()}
            lazyMount
            unmountOnExit
        >
            <Ark.Trigger asChild>{gatilho}</Ark.Trigger>
            <Portal>
                <Ark.Positioner className={CLASSE_FLUTUANTE}>
                    <Ark.Content
                        className={cn('min-w-48 rounded-xl border border-border bg-surface p-1 shadow-md', ANEL_FOCO)}
                    >
                        {itens.map((item) => (
                            <Ark.Item
                                key={item.value}
                                value={item.value}
                                disabled={item.disabled}
                                className={cn(
                                    'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-base',
                                    'data-highlighted:bg-surface-muted data-disabled:cursor-not-allowed data-disabled:opacity-50',
                                    item.destrutivo ? 'text-danger-600 dark:text-danger-400' : 'text-foreground'
                                )}
                            >
                                {item.icone}
                                {item.label}
                            </Ark.Item>
                        ))}
                    </Ark.Content>
                </Ark.Positioner>
            </Portal>
        </Ark.Root>
    )
}
