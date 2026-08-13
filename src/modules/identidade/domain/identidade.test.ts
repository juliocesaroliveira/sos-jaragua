import { describe, expect, it } from 'vitest'
import { cpfEhValido, formatarCpf, normalizarCpf } from './cpf'
import { calcularIdade, ehMaiorDeIdade } from './maioridade'
import { cepEhValido, emailEhValido, telefoneEhValido } from './contato'

/** TEST-02 — regras de domínio de Identidade (BRD §3.1, DESIGN.md §10.1). */

describe('CPF — dígito verificador', () => {
    it('aceita CPFs válidos', () => {
        // Gerados por algoritmo; nenhum pertence a pessoa real.
        for (const cpf of ['529.982.247-25', '111.444.777-35', '52998224725']) {
            expect(cpfEhValido(cpf), cpf).toBe(true)
        }
    })

    it('rejeita quando um dígito verificador está errado', () => {
        expect(cpfEhValido('529.982.247-26')).toBe(false)
        expect(cpfEhValido('111.444.777-30')).toBe(false)
    })

    it('rejeita sequências de dígitos repetidos', () => {
        // Passam no cálculo do DV, mas não são CPFs válidos — o caso que uma
        // implementação ingênua deixa passar.
        for (const cpf of ['000.000.000-00', '111.111.111-11', '99999999999']) {
            expect(cpfEhValido(cpf), cpf).toBe(false)
        }
    })

    it('rejeita comprimento diferente de 11 dígitos', () => {
        expect(cpfEhValido('529.982.247-2')).toBe(false)
        expect(cpfEhValido('529982247251')).toBe(false)
        expect(cpfEhValido('')).toBe(false)
    })

    it('normaliza e formata', () => {
        expect(normalizarCpf('529.982.247-25')).toBe('52998224725')
        expect(formatarCpf('52998224725')).toBe('529.982.247-25')
        // Entrada com tamanho inesperado volta intacta em vez de virar lixo.
        expect(formatarCpf('123')).toBe('123')
    })
})

describe('Maioridade — ≥ 18 anos', () => {
    const referencia = new Date(2026, 7, 9) // 09/08/2026, horário local

    it('aceita quem já fez 18 anos', () => {
        expect(ehMaiorDeIdade('2008-08-08', referencia)).toBe(true)
        expect(ehMaiorDeIdade('1990-01-01', referencia)).toBe(true)
    })

    it('aceita quem faz 18 exatamente na data de referência', () => {
        expect(ehMaiorDeIdade('2008-08-09', referencia)).toBe(true)
        expect(calcularIdade('2008-08-09', referencia)).toBe(18)
    })

    it('rejeita quem faz 18 no dia seguinte', () => {
        expect(ehMaiorDeIdade('2008-08-10', referencia)).toBe(false)
        expect(calcularIdade('2008-08-10', referencia)).toBe(17)
    })

    it('não conta aniversário que ainda não chegou no ano corrente', () => {
        expect(calcularIdade('2008-12-31', referencia)).toBe(17)
    })

    it('interpreta YYYY-MM-DD como data local, não UTC', () => {
        // Em fuso negativo (Brasil), `new Date('2008-08-09')` cairia no dia 8.
        // Se isso acontecesse, quem faz 18 hoje seria barrado.
        expect(calcularIdade('2008-08-09', referencia)).toBe(18)
    })
})

describe('Contato — e-mail, telefone e CEP', () => {
    it('valida e-mails', () => {
        expect(emailEhValido('maria@exemplo.com.br')).toBe(true)
        expect(emailEhValido('  maria@exemplo.com  ')).toBe(true)
        expect(emailEhValido('maria@exemplo')).toBe(false)
        expect(emailEhValido('maria arroba exemplo.com')).toBe(false)
        expect(emailEhValido('')).toBe(false)
    })

    it('valida telefone brasileiro com DDD', () => {
        expect(telefoneEhValido('(47) 99123-4567')).toBe(true)
        expect(telefoneEhValido('4733701234')).toBe(true)
        // Celular de 11 dígitos precisa do nono dígito 9.
        expect(telefoneEhValido('(47) 81234-5678')).toBe(false)
        // DDD inexistente.
        expect(telefoneEhValido('(01) 99123-4567')).toBe(false)
        expect(telefoneEhValido('99123456')).toBe(false)
    })

    it('valida CEP de 8 dígitos', () => {
        expect(cepEhValido('89250-000')).toBe(true)
        expect(cepEhValido('89250000')).toBe(true)
        expect(cepEhValido('8925-000')).toBe(false)
    })
})
