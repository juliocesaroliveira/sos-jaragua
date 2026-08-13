'use client'

import { Tabs as Ark } from '@ark-ui/react/tabs'
import type { ReactNode } from 'react'
import { ANEL_FOCO, cn } from '../cn'

/**
 * Tabs sobre o primitivo Ark (DESIGN_SYSTEM.md §4.9).
 * Uso: telas com múltiplas visões — Relatórios (Inventário × Histórico de Saídas).
 */
export type AbaTabs = { value: string; label: string; conteudo: ReactNode; disabled?: boolean }

export interface TabsProps {
    abas: readonly AbaTabs[]
    value?: string
    defaultValue?: string
    onValueChange?: (valor: string) => void
    /** Rótulo acessível da barra de abas. */
    'aria-label'?: string
}

export function Tabs({ abas, value, defaultValue, onValueChange, ...rest }: TabsProps) {
    return (
        <Ark.Root
            value={value}
            defaultValue={defaultValue ?? abas[0]?.value}
            onValueChange={(detalhe) => detalhe.value && onValueChange?.(detalhe.value)}
            className="flex flex-col gap-4"
        >
            <Ark.List
                aria-label={rest['aria-label']}
                className="relative flex gap-1 overflow-x-auto border-b border-border"
            >
                {abas.map((aba) => (
                    <Ark.Trigger
                        key={aba.value}
                        value={aba.value}
                        disabled={aba.disabled}
                        className={cn(
                            'min-h-11 shrink-0 rounded-t-lg px-4 text-sm font-medium text-neutral-500 hover:text-foreground',
                            'data-[selected]:text-primary-600 dark:data-[selected]:text-primary-400',
                            'data-disabled:cursor-not-allowed data-disabled:opacity-50',
                            ANEL_FOCO
                        )}
                    >
                        {aba.label}
                    </Ark.Trigger>
                ))}
                <Ark.Indicator className="absolute bottom-0 h-0.5 bg-primary-600 dark:bg-primary-400" />
            </Ark.List>
            {abas.map((aba) => (
                <Ark.Content key={aba.value} value={aba.value} className={ANEL_FOCO}>
                    {aba.conteudo}
                </Ark.Content>
            ))}
        </Ark.Root>
    )
}
