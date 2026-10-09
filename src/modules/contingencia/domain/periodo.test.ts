import { describe, expect, it } from 'vitest'
import {
    formatarPeriodo,
    hojeEmSaoPaulo,
    intervaloUtc,
    periodoDoAtalho,
    periodoPadrao,
    somarDias,
    validarPeriodo
} from './periodo'

/**
 * Filtro de período dos relatórios (specs/023-central-relatorios, research D6).
 *
 * O modo de falha que estes testes travam é silencioso: um registro feito às
 * 23h30 de Brasília é 02h30 UTC do dia seguinte, e um filtro montado em UTC o
 * jogaria no dia errado — a prestação de contas de uma data deixaria de bater
 * com a do dia vizinho sem ninguém perceber.
 */

// 08/10/2026 15:00 UTC = 12:00 em Brasília.
const AGORA = new Date(Date.UTC(2026, 9, 8, 15, 0))

describe('hojeEmSaoPaulo', () => {
    it('usa a data civil de Brasília, não a de UTC', () => {
        // 09/10 01:00 UTC ainda é 08/10 22:00 em Brasília.
        expect(hojeEmSaoPaulo(new Date(Date.UTC(2026, 9, 9, 1, 0)))).toBe('2026-10-08')
        expect(hojeEmSaoPaulo(AGORA)).toBe('2026-10-08')
    })
})

describe('somarDias', () => {
    it('atravessa virada de mês e de ano', () => {
        expect(somarDias('2026-10-31', 1)).toBe('2026-11-01')
        expect(somarDias('2026-01-01', -1)).toBe('2025-12-31')
        expect(somarDias('2028-02-28', 1)).toBe('2028-02-29')
    })
})

describe('periodoPadrao e atalhos', () => {
    it('sem parâmetros, são os últimos 30 dias incluindo hoje', () => {
        expect(periodoPadrao(AGORA)).toEqual({ de: '2026-09-09', ate: '2026-10-08' })
    })

    it('atalhos hoje, 7 dias e 30 dias terminam hoje', () => {
        expect(periodoDoAtalho('hoje', AGORA)).toEqual({ de: '2026-10-08', ate: '2026-10-08' })
        expect(periodoDoAtalho('7dias', AGORA)).toEqual({ de: '2026-10-02', ate: '2026-10-08' })
        expect(periodoDoAtalho('30dias', AGORA)).toEqual(periodoPadrao(AGORA))
    })
})

describe('validarPeriodo', () => {
    it('sem datas, aplica o padrão', () => {
        expect(validarPeriodo({}, AGORA)).toEqual({ ok: true, periodo: periodoPadrao(AGORA) })
    })

    it('aceita um período válido como veio', () => {
        expect(validarPeriodo({ de: '2026-10-01', ate: '2026-10-05' }, AGORA)).toEqual({
            ok: true,
            periodo: { de: '2026-10-01', ate: '2026-10-05' }
        })
    })

    it('só com a data final, conta 30 dias para trás a partir dela', () => {
        expect(validarPeriodo({ ate: '2026-10-05' }, AGORA)).toEqual({
            ok: true,
            periodo: { de: '2026-09-06', ate: '2026-10-05' }
        })
    })

    it('só com a data inicial, vai até hoje', () => {
        expect(validarPeriodo({ de: '2026-10-01' }, AGORA)).toEqual({
            ok: true,
            periodo: { de: '2026-10-01', ate: '2026-10-08' }
        })
    })

    it('recusa início depois do fim', () => {
        expect(validarPeriodo({ de: '2026-10-06', ate: '2026-10-05' }, AGORA)).toEqual({
            ok: false,
            campo: 'de',
            erro: 'A data inicial deve ser anterior ou igual à final.'
        })
    })

    it('recusa início no futuro', () => {
        expect(validarPeriodo({ de: '2026-10-09', ate: '2026-10-10' }, AGORA)).toEqual({
            ok: false,
            campo: 'de',
            erro: 'A data inicial não pode ser futura.'
        })
    })

    it('recusa data malformada ou inexistente, indicando o campo', () => {
        expect(validarPeriodo({ de: '05/10/2026' }, AGORA)).toEqual({
            ok: false,
            campo: 'de',
            erro: 'Informe uma data válida.'
        })
        expect(validarPeriodo({ de: '2026-10-01', ate: '2026-02-30' }, AGORA)).toEqual({
            ok: false,
            campo: 'ate',
            erro: 'Informe uma data válida.'
        })
    })

    it('trata string vazia como ausência (formulário limpo)', () => {
        expect(validarPeriodo({ de: '', ate: '' }, AGORA)).toEqual({ ok: true, periodo: periodoPadrao(AGORA) })
    })
})

describe('intervaloUtc', () => {
    it('converte o dia de Brasília num intervalo semiaberto em UTC', () => {
        const { inicio, fimExclusivo } = intervaloUtc({ de: '2026-10-05', ate: '2026-10-05' })
        expect(inicio.toISOString()).toBe('2026-10-05T03:00:00.000Z')
        expect(fimExclusivo.toISOString()).toBe('2026-10-06T03:00:00.000Z')
    })

    it('um registro às 23h30 de 05/10 (Brasília) pertence ao dia 05/10', () => {
        const registro = new Date('2026-10-06T02:30:00.000Z') // 05/10 23:30 em Brasília
        const dia5 = intervaloUtc({ de: '2026-10-05', ate: '2026-10-05' })
        const dia6 = intervaloUtc({ de: '2026-10-06', ate: '2026-10-06' })

        expect(registro >= dia5.inicio && registro < dia5.fimExclusivo).toBe(true)
        expect(registro >= dia6.inicio && registro < dia6.fimExclusivo).toBe(false)
    })

    it('00h00 de Brasília do dia seguinte já fica fora do período', () => {
        const { fimExclusivo } = intervaloUtc({ de: '2026-10-01', ate: '2026-10-05' })
        const meiaNoiteDo6 = new Date('2026-10-06T03:00:00.000Z')
        expect(meiaNoiteDo6 < fimExclusivo).toBe(false)
    })
})

describe('formatarPeriodo', () => {
    it('formata em dd/mm/aaaa', () => {
        expect(formatarPeriodo({ de: '2026-10-01', ate: '2026-10-05' })).toBe('01/10/2026 a 05/10/2026')
    })

    it('um único dia aparece uma vez', () => {
        expect(formatarPeriodo({ de: '2026-10-05', ate: '2026-10-05' })).toBe('05/10/2026')
    })
})
