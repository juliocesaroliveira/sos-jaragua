import { describe, expect, it } from 'vitest'
import { mesmasContagens, temDependentesHistoricos, textoConfirmacao, truncarAmostra, type NoImpacto } from './previa'

describe('texto de confirmação (FR-014)', () => {
    it('reset usa o nome da tabela', () => {
        expect(textoConfirmacao({ acao: 'resetar_tabela', tabela: 'item' })).toBe('RESETAR item')
    })

    it('exclusão de selecionados usa a quantidade', () => {
        expect(textoConfirmacao({ acao: 'excluir_selecionados', tabela: 'item', chaves: ['a', 'b', 'c'] })).toBe(
            'EXCLUIR 3 DE item'
        )
    })
})

describe('mesmasContagens (FR-015, research D7)', () => {
    it('é estrutural e ignora ordem de chaves', () => {
        const a = { item: { apagar: 2, redirecionar: {} }, entrada: { apagar: 0, redirecionar: { item_id: 5 } } }
        const b = { entrada: { redirecionar: { item_id: 5 }, apagar: 0 }, item: { redirecionar: {}, apagar: 2 } }
        expect(mesmasContagens(a, b)).toBe(true)
    })

    it('trata contagem zero como ausência', () => {
        expect(
            mesmasContagens(
                { item: { apagar: 2, redirecionar: { x: 0 } }, kit: { apagar: 0, redirecionar: {} } },
                { item: { apagar: 2, redirecionar: {} } }
            )
        ).toBe(true)
    })

    it('detecta divergência', () => {
        expect(
            mesmasContagens({ item: { apagar: 2, redirecionar: {} } }, { item: { apagar: 3, redirecionar: {} } })
        ).toBe(false)
        expect(
            mesmasContagens(
                { entrada: { apagar: 0, redirecionar: { item_id: 1 } } },
                { entrada: { apagar: 0, redirecionar: { item_id: 2 } } }
            )
        ).toBe(false)
    })
})

describe('temDependentesHistoricos (FR-011)', () => {
    const no = (classificacao: NoImpacto['classificacao'], apagar: number, redirecionar = 0): NoImpacto => ({
        tabela: 'x',
        rotulo: 'x',
        nivel: 1,
        via: 'x.y → z',
        classificacao,
        apagar,
        redirecionar
    })

    it('só inseparáveis → falso', () => {
        expect(temDependentesHistoricos([no('inseparavel', 4)])).toBe(false)
    })

    it('histórico com linhas → verdadeiro', () => {
        expect(temDependentesHistoricos([no('inseparavel', 4), no('historico', 0, 2)])).toBe(true)
        expect(temDependentesHistoricos([no('historico', 3)])).toBe(true)
    })

    it('histórico sem linhas → falso', () => {
        expect(temDependentesHistoricos([no('historico', 0, 0)])).toBe(false)
    })
})

describe('truncarAmostra', () => {
    it('limita a 5 e informa o restante', () => {
        expect(truncarAmostra(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 7)).toEqual({
            itens: ['a', 'b', 'c', 'd', 'e'],
            restante: 2
        })
    })

    it('usa o total real, não o tamanho da amostra', () => {
        expect(truncarAmostra(['a', 'b'], 40)).toEqual({ itens: ['a', 'b'], restante: 38 })
    })
})
