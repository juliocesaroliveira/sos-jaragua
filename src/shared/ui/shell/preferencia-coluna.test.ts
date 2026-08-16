import { describe, expect, it } from 'vitest'
import { normalizarPreferenciaColuna, PREFERENCIA_PADRAO } from './preferencia-coluna'

/**
 * Normalização da preferência de apresentação da coluna
 * (013-navegacao-lateral-responsiva, contracts/coluna-recolhivel.md C-03).
 *
 * É a **única lógica pura** desta feature — o resto é layout, foco e
 * comportamento de viewport, que não têm equivalente em teste unitário.
 *
 * O que ela protege: o valor vem de `localStorage`, que é território hostil.
 * Pode estar ausente na primeira visita, corrompido por outra aba, ou gravado
 * por uma versão futura que conheça um terceiro estado. Em todos esses casos o
 * usuário precisa encontrar a coluna expandida (FR-017), e nunca uma coluna em
 * estado indefinido.
 */

describe('normalizarPreferenciaColuna — valores válidos', () => {
    it('preserva `expandida`', () => {
        expect(normalizarPreferenciaColuna('expandida')).toBe('expandida')
    })

    it('preserva `recolhida`', () => {
        expect(normalizarPreferenciaColuna('recolhida')).toBe('recolhida')
    })
})

describe('normalizarPreferenciaColuna — ausência e lixo', () => {
    it('usa o padrão quando não há valor gravado', () => {
        expect(normalizarPreferenciaColuna(null)).toBe(PREFERENCIA_PADRAO)
    })

    it('usa o padrão para string vazia', () => {
        expect(normalizarPreferenciaColuna('')).toBe(PREFERENCIA_PADRAO)
    })

    it('usa o padrão para valor desconhecido', () => {
        // Uma versão futura que grave um terceiro estado não pode deixar a
        // coluna indefinida numa versão antiga.
        expect(normalizarPreferenciaColuna('trilha-flutuante')).toBe(PREFERENCIA_PADRAO)
    })

    it('usa o padrão para valor corrompido', () => {
        expect(normalizarPreferenciaColuna('{"json":true}')).toBe(PREFERENCIA_PADRAO)
    })

    it('não aceita variação de caixa — o valor gravado é exato', () => {
        expect(normalizarPreferenciaColuna('Recolhida')).toBe(PREFERENCIA_PADRAO)
    })

    it('o padrão é `expandida` — ninguém encontra o sistema num estado que não escolheu', () => {
        expect(PREFERENCIA_PADRAO).toBe('expandida')
    })
})
