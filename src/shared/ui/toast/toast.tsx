'use client'

import { Toast, Toaster as ArkToaster, createToaster } from '@ark-ui/react/toast'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { ANEL_FOCO, cn } from '../cn'

/**
 * Toast sobre o primitivo Ark (DESIGN_SYSTEM.md §4.8).
 *
 * Feedback de mutações client-side. Auto-dismiss em 5s, pausável em hover/foco
 * (comportamento padrão do Ark). As variantes seguem o mapeamento de cores da
 * §3 — nunca cores ad-hoc por tela.
 */
export const toaster = createToaster({
    placement: 'bottom-end',
    overlap: true,
    gap: 8,
    max: 4
})

type TipoToast = 'success' | 'error' | 'info' | 'warning'

const ESTILO: Record<TipoToast, { borda: string; icone: ReactNode }> = {
    success: {
        borda: 'border-l-4 border-l-success-600',
        icone: <CheckCircle2 aria-hidden className="size-5 text-success-600 dark:text-success-400" />
    },
    error: {
        borda: 'border-l-4 border-l-danger-600',
        icone: <XCircle aria-hidden className="size-5 text-danger-600 dark:text-danger-400" />
    },
    warning: {
        borda: 'border-l-4 border-l-warning-500',
        icone: <AlertTriangle aria-hidden className="size-5 text-warning-600 dark:text-warning-400" />
    },
    info: {
        borda: 'border-l-4 border-l-info-600',
        icone: <Info aria-hidden className="size-5 text-info-600 dark:text-info-400" />
    }
}

/** Monte uma vez, no shell da aplicação. */
export function Toaster() {
    return (
        <ArkToaster toaster={toaster} className="z-100">
            {(toast) => {
                const tipo = (toast.type as TipoToast) in ESTILO ? (toast.type as TipoToast) : 'info'
                return (
                    <Toast.Root
                        className={cn(
                            'flex w-[min(92vw,24rem)] items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-lg',
                            ESTILO[tipo].borda
                        )}
                    >
                        {ESTILO[tipo].icone}
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <Toast.Title className="text-base font-semibold text-foreground">{toast.title}</Toast.Title>
                            {toast.description && (
                                <Toast.Description className="text-sm text-neutral-600 dark:text-neutral-300">
                                    {toast.description}
                                </Toast.Description>
                            )}
                        </div>
                        <Toast.CloseTrigger
                            aria-label="Fechar aviso"
                            className={cn(
                                'flex size-11 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-surface-muted',
                                ANEL_FOCO
                            )}
                        >
                            <X aria-hidden className="size-5" />
                        </Toast.CloseTrigger>
                    </Toast.Root>
                )
            }}
        </ArkToaster>
    )
}

/** Atalhos em pt-BR para o disparo a partir das telas. */
export const avisar = {
    sucesso: (titulo: string, descricao?: string) =>
        toaster.create({ type: 'success', title: titulo, description: descricao, duration: 5000 }),
    erro: (titulo: string, descricao?: string) =>
        toaster.create({ type: 'error', title: titulo, description: descricao, duration: 8000 }),
    atencao: (titulo: string, descricao?: string) =>
        toaster.create({ type: 'warning', title: titulo, description: descricao, duration: 6000 }),
    info: (titulo: string, descricao?: string) =>
        toaster.create({ type: 'info', title: titulo, description: descricao, duration: 5000 })
}
