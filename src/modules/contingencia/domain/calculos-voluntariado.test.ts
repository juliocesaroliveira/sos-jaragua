import { describe, expect, it } from 'vitest'
import { diasEntre, horasDeSegundos, ocupacaoPercentual, resumoTriagem } from './calculos-voluntariado'

/** Regras de R-10, R-12 e R-13 (specs/023-central-relatorios, US3, research D11). */

describe('ocupacaoPercentual', () => {
    it('confirmados sobre vagas, arredondado', () => {
        expect(ocupacaoPercentual(2, 5)).toBe(40)
        expect(ocupacaoPercentual(5, 5)).toBe(100)
        expect(ocupacaoPercentual(1, 3)).toBe(33)
        expect(ocupacaoPercentual(0, 4)).toBe(0)
    })

    it('turno sem vagas não divide por zero', () => {
        expect(ocupacaoPercentual(0, 0)).toBe(0)
    })
})

describe('horasDeSegundos', () => {
    it('converte para horas com uma casa decimal', () => {
        expect(horasDeSegundos(8 * 3600)).toBe(8)
        expect(horasDeSegundos(4.25 * 3600)).toBe(4.3)
        expect(horasDeSegundos(0)).toBe(0)
    })
})

describe('diasEntre', () => {
    it('dias corridos inteiros, arredondados para baixo', () => {
        expect(diasEntre(new Date('2026-10-01T10:00:00Z'), new Date('2026-10-03T09:00:00Z'))).toBe(1)
        expect(diasEntre(new Date('2026-10-01T10:00:00Z'), new Date('2026-10-03T10:00:00Z'))).toBe(2)
    })
})

describe('resumoTriagem', () => {
    const AGORA = new Date('2026-10-10T12:00:00Z')

    it('conta por situação e calcula o tempo médio até decisão só das decididas', () => {
        const resumo = resumoTriagem([
            { status: 'pendente', primeiroEnvio: new Date('2026-10-01T12:00:00Z'), decididoEm: null },
            {
                status: 'aprovado',
                primeiroEnvio: new Date('2026-10-01T12:00:00Z'),
                decididoEm: new Date('2026-10-03T12:00:00Z') // 2 dias
            },
            {
                status: 'rejeitado',
                primeiroEnvio: new Date('2026-10-01T12:00:00Z'),
                decididoEm: new Date('2026-10-02T00:00:00Z') // 0,5 dia
            }
        ])

        expect(resumo).toEqual({ pendentes: 1, aprovadas: 1, rejeitadas: 1, tempoMedioDias: 1.3 })
    })

    it('sem candidaturas decididas, o tempo médio é nulo (não zero)', () => {
        expect(
            resumoTriagem([{ status: 'pendente', primeiroEnvio: AGORA, decididoEm: null }]).tempoMedioDias
        ).toBeNull()
    })
})
