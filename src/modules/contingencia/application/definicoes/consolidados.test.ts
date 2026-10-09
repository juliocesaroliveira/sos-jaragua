import { describe, expect, it, vi } from 'vitest'

/**
 * Definições de R-07, R-08, R-14, R-15 e R-16 (specs/023-central-relatorios,
 * US5). Consultas falsas — elas têm testes de integração próprios.
 */
const estoque = vi.hoisted(() => ({
    movimentacaoRelatorio: vi.fn(),
    entregasPorDestinoRelatorio: vi.fn(),
    contarEntregasPorDestino: vi.fn()
}))
const logistica = vi.hoisted(() => ({ evolucaoCriseRelatorio: vi.fn(), contarEvolucaoCrise: vi.fn() }))
const notificacoes = vi.hoisted(() => ({
    enviosNotificacoesRelatorio: vi.fn(),
    contarEnviosNotificacoes: vi.fn(),
    totaisEnviosNotificacoes: vi.fn()
}))
const projecaoAtual = vi.hoisted(() => vi.fn())

vi.mock('@/src/modules/estoque/presentation/queries/relatorios', () => estoque)
vi.mock('@/src/modules/logistica/presentation/queries/relatorios', () => logistica)
vi.mock('@/src/modules/notificacoes/presentation/queries/relatorios', () => notificacoes)
vi.mock('@/src/modules/logistica/presentation/queries/dashboard', () => ({ projecaoAtual }))
vi.mock('@/src/modules/identidade/presentation/queries/relatorios', () => ({
    nomesPorIds: async () => new Map([['u-1', 'Maria Souza']])
}))

const { RELATORIOS_CONSOLIDADOS } = await import('./consolidados')
const { GerarRelatorioUseCase } = await import('../gerar-relatorio')

const porSlug = new Map(RELATORIOS_CONSOLIDADOS.map((r) => [r.slug, r]))
const uc = new GerarRelatorioUseCase((slug) => porSlug.get(slug as never))
const AGORA = new Date(Date.UTC(2026, 9, 8, 15, 0))

async function pagina(slug: string, entrada: Record<string, unknown> = {}) {
    const resultado = await uc.pagina(slug, entrada, AGORA)
    if (!resultado.ok) throw new Error(resultado.erro.message)
    return resultado.valor
}

const ZERO = { entradas: 0, saidas: 0, descartes: 0 }

describe('R-07 Movimentação por item', () => {
    it('fecha o balanço a partir do saldo de hoje e deixa de fora item parado e zerado', async () => {
        estoque.movimentacaoRelatorio.mockResolvedValue([
            {
                id: 'a',
                nome: 'Arroz',
                categoria: 'alimentacao',
                unidadeMedida: 'kg',
                saldoAtual: 125,
                noPeriodo: { entradas: 50, saidas: 30, descartes: 5 },
                aposPeriodo: { entradas: 10, saidas: 0, descartes: 0 }
            },
            {
                id: 'b',
                nome: 'Parado',
                categoria: 'outros',
                unidadeMedida: 'unidade',
                saldoAtual: 0,
                noPeriodo: ZERO,
                aposPeriodo: ZERO
            }
        ])

        const resultado = await pagina('movimentacao')
        expect(resultado.colunas).toEqual([
            'Item',
            'Categoria',
            'Unidade',
            'Saldo inicial',
            'Entradas',
            'Saídas',
            'Descartes',
            'Saldo final'
        ])
        expect(resultado.rows.map((r) => r.celulas)).toEqual([['Arroz', 'Alimentação', 'Kg', 100, 50, 30, 5, 115]])
        expect(resultado.resumo).toEqual([
            { rotulo: 'Itens no relatório', valor: 1 },
            { rotulo: 'Itens com entrada', valor: 1 },
            { rotulo: 'Itens com saída', valor: 1 },
            { rotulo: 'Itens com descarte', valor: 1 }
        ])
    })
})

describe('R-08 Entregas por destino', () => {
    it('colunas e quantidades', async () => {
        estoque.contarEntregasPorDestino.mockResolvedValue(1)
        estoque.entregasPorDestinoRelatorio.mockResolvedValue([
            { destino: 'Abrigo Central', categoria: 'agua', unidadeMedida: 'litro', quantidade: 120, saidas: 4 }
        ])
        const resultado = await pagina('entregas-por-destino')
        expect(resultado.colunas).toEqual(['Destino', 'Categoria', 'Unidade', 'Quantidade entregue', 'Nº de saídas'])
        expect(resultado.rows[0].celulas).toEqual(['Abrigo Central', 'Água', 'Litro', 120, 4])
    })
})

