import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../cn'

/**
 * Alert/Banner — componente próprio (DESIGN_SYSTEM.md §4.14). Sem primitivo Ark
 * equivalente.
 *
 * Usado nos três alertas de coordenador (`cadastros_acumulados` → `info`,
 * `estoque_critico` → `warning`, `deficit_atendimento` → `danger`, conforme §3)
 * e no broadcast de urgência.
 */
export type TomAlerta = 'info' | 'success' | 'warning' | 'danger'

const ESTILO: Record<TomAlerta, { caixa: string; icone: ReactNode }> = {
    info: {
        caixa: 'border-info-300 bg-info-50 text-info-900 dark:border-info-800 dark:bg-info-950 dark:text-info-100',
        icone: <Info aria-hidden className="size-5 shrink-0 text-info-600 dark:text-info-400" />
    },
    success: {
        caixa: 'border-success-300 bg-success-50 text-success-900 dark:border-success-800 dark:bg-success-950 dark:text-success-100',
        icone: <CheckCircle2 aria-hidden className="size-5 shrink-0 text-success-600 dark:text-success-400" />
    },
    warning: {
        caixa: 'border-warning-300 bg-warning-50 text-warning-900 dark:border-warning-800 dark:bg-warning-950 dark:text-warning-100',
        icone: <AlertTriangle aria-hidden className="size-5 shrink-0 text-warning-600 dark:text-warning-400" />
    },
    danger: {
        caixa: 'border-danger-300 bg-danger-50 text-danger-900 dark:border-danger-800 dark:bg-danger-950 dark:text-danger-100',
        icone: <XCircle aria-hidden className="size-5 shrink-0 text-danger-600 dark:text-danger-400" />
    }
}

export interface AlertProps {
    tom?: TomAlerta
    titulo: string
    children?: ReactNode
    /** Ação à direita (ex.: "Ver fila de cadastros"). */
    acao?: ReactNode
}

export function Alert({ tom = 'info', titulo, children, acao }: AlertProps) {
    return (
        <div
            // `danger`/`warning` exigem anúncio imediato ao leitor de tela;
            // `info`/`success` podem esperar a pausa natural.
            role={tom === 'danger' || tom === 'warning' ? 'alert' : 'status'}
            className={cn('flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start', ESTILO[tom].caixa)}
        >
            {ESTILO[tom].icone}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-base font-semibold">{titulo}</p>
                {children && <div className="text-sm">{children}</div>}
            </div>
            {acao && <div className="shrink-0">{acao}</div>}
        </div>
    )
}
