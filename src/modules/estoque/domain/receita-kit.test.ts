import { describe, expect, it } from 'vitest'
import { validarEstoqueMinimo } from './estoque-minimo'
import {
    consolidarAvulsos,
    expandirKits,
    kitsPossiveis,
    normalizarNomeItem,
    validarReceita,
    type ComponenteInformado,
    type KitSolicitado,
    type NovoItem
} from './receita-kit'

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

/**
 * Feature 022 — item novo na receita do kit.
 *
 * `normalizarNomeItem` é o espelho em TS do `lower(f_unaccent(nome))` que o
 * servidor usa para vincular nome idêntico (FR-009); `validarReceita` concentra
 * as regras V1–V5 do data-model.
 */
describe('normalizarNomeItem', () => {
    it('remove espaços nas pontas, acentos e caixa', () => {
        expect(normalizarNomeItem('  Água Sanitária ')).toBe('agua sanitaria')
        expect(normalizarNomeItem('SABÃO')).toBe('sabao')
    })

    it('trata grafias com e sem acento como iguais', () => {
        expect(normalizarNomeItem('Feijão')).toBe(normalizarNomeItem('feijao'))
    })

    it('reduz texto só com espaços a vazio', () => {
        expect(normalizarNomeItem('   ')).toBe('')
    })

    it('preserva espaços internos', () => {
        expect(normalizarNomeItem('a  b')).toBe('a  b')
    })
})

describe('validarReceita', () => {
    const novo = (nome: string, extra: Partial<NovoItem> = {}): ComponenteInformado => ({
        tipo: 'novo',
        novoItem: { nome, categoria: 'higiene', unidadeMedida: 'unidade', estoqueMinimo: null, ...extra },
        quantidadePorKit: 1
    })
    const existente = (itemId: string, quantidadePorKit = 1): ComponenteInformado => ({
        tipo: 'existente',
        itemId,
        quantidadePorKit
    })

    function campos(componentes: ComponenteInformado[]) {
        const resultado = validarReceita(componentes)
        expect(resultado.ok).toBe(false)
        if (resultado.ok) return {}
        return (resultado.erro.detalhes?.campos ?? {}) as Record<string, string>
    }

    it('V1: exige ao menos um componente', () => {
        expect(campos([])).toEqual({ componentes: 'O kit precisa de ao menos um componente.' })
    })

    it('V2: exige quantidade por kit positiva', () => {
        expect(campos([existente(ARROZ, 0)])).toEqual({
            'componentes.0.quantidade': 'Informe a quantidade por kit.'
        })
    })

    it('V3: recusa item novo sem nome', () => {
        expect(campos([existente(ARROZ), novo('  ')])).toEqual({
            'componentes.1.itemId': 'Selecione ou digite o item.'
        })
    })

    it('V4: valida o estoque mínimo do item novo com a regra da feature 020', () => {
        expect(campos([novo('Sabonete', { estoqueMinimo: -1 })])).toEqual({
            'componentes.0.estoqueMinimo': validarEstoqueMinimo(-1)
        })
    })

    it('V5: recusa o mesmo item existente duas vezes', () => {
        expect(campos([existente(ARROZ), existente(ARROZ)])).toEqual({
            'componentes.1.itemId': 'Este item já está na receita.'
        })
    })

    it('V5: recusa o mesmo nome novo, ignorando acento, caixa e espaços', () => {
        expect(campos([novo('Feijão'), novo(' feijao')])).toEqual({
            'componentes.1.itemId': 'Este item já está na receita.'
        })
    })

    it('aceita a receita válida e devolve o nome novo sem espaços nas pontas', () => {
        const resultado = validarReceita([existente(ARROZ), novo('  Sabonete líquido ')])
        expect(resultado.ok).toBe(true)
        if (!resultado.ok) return
        expect(resultado.valor[1]).toMatchObject({ tipo: 'novo', novoItem: { nome: 'Sabonete líquido' } })
    })
})
