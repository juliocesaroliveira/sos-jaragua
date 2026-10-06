import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponenteInformado } from '../../domain/receita-kit'
import type { Item, KitRepository, ResultadoComposicao } from '../ports/estoque-repository'
import { SalvarKitUseCase } from './salvar-kit'

/**
 * Feature 022 — `SalvarKitUseCase` com repositório dublê.
 *
 * Cobre a orquestração: validar a receita antes de tocar no banco, traduzir os
 * conflitos do repositório para erros por linha e auditar **só** o que foi
 * gravado (research R6). A atomicidade em si é do repositório e está no teste
 * de integração.
 */
// `vi.mock` é içado para o topo do arquivo; o registro de chamadas precisa ser
// içado junto.
const { auditadas } = vi.hoisted(() => ({ auditadas: [] as string[] }))
vi.mock('@/src/modules/auditoria', () => ({
    withAudit: <T>(opcoes: { tabela: string }, fn: () => Promise<T>) => {
        auditadas.push(opcoes.tabela)
        return fn()
    }
}))

const KIT = { id: 'kit-1', nome: 'Higiene', descricao: null, ativo: true }

function item(id: string, nome: string): Item {
    return {
        id,
        nome,
        categoria: 'higiene',
        unidadeMedida: 'unidade',
        estoqueMinimo: null,
        aguardandoPrimeiraEntrada: true
    }
}

const novo = (nome: string): ComponenteInformado => ({
    tipo: 'novo',
    novoItem: { nome, categoria: 'higiene', unidadeMedida: 'unidade', estoqueMinimo: null },
    quantidadePorKit: 1
})

const existente = (itemId: string): ComponenteInformado => ({ tipo: 'existente', itemId, quantidadePorKit: 1 })

/**
 * Tipar o mock com a assinatura do port é o que dá a `mock.calls` o formato
 * real dos argumentos.
 */
function repositorio(resultado: ResultadoComposicao | null) {
    const salvarComposicao = vi.fn<KitRepository['salvarComposicao']>(async () => resultado)
    const repo: KitRepository = {
        listar: async () => [],
        buscarPorId: async () => KIT,
        receita: async () => [],
        salvarComposicao
    }
    return { repo, salvarComposicao }
}

const BASE = { nome: 'Higiene', descricao: null, ativo: true }

beforeEach(() => {
    auditadas.length = 0
})

describe('SalvarKitUseCase', () => {
    it('recusa receita inválida sem chamar o repositório nem auditar', async () => {
        const { repo, salvarComposicao } = repositorio(null)

        const r = await new SalvarKitUseCase(repo).executar({ ...BASE, componentes: [] })

        expect(r.ok).toBe(false)
        if (r.ok) return
        expect(r.erro.codigo).toBe('validacao')
        expect(salvarComposicao).not.toHaveBeenCalled()
        expect(auditadas).toEqual([])
    })

    it('traduz conflito ambíguo em erro na linha, sem auditar', async () => {
        const { repo } = repositorio({ conflitos: [{ indice: 2, tipo: 'ambiguo' }] })

        const r = await new SalvarKitUseCase(repo).executar({
            ...BASE,
            componentes: [existente('a'), existente('b'), novo('Sabão')]
        })

        expect(r.ok).toBe(false)
        if (r.ok) return
        expect(r.erro.codigo).toBe('validacao')
        expect(r.erro.detalhes?.campos).toEqual({
            'componentes.2.itemId': 'Há mais de um item com esse nome. Selecione o item na lista.'
        })
        expect(auditadas).toEqual([])
    })

    it('traduz conflito de item repetido em erro na linha', async () => {
        const { repo } = repositorio({ conflitos: [{ indice: 1, tipo: 'repetido' }] })

        const r = await new SalvarKitUseCase(repo).executar({
            ...BASE,
            componentes: [existente('a'), novo('Água')]
        })

        expect(r.ok).toBe(false)
        if (r.ok) return
        expect(r.erro.detalhes?.campos).toEqual({ 'componentes.1.itemId': 'Este item já está na receita.' })
        expect(auditadas).toEqual([])
    })

    it('devolve nao_encontrado quando o kit não existe, sem auditar', async () => {
        const { repo } = repositorio(null)

        const r = await new SalvarKitUseCase(repo).executar({ ...BASE, id: 'kit-x', componentes: [existente('a')] })

        expect(r.ok).toBe(false)
        if (r.ok) return
        expect(r.erro.codigo).toBe('nao_encontrado')
        expect(auditadas).toEqual([])
    })

    it('no sucesso, audita o kit uma vez e cada item criado separadamente', async () => {
        const criados = [item('i-1', 'Sabão'), item('i-2', 'Escova')]
        const { repo, salvarComposicao } = repositorio({
            kit: KIT,
            receita: [
                { itemId: 'i-1', quantidadePorKit: 1 },
                { itemId: 'i-2', quantidadePorKit: 1 }
            ],
            itensCriados: criados,
            vinculos: []
        })

        const r = await new SalvarKitUseCase(repo).executar({
            ...BASE,
            componentes: [novo('  Sabão '), novo('Escova')]
        })

        expect(r).toEqual({ ok: true, valor: { id: 'kit-1', itensCriados: 2 } })
        // O repositório recebe o nome já sem espaços nas pontas (validarReceita).
        expect(salvarComposicao.mock.calls[0][0].componentes[0]).toMatchObject({ novoItem: { nome: 'Sabão' } })
        expect(auditadas).toEqual(['kit', 'item', 'item'])
    })
})