describe('R-14 Evolução da crise', () => {
    it('variação em relação à anterior; a primeira de todas sem variação', async () => {
        logistica.contarEvolucaoCrise.mockResolvedValue(2)
        logistica.evolucaoCriseRelatorio.mockResolvedValue([
            {
                id: 'c1',
                atualizadoEm: new Date('2026-10-01T15:00:00Z'),
                totalFamiliasAfetadas: 100,
                totalPessoasAfetadas: 350,
                familiasAnterior: null,
                pessoasAnterior: null,
                atualizadoPorId: 'u-1'
            },
            {
                id: 'c2',
                atualizadoEm: new Date('2026-10-02T15:00:00Z'),
                totalFamiliasAfetadas: 90,
                totalPessoasAfetadas: 400,
                familiasAnterior: 100,
                pessoasAnterior: 350,
                atualizadoPorId: 'u-1'
            }
        ])

        const resultado = await pagina('evolucao-crise')
        expect(resultado.rows.map((r) => r.celulas)).toEqual([
            ['01/10/2026, 12:00', 100, null, 350, null, 'Maria Souza'],
            ['02/10/2026, 12:00', 90, -10, 400, 50, 'Maria Souza']
        ])
    })
})

describe('R-15 Demanda × capacidade de kits', () => {
    it('só kits ativos com métrica, com os números da projeção do Painel (SC-007)', async () => {
        const kit = (nome: string, extra: object) => ({
            kitId: nome,
            nome,
            ativo: true,
            baseDemanda: 'por_familia',
            proporcao: 1,
            necessarios: 100,
            possiveis: 60,
            percentualAtendido: 60,
            deficit: true,
            gargalo: null,
            temReceita: true,
            ...extra
        })
        projecaoAtual.mockResolvedValue({
            crise: { totalFamiliasAfetadas: 100, totalPessoasAfetadas: 350 },
            kits: [kit('Higiene', {}), kit('Inativo', { ativo: false }), kit('Sem métrica', { baseDemanda: null })],
            kitsEmDeficit: 1
        })

        const resultado = await pagina('demanda-kits')
        expect(resultado.rows.map((r) => r.celulas)).toEqual([['Higiene', 'Por família afetada', 1, 100, 60, 40, 60]])
        expect(resultado.resumo).toEqual([
            { rotulo: 'Famílias afetadas', valor: 100 },
            { rotulo: 'Pessoas afetadas', valor: 350 },
            { rotulo: 'Kits em déficit', valor: 1 }
        ])
    })
})

describe('R-16 Envio de notificações', () => {
    it('sem filtro de situação, lista as falhas; o resumo traz todos os envios', async () => {
        notificacoes.contarEnviosNotificacoes.mockResolvedValue(1)
        notificacoes.enviosNotificacoesRelatorio.mockResolvedValue([
            {
                id: 'e1',
                criadoEm: new Date('2026-10-05T15:00:00Z'),
                tipo: 'lembrete_turno',
                canal: 'email',
                status: 'falhou',
                destinatarioUserId: 'u-1',
                erro: 'Caixa inexistente'
            }
        ])
        notificacoes.totaisEnviosNotificacoes.mockResolvedValue([
            { tipo: 'lembrete_turno', canal: 'email', status: 'falhou', total: 1 },
            { tipo: 'lembrete_turno', canal: 'email', status: 'enviado', total: 9 },
            { tipo: 'lembrete_turno', canal: 'plataforma', status: 'enviado', total: 10 }
        ])

        const resultado = await pagina('notificacoes')
        expect(notificacoes.contarEnviosNotificacoes).toHaveBeenLastCalledWith(
            expect.objectContaining({ status: 'falhou' })
        )
        expect(resultado.rows[0].celulas).toEqual([
            '05/10/2026, 12:00',
            'Lembrete de turno',
            'E-mail',
            'Falhou',
            'Maria Souza',
            'Caixa inexistente'
        ])
        expect(resultado.resumo).toEqual([
            { rotulo: 'E-mail — enviado', valor: 9 },
            { rotulo: 'E-mail — falhou', valor: 1 },
            { rotulo: 'Plataforma — enviado', valor: 10 },
            { rotulo: 'Falhas — Lembrete de turno', valor: 1 }
        ])
    })

    it('"Todas" tira o filtro de situação da lista', async () => {
        notificacoes.contarEnviosNotificacoes.mockResolvedValue(0)
        notificacoes.enviosNotificacoesRelatorio.mockResolvedValue([])
        notificacoes.totaisEnviosNotificacoes.mockResolvedValue([])
        await pagina('notificacoes', { status: 'todos' })
        expect(notificacoes.contarEnviosNotificacoes).toHaveBeenLastCalledWith(
            expect.objectContaining({ status: undefined })
        )
    })
})
