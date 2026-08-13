import { describe, expect, it } from 'vitest'
import { validadeEstaVencida, validarEntrada } from './entrada'

/**
 * TEST-02 — BRD §4.1: item perecível exige data de validade, e o sistema deve
 * "bloquear inserção de data retroativa (vencida)".
 */
const HOJE = new Date(2026, 7, 9) // 09/08/2026 local

const BASE = {
    itemId: '11111111-1111-1111-1111-111111111111',
    quantidade: 10,
    condicao: 'novo' as const,
    perecivel: false
}

describe('validadeEstaVencida', () => {
    it('considera vencido apenas o que é anterior a hoje', () => {
        expect(validadeEstaVencida('2026-08-08', HOJE)).toBe(true)
        expect(validadeEstaVencida('2026-07-31', HOJE)).toBe(true)
    })

    it('não considera vencido o que vence hoje', () => {
        // Um item que vence hoje ainda pode ser distribuído hoje.
        expect(validadeEstaVencida('2026-08-09', HOJE)).toBe(false)
    })

    it('não considera vencido o futuro', () => {
        expect(validadeEstaVencida('2026-08-10', HOJE)).toBe(false)
        expect(validadeEstaVencida('2027-01-01', HOJE)).toBe(false)
    })
})

describe('validarEntrada — perecível', () => {
    it('exige data de validade quando perecível', () => {
        const r = validarEntrada({ ...BASE, perecivel: true, dataValidade: null }, HOJE)
        expect(r.ok).toBe(false)
        if (r.ok) return
        const campos = r.erro.detalhes?.campos as Record<string, string>
        expect(campos.dataValidade).toContain('exige data de validade')
    })

    it('bloqueia validade retroativa', () => {
        const r = validarEntrada({ ...BASE, perecivel: true, dataValidade: '2026-08-01' }, HOJE)
        expect(r.ok).toBe(false)
        if (r.ok) return
        const campos = r.erro.detalhes?.campos as Record<string, string>
        expect(campos.dataValidade).toContain('retroativa')
    })

    it('aceita validade futura', () => {
        const r = validarEntrada({ ...BASE, perecivel: true, dataValidade: '2026-12-31' }, HOJE)
        expect(r.ok).toBe(true)
        if (!r.ok) return
        expect(r.valor.dataValidade).toBe('2026-12-31')
    })

    it('descarta a validade informada quando o item não é perecível', () => {
        // Evita dado órfão que apareceria num relatório de vencimento.
        const r = validarEntrada({ ...BASE, perecivel: false, dataValidade: '2026-12-31' }, HOJE)
        expect(r.ok).toBe(true)
        if (!r.ok) return
        expect(r.valor.dataValidade).toBeNull()
    })
})

describe('validarEntrada — item e quantidade', () => {
    it('exige item existente ou item novo', () => {
        const r = validarEntrada({ ...BASE, itemId: null, novoItem: null }, HOJE)
        expect(r.ok).toBe(false)
        if (r.ok) return
        expect((r.erro.detalhes?.campos as Record<string, string>).item).toBeDefined()
    })

    it('aceita item novo em vez de itemId', () => {
        const r = validarEntrada(
            {
                ...BASE,
                itemId: null,
                novoItem: { nome: 'Arroz 5kg', categoria: 'alimentacao', unidadeMedida: 'unidade' }
            },
            HOJE
        )
        expect(r.ok).toBe(true)
    })

    it('rejeita quantidade zero ou negativa', () => {
        for (const quantidade of [0, -5]) {
            const r = validarEntrada({ ...BASE, quantidade }, HOJE)
            expect(r.ok, `quantidade=${quantidade}`).toBe(false)
        }
    })

    it('acumula todos os erros de uma vez', () => {
        // Quem preenche no celular, em campo, não deve descobrir um problema
        // por vez.
        const r = validarEntrada({ ...BASE, itemId: null, quantidade: 0, perecivel: true }, HOJE)
        expect(r.ok).toBe(false)
        if (r.ok) return
        const campos = r.erro.detalhes?.campos as Record<string, string>
        expect(Object.keys(campos).sort()).toEqual(['dataValidade', 'item', 'quantidade'])
    })
})
