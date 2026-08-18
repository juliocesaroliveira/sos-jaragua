import { describe, expect, it } from 'vitest'
import { email, listaNaoVazia, selecaoObrigatoria, senha, textoObrigatorio } from './campos'
import { z } from '../validacao/zod-ptbr'

/**
 * O que estes testes protegem não é a biblioteca — é o requisito de interface
 * 100% em pt-BR (NFR §2.2). O caso `undefined` é o que mais importa: é o
 * formulário enviado vazio, o caminho mais comum, e o único em que a mensagem
 * escaparia para o inglês se a declaração estivesse só no `.min()`.
 */
function mensagemDoErro(resultado: z.ZodSafeParseResult<unknown>): string {
    expect(resultado.success).toBe(false)
    return resultado.success ? '' : resultado.error.issues[0].message
}

describe('textoObrigatorio', () => {
    const campo = textoObrigatorio('Informe o bairro.')

    it('rejeita undefined com a mensagem informada', () => {
        expect(mensagemDoErro(campo.safeParse(undefined))).toBe('Informe o bairro.')
    })

    it('rejeita string vazia com a mensagem informada', () => {
        expect(mensagemDoErro(campo.safeParse(''))).toBe('Informe o bairro.')
    })

    it('aceita texto preenchido', () => {
        expect(campo.safeParse('Centro').success).toBe(true)
    })
})

describe('email', () => {
    it('rejeita undefined em pt-BR', () => {
        expect(mensagemDoErro(email().safeParse(undefined))).toBe('Informe um e-mail válido.')
    })

    it('rejeita formato inválido em pt-BR', () => {
        expect(mensagemDoErro(email().safeParse('abc'))).toBe('Informe um e-mail válido.')
    })

    it('aceita e-mail válido', () => {
        expect(email().safeParse('pessoa@exemplo.com').success).toBe(true)
    })
})

describe('senha', () => {
    it('rejeita undefined em pt-BR', () => {
        expect(mensagemDoErro(senha().safeParse(undefined))).toBe('A senha deve ter ao menos 8 caracteres.')
    })

    it('rejeita menos de 8 caracteres', () => {
        expect(mensagemDoErro(senha().safeParse('1234567'))).toBe('A senha deve ter ao menos 8 caracteres.')
    })

    it('aceita 8 caracteres', () => {
        expect(senha().safeParse('12345678').success).toBe(true)
    })
})

describe('selecaoObrigatoria', () => {
    const VALORES = ['carro', 'moto'] as const
    const campo = selecaoObrigatoria(VALORES, 'Selecione o tipo de veículo.')

    it('rejeita undefined com a mensagem informada', () => {
        expect(mensagemDoErro(campo.safeParse(undefined))).toBe('Selecione o tipo de veículo.')
    })

    it('rejeita valor fora da lista', () => {
        expect(mensagemDoErro(campo.safeParse('barco'))).toBe('Selecione o tipo de veículo.')
    })

    it('aceita valor da lista', () => {
        expect(campo.safeParse('moto').success).toBe(true)
    })
})

describe('listaNaoVazia', () => {
    const campo = listaNaoVazia(z.string(), 'Selecione ao menos uma disponibilidade.')

    it('rejeita undefined com a mensagem informada', () => {
        expect(mensagemDoErro(campo.safeParse(undefined))).toBe('Selecione ao menos uma disponibilidade.')
    })

    it('rejeita lista vazia com a mensagem informada', () => {
        expect(mensagemDoErro(campo.safeParse([]))).toBe('Selecione ao menos uma disponibilidade.')
    })

    it('aceita lista com um item', () => {
        expect(campo.safeParse(['manha']).success).toBe(true)
    })
})
