import { describe, expect, it } from 'vitest'
import { LIMITES_NOME_HABILIDADE, normalizarNomeHabilidade, validarNomeHabilidade } from './habilidade'

describe('normalizarNomeHabilidade', () => {
    it('remove espaços nas pontas', () => {
        expect(normalizarNomeHabilidade('  Motosserra  ')).toBe('Motosserra')
    })

    it('colapsa espaços internos repetidos', () => {
        expect(normalizarNomeHabilidade('Primeiros    Socorros')).toBe('Primeiros Socorros')
    })

    it('trata quebras de linha e tabulações como espaço', () => {
        expect(normalizarNomeHabilidade('Apoio\n\tLogístico')).toBe('Apoio Logístico')
    })

    it('devolve string vazia para entrada só de espaços', () => {
        expect(normalizarNomeHabilidade('   ')).toBe('')
    })

    it('não altera a caixa — só a comparação de duplicidade ignora caixa', () => {
        expect(normalizarNomeHabilidade('CNH D/E')).toBe('CNH D/E')
        expect(normalizarNomeHabilidade('motosserra')).toBe('motosserra')
    })

    it('é idempotente', () => {
        const uma = normalizarNomeHabilidade('  Operação   de  drone ')
        expect(normalizarNomeHabilidade(uma)).toBe(uma)
    })
})

describe('validarNomeHabilidade', () => {
    it('aceita um nome dentro dos limites', () => {
        expect(validarNomeHabilidade('Motosserra')).toBeNull()
    })

    it('recusa nome vazio', () => {
        const erro = validarNomeHabilidade('')
        expect(erro).not.toBeNull()
        expect(erro?.detalhes?.campos).toMatchObject({ nome: expect.any(String) })
    })

    it('recusa nome que só tinha espaços', () => {
        expect(validarNomeHabilidade('   ')).not.toBeNull()
    })

    it(`recusa nome com menos de ${LIMITES_NOME_HABILIDADE.min} caracteres`, () => {
        expect(validarNomeHabilidade('A')).not.toBeNull()
    })

    it(`aceita exatamente ${LIMITES_NOME_HABILIDADE.min} caracteres`, () => {
        expect(validarNomeHabilidade('AB')).toBeNull()
    })

    it(`recusa nome com mais de ${LIMITES_NOME_HABILIDADE.max} caracteres`, () => {
        expect(validarNomeHabilidade('x'.repeat(LIMITES_NOME_HABILIDADE.max + 1))).not.toBeNull()
    })

    it(`aceita exatamente ${LIMITES_NOME_HABILIDADE.max} caracteres`, () => {
        expect(validarNomeHabilidade('x'.repeat(LIMITES_NOME_HABILIDADE.max))).toBeNull()
    })

    it('valida sobre o nome normalizado, não sobre o bruto', () => {
        // 80 caracteres úteis cercados de espaços continuam válidos.
        expect(validarNomeHabilidade(`  ${'x'.repeat(LIMITES_NOME_HABILIDADE.max)}  `)).toBeNull()
    })

    it('devolve mensagem em pt-BR no campo `nome`', () => {
        const erro = validarNomeHabilidade('A')
        const campos = erro?.detalhes?.campos as Record<string, string>
        expect(campos.nome).toContain('caracteres')
    })
})
