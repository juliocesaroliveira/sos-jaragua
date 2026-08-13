import { Loader2 } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { ANEL_FOCO, cn, type TamanhoControle } from '../cn'
import type { VarianteBotao } from '../button/button'

/**
 * IconButton (DESIGN_SYSTEM.md §4.1) — mesma API do `Button`, quadrado e com
 * `aria-label` **obrigatório**: não há texto visível para nomear a ação.
 */
const VARIANTES: Record<VarianteBotao, string> = {
    primary:
        'bg-primary-600 dark:bg-primary-500 text-primary-foreground hover:bg-primary-700 dark:hover:bg-primary-600',
    secondary: 'bg-surface text-foreground border border-border hover:bg-surface-muted',
    ghost: 'text-foreground hover:bg-surface-muted',
    danger: 'bg-danger-600 text-white hover:bg-danger-700'
}

const DIMENSAO: Record<TamanhoControle, string> = {
    sm: 'size-9',
    md: 'size-11',
    lg: 'size-13'
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> {
    'aria-label': string
    variant?: VarianteBotao
    size?: TamanhoControle
    loading?: boolean
    icone: ReactNode
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
    { variant = 'ghost', size = 'md', loading = false, icone, disabled, type = 'button', ...props },
    ref
) {
    return (
        <button
            {...props}
            ref={ref}
            type={type}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-lg transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                ANEL_FOCO,
                VARIANTES[variant],
                DIMENSAO[size]
            )}
        >
            {loading ? <Loader2 aria-hidden className="size-5 animate-spin" /> : icone}
        </button>
    )
})
