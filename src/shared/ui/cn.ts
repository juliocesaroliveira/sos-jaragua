/**
 * Concatenador de classes. Sem dependência externa: os componentes do design
 * system expõem `variant`/`size` e não aceitam classes arbitrárias no ponto de
 * uso (DESIGN_SYSTEM.md §4), então não há conflito de utilitários para resolver.
 */
export type ValorClasse = string | false | null | undefined

export function cn(...classes: ValorClasse[]): string {
    return classes.filter(Boolean).join(' ')
}

/**
 * Anel de foco padrão (DESIGN_SYSTEM.md §4, §6) — obrigatório em todo elemento
 * interativo. `outline-none` só é aceitável porque o anel é o substituto.
 */
export const ANEL_FOCO =
    'outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface'

/** Altura por tamanho — o mínimo `md` respeita o touch target de 44px (§1.3). */
export const ALTURA_POR_TAMANHO = {
    sm: 'h-9',
    md: 'h-11',
    lg: 'h-13'
} as const

export type TamanhoControle = keyof typeof ALTURA_POR_TAMANHO
