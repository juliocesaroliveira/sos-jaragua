import { describe, expect, it } from 'vitest'
import { balancoItem, temMovimento, variacao } from './calculos-consolidados'

/** Regras de R-07 Movimentação e R-14 Evolução da crise (specs/023-central-relatorios, US5, research D11). */

describe('balancoItem', () => {
    it('reproduz o exemplo da spec: 100 + 50 − 30 − 5 = 115', () => {
        // Nada se moveu depois do período: o saldo final é o saldo de hoje.
        const balanco = balancoItem(
            115,
            { entradas: 50, saidas: 30, descartes: 5 },
            { entradas: 0, saidas: 0, descartes: 0 }
        )
        expect(balanco).toEqual({ saldoInicial: 100, entradas: 50, saidas: 30, descartes: 5, saldoFinal: 115 })
    })

    it('desconta o que se moveu depois do fim do período', () => {
        // Hoje: 125. Depois do período entraram 10 → no fim do período eram 115.
        const balanco = balancoItem(
            125,
            { entradas: 50, saidas: 30, descartes: 5 },
            { entradas: 10, saidas: 0, descartes: 0 }
        )
        expect(balanco.saldoFinal).toBe(115)
        expect(balanco.saldoInicial).toBe(100)
    })

    it('sempre fecha a conta: inicial + entradas − saídas − descartes = final (SC-003)', () => {
        const casos = [
            [7.25, { entradas: 1.5, saidas: 0.75, descartes: 0 }, { entradas: 2, saidas: 1, descartes: 0.5 }],
            [0, { entradas: 0, saidas: 3, descartes: 0 }, { entradas: 0, saidas: 0, descartes: 0 }],
            [0.3, { entradas: 0.1, saidas: 0.2, descartes: 0 }, { entradas: 0, saidas: 0, descartes: 0 }]
        ] as const
        for (const [atual, no, apos] of casos) {
            const b = balancoItem(atual, no, apos)
            expect(b.saldoInicial + b.entradas - b.saidas - b.descartes).toBeCloseTo(b.saldoFinal, 3)
        }
    })

    it('arredonda em 3 casas — sem 0,30000000000000004 na planilha', () => {
        const b = balancoItem(
            0.3,
            { entradas: 0.1, saidas: 0.2, descartes: 0 },
            { entradas: 0, saidas: 0, descartes: 0 }
        )
        expect(b.saldoInicial).toBe(0.4)
    })
})

describe('temMovimento', () => {
    it('item parado e zerado não entra no relatório', () => {
        expect(temMovimento({ saldoInicial: 0, entradas: 0, saidas: 0, descartes: 0, saldoFinal: 0 })).toBe(false)
    })

    it('item com saldo, mesmo sem movimento, entra', () => {
        expect(temMovimento({ saldoInicial: 4, entradas: 0, saidas: 0, descartes: 0, saldoFinal: 4 })).toBe(true)
    })
})

describe('variacao', () => {
    it('diferença em relação à atualização anterior', () => {
        expect(variacao(120, 100)).toBe(20)
        expect(variacao(80, 100)).toBe(-20)
    })

    it('a primeira atualização de todas não tem variação', () => {
        expect(variacao(100, null)).toBeNull()
    })
})
