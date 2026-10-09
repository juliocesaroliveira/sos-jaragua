/**
 * Regras de R-07 Movimentação por item e R-14 Evolução da crise
 * (specs/023-central-relatorios, US5, research D11).
 */

export type Movimentos = { entradas: number; saidas: number; descartes: number }

export type BalancoItem = {
    saldoInicial: number
    entradas: number
    saidas: number
    descartes: number
    saldoFinal: number
}

const CASAS = 1_000

function arredondar(valor: number): number {
    return Math.round(valor * CASAS) / CASAS
}

function liquido({ entradas, saidas, descartes }: Movimentos): number {
    return entradas - saidas - descartes
}

/**
 * Balanço de um item num período, a partir do saldo **de hoje** — o único
 * saldo que o sistema guarda (`saldo_estoque`, read-model do ledger).
 *
 * - saldo final = hoje − o que se moveu **depois** do fim do período;
 * - saldo inicial = saldo final − o que se moveu **no** período.
 *
 * Assim a conta fecha por construção (SC-003) e, com o período terminando
 * hoje, o saldo final é exatamente o do Inventário atual.
 */
export function balancoItem(saldoAtual: number, noPeriodo: Movimentos, aposPeriodo: Movimentos): BalancoItem {
    const saldoFinal = arredondar(saldoAtual - liquido(aposPeriodo))
    const saldoInicial = arredondar(saldoFinal - liquido(noPeriodo))
    return {
        saldoInicial,
        entradas: arredondar(noPeriodo.entradas),
        saidas: arredondar(noPeriodo.saidas),
        descartes: arredondar(noPeriodo.descartes),
        saldoFinal
    }
}

/** Item zerado e parado no período não acrescenta nada à leitura do balanço. */
export function temMovimento(b: BalancoItem): boolean {
    return b.saldoInicial !== 0 || b.entradas !== 0 || b.saidas !== 0 || b.descartes !== 0 || b.saldoFinal !== 0
}

/** Diferença para a atualização anterior; a primeira de todas não tem variação. */
export function variacao(atual: number, anterior: number | null): number | null {
    return anterior === null ? null : atual - anterior
}
