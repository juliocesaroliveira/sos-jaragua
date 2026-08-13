import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { ALTURA_POR_TAMANHO, ANEL_FOCO, cn, type TamanhoControle } from '../cn'

/**
 * Button (DESIGN_SYSTEM.md §4.1). Ark UI não expõe primitivo de botão — é um
 * wrapper próprio sobre `<button>` nativo.
 */
export type VarianteBotao = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTES: Record<VarianteBotao, string> = {
    primary:
        'bg-primary-600 dark:bg-primary-500 text-primary-foreground hover:bg-primary-700 dark:hover:bg-primary-600',
    secondary: 'bg-surface text-foreground border border-border hover:bg-surface-muted',
    ghost: 'text-foreground hover:bg-surface-muted',
    danger: 'bg-danger-600 text-white hover:bg-danger-700'
}

const PADDING_POR_TAMANHO: Record<TamanhoControle, string> = {
    sm: 'px-3 text-sm',
    md: 'px-4 text-base',
    lg: 'px-6 text-base'
}

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
    variant?: VarianteBotao
    /** `sm` só em contexto denso de desktop; nunca como única ação em mobile (§1.3). */
    size?: TamanhoControle
    loading?: boolean
    /** Ocupa toda a largura — padrão em ações primárias de tela cheia no mobile. */
    fullWidth?: boolean
    /**
     * Icon rendered on the left side of button text. Positioned via flexbox gap.
     * Use icons from 'lucide-react' to maintain visual consistency.
     * For size sm/md: use `className="size-4"` on icon (16px)
     * For size lg: use `className="size-5"` on icon (20px)
     * Example: `<Button iconeInicio={<Plus className="size-4" />}>Criar</Button>`
     */
    iconeInicio?: ReactNode
    /**
     * Icon rendered on the right side of button text. Positioned via flexbox gap.
     * Less common than iconeInicio; use for secondary visual affordances only.
     */
    iconeFim?: ReactNode
}

export function Button({
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    iconeInicio,
    iconeFim,
    disabled,
    children,
    type = 'button',
    ...props
}: ButtonProps) {
    return (
        <button
            {...props}
            type={type}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={cn(
                'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
                'hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
                ANEL_FOCO,
                VARIANTES[variant],
                ALTURA_POR_TAMANHO[size],
                PADDING_POR_TAMANHO[size],
                fullWidth && 'w-full'
            )}
        >
            {/* O texto é mantido durante o loading para a largura não colapsar (§4.1). */}
            {loading ? <Loader2 aria-hidden className="size-5 animate-spin" /> : iconeInicio}
            {children}
            {!loading && iconeFim}
        </button>
    )
}
