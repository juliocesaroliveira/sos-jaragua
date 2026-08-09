'use client'

import { Popover as Ark } from '@ark-ui/react/popover'
import { Portal } from '@ark-ui/react/portal'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { ANEL_FOCO, cn } from '../cn'

/**
 * Popover sobre o primitivo Ark (DESIGN_SYSTEM.md §4.10).
 * Painéis contextuais leves — ex.: detalhes rápidos do saldo de um item.
 */
export interface PopoverProps {
    gatilho: ReactNode
    titulo?: string
    descricao?: string
    children: ReactNode
    posicao?: 'top' | 'bottom' | 'left' | 'right'
}

export function Popover({ gatilho, titulo, descricao, children, posicao = 'bottom' }: PopoverProps) {
    return (
        <Ark.Root positioning={{ placement: posicao }} lazyMount unmountOnExit>
            <Ark.Trigger asChild>{gatilho}</Ark.Trigger>
            <Portal>
                <Ark.Positioner>
                    <Ark.Content className="z-50 w-[min(90vw,20rem)] rounded-xl border border-border bg-surface p-4 shadow-md">
                        {titulo && (
                            <div className="mb-2 flex items-start justify-between gap-2">
                                <div className="flex flex-col gap-0.5">
                                    <Ark.Title className="text-base font-semibold text-foreground">{titulo}</Ark.Title>
                                    {descricao && (
                                        <Ark.Description className="text-sm text-neutral-500 dark:text-neutral-400">
                                            {descricao}
                                        </Ark.Description>
                                    )}
                                </div>
                                <Ark.CloseTrigger
                                    aria-label="Fechar"
                                    className={cn(
                                        'flex size-9 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-surface-muted',
                                        ANEL_FOCO
                                    )}
                                >
                                    <X aria-hidden className="size-4" />
                                </Ark.CloseTrigger>
                            </div>
                        )}
                        {children}
                    </Ark.Content>
                </Ark.Positioner>
            </Portal>
        </Ark.Root>
    )
}
