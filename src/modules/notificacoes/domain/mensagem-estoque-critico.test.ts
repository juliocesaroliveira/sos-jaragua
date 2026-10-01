import { describe, expect, it } from 'vitest'
import { mensagemEstoqueCritico, type ItemCritico } from './mensagem-estoque-critico'

/**
 * Texto do alerta `estoque_critico` (specs/020-resolver-pendencias,
 * contracts/estoque-minimo.md). Extraído de `avaliarEstoqueCritico`, que
 * acessa o banco, para que a regra do texto tenha teste unitário (Princípio III).
 */
const critico = (nome: string, limiar = 1, unidadeMedida: ItemCritico['unidadeMedida'] = 'unidade'): ItemCritico => ({
    nome,
    saldo: 0,
    limiar,
    unidadeMedida
})

describe('mensagemEstoqueCritico', () => {
    it('não emite nada sem itens críticos', () => {
        expect(mensagemEstoqueCritico([])).toBeNull()
    })

    it('com um item, cita o mínimo e usa "atingiu"', () => {
        const alerta = mensagemEstoqueCritico([{ nome: 'Arroz', saldo: 19, limiar: 20, unidadeMedida: 'kg' }])

        expect(alerta?.titulo).toBe('Estoque crítico')
        expect(alerta?.mensagem).toBe('Arroz (mín. 20 kg) atingiu o estoque mínimo de segurança.')
    })

    it('com dois itens, separa por vírgula e usa "atingiram"', () => {
        const alerta = mensagemEstoqueCritico([critico('Arroz', 20, 'kg'), critico('Cobertor', 10)])

        expect(alerta?.mensagem).toBe(
            'Arroz (mín. 20 kg), Cobertor (mín. 10 un) atingiram o estoque mínimo de segurança.'
        )
    })

    it('lista até 5 nomes e resume o resto no singular', () => {
        const alerta = mensagemEstoqueCritico(['A', 'B', 'C', 'D', 'E', 'F'].map((n) => critico(n)))

        expect(alerta?.mensagem).toBe(
            'A (mín. 1 un), B (mín. 1 un), C (mín. 1 un), D (mín. 1 un), E (mín. 1 un) e mais 1 item atingiram o estoque mínimo de segurança.'
        )
    })

    it('lista até 5 nomes e resume o resto no plural', () => {
        const alerta = mensagemEstoqueCritico(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n) => critico(n)))

        expect(alerta?.mensagem).toBe(
            'A (mín. 1 un), B (mín. 1 un), C (mín. 1 un), D (mín. 1 un), E (mín. 1 un) e mais 2 itens atingiram o estoque mínimo de segurança.'
        )
    })

    it('formata o limiar decimal em pt-BR', () => {
        const alerta = mensagemEstoqueCritico([critico('Feijão', 2.5, 'kg')])

        expect(alerta?.mensagem).toBe('Feijão (mín. 2,5 kg) atingiu o estoque mínimo de segurança.')
    })

    it('leva todos os itens críticos no contexto, não só os exibidos', () => {
        const itens = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n, i) => ({ ...critico(n, i + 1), saldo: i }))

        const alerta = mensagemEstoqueCritico(itens)

        expect(alerta?.contexto.itens).toHaveLength(7)
        expect(alerta?.contexto.itens[6]).toEqual({ nome: 'G', saldo: 6, limiar: 7 })
    })
})
