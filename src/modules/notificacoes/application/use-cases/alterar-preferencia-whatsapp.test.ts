import { describe, expect, it } from 'vitest'
import type { ContatosWhatsapp } from '../ports/contatos-whatsapp'
import type { PreferenciasWhatsapp } from '../ports/preferencias-whatsapp'
import { AlterarPreferenciaWhatsappUseCase } from './alterar-preferencia-whatsapp'

/**
 * Opt-in e opt-out do WhatsApp (024, US2, FR-010/FR-011/FR-013).
 */

function cenario(telefone: string | null, inicial: boolean | null = null) {
    let estado = inicial
    const eventos: { ativo: boolean; origem: string; telefone: string | null }[] = []

    const preferencias: PreferenciasWhatsapp = {
        async lerPreferencia() {
            return estado === null ? null : { ativo: estado, ativoDesde: null }
        },
        async salvarPreferencia(_userId, ativo, origem, tel) {
            estado = ativo
            eventos.push({ ativo, origem, telefone: tel })
        }
    }
    const contatos: ContatosWhatsapp = {
        telefonesDe: async (ids) => new Map(telefone ? ids.map((id) => [id, telefone]) : []),
        usuariosPorTelefone: async () => []
    }

    return {
        useCase: new AlterarPreferenciaWhatsappUseCase(preferencias, contatos),
        eventos,
        estado: () => estado
    }
}

describe('AlterarPreferenciaWhatsappUseCase', () => {
    it('ativar sem escolha prévia grava o estado e um evento com o número vigente', async () => {
        const c = cenario('47999998888')

        const r = await c.useCase.executar({ userId: 'u1', ativo: true, origem: 'perfil' })

        expect(r).toEqual({ ok: true, valor: { ativo: true } })
        expect(c.eventos).toEqual([{ ativo: true, origem: 'perfil', telefone: '5547999998888' }])
    })

    it('ativar o que já está ativo não gera histórico', async () => {
        const c = cenario('47999998888', true)

        await c.useCase.executar({ userId: 'u1', ativo: true, origem: 'perfil' })

        expect(c.eventos).toEqual([])
    })

    it('desativar gera revogação', async () => {
        const c = cenario('47999998888', true)

        await c.useCase.executar({ userId: 'u1', ativo: false, origem: 'resposta_whatsapp' })

        expect(c.estado()).toBe(false)
        expect(c.eventos).toEqual([{ ativo: false, origem: 'resposta_whatsapp', telefone: '5547999998888' }])
    })

    it('desativar quem nunca ativou não gera histórico', async () => {
        const c = cenario('47999998888')

        await c.useCase.executar({ userId: 'u1', ativo: false, origem: 'perfil' })

        expect(c.eventos).toEqual([])
    })

    it.each([
        ['sem perfil', null],
        ['com telefone fixo', '4733334444']
    ])('%s não pode ativar', async (_caso, telefone) => {
        const c = cenario(telefone)

        const r = await c.useCase.executar({ userId: 'u1', ativo: true, origem: 'perfil' })

        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.erro.codigo).toBe('sem_celular')
        expect(c.eventos).toEqual([])
    })

    it('com telefone fixo ainda pode desativar', async () => {
        const c = cenario('4733334444', true)

        const r = await c.useCase.executar({ userId: 'u1', ativo: false, origem: 'perfil' })

        expect(r).toEqual({ ok: true, valor: { ativo: false } })
        expect(c.eventos).toEqual([{ ativo: false, origem: 'perfil', telefone: null }])
    })
})
