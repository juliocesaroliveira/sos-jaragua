'use client'

import { Dialog as Ark } from '@ark-ui/react/dialog'
import { Portal } from '@ark-ui/react/portal'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { ANEL_FOCO, cn } from '../cn'
import { Tooltip } from '../tooltip/tooltip'

/**
 * Drawer (DESIGN_SYSTEM.md §4.7): o **mesmo primitivo `Dialog`** do Ark, com
 * posicionamento lateral/inferior via CSS — não um componente diferente.
 * Uso: filtros de listagem em mobile e formulários longos que não cabem em um
 * modal centralizado.
 */
export interface DrawerProps {
    open?: boolean
    defaultOpen?: boolean
    onOpenChange?: (aberto: boolean) => void
    titulo: string
    descricao?: string
    gatilho?: ReactNode
    children: ReactNode
    acoes?: ReactNode
    /**
     * `bottom` é o padrão em mobile; `right` para painéis de desktop; `left`
     * para a gaveta de navegação (013-navegacao-lateral-responsiva).
     */
    lado?: 'bottom' | 'right' | 'left'
}

const POSICAO = {
    bottom: 'inset-x-0 bottom-0 max-h-[85dvh] w-full rounded-t-xl border-t',
    right: 'inset-y-0 right-0 h-full w-full max-w-md border-l sm:rounded-l-xl',
    /**
     * Mais estreito que `right` de propósito: a gaveta de navegação precisa
     * deixar parte do fundo escurecido visível, senão o toque fora — um dos
     * caminhos de fechamento — deixa de ser descobrível
     * (contracts/gaveta-navegacao.md G-05). Em um aparelho de 360px, `85%`
     * deixa ~54px de fundo à mostra.
     */
    left: 'inset-y-0 left-0 h-full w-[85%] max-w-xs border-r sm:rounded-r-xl'
} as const

export function Drawer({
    open,
    defaultOpen,
    onOpenChange,
    titulo,
    descricao,
    gatilho,
    children,
    acoes,
    lado = 'bottom'
}: DrawerProps) {
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
                <Ark.Positioner className="fixed inset-0 z-50">
                    <Ark.Content
                        className={cn('absolute flex flex-col border-border bg-surface shadow-lg', POSICAO[lado])}
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
                            <Tooltip conteudo="Fechar" posicao="left">
                                <Ark.CloseTrigger
                                    aria-label="Fechar"
                                    className={cn(
                                        'flex size-11 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-surface-muted',
                                        ANEL_FOCO
                                    )}
                                >
                                    <X aria-hidden className="size-5" />
                                </Ark.CloseTrigger>
                            </Tooltip>
                        </header>
                        {/*
                          `overscroll-contain`: chegar ao fim desta lista não
                          transfere o gesto para a página atrás
                          (013-navegacao-lateral-responsiva, R-04). Vale para
                          todos os drawers, não só o de navegação.
                        */}
                        <div className="flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
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
