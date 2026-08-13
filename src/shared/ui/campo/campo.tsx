import type { ReactNode } from 'react'
import { cn } from '../cn'

/**
 * Moldura compartilhada de campo de formulário: rótulo, texto de apoio e
 * mensagem de erro, com a fiação de `aria-describedby`/`aria-invalid` exigida
 * por DESIGN_SYSTEM.md §4.2.
 *
 * Não é um componente da lista da §5 — é o pedaço comum de `Input`, `Textarea`,
 * `NumberInput`, `Select`, `Combobox` e `DatePicker`, extraído para que a
 * marcação de erro seja idêntica em todos eles.
 */
export interface IdsCampo {
    idControle: string
    idErro?: string
    idApoio?: string
    describedBy?: string
}

export function idsCampo(id: string, temErro: boolean, temApoio: boolean): IdsCampo {
    const idErro = temErro ? `${id}-erro` : undefined
    const idApoio = temApoio ? `${id}-apoio` : undefined
    const describedBy = [idApoio, idErro].filter(Boolean).join(' ') || undefined
    return { idControle: id, idErro, idApoio, describedBy }
}

export interface CampoProps {
    id: string
    label: string
    /** Texto de apoio abaixo do rótulo (opcional). */
    apoio?: string
    erro?: string
    obrigatorio?: boolean
    children: ReactNode
}

export function Campo({ id, label, apoio, erro, obrigatorio, children }: CampoProps) {
    const ids = idsCampo(id, Boolean(erro), Boolean(apoio))
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-sm font-medium text-foreground">
                {label}
                {obrigatorio && (
                    <span aria-hidden className="ml-1 text-danger-600 dark:text-danger-400">
                        *
                    </span>
                )}
                {obrigatorio && <span className="sr-only"> (obrigatório)</span>}
            </label>
            {apoio && (
                <p id={ids.idApoio} className="text-sm text-neutral-500 dark:text-neutral-400">
                    {apoio}
                </p>
            )}
            {children}
            {erro && (
                <p id={ids.idErro} role="alert" className={cn('text-sm text-danger-600 dark:text-danger-400')}>
                    {erro}
                </p>
            )}
        </div>
    )
}

/** Classes base compartilhadas por todo controle de texto (§4.2). */
export const CLASSES_CONTROLE_TEXTO =
    'w-full rounded-lg border bg-surface px-3 text-base text-foreground placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:opacity-50'

export function bordaControle(temErro: boolean): string {
    return temErro ? 'border-danger-500' : 'border-border'
}
