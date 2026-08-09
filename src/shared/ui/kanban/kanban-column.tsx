import type { ReactNode } from 'react'

/**
 * KanbanColumn — componente próprio sobre HTML semântico, **sem
 * drag-and-drop** (não requerido pelo BRD). DESIGN_SYSTEM.md §4.16.
 *
 * Uma coluna por atividade. Em telas `md-` as colunas empilham verticalmente
 * (vira lista); em `md+` ficam lado a lado — o pai controla o layout, a coluna
 * só se comporta como bloco de largura total.
 */
export interface KanbanColumnProps {
    titulo: string
    /** Ex.: "6 turnos" — contagem exibida ao lado do título. */
    contagem?: string
    subtitulo?: string
    acao?: ReactNode
    children: ReactNode
}

export function KanbanColumn({ titulo, contagem, subtitulo, acao, children }: KanbanColumnProps) {
    return (
        <section className="flex w-full min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface-muted p-3 md:w-80 md:shrink-0">
            <header className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                    <h3 className="truncate text-lg font-semibold text-foreground">{titulo}</h3>
                    {subtitulo && (
                        <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">{subtitulo}</p>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {contagem && <span className="text-xs text-neutral-500 dark:text-neutral-400">{contagem}</span>}
                    {acao}
                </div>
            </header>
            <ul className="flex flex-col gap-2">{children}</ul>
        </section>
    )
}
