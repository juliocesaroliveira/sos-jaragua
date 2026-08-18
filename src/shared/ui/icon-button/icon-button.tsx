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
    /**
     * Indisponível **e explicável** (015-tooltip-acoes-icone, C-03).
     *
     * Mesma aparência esmaecida de `disabled`, mas o botão **permanece focável
     * e sensível ao ponteiro**: um `<button disabled>` não dispara evento de
     * ponteiro nem entra na ordem de foco — regra do navegador —, e por isso
     * não tem como exibir um tooltip que explique por que está indisponível.
     * Quem navega por teclado simplesmente não o encontraria.
     *
     * Use **somente** acompanhado de um `Tooltip descricao` com o motivo. Sem
     * ele, `inativo` produz apenas um controle focável que não faz nada — pior
     * que `disabled`. Para indisponibilidade sem explicação, e para estados
     * transitórios, continue usando `disabled`/`loading`.
     */
    inativo?: boolean
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
    {
        variant = 'ghost',
        size = 'md',
        loading = false,
        inativo = false,
        icone,
        disabled,
        type = 'button',
        onClick,
        ...props
    },
    ref
) {
    // `disabled` vence se ambos forem informados: é a garantia mais forte, e a
    // combinação indica erro de uso.
    const desabilitado = Boolean(disabled) || loading
    const somenteInativo = inativo && !desabilitado

    return (
        <button
            {...props}
            ref={ref}
            type={type}
            disabled={desabilitado}
            aria-disabled={somenteInativo || undefined}
            aria-busy={loading || undefined}
            // `aria-disabled` é informação para tecnologia assistiva: não
            // impede clique nenhum. Sem este curto-circuito, o botão inativo
            // continuaria executando a ação normalmente.
            onClick={somenteInativo ? undefined : onClick}
            className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-lg transition-colors',
                'hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
                // Espelha o par acima para o estado inativo, que não tem o
                // atributo `disabled` de onde as variantes `disabled:`
                // dependem. As duas aparências têm de ser indistinguíveis
                // (C-03.3): dois esmaecidos diferentes confundiriam sem motivo.
                'aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
                ANEL_FOCO,
                VARIANTES[variant],
                DIMENSAO[size]
            )}
        >
            {loading ? <Loader2 aria-hidden className="size-5 animate-spin" /> : icone}
        </button>
    )
})
