import { describe, expect, it } from 'vitest'
import { lerEnvelope, montarEnvelope } from './envelope'
import { ValorIlegivelError } from './erros'

const iv = Buffer.alloc(12, 1)
const conteudo = Buffer.from('conteudo')
const tag = Buffer.alloc(16, 2)

describe('montarEnvelope', () => {
    it('produz o formato v1.<iv>.<ct>.<tag> em base64url', () => {
        const envelope = montarEnvelope({ iv, conteudo, tag })
        const partes = envelope.split('.')
        expect(partes).toHaveLength(4)
        expect(partes[0]).toBe('v1')
        // base64url não usa +, / nem =
        expect(envelope).not.toMatch(/[+/=]/)
    })
})

describe('lerEnvelope', () => {
    it('faz o round-trip das três partes', () => {
        const lido = lerEnvelope(montarEnvelope({ iv, conteudo, tag }))
        expect(Buffer.compare(lido.iv, iv)).toBe(0)
        expect(Buffer.compare(lido.conteudo, conteudo)).toBe(0)
        expect(Buffer.compare(lido.tag, tag)).toBe(0)
    })

    it('rejeita versão desconhecida', () => {
        const v2 = montarEnvelope({ iv, conteudo, tag }).replace(/^v1\./, 'v2.')
        expect(() => lerEnvelope(v2)).toThrow(ValorIlegivelError)
    })

    it('rejeita envelope com número errado de partes', () => {
        expect(() => lerEnvelope('v1.apenas.duas')).toThrow(ValorIlegivelError)
        expect(() => lerEnvelope('v1.a.b.c.d')).toThrow(ValorIlegivelError)
    })

    it('rejeita texto que não é envelope — inclusive um valor em texto plano', () => {
        expect(() => lerEnvelope('12345678901')).toThrow(ValorIlegivelError)
        expect(() => lerEnvelope('')).toThrow(ValorIlegivelError)
    })

    it('rejeita IV ou tag com tamanho inválido', () => {
        const ruim = montarEnvelope({ iv: Buffer.alloc(5, 1), conteudo, tag })
        expect(() => lerEnvelope(ruim)).toThrow(ValorIlegivelError)
    })
})
