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

/**
 * Escala de empilhamento única do design system.
 *
 * Camadas flutuantes (select, combobox, menu, popover, tooltip, calendário)
 * ficam **acima** de diálogos e gavetas: um `Select` dentro de um `Dialog` é um
 * caso normal de formulário, e com o mesmo z-index o diálogo — montado depois
 * no `<body>` — cobriria a lista de opções.
 *
 * O Ark posiciona pela variável `--z-index` no elemento `Positioner`; sobrepor
 * a classe do `Content` não adianta, porque o positioner cria o contexto de
 * empilhamento.
 */
export const CAMADA = {
    backdrop: 40,
    dialogo: 50,
    flutuante: 60,
    toast: 100
} as const

/**
 * Classe a aplicar no `Positioner` de qualquer componente flutuante do Ark.
 *
 * Precisa ser `!important`: o Ark escreve `z-index: var(--z-index)` no estilo
 * inline do positioner e sobrescreve qualquer `--z-index` que passemos via
 * prop `style`, então só uma regra de folha de estilo com prioridade maior
 * vence.
 */
export const CLASSE_FLUTUANTE = 'z-[60]!'

/** Altura por tamanho — o mínimo `md` respeita o touch target de 44px (§1.3). */
export const ALTURA_POR_TAMANHO = {
    sm: 'h-9',
    md: 'h-11',
    lg: 'h-13'
} as const

export type TamanhoControle = keyof typeof ALTURA_POR_TAMANHO
