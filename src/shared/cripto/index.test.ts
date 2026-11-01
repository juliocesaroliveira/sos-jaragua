import { beforeAll, describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { cifrar, decifrar } from './index'
import { ValorIlegivelError } from './erros'

beforeAll(() => {
    process.env.DADOS_SENSIVEIS_CHAVE = randomBytes(32).toString('base64')
})

describe('cifrar/decifrar', () => {
    it('faz round-trip preservando o valor exatamente', () => {
        for (const valor of ['12345678901', '89250000', '1990-03-15']) {
            expect(decifrar(cifrar(valor))).toBe(valor)
        }
    })

    it('preserva acentuação, pontuação e espaços', () => {
        const valor = 'Alergia a dipirona — usa marca-passo; CEP 89.250-000'
        expect(decifrar(cifrar(valor))).toBe(valor)
    })

    it('preserva string vazia sem confundir com ausência', () => {
        expect(decifrar(cifrar(''))).toBe('')
    })

    it('produz ciphertexts DIFERENTES para o mesmo valor (IV aleatório)', () => {
        const a = cifrar('12345678901')
        const b = cifrar('12345678901')
        expect(a).not.toBe(b)
        expect(decifrar(a)).toBe(decifrar(b))
    })

    it('lança ValorIlegivelError quando a tag de autenticação é adulterada', () => {
        const partes = cifrar('12345678901').split('.')
        const tagRuim = Buffer.from(partes[3]!, 'base64url')
        tagRuim[0] = tagRuim[0]! ^ 0xff
        const adulterado = [partes[0], partes[1], partes[2], tagRuim.toString('base64url')].join('.')
        expect(() => decifrar(adulterado)).toThrow(ValorIlegivelError)
    })

    it('lança ValorIlegivelError quando o conteúdo é adulterado', () => {
        const partes = cifrar('12345678901').split('.')
        const ctRuim = Buffer.from(partes[2]!, 'base64url')
        ctRuim[0] = ctRuim[0]! ^ 0xff
        const adulterado = [partes[0], partes[1], ctRuim.toString('base64url'), partes[3]].join('.')
        expect(() => decifrar(adulterado)).toThrow(ValorIlegivelError)
    })

    it('lança ValorIlegivelError ao ler com outra chave — troca de chave falha de forma visível', () => {
        const envelope = cifrar('12345678901')
        process.env.DADOS_SENSIVEIS_CHAVE = randomBytes(32).toString('base64')
        expect(() => decifrar(envelope)).toThrow(ValorIlegivelError)
    })

    it('não expõe o valor original na mensagem de erro', () => {
        const envelope = cifrar('12345678901')
        process.env.DADOS_SENSIVEIS_CHAVE = randomBytes(32).toString('base64')
        try {
            decifrar(envelope)
            expect.unreachable('deveria ter lançado')
        } catch (erro) {
            expect(String(erro)).not.toContain('12345678901')
        }
    })
})
