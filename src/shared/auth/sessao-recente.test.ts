import { describe, expect, it } from 'vitest'
import { JANELA_SESSAO_RECENTE_MS, sessaoRecente } from './sessao-recente'

const agora = new Date('2026-11-10T12:00:00Z')
const criadaHa = (ms: number) => ({ sessaoCriadaEm: new Date(agora.getTime() - ms) })

describe('sessaoRecente (FR-003, research D11)', () => {
    it('login de agora é recente', () => {
        expect(sessaoRecente(criadaHa(0), agora)).toBe(true)
    })

    it('exatamente 15 minutos ainda é recente; um segundo depois, não', () => {
        expect(sessaoRecente(criadaHa(JANELA_SESSAO_RECENTE_MS), agora)).toBe(true)
        expect(sessaoRecente(criadaHa(JANELA_SESSAO_RECENTE_MS + 1_000), agora)).toBe(false)
    })

    it('data ilegível (época zero) não é recente', () => {
        expect(sessaoRecente({ sessaoCriadaEm: new Date(0) }, agora)).toBe(false)
    })

    it('data inválida não é recente', () => {
        expect(sessaoRecente({ sessaoCriadaEm: new Date('x') }, agora)).toBe(false)
    })
})
