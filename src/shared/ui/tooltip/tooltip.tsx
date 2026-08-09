'use client'

import { Portal } from '@ark-ui/react/portal'
import { Tooltip as Ark } from '@ark-ui/react/tooltip'
import type { ReactNode } from 'react'

/**
 * Tooltip sobre o primitivo Ark (DESIGN_SYSTEM.md §4.10).
 * Texto de apoio em ícones sem rótulo visível — nunca como único meio de
 * transmitir informação crítica (não existe hover em toque).
 */
export interface TooltipProps {
    conteudo: string
    children: ReactNode
    posicao?: 'top' | 'bottom' | 'left' | 'right'
    atrasoMs?: number
}

export function Tooltip({ conteudo, children, posicao = 'top', atrasoMs = 300 }: TooltipProps) {
    return (
        <Ark.Root openDelay={atrasoMs} closeDelay={100} positioning={{ placement: posicao }}>
            <Ark.Trigger asChild>{children}</Ark.Trigger>
            <Portal>
                <Ark.Positioner>
                    <Ark.Content className="z-50 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white shadow-md dark:bg-neutral-700">
                        {conteudo}
                    </Ark.Content>
                </Ark.Positioner>
            </Portal>
        </Ark.Root>
    )
}
