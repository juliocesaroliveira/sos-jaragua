import { beforeAll, describe, expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { indiceCego } from './index'

beforeAll(() => {
    process.env.DADOS_SENSIVEIS_CHAVE = randomBytes(32).toString('base64')
})

describe('indiceCego', () => {
    it('é determinístico para o mesmo valor — é o que sustenta unicidade e busca', () => {
        expect(indiceCego('12345678901')).toBe(indiceCego('12345678901'))
    })

    it('normaliza para dígitos: formatado e cru produzem o MESMO índice', () => {
        expect(indiceCego('123.456.789-01')).toBe(indiceCego('12345678901'))
        expect(indiceCego(' 123 456 789 01 ')).toBe(indiceCego('12345678901'))
    })

    it('produz índices distintos para valores distintos', () => {
        expect(indiceCego('12345678901')).not.toBe(indiceCego('12345678902'))
    })

    it('não devolve o valor original nem o contém', () => {
        expect(indiceCego('12345678901')).not.toContain('12345678901')
    })

    it('usa base64url — seguro para índice e comparação', () => {
        expect(indiceCego('12345678901')).not.toMatch(/[+/=]/)
    })

    it('depende da chave: a mesma entrada com outra chave muda o índice', () => {
        const a = indiceCego('12345678901')
        process.env.DADOS_SENSIVEIS_CHAVE = randomBytes(32).toString('base64')
        expect(indiceCego('12345678901')).not.toBe(a)
    })
})
