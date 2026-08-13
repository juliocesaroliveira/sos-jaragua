import type { ReactNode } from 'react'
import { cn } from '../cn'

/**
 * KanbanCard — um card por `turno` (DESIGN_SYSTEM.md §4.16).
 *
 * Mostra horário e vagas preenchidas/total, aplicando o **destaque de déficit**
 * definido na §3 quando `preenchidas < vagas`: fundo `danger-50`/borda
 * `danger-400` no claro, `danger-950`/`danger-700` no escuro. O déficit não é
 * comunicado só pela cor — o contador também é escrito em texto, para leitores
 * de tela e para quem não distingue a diferença cromática.
 */
export interface KanbanCardProps {
    /** Ex.: "08:00 – 12:00". */
    horario: string
    preenchidas: number
    vagas: number
    detalhe?: ReactNode
    acoes?: ReactNode
}

export function KanbanCard({ horario, preenchidas, vagas, detalhe, acoes }: KanbanCardProps) {
    const deficit = preenchidas < vagas
    const faltam = vagas - preenchidas

    return (
        <li
            className={cn(
                // O fundo fica só no ramo condicional: duas classes `bg-*` no
                // mesmo elemento seriam resolvidas pela ordem do CSS gerado,
                // não pela ordem em que aparecem aqui.
                'flex flex-col gap-2 rounded-xl border p-3',
                deficit
                    ? 'border-danger-400 bg-danger-50 dark:border-danger-700 dark:bg-danger-950'
                    : 'border-border bg-surface'
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <p className="text-base font-semibold text-foreground">{horario}</p>
                {acoes && <div className="shrink-0">{acoes}</div>}
            </div>

            <p className={cn('text-sm', deficit ? 'text-danger-700 dark:text-danger-300' : 'text-neutral-500')}>
                {preenchidas} de {vagas} {vagas === 1 ? 'vaga preenchida' : 'vagas preenchidas'}
                {deficit && ` — faltam ${faltam}`}
            </p>

            {detalhe}
        </li>
    )
}
