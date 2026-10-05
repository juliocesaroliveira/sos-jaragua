import { describe, expect, it } from 'vitest'
import { escaparLike } from './escapar-like'

describe('escaparLike', () => {
    it('mantém texto comum inalterado', () => {
        expect(escaparLike('Água mineral 5L')).toBe('Água mineral 5L')
    })

    it('escapa o curinga %', () => {
        expect(escaparLike('50%')).toBe('50\\%')
    })

    it('escapa o curinga _', () => {
        expect(escaparLike('kit_1')).toBe('kit\\_1')
    })

    it('escapa a própria barra invertida', () => {
        expect(escaparLike('a\\b')).toBe('a\\\\b')
    })

    it('escapa a barra antes dos curingas, sem escapar duas vezes', () => {
        expect(escaparLike('a%_\\b')).toBe('a\\%\\_\\\\b')
    })

    it('aceita string vazia', () => {
        expect(escaparLike('')).toBe('')
    })
})
