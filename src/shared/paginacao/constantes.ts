/**
 * Constantes de paginação (007-datatable-server-pagination).
 *
 * Substituem os `const TAMANHO_PAGINA = 20` que existiam soltos em cada
 * `page.tsx` de listagem: o seletor do rodapé e o saneamento do servidor
 * precisam concordar sobre quais tamanhos são válidos, e concordar em um só
 * lugar (FR-004, FR-018).
 */

/** Opções exatas oferecidas pelo seletor do rodapé, na ordem de exibição. */
export const TAMANHOS_PAGINA = [5, 10, 20, 50] as const

export type TamanhoPagina = (typeof TAMANHOS_PAGINA)[number]

/** Aplicado quando a URL não traz `pageSize` ou traz um valor fora da lista. */
export const TAMANHO_PAGINA_PADRAO: TamanhoPagina = 5

export function ehTamanhoPagina(valor: unknown): valor is TamanhoPagina {
    return TAMANHOS_PAGINA.includes(valor as TamanhoPagina)
}
