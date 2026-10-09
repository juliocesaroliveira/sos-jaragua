import { describe, expect, it, vi } from 'vitest'

/**
 * Definições de prestação de contas de doações — R-01 a R-04
 * (specs/023-central-relatorios, US1, data-model.md §4).
 *
 * As consultas são falsas: elas têm teste de integração próprio. Aqui se trava
 * o que a pessoa vê — colunas, rótulos em pt-BR, formatação e a descrição dos
 * filtros no cabeçalho do arquivo.
 */
const consultas = vi.hoisted(() => ({
    inventarioRelatorio: vi.fn(),
    saidasNoPeriodo: vi.fn(),
    contarSaidasNoPeriodo: vi.fn(),
    entradasNoPeriodo: vi.fn(),
    contarEntradasNoPeriodo: vi.fn(),
    descartesNoPeriodo: vi.fn(),
    contarDescartesNoPeriodo: vi.fn()
}))
const nomesPorIds = vi.hoisted(() => vi.fn(async () => new Map([['u-1', 'Maria Souza']])))

vi.mock('@/src/modules/estoque/presentation/queries/relatorios', () => consultas)
vi.mock('@/src/modules/identidade/presentation/queries/relatorios', () => ({ nomesPorIds }))
vi.mock('@/src/shared/config/limiares-alerta', () => ({ limiarEstoqueMinimoGlobal: () => 5 }))

const { RELATORIOS_PRESTACAO } = await import('./estoque-prestacao')
const { GerarRelatorioUseCase } = await import('../gerar-relatorio')

const porSlug = new Map(RELATORIOS_PRESTACAO.map((r) => [r.slug, r]))
const uc = new GerarRelatorioUseCase((slug) => porSlug.get(slug as never))

// 08/10/2026 15:00 UTC = 12:00 em Brasília.
const AGORA = new Date(Date.UTC(2026, 9, 8, 15, 0))

async function pagina(slug: string, entrada: Record<string, unknown> = {}) {
    const resultado = await uc.pagina(slug, entrada, AGORA)
    if (!resultado.ok) throw new Error(resultado.erro.message)
    return resultado.valor
}

describe('R-01 Inventário atual', () => {
    it('colunas e células conforme data-model.md §4', async () => {
        consultas.inventarioRelatorio.mockResolvedValue([
            {
                id: 'i1',
                nome: 'Arroz',
                categoria: 'alimentacao',
                unidadeMedida: 'kg',
                saldo: 3,
                minimoAplicado: 5,
                origemMinimo: 'padrao',
                situacao: 'abaixo'
            },
            {
                id: 'i2',
                nome: 'Lona',
                categoria: 'acomodacao',
                unidadeMedida: 'unidade',
                saldo: 0,
                minimoAplicado: null,
                origemMinimo: 'sem_alerta',
                situacao: 'ok'
            }
        ])

        const resultado = await pagina('inventario')
        expect(resultado.colunas).toEqual([
            'Item',
            'Categoria',
            'Unidade',
            'Saldo atual',
            'Mínimo aplicado',
            'Origem do mínimo',
            'Situação'
        ])
        expect(resultado.rows.map((r) => r.celulas)).toEqual([
            ['Arroz', 'Alimentação', 'Kg', 3, 5, 'Padrão', 'Abaixo do mínimo'],
            ['Lona', 'Acomodação', 'Unidade', 0, null, 'Sem alerta', 'OK']
        ])
        // O limiar global vem da configuração, não de constante no relatório.
        expect(consultas.inventarioRelatorio).toHaveBeenCalledWith({}, 5)
    })

    it('valor de filtro fora da lista é ignorado', async () => {
        consultas.inventarioRelatorio.mockResolvedValue([])
        await pagina('inventario', { categoria: 'nao-existe', situacao: 'abaixo' })
        expect(consultas.inventarioRelatorio).toHaveBeenLastCalledWith({ situacao: 'abaixo' }, 5)
    })
})

