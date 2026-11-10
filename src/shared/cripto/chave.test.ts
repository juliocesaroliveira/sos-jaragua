import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { subchaveCifra, subchaveIndice, validarChave } from './chave'

const VARIAVEL = 'DADOS_SENSIVEIS_CHAVE'

describe('validarChave', () => {
    let original: string | undefined

    beforeEach(() => {
        original = process.env[VARIAVEL]
    })

    afterEach(() => {
        if (original === undefined) delete process.env[VARIAVEL]
        else process.env[VARIAVEL] = original
    })

    it('lança quando a variável está ausente, nomeando-a em pt-BR', () => {
        delete process.env[VARIAVEL]
        expect(() => validarChave()).toThrowError(new RegExp(VARIAVEL))
        delete process.env[VARIAVEL]
        expect(() => validarChave()).toThrowError(/ausente|não (foi )?definida|configurada/i)
    })

    it('lança quando a variável está vazia', () => {
        process.env[VARIAVEL] = ''
        expect(() => validarChave()).toThrowError(new RegExp(VARIAVEL))
    })

    it('lança quando o valor não é base64 válido', () => {
        process.env[VARIAVEL] = 'isto-não-é-base64-!!!'
        expect(() => validarChave()).toThrowError(new RegExp(VARIAVEL))
    })

    it('lança quando o valor decodifica para um tamanho diferente de 32 bytes', () => {
        process.env[VARIAVEL] = randomBytes(16).toString('base64')
        expect(() => validarChave()).toThrowError(/32 bytes/)
    })

    it('aceita exatamente 32 bytes em base64', () => {
        process.env[VARIAVEL] = randomBytes(32).toString('base64')
        expect(() => validarChave()).not.toThrow()
    })
})

describe('derivação de subchaves', () => {
    it('deriva subchaves de 32 bytes', () => {
        process.env[VARIAVEL] = randomBytes(32).toString('base64')
        expect(subchaveCifra()).toHaveLength(32)
        expect(subchaveIndice()).toHaveLength(32)
    })

    it('deriva subchaves DIFERENTES para cifra e índice — a mesma chave nunca serve a dois propósitos', () => {
        process.env[VARIAVEL] = randomBytes(32).toString('base64')
        expect(Buffer.compare(subchaveCifra(), subchaveIndice())).not.toBe(0)
    })

    it('deriva de forma determinística a partir da mesma chave mestra', () => {
        const mestra = randomBytes(32).toString('base64')
        process.env[VARIAVEL] = mestra
        const a = subchaveCifra()
        process.env[VARIAVEL] = mestra
        expect(Buffer.compare(a, subchaveCifra())).toBe(0)
    })

    it('deriva subchaves distintas a partir de chaves mestras distintas', () => {
        process.env[VARIAVEL] = randomBytes(32).toString('base64')
        const a = subchaveCifra()
        process.env[VARIAVEL] = randomBytes(32).toString('base64')
        expect(Buffer.compare(a, subchaveCifra())).not.toBe(0)
    })
})
