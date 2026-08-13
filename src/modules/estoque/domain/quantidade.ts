/**
 * Quantidades de estoque são **decimais** (kg, litro) e o banco as guarda em
 * `numeric(14,3)`, que o driver entrega como string.
 *
 * Fazer aritmética com `number` aqui é aceitável porque a escala é pequena
 * (3 casas) e os valores são muito menores que `Number.MAX_SAFE_INTEGER`; o que
 * **não** é aceitável é somar strings ou arredondar sem intenção — por isso toda
 * conversão passa por estas funções.
 */
export const CASAS_DECIMAIS = 3

export function paraNumero(valor: string | number): number {
    const n = typeof valor === 'number' ? valor : Number(valor)
    return Number.isFinite(n) ? n : 0
}

/** Formato aceito pela coluna `numeric` do Postgres. */
export function paraNumeric(valor: number): string {
    return valor.toFixed(CASAS_DECIMAIS)
}

/** Soma/subtração com arredondamento na escala do banco, evitando drift binário. */
export function arredondar(valor: number): number {
    const fator = 10 ** CASAS_DECIMAIS
    return Math.round(valor * fator) / fator
}

/** Exibição em pt-BR, sem casas decimais desnecessárias ("12" e não "12,000"). */
export function formatarQuantidade(valor: string | number): string {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: CASAS_DECIMAIS }).format(paraNumero(valor))
}

export function ehQuantidadePositiva(valor: string | number): boolean {
    return paraNumero(valor) > 0
}
