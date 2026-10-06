import { describe, expect, it, vi } from 'vitest'
import type { Item, ItemRepository } from '../ports/estoque-repository'
import { DefinirEstoqueMinimoUseCase } from './definir-estoque-minimo'

/**
 * `DefinirEstoqueMinimoUseCase` com repositório em memória
 * (specs/020-resolver-pendencias, Q3 / I1).
 */
vi.mock('@/src/modules/auditoria', () => ({
    withAudit: <T>(_opcoes: unknown, fn: () => Promise<T>) => fn()
}))

const ARROZ: Item = {
    id: '11111111-1111-1111-1111-111111111111',
    nome: 'Arroz',
    categoria: 'alimentacao',
    unidadeMedida: 'kg',
    estoqueMinimo: null,
    aguardandoPrimeiraEntrada: false
}

function repositorio(itens: Item[] = [ARROZ]) {
    const banco = new Map(itens.map((i) => [i.id, { ...i }]))
    const definirEstoqueMinimo = vi.fn<ItemRepository['definirEstoqueMinimo']>(async (id, valor) => {
        const item = banco.get(id)
        if (item) item.estoqueMinimo = valor
    })
    const repo: ItemRepository = {
        buscarPorId: async (id) => banco.get(id) ?? null,
        criar: async () => {
            throw new Error('não usado')
        },
        definirEstoqueMinimo
    }
    return { repo, banco, definirEstoqueMinimo }
}

describe('DefinirEstoqueMinimoUseCase', () => {
    it('falha com nao_encontrado quando o item não existe', async () => {
        const { repo, definirEstoqueMinimo } = repositorio()

        const r = await new DefinirEstoqueMinimoUseCase(repo).executar({
            itemId: '99999999-9999-9999-9999-999999999999',
            estoqueMinimo: 10
        })

        expect(r.ok).toBe(false)
        if (r.ok) return
        expect(r.erro.codigo).toBe('nao_encontrado')
        expect(r.erro.message).toBe('Item não encontrado.')
        expect(definirEstoqueMinimo).not.toHaveBeenCalled()
    })

    it.each([
        [-1, 'Informe um número maior ou igual a zero.'],
        [Number.NaN, 'Informe um número válido.'],
        [Number.POSITIVE_INFINITY, 'Informe um número válido.'],
        [1.2345, 'Use no máximo 3 casas decimais.'],
        [100_000_000_000, 'Valor muito alto.']
    ])('recusa %s com erro no campo estoqueMinimo', async (valor, mensagem) => {
        const { repo, definirEstoqueMinimo } = repositorio()

        const r = await new DefinirEstoqueMinimoUseCase(repo).executar({ itemId: ARROZ.id, estoqueMinimo: valor })

        expect(r.ok).toBe(false)
        if (r.ok) return
        expect(r.erro.codigo).toBe('validacao')
        expect(r.erro.detalhes?.campos).toEqual({ estoqueMinimo: mensagem })
        expect(definirEstoqueMinimo).not.toHaveBeenCalled()
    })

    it('grava o mínimo informado e devolve o resultado', async () => {
        const { repo, banco } = repositorio()

        const r = await new DefinirEstoqueMinimoUseCase(repo).executar({ itemId: ARROZ.id, estoqueMinimo: 20 })

        expect(r).toEqual({ ok: true, valor: { itemId: ARROZ.id, estoqueMinimo: 20 } })
        expect(banco.get(ARROZ.id)?.estoqueMinimo).toBe(20)
    })

    it('limpa o mínimo com null, voltando a herdar o padrão', async () => {
        const { repo, banco } = repositorio([{ ...ARROZ, estoqueMinimo: 20 }])

        const r = await new DefinirEstoqueMinimoUseCase(repo).executar({ itemId: ARROZ.id, estoqueMinimo: null })

        expect(r).toEqual({ ok: true, valor: { itemId: ARROZ.id, estoqueMinimo: null } })
        expect(banco.get(ARROZ.id)?.estoqueMinimo).toBeNull()
    })

    it('aceita zero, que desliga o alerta do item', async () => {
        const { repo, banco } = repositorio()

        const r = await new DefinirEstoqueMinimoUseCase(repo).executar({ itemId: ARROZ.id, estoqueMinimo: 0 })

        expect(r.ok).toBe(true)
        expect(banco.get(ARROZ.id)?.estoqueMinimo).toBe(0)
    })
})
