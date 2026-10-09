import { describe, expect, it, vi } from 'vitest'

/**
 * Definições de R-09 a R-13 (specs/023-central-relatorios, US3). Consultas
 * falsas — elas têm teste de integração próprio.
 */
const consultas = vi.hoisted(() => ({
    voluntariosRelatorio: vi.fn(),
    contarVoluntariosRelatorio: vi.fn(),
    triagemRelatorio: vi.fn(),
    contarTriagem: vi.fn(),
    candidaturasParaResumo: vi.fn(),
    capacidadeRelatorio: vi.fn(),
    ocupacaoTurnosRelatorio: vi.fn(),
    contarOcupacaoTurnos: vi.fn(),
    ocupacaoParaResumo: vi.fn(),
    participacaoRelatorio: vi.fn(),
    contarParticipacao: vi.fn(),
    opcoesFiltrosVoluntariado: vi.fn(async () => ({
        habilidades: [{ valor: 'h-barco', rotulo: 'Embarcação' }],
        atividades: [{ valor: 'a-1', rotulo: 'Montagem de kits' }],
        categoriasAtividade: [],
        bairros: [{ valor: 'Centro', rotulo: 'Centro' }]
    }))
}))

vi.mock('@/src/modules/voluntariado/presentation/queries/relatorios', () => consultas)
vi.mock('@/src/modules/identidade/presentation/queries/relatorios', () => ({
    nomesPorIds: async () => new Map([['u-carla', 'Carla Lima']])
}))

const { RELATORIOS_VOLUNTARIADO } = await import('./voluntariado')
const { GerarRelatorioUseCase } = await import('../gerar-relatorio')

const porSlug = new Map(RELATORIOS_VOLUNTARIADO.map((r) => [r.slug, r]))
const uc = new GerarRelatorioUseCase((slug) => porSlug.get(slug as never))

// 10/10/2026 15:00 UTC = 12:00 em Brasília.
const AGORA = new Date(Date.UTC(2026, 9, 10, 15, 0))

async function pagina(slug: string, entrada: Record<string, unknown> = {}) {
    const resultado = await uc.pagina(slug, entrada, AGORA)
    if (!resultado.ok) throw new Error(resultado.erro.message)
    return resultado.valor
}

describe('R-09 Voluntários cadastrados', () => {
    it('mostra CPF e restrições completos, rótulos em pt-BR (FR-014, FR-024)', async () => {
        consultas.contarVoluntariosRelatorio.mockResolvedValue(1)
        consultas.voluntariosRelatorio.mockResolvedValue([
            {
                id: 'p1',
                nomeCompleto: 'Ana Souza',
                cpf: '12345678909',
                status: 'aprovado',
                telefone: '47999990000',
                bairro: 'Centro',
                profissao: 'Enfermeira',
                habilidades: 'Embarcação, Primeiros socorros',
                veiculoProprio: true,
                tipoVeiculo: 'barco',
                disponibilidade: ['noite', 'fim_de_semana'],
                restricoesSaude: 'Alergia a dipirona',
                criadoEm: new Date('2026-10-01T15:00:00Z'),
                decididoEm: null
            }
        ])

        const resultado = await pagina('voluntarios')
        expect(resultado.colunas).toEqual([
            'Nome',
            'CPF',
            'Situação',
            'Telefone',
            'Bairro',
            'Profissão',
            'Habilidades',
            'Veículo próprio',
            'Tipo de veículo',
            'Disponibilidade',
            'Restrições de saúde',
            'Cadastro em',
            'Decisão em'
        ])
        expect(resultado.rows[0].celulas).toEqual([
            'Ana Souza',
            '12345678909',
            'Aprovado',
            '47999990000',
            'Centro',
            'Enfermeira',
            'Embarcação, Primeiros socorros',
            'Sim',
            'Barco',
            'Noite, Fim de semana',
            'Alergia a dipirona',
            '01/10/2026, 12:00',
            null
        ])
    })

    it('descreve a habilidade filtrada pelo nome, não pelo id', async () => {
        consultas.contarVoluntariosRelatorio.mockResolvedValue(0)
        consultas.voluntariosRelatorio.mockResolvedValue([])
        const resultado = await uc.completo(
            'voluntarios',
            { habilidadeId: 'h-barco', bairro: 'Centro' },
            { nome: 'M' },
            AGORA
        )
        expect(resultado.ok && resultado.valor.aba.cabecalhoDocumento?.slice(2, 4)).toEqual([
            { rotulo: 'Bairro', valor: 'Centro' },
            { rotulo: 'Habilidade', valor: 'Embarcação' }
        ])
    })
})

