import { describe, expect, it } from 'vitest'
import { INTERVALO_MS, INTERVALO_MAXIMO_MS, proximoIntervalo } from './politica-intervalo'

/**
 * Política de intervalo do sino (012-notificacoes-tempo-real,
 * contracts/sino-cliente.md C-12, data-model.md R4).
 *
 * É a única lógica pura da feature, e concentra a distinção que faz a diferença
 * em campo: **`401` para em definitivo, falha de rede espaça**. Tratar as duas
 * igual deixa o usuário sem atualização depois de um túnel, ou martelando um
 * endpoint que já o rejeitou.
 */

describe('proximoIntervalo — operação normal', () => {
    it('usa o intervalo padrão quando não houve falha', () => {
        expect(proximoIntervalo({ falhasConsecutivas: 0, sessaoEncerrada: false })).toBe(INTERVALO_MS)
    })

    it('volta ao intervalo padrão depois de uma consulta bem-sucedida', () => {
        // Sucesso zera o contador de falhas — é assim que o TanStack o reporta.
        expect(proximoIntervalo({ falhasConsecutivas: 0, sessaoEncerrada: false })).toBe(INTERVALO_MS)
    })
})

describe('proximoIntervalo — falhas de rede', () => {
    it('espaça progressivamente a cada falha consecutiva', () => {
        const [um, dois, tres] = [1, 2, 3].map((falhas) =>
            proximoIntervalo({ falhasConsecutivas: falhas, sessaoEncerrada: false })
        )

        // Falha de rede nunca desliga o ciclo — os três são números, não `false`.
        expect(typeof um === 'number' && typeof dois === 'number' && typeof tres === 'number').toBe(true)
        if (typeof um !== 'number' || typeof dois !== 'number' || typeof tres !== 'number') return

        expect(um).toBeGreaterThan(INTERVALO_MS)
        expect(dois).toBeGreaterThan(um)
        expect(tres).toBeGreaterThan(dois)
    })

    it('não ultrapassa o teto, por mais falhas que haja', () => {
        // Sem teto, um aparelho esquecido offline acordaria para consultar uma
        // vez por dia — ou nunca mais, dependendo do overflow.
        expect(proximoIntervalo({ falhasConsecutivas: 50, sessaoEncerrada: false })).toBe(INTERVALO_MAXIMO_MS)
        expect(proximoIntervalo({ falhasConsecutivas: 1000, sessaoEncerrada: false })).toBe(INTERVALO_MAXIMO_MS)
    })

    it('continua tentando — falha de rede nunca desliga o ciclo', () => {
        expect(proximoIntervalo({ falhasConsecutivas: 99, sessaoEncerrada: false })).not.toBe(false)
    })
})

describe('proximoIntervalo — sessão encerrada', () => {
    it('para em definitivo após 401', () => {
        expect(proximoIntervalo({ falhasConsecutivas: 1, sessaoEncerrada: true })).toBe(false)
    })

    it('para mesmo sem falhas acumuladas', () => {
        expect(proximoIntervalo({ falhasConsecutivas: 0, sessaoEncerrada: true })).toBe(false)
    })

    it('a sessão encerrada tem precedência sobre o recuo progressivo', () => {
        // Uma aba esquecida aberta não pode voltar a consultar depois do teto:
        // sem sessão, o endpoint só devolveria 401 para sempre.
        expect(proximoIntervalo({ falhasConsecutivas: 50, sessaoEncerrada: true })).toBe(false)
    })
})
