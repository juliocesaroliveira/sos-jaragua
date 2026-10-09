import { describe, expect, it, vi } from 'vitest'

/**
 * Regressão do pacote de contingência (BR-CON-01) — specs/023-central-relatorios,
 * FR-004: "o mesmo conteúdo de hoje".
 *
 * A central deu ao Inventário colunas novas; o pacote não pode herdá-las sem
 * querer. Quem imprime o pacote para trabalhar sem conexão depende de reconhecer
 * as mesmas abas e as mesmas colunas de sempre.
 */
vi.mock('@/src/modules/estoque/presentation/queries/estoque', () => ({
    inventarioParaExportacao: async () => [
        {
            id: 'i1',
            nome: 'Arroz',
            categoria: 'alimentacao',
            unidadeMedida: 'kg',
            saldo: 12.5,
            estoqueMinimo: null,
            aguardandoPrimeiraEntrada: false
        }
    ]
}))

const { montarPacoteContingencia } = await import('./pacote-contingencia')

describe('montarPacoteContingencia', () => {
    it('mantém as quatro abas e as colunas de sempre', async () => {
        const abas = await montarPacoteContingencia()

        expect(abas.map((a) => a.nome)).toEqual([
            'Estoque atual',
            'Entradas (em branco)',
            'Saídas (em branco)',
            'Turnos (em branco)'
        ])
        expect(abas[0].colunas.map((c) => c.cabecalho)).toEqual([
            'Item',
            'Categoria',
            'Unidade',
            'Saldo atual',
            'Estoque mínimo'
        ])
        // Sem cabeçalho de documento: o pacote não é um relatório da central.
        expect(abas.every((a) => a.cabecalhoDocumento === undefined)).toBe(true)
    })

    it('a aba de estoque traz o saldo exato, com rótulos em pt-BR', async () => {
        const [estoque] = await montarPacoteContingencia()
        const [linha] = estoque.linhas
        expect(estoque.colunas.map((c) => c.valor(linha))).toEqual(['Arroz', 'Alimentação', 'Kg', 12.5, null])
    })
})
