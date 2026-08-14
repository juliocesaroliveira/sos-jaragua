import { describe, expect, it } from 'vitest'
import { TAMANHOS_PAGINA, TAMANHO_PAGINA_PADRAO } from './constantes'
import { calcularFaixa, clampPagina, normalizarPaginacao } from './esquema'

/**
 * Saneamento de parâmetros é a única regra pura desta feature — o resto é
 * apresentação. FR-012 (entradas inválidas viram o valor válido mais próximo,
 * sem erro) e FR-018 (padrão 20) vivem aqui.
 */
describe('normalizarPaginacao', () => {
    it('usa os padrões quando não há parâmetros', () => {
        expect(normalizarPaginacao({})).toEqual({ page: 1, pageSize: TAMANHO_PAGINA_PADRAO })
        expect(normalizarPaginacao(undefined)).toEqual({ page: 1, pageSize: TAMANHO_PAGINA_PADRAO })
    })

    it.each([
        ['0', 1],
        ['-3', 1],
        ['abc', 1],
        ['', 1],
        ['2', 2],
        ['1.5', 1]
    ])('sanea page=%s para %i', (entrada, esperado) => {
        expect(normalizarPaginacao({ page: entrada }).page).toBe(esperado)
    })

    it.each(TAMANHOS_PAGINA)('preserva pageSize válido %i', (tamanho) => {
        expect(normalizarPaginacao({ pageSize: String(tamanho) }).pageSize).toBe(tamanho)
    })

    it.each(['7', '0', '-5', 'abc', '1000'])('cai no padrão para pageSize=%s', (entrada) => {
        expect(normalizarPaginacao({ pageSize: entrada }).pageSize).toBe(TAMANHO_PAGINA_PADRAO)
    })

    it('um pageSize inválido não contamina um page válido', () => {
        expect(normalizarPaginacao({ page: '3', pageSize: '7' })).toEqual({
            page: 3,
            pageSize: TAMANHO_PAGINA_PADRAO
        })
    })

    it('nunca lança, mesmo com entrada que não é objeto', () => {
        expect(normalizarPaginacao('lixo')).toEqual({ page: 1, pageSize: TAMANHO_PAGINA_PADRAO })
        expect(normalizarPaginacao(null)).toEqual({ page: 1, pageSize: TAMANHO_PAGINA_PADRAO })
    })
})

describe('clampPagina', () => {
    it('mantém a página quando ela existe', () => {
        expect(clampPagina({ page: 2, pageSize: 20, totalCount: 47 })).toBe(2)
    })

    it('recua para a última página válida quando o page está além do fim', () => {
        expect(clampPagina({ page: 999, pageSize: 20, totalCount: 47 })).toBe(3)
    })

    it('volta para 1 quando não há registros', () => {
        expect(clampPagina({ page: 5, pageSize: 20, totalCount: 0 })).toBe(1)
    })
})

describe('calcularFaixa', () => {
    it('descreve a faixa exibida na página cheia', () => {
        expect(calcularFaixa({ page: 2, pageSize: 20, totalCount: 47 })).toEqual({
            totalPaginas: 3,
            primeiro: 21,
            ultimo: 40
        })
    })

    it('trunca o último item na página final', () => {
        expect(calcularFaixa({ page: 3, pageSize: 20, totalCount: 47 })).toEqual({
            totalPaginas: 3,
            primeiro: 41,
            ultimo: 47
        })
    })

    it('mostra faixa zerada e uma única página quando a lista está vazia', () => {
        expect(calcularFaixa({ page: 1, pageSize: 20, totalCount: 0 })).toEqual({
            totalPaginas: 1,
            primeiro: 0,
            ultimo: 0
        })
    })
})
