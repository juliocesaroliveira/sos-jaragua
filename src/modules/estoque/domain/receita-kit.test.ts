import { describe, expect, it } from 'vitest'
import { consolidarAvulsos, expandirKits, kitsPossiveis, type KitSolicitado } from './receita-kit'

/**
 * TEST-03 — BR-EST-04: expansão da receita × quantidade e **consolidação por
 * item** quando há múltiplos kits na mesma saída.
 *
 * É a peça mais fácil de errar da saída de kit: sem consolidar, a validação de
 * saldo é feita duas vezes contra o mesmo estoque e deixa passar uma saída que
 * o estoque não cobre.
 */
const ARROZ = 'item-arroz'
const FEIJAO = 'item-feijao'
const SABONETE = 'item-sabonete'

const cestaBasica: KitSolicitado = {
    kitId: 'kit-cesta',
    quantidade: 1,
    componentes: [
        { itemId: ARROZ, quantidadePorKit: 2 },
        { itemId: FEIJAO, quantidadePorKit: 1 }
    ]
}

const kitHigiene: KitSolicitado = {
    kitId: 'kit-higiene',
    quantidade: 1,
    componentes: [{ itemId: SABONETE, quantidadePorKit: 3 }]
}

function porItem(itens: { itemId: string; quantidade: number }[]) {
    return Object.fromEntries(itens.map((i) => [i.itemId, i.quantidade]))
}

describe('expandirKits', () => {
    it('multiplica a receita pela quantidade de kits', () => {
        const r = expandirKits([{ ...cestaBasica, quantidade: 10 }])
        expect(porItem(r)).toEqual({ [ARROZ]: 20, [FEIJAO]: 10 })
    })

    it('consolida o mesmo item vindo de kits diferentes', () => {
        // O caso que a spec destaca: dois kits que compartilham um componente.
        const kitEmergencia: KitSolicitado = {
            kitId: 'kit-emergencia',
            quantidade: 5,
            componentes: [{ itemId: ARROZ, quantidadePorKit: 1 }]
        }

        const r = expandirKits([{ ...cestaBasica, quantidade: 10 }, kitEmergencia])

        // 10×2 (cesta) + 5×1 (emergência) = 25 — uma linha só de arroz.
        expect(r.filter((i) => i.itemId === ARROZ)).toHaveLength(1)
        expect(porItem(r)).toEqual({ [ARROZ]: 25, [FEIJAO]: 10 })
    })

    it('mantém itens de kits sem componentes em comum', () => {
        const r = expandirKits([cestaBasica, kitHigiene])
        expect(porItem(r)).toEqual({ [ARROZ]: 2, [FEIJAO]: 1, [SABONETE]: 3 })
    })

    it('lida com quantidades decimais sem drift binário', () => {
        // 0.1 × 3 em ponto flutuante daria 0.30000000000000004.
        const r = expandirKits([
            {
                kitId: 'kit-decimal',
                quantidade: 3,
                componentes: [{ itemId: ARROZ, quantidadePorKit: 0.1 }]
            }
        ])
        expect(porItem(r)).toEqual({ [ARROZ]: 0.3 })
    })

    it('devolve lista vazia sem kits', () => {
        expect(expandirKits([])).toEqual([])
    })
})

describe('consolidarAvulsos', () => {
    it('soma o mesmo item repetido no formulário', () => {
        // O operador pode adicionar duas linhas do mesmo item sem perceber.
        const r = consolidarAvulsos([
            { itemId: ARROZ, quantidade: 5 },
            { itemId: FEIJAO, quantidade: 2 },
            { itemId: ARROZ, quantidade: 3 }
        ])
        expect(r).toHaveLength(2)
        expect(porItem(r)).toEqual({ [ARROZ]: 8, [FEIJAO]: 2 })
    })
})

describe('kitsPossiveis — capacidade (BR-INT-02)', () => {
    it('limita pelo componente mais escasso', () => {
        const saldo = new Map([
            [ARROZ, 40], // 40/2 = 20 kits
            [FEIJAO, 7] // 7/1 = 7 kits  ← gargalo
        ])
        expect(kitsPossiveis(cestaBasica.componentes, saldo)).toBe(7)
    })

    it('arredonda para baixo — meio kit não existe', () => {
        const saldo = new Map([
            [ARROZ, 7], // 7/2 = 3.5 → 3
            [FEIJAO, 99]
        ])
        expect(kitsPossiveis(cestaBasica.componentes, saldo)).toBe(3)
    })

    it('devolve 0 quando falta completamente um componente', () => {
        const saldo = new Map([[ARROZ, 100]]) // sem feijão
        expect(kitsPossiveis(cestaBasica.componentes, saldo)).toBe(0)
    })

    it('devolve 0 para kit sem receita — não "infinitos"', () => {
        // Kit sem componentes é cadastro incompleto, não capacidade ilimitada.
        expect(kitsPossiveis([], new Map([[ARROZ, 100]]))).toBe(0)
    })

    it('ignora componente com quantidade por kit zero', () => {
        const saldo = new Map([
            [ARROZ, 10],
            [FEIJAO, 0]
        ])
        const componentes = [
            { itemId: ARROZ, quantidadePorKit: 2 },
            { itemId: FEIJAO, quantidadePorKit: 0 }
        ]
        expect(kitsPossiveis(componentes, saldo)).toBe(5)
    })
})