describe('R-10 Triagem', () => {
    it('dias de espera para pendentes, dias até decisão para decididas, e resumo', async () => {
        consultas.contarTriagem.mockResolvedValue(2)
        consultas.triagemRelatorio.mockResolvedValue([
            {
                id: 'p1',
                nomeCompleto: 'Pendente',
                telefone: '1',
                bairro: 'Centro',
                status: 'pendente',
                enviadoEm: new Date('2026-10-05T15:00:00Z'),
                primeiroEnvio: new Date('2026-09-01T15:00:00Z'),
                decididoEm: null
            },
            {
                id: 'p2',
                nomeCompleto: 'Aprovada',
                telefone: '2',
                bairro: 'Centro',
                status: 'aprovado',
                enviadoEm: new Date('2026-10-01T15:00:00Z'),
                primeiroEnvio: new Date('2026-10-01T15:00:00Z'),
                decididoEm: new Date('2026-10-04T15:00:00Z')
            }
        ])
        consultas.candidaturasParaResumo.mockResolvedValue([
            { status: 'pendente', primeiroEnvio: new Date('2026-09-01T15:00:00Z'), decididoEm: null },
            {
                status: 'aprovado',
                primeiroEnvio: new Date('2026-10-01T15:00:00Z'),
                decididoEm: new Date('2026-10-04T15:00:00Z')
            }
        ])

        const resultado = await pagina('triagem')
        expect(resultado.rows.map((r) => r.celulas.at(-1))).toEqual([5, 3])
        expect(resultado.resumo).toEqual([
            { rotulo: 'Pendentes', valor: 1 },
            { rotulo: 'Aprovadas', valor: 1 },
            { rotulo: 'Rejeitadas', valor: 0 },
            { rotulo: 'Tempo médio até decisão', valor: '3 dias' }
        ])
    })
})

describe('R-11 Capacidade por habilidade', () => {
    it('lista todo veículo e disponibilidade, inclusive com zero', async () => {
        consultas.capacidadeRelatorio.mockResolvedValue({
            porHabilidade: [{ habilidade: 'Embarcação', total: 2 }],
            porVeiculo: [{ tipoVeiculo: 'barco', total: 1 }],
            porDisponibilidade: [{ disponibilidade: 'manha', total: 2 }]
        })

        const resultado = await pagina('capacidade-habilidades', { pageSize: '50' })
        expect(resultado.totalCount).toBe(1 + 4 + 5)
        expect(resultado.rows.map((r) => r.celulas)).toContainEqual(['Veículo', 'Barco', 1])
        expect(resultado.rows.map((r) => r.celulas)).toContainEqual(['Veículo', 'Moto', 0])
        expect(resultado.rows.map((r) => r.celulas)).toContainEqual(['Disponibilidade', 'Manhã', 2])
    })
})

describe('R-12 Ocupação de turnos', () => {
    it('ocupação por turno e resumo geral; "só com vagas" vira booleano na consulta', async () => {
        consultas.contarOcupacaoTurnos.mockResolvedValue(1)
        consultas.ocupacaoTurnosRelatorio.mockResolvedValue([
            {
                turnoId: 't1',
                atividade: 'Montagem de kits',
                categoria: 'Logística',
                local: 'Galpão',
                statusAtividade: 'aberta',
                inicio: new Date('2026-10-05T12:00:00Z'),
                fim: new Date('2026-10-05T16:00:00Z'),
                vagas: 5,
                confirmados: 2
            }
        ])
        consultas.ocupacaoParaResumo.mockResolvedValue([
            { vagas: 5, confirmados: 2 },
            { vagas: 5, confirmados: 5 }
        ])

        const resultado = await pagina('ocupacao-turnos', { apenasComVagas: 'true' })
        expect(resultado.rows[0].celulas.slice(-3)).toEqual([5, 2, 40])
        expect(resultado.resumo).toEqual([
            { rotulo: 'Turnos no período', valor: 2 },
            { rotulo: 'Turnos com vagas abertas', valor: 1 },
            { rotulo: 'Ocupação geral (%)', valor: 70 }
        ])
        expect(consultas.contarOcupacaoTurnos).toHaveBeenLastCalledWith(
            expect.objectContaining({ apenasComVagas: true })
        )
    })
})

describe('R-13 Participação por pessoa', () => {
    it('nome via Identidade, horas escaladas com uma casa', async () => {
        consultas.contarParticipacao.mockResolvedValue(1)
        consultas.participacaoRelatorio.mockResolvedValue([
            { participanteUserId: 'u-carla', cpf: null, telefone: null, turnos: 2, segundos: 8 * 3600 }
        ])

        const resultado = await pagina('participacao')
        expect(resultado.colunas).toEqual(['Participante', 'CPF', 'Telefone', 'Turnos confirmados', 'Horas escaladas'])
        expect(resultado.rows[0].celulas).toEqual(['Carla Lima', null, null, 2, 8])
    })
})
