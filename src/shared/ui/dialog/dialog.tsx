'use client'

import { Dialog as Ark } from '@ark-ui/react/dialog'
import { Portal } from '@ark-ui/react/portal'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { ANEL_FOCO, cn } from '../cn'

/**
 * Dialog sobre o primitivo Ark (DESIGN_SYSTEM.md §4.7).
 * Uso: confirmações destrutivas (rejeitar candidatura, cancelar alocação) e o
 * detalhe de candidatura na fila de triagem.
 */
export interface DialogProps {
    open?: boolean
    defaultOpen?: boolean
    onOpenChange?: (aberto: boolean) => void
    titulo: string
    descricao?: string
    /** Elemento que abre o diálogo; omita ao controlar por `open`. */
    gatilho?: ReactNode
    children: ReactNode
    /** Rodapé de ações — normalmente `Button`s. */
    acoes?: ReactNode
    tamanho?: 'sm' | 'md' | 'lg'
}

const LARGURA = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' } as const

export function Dialog({
    open,
    defaultOpen,
    onOpenChange,
    titulo,
    descricao,
    gatilho,
    children,
    acoes,
    tamanho = 'md'
}: DialogProps) {
    return (
        <Ark.Root
            open={open}
            defaultOpen={defaultOpen}
            onOpenChange={(detalhe) => onOpenChange?.(detalhe.open)}
            lazyMount
            unmountOnExit
        >
            {gatilho && <Ark.Trigger asChild>{gatilho}</Ark.Trigger>}
            <Portal>
                <Ark.Backdrop className="fixed inset-0 z-40 bg-black/50" />
                <Ark.Positioner className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
                    <Ark.Content
                        className={cn(
                            // Em mobile ocupa a base da tela (folha), no desktop
                            // vira modal centralizado — §1.7, mobile-first.
                            'flex max-h-[90dvh] w-full flex-col rounded-t-xl border border-border bg-surface shadow-lg sm:rounded-xl',
                            LARGURA[tamanho]
                        )}
                    >
                        <header className="flex items-start justify-between gap-4 border-b border-border p-4">
                            <div className="flex flex-col gap-1">
                                <Ark.Title className="text-xl font-semibold text-foreground">{titulo}</Ark.Title>
                                {descricao && (
                                    <Ark.Description className="text-sm text-neutral-500 dark:text-neutral-400">
                                        {descricao}
                                    </Ark.Description>
                                )}
                            </div>
                            <Ark.CloseTrigger
                                aria-label="Fechar"
                                className={cn(
                                    'flex size-11 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-surface-muted',
                                    ANEL_FOCO
                                )}
                            >
                                <X aria-hidden className="size-5" />
                            </Ark.CloseTrigger>
                        </header>
                        <div className="flex-1 overflow-y-auto p-4">{children}</div>
                        {acoes && (
                            <footer className="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end">
                                {acoes}
                            </footer>
                        )}
                    </Ark.Content>
                </Ark.Positioner>
            </Portal>
        </Ark.Root>
    )
}
