import { describe, expect, it } from 'vitest'
import {
    HORIZONTE_MAXIMO,
    HORIZONTE_MINIMO,
    diasAteVencer,
    ehHorizonteValido,
    faltaProporcional,
    ordenarCriticos,
    situacaoValidade
} from './calculos-estoque'

/** Regras de R-05 Estoque crítico e R-06 Validades (specs/023-central-relatorios, US2, research D11). */

describe('faltaProporcional', () => {
    it('é quanto falta para o mínimo, como fração do mínimo', () => {
        expect(faltaProporcional(3, 10)).toBeCloseTo(0.7)
        expect(faltaProporcional(0, 5)).toBe(1)
        expect(faltaProporcional(5, 5)).toBe(0)
    })

    it('mínimo zero não tem falta (alerta desligado)', () => {
        expect(faltaProporcional(0, 0)).toBe(0)
    })
})

describe('ordenarCriticos', () => {
    it('do mais crítico (maior falta proporcional) ao menos crítico', () => {
        const itens = [
            { nome: 'A', saldo: 9, limiar: 10 }, // 10%
            { nome: 'B', saldo: 0, limiar: 2 }, // 100%
            { nome: 'C', saldo: 50, limiar: 100 } // 50%
        ]
        expect(ordenarCriticos(itens).map((i) => i.nome)).toEqual(['B', 'C', 'A'])
    })

    it('empate na proporção desempata pelo nome', () => {
        const itens = [
            { nome: 'Feijão', saldo: 0, limiar: 3 },
            { nome: 'Arroz', saldo: 0, limiar: 8 }
        ]
        expect(ordenarCriticos(itens).map((i) => i.nome)).toEqual(['Arroz', 'Feijão'])
    })

    it('não altera a lista recebida', () => {
        const itens = [
            { nome: 'A', saldo: 9, limiar: 10 },
            { nome: 'B', saldo: 0, limiar: 2 }
        ]
        ordenarCriticos(itens)
        expect(itens.map((i) => i.nome)).toEqual(['A', 'B'])
    })
})

describe('situacaoValidade e diasAteVencer', () => {
    const HOJE = '2026-10-08'

    it('antes de hoje é vencida, com dias negativos', () => {
        expect(situacaoValidade('2026-10-07', HOJE, 30)).toBe('vencida')
        expect(diasAteVencer('2026-10-07', HOJE)).toBe(-1)
    })

    it('hoje ainda não venceu: vence hoje, 0 dias', () => {
        expect(situacaoValidade('2026-10-08', HOJE, 30)).toBe('a_vencer')
        expect(diasAteVencer('2026-10-08', HOJE)).toBe(0)
    })

    it('dentro do horizonte é "a vencer"; depois dele, fora do relatório', () => {
        expect(situacaoValidade('2026-10-18', HOJE, 30)).toBe('a_vencer')
        expect(situacaoValidade('2026-11-07', HOJE, 30)).toBe('a_vencer')
        expect(situacaoValidade('2026-11-08', HOJE, 30)).toBeNull()
        expect(situacaoValidade('2026-12-07', HOJE, 30)).toBeNull()
    })

    it('atravessa virada de mês e de ano sem erro de fuso', () => {
        expect(diasAteVencer('2027-01-01', '2026-12-31')).toBe(1)
    })
})

describe('horizonte', () => {
    it('aceita de 1 a 365 dias, inteiros', () => {
        expect(HORIZONTE_MINIMO).toBe(1)
        expect(HORIZONTE_MAXIMO).toBe(365)
        expect(ehHorizonteValido(1)).toBe(true)
        expect(ehHorizonteValido(365)).toBe(true)
        expect(ehHorizonteValido(0)).toBe(false)
        expect(ehHorizonteValido(366)).toBe(false)
        expect(ehHorizonteValido(2.5)).toBe(false)
    })
})
