import { describe, expect, it } from 'vitest'
import { itensCriticos, limiarDoItem, validarEstoqueMinimo } from './estoque-minimo'

/**
 * Mínimo de segurança por item (specs/020-resolver-pendencias, Q3): vazio herda
 * o limiar global, `0` desliga o alerta, `n > 0` é o próprio limiar.
 */
describe('limiarDoItem', () => {
    it('herda o limiar global quando o item não tem mínimo próprio', () => {
        expect(limiarDoItem(null, 5)).toBe(5)
    })

    it('desliga o alerta quando o mínimo é zero', () => {
        expect(limiarDoItem(0, 5)).toBeNull()
    })

    it('usa o mínimo do item quando definido', () => {
        expect(limiarDoItem(20, 5)).toBe(20)
    })

    it('usa o mínimo do item mesmo quando é menor que o global', () => {
        expect(limiarDoItem(2, 5)).toBe(2)
    })
})

describe('itensCriticos', () => {
    const item = (nome: string, saldo: number, estoqueMinimo: number | null) => ({
        nome,
        saldo,
        estoqueMinimo,
        unidadeMedida: 'kg' as const
    })

    it('considera crítico o saldo igual ao limiar ("atingiu o mínimo")', () => {
        expect(itensCriticos([item('Arroz', 20, 20)], 5)).toHaveLength(1)
    })

    it('considera crítico o saldo abaixo do limiar', () => {
        expect(itensCriticos([item('Arroz', 19, 20)], 5)).toHaveLength(1)
    })

    it('ignora o saldo acima do limiar', () => {
        expect(itensCriticos([item('Arroz', 21, 20)], 5)).toEqual([])
    })

    it('nunca alerta item com mínimo zero, nem com saldo zero', () => {
        expect(itensCriticos([item('Cobertor', 0, 0)], 5)).toEqual([])
    })

    it('aplica o limiar global ao item sem mínimo próprio e informa o limiar usado', () => {
        expect(itensCriticos([item('Sabonete', 4, null)], 5)).toEqual([{ ...item('Sabonete', 4, null), limiar: 5 }])
    })

    it('preserva os campos extras e a ordem dos itens', () => {
        const criticos = itensCriticos([item('A', 1, null), item('B', 100, null), { ...item('C', 3, 10), id: 'c' }], 5)
        expect(criticos.map((c) => c.nome)).toEqual(['A', 'C'])
        expect(criticos[1]).toMatchObject({ id: 'c', limiar: 10, unidadeMedida: 'kg' })
    })
})

describe('validarEstoqueMinimo', () => {
    it('aceita vazio (herda o padrão) e zero (sem alerta)', () => {
        expect(validarEstoqueMinimo(null)).toBeNull()
        expect(validarEstoqueMinimo(0)).toBeNull()
    })

    it('aceita valores com até 3 casas decimais', () => {
        expect(validarEstoqueMinimo(2.5)).toBeNull()
        expect(validarEstoqueMinimo(1.125)).toBeNull()
    })

    it('recusa negativo', () => {
        expect(validarEstoqueMinimo(-1)).toBe('Informe um número maior ou igual a zero.')
    })

    it('recusa valor não finito', () => {
        expect(validarEstoqueMinimo(Number.NaN)).toBe('Informe um número válido.')
        expect(validarEstoqueMinimo(Number.POSITIVE_INFINITY)).toBe('Informe um número válido.')
    })

    it('recusa mais de 3 casas decimais', () => {
        expect(validarEstoqueMinimo(1.2345)).toBe('Use no máximo 3 casas decimais.')
    })

    it('recusa valor acima do limite de numeric(14,3)', () => {
        expect(validarEstoqueMinimo(99_999_999_999.999)).toBeNull()
        expect(validarEstoqueMinimo(100_000_000_000)).toBe('Valor muito alto.')
    })
})
