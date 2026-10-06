/**
 * Mínimo de segurança por item (specs/020-resolver-pendencias, Q3; DESIGN.md
 * §19). É a única fonte da semântica do valor:
 *
 * | `estoqueMinimo` | limiar efetivo | crítico quando    |
 * | --------------- | -------------- | ----------------- |
 * | `null`          | global         | `saldo <= global` |
 * | `0`             | nenhum         | nunca             |
 * | `n > 0`         | `n`            | `saldo <= n`      |
 *
 * `<=` porque o alerta diz que o item "atingiu" o mínimo: chegar exatamente nele
 * já conta. É o mesmo operador de antes da feature 020, com o limiar global.
 */

/** Maior valor que `numeric(14,3)` guarda. */
const MAXIMO = 99_999_999_999.999
const CASAS_DECIMAIS = 3

/** `null` = alerta desligado para o item. */
export function limiarDoItem(estoqueMinimo: number | null, limiarGlobal: number): number | null {
    if (estoqueMinimo === null) return limiarGlobal
    if (estoqueMinimo === 0) return null
    return estoqueMinimo
}

export function itensCriticos<
    T extends { saldo: number; estoqueMinimo: number | null; aguardandoPrimeiraEntrada?: boolean }
>(itens: T[], limiarGlobal: number): (T & { limiar: number })[] {
    const criticos: (T & { limiar: number })[] = []
    for (const item of itens) {
        // Item criado pelo cadastro de kit nasce com saldo 0 por planejamento,
        // não por falta: só entra na avaliação depois da primeira entrada
        // (feature 022, FR-015).
        if (item.aguardandoPrimeiraEntrada === true) continue
        const limiar = limiarDoItem(item.estoqueMinimo, limiarGlobal)
        if (limiar !== null && item.saldo <= limiar) criticos.push({ ...item, limiar })
    }
    return criticos
}

/**
 * Mensagem de erro em pt-BR, ou `null` quando o valor é válido. A Entrada (item
 * novo) e a edição pela tabela usam esta mesma função, para as duas regras
 * nunca divergirem.
 */
export function validarEstoqueMinimo(valor: number | null): string | null {
    if (valor === null) return null
    if (!Number.isFinite(valor)) return 'Informe um número válido.'
    if (valor < 0) return 'Informe um número maior ou igual a zero.'
    if (valor > MAXIMO) return 'Valor muito alto.'
    if (!temNoMaximoCasas(valor, CASAS_DECIMAIS)) return `Use no máximo ${CASAS_DECIMAIS} casas decimais.`
    return null
}

/**
 * Compara pelo arredondamento em vez de contar casas na string: `0.1 + 0.2`
 * vira `0.30000000000000004` e seria recusado por uma contagem ingênua.
 */
function temNoMaximoCasas(valor: number, casas: number): boolean {
    const fator = 10 ** casas
    return Math.abs(Math.round(valor * fator) / fator - valor) < Number.EPSILON * Math.max(1, Math.abs(valor))
}
