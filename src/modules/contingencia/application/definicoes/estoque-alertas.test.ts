import { describe, expect, it, vi } from 'vitest'

/**
 * Definições de R-05 Estoque crítico e R-06 Validades
 * (specs/023-central-relatorios, US2). Consultas falsas — elas têm teste de
 * integração próprio.
 */
const consultas = vi.hoisted(() => ({
    itensCriticosRelatorio: vi.fn(),
    validadesRelatorio: vi.fn(),
    contarValidadesRelatorio: vi.fn()
}))

vi.mock('@/src/modules/estoque/presentation/queries/relatorios', () => consultas)
vi.mock('@/src/modules/identidade/presentation/queries/relatorios', () => ({ nomesPorIds: async () => new Map() }))
vi.mock('@/src/shared/config/limiares-alerta', () => ({ limiarEstoqueMinimoGlobal: () => 5 }))

const { RELATORIOS_ALERTAS_ESTOQUE } = await import('./estoque-alertas')
const { GerarRelatorioUseCase } = await import('../gerar-relatorio')

const porSlug = new Map(RELATORIOS_ALERTAS_ESTOQUE.map((r) => [r.slug, r]))
const uc = new GerarRelatorioUseCase((slug) => porSlug.get(slug as never))

// 08/10/2026 15:00 UTC = 12:00 em Brasília.
const AGORA = new Date(Date.UTC(2026, 9, 8, 15, 0))

describe('R-05 Estoque crítico', () => {
    it('ordena do mais crítico ao menos crítico e mostra falta absoluta e percentual', async () => {
        consultas.itensCriticosRelatorio.mockResolvedValue([
            { id: 'a', nome: 'Arroz', categoria: 'alimentacao', unidadeMedida: 'kg', saldo: 9, limiar: 10 },
            { id: 'b', nome: 'Água', categoria: 'agua', unidadeMedida: 'litro', saldo: 0, limiar: 20 }
        ])

        const resultado = await uc.pagina('estoque-critico', {}, AGORA)
        expect(resultado.ok).toBe(true)
        if (!resultado.ok) return
        expect(resultado.valor.colunas).toEqual([
            'Item',
            'Categoria',
            'Unidade',
            'Saldo',
            'Mínimo aplicado',
            'Falta',
            'Falta (%)'
        ])
        expect(resultado.valor.rows.map((r) => r.celulas)).toEqual([
            ['Água', 'Água', 'Litro', 0, 20, 20, 100],
            ['Arroz', 'Alimentação', 'Kg', 9, 10, 1, 10]
        ])
        expect(consultas.itensCriticosRelatorio).toHaveBeenCalledWith({}, 5)
    })
})

describe('R-06 Validades', () => {
    it('horizonte padrão de 30 dias a partir de hoje em Brasília', async () => {
        consultas.contarValidadesRelatorio.mockResolvedValue(2)
        consultas.validadesRelatorio.mockResolvedValue([
            {
                id: 'e1',
                criadoEm: new Date('2026-09-01T15:00:00Z'),
                item: 'Leite',
                categoria: 'alimentacao',
                quantidade: 12,
                unidadeMedida: 'litro',
                dataValidade: '2026-10-05'
            },
            {
                id: 'e2',
                criadoEm: new Date('2026-09-02T15:00:00Z'),
                item: 'Iogurte',
                categoria: 'alimentacao',
                quantidade: 6,
                unidadeMedida: 'unidade',
                dataValidade: '2026-10-18'
            }
        ])

        const resultado = await uc.pagina('validades', {}, AGORA)
        expect(consultas.contarValidadesRelatorio).toHaveBeenCalledWith({ limite: '2026-11-07', categoria: undefined })
        expect(resultado.ok && resultado.valor.rows.map((r) => r.celulas.slice(0, 4))).toEqual([
            ['Vencida', '05/10/2026', -3, 'Leite'],
            ['A vencer', '18/10/2026', 10, 'Iogurte']
        ])
    })

    it('horizonte informado muda o limite e aparece no cabeçalho do arquivo', async () => {
        consultas.contarValidadesRelatorio.mockResolvedValue(0)
        consultas.validadesRelatorio.mockResolvedValue([])

        const resultado = await uc.completo('validades', { horizonte: '7' }, { nome: 'Maria' }, AGORA)
        expect(consultas.contarValidadesRelatorio).toHaveBeenLastCalledWith({
            limite: '2026-10-15',
            categoria: undefined
        })
        expect(resultado.ok && resultado.valor.aba.cabecalhoDocumento?.[2]).toEqual({
            rotulo: 'Vencem em até',
            valor: '7 dias'
        })
    })

    it('horizonte fora de 1–365 é erro no campo', async () => {
        for (const horizonte of ['0', '366', 'abc', '2.5']) {
            const resultado = await uc.pagina('validades', { horizonte }, AGORA)
            expect(resultado.ok, horizonte).toBe(false)
            if (resultado.ok) continue
            expect(resultado.erro.detalhes).toEqual({
                campos: { horizonte: 'Informe um número de dias entre 1 e 365.' }
            })
        }
    })
})