describe('R-02 Histórico de saídas', () => {
    it('colunas, rótulos e "Registrado por" resolvido por nome', async () => {
        consultas.contarSaidasNoPeriodo.mockResolvedValue(1)
        consultas.saidasNoPeriodo.mockResolvedValue([
            {
                saidaId: 's1',
                saidaItemId: 'si1',
                criadoEm: new Date('2026-10-06T02:30:00Z'),
                tipo: 'kit',
                destino: 'Abrigo Central',
                responsavelTransporte: 'João',
                item: 'Arroz',
                categoria: 'alimentacao',
                quantidade: 2.5,
                unidadeMedida: 'kg',
                registradoPorId: 'u-1'
            }
        ])

        const resultado = await pagina('saidas')
        expect(resultado.colunas).toEqual([
            'Data',
            'Tipo',
            'Destino',
            'Responsável pelo transporte',
            'Item',
            'Categoria',
            'Quantidade',
            'Unidade',
            'Registrado por'
        ])
        // 06/10 02:30 UTC = 05/10 23:30 em Brasília.
        expect(resultado.rows[0].celulas).toEqual([
            '05/10/2026, 23:30',
            'Kit',
            'Abrigo Central',
            'João',
            'Arroz',
            'Alimentação',
            2.5,
            'Kg',
            'Maria Souza'
        ])
    })

    it('passa período e filtros à consulta e descreve os filtros em pt-BR', async () => {
        consultas.contarSaidasNoPeriodo.mockResolvedValue(0)
        consultas.saidasNoPeriodo.mockResolvedValue([])

        const resultado = await uc.completo(
            'saidas',
            { de: '2026-10-01', ate: '2026-10-05', tipo: 'kit', destino: '  abrigo ', categoria: 'agua' },
            { nome: 'Maria' },
            AGORA
        )

        expect(consultas.contarSaidasNoPeriodo).toHaveBeenLastCalledWith({
            intervalo: {
                inicio: new Date('2026-10-01T03:00:00.000Z'),
                fimExclusivo: new Date('2026-10-06T03:00:00.000Z')
            },
            tipo: 'kit',
            destino: 'abrigo',
            categoria: 'agua'
        })
        expect(resultado.ok && resultado.valor.aba.cabecalhoDocumento?.slice(2, 5)).toEqual([
            { rotulo: 'Tipo', valor: 'Kit' },
            { rotulo: 'Destino contém', valor: 'abrigo' },
            { rotulo: 'Categoria', valor: 'Água' }
        ])
    })

    it('autor sem conta aparece como "usuário não encontrado"', async () => {
        consultas.contarSaidasNoPeriodo.mockResolvedValue(1)
        consultas.saidasNoPeriodo.mockResolvedValue([
            {
                saidaId: 's1',
                saidaItemId: 'si1',
                criadoEm: new Date('2026-10-06T12:00:00Z'),
                tipo: 'avulso',
                destino: 'X',
                responsavelTransporte: 'Y',
                item: 'Arroz',
                categoria: 'alimentacao',
                quantidade: 1,
                unidadeMedida: 'kg',
                registradoPorId: 'removido'
            }
        ])
        const resultado = await pagina('saidas')
        expect(resultado.rows[0].celulas.at(-1)).toBe('usuário não encontrado')
    })
})

describe('R-03 Doações recebidas e R-04 Descartes', () => {
    it('R-03: colunas e formatação', async () => {
        consultas.contarEntradasNoPeriodo.mockResolvedValue(1)
        consultas.entradasNoPeriodo.mockResolvedValue([
            {
                id: 'e1',
                criadoEm: new Date('2026-10-06T15:00:00Z'),
                item: 'Leite',
                categoria: 'alimentacao',
                quantidade: 12,
                unidadeMedida: 'litro',
                condicao: 'novo',
                perecivel: true,
                dataValidade: '2026-11-30',
                kitDestino: 'Kit básico',
                registradoPorId: 'u-1'
            }
        ])

        const resultado = await pagina('entradas')
        expect(resultado.colunas).toEqual([
            'Data',
            'Item',
            'Categoria',
            'Quantidade',
            'Unidade',
            'Condição',
            'Perecível',
            'Validade',
            'Kit de destino',
            'Registrado por'
        ])
        expect(resultado.rows[0].celulas).toEqual([
            '06/10/2026, 12:00',
            'Leite',
            'Alimentação',
            12,
            'Litro',
            'Novo',
            'Sim',
            '30/11/2026',
            'Kit básico',
            'Maria Souza'
        ])
    })

    it('R-04: colunas com motivo', async () => {
        consultas.contarDescartesNoPeriodo.mockResolvedValue(1)
        consultas.descartesNoPeriodo.mockResolvedValue([
            {
                id: 'd1',
                criadoEm: new Date('2026-10-06T15:00:00Z'),
                item: 'Leite',
                categoria: 'alimentacao',
                quantidade: 2,
                unidadeMedida: 'litro',
                motivo: null,
                registradoPorId: 'u-1'
            }
        ])

        const resultado = await pagina('descartes')
        expect(resultado.colunas).toEqual([
            'Data',
            'Item',
            'Categoria',
            'Quantidade',
            'Unidade',
            'Motivo',
            'Registrado por'
        ])
        expect(resultado.rows[0].celulas).toEqual([
            '06/10/2026, 12:00',
            'Leite',
            'Alimentação',
            2,
            'Litro',
            null,
            'Maria Souza'
        ])
    })
})
