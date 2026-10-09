import { describe, expect, it, vi } from 'vitest'

/**
 * Definição de R-17 Trilha de auditoria (specs/023-central-relatorios, US4).
 * A leitura do Mongo é falsa — ela tem teste de integração próprio.
 */
const trilha = vi.hoisted(() => ({ trilhaAuditoria: vi.fn(), contarTrilhaAuditoria: vi.fn() }))

vi.mock('@/src/modules/auditoria/presentation/queries/trilha', async () => {
    const real = await vi.importActual<object>('@/src/modules/auditoria/presentation/queries/trilha')
    return { ...real, ...trilha }
})
vi.mock('@/src/modules/auditoria/infrastructure/audit-reader', () => ({
    AuditoriaIndisponivelError: class extends Error {},
    criarLeitorAuditoria: () => ({})
}))
vi.mock('@/src/shared/db/mongo/audit-logs', () => ({
    ENTIDADES_AUDITADAS: ['Voluntario', 'Atividade', 'Doacao', 'Usuario', 'Habilidade']
}))
vi.mock('@/src/modules/identidade/presentation/queries/relatorios', () => ({
    nomesPorIds: async () => new Map([['u-ana', 'Ana Admin']]),
    opcoesUsuarios: async () => [{ valor: 'u-ana', rotulo: 'Ana Admin (ana@x)' }]
}))

const { RELATORIOS_AUDITORIA } = await import('./auditoria')
const { GerarRelatorioUseCase } = await import('../gerar-relatorio')

const porSlug = new Map(RELATORIOS_AUDITORIA.map((r) => [r.slug, r]))
const uc = new GerarRelatorioUseCase((slug) => porSlug.get(slug as never))
const AGORA = new Date(Date.UTC(2026, 9, 8, 15, 0))

const REGISTRO = {
    id: 'r1',
    timestamp: new Date('2026-10-06T02:30:00Z'),
    entidade: 'Voluntario' as const,
    entidadeId: 'p-1',
    acao: 'update' as const,
    userId: 'u-ana',
    userRole: 'administrador',
    tabela: 'voluntario_perfil',
    dadosAnteriores: { status: 'pendente', cpf: '12345678909' },
    dadosNovos: { status: 'aprovado', cpf: '12345678909' }
}

describe('R-17 Trilha de auditoria', () => {
    it('colunas, autor por nome, papel em pt-BR e resumo das alterações (FR-021)', async () => {
        trilha.contarTrilhaAuditoria.mockResolvedValue(1)
        trilha.trilhaAuditoria.mockResolvedValue([REGISTRO])

        const resultado = await uc.pagina('auditoria', {}, AGORA)
        expect(resultado.ok).toBe(true)
        if (!resultado.ok) return

        expect(resultado.valor.colunas).toEqual([
            'Data/hora',
            'Assunto',
            'Tabela',
            'Registro',
            'Ação',
            'Autor',
            'Papel do autor',
            'Alterações'
        ])
        expect(resultado.valor.rows[0].celulas).toEqual([
            '05/10/2026, 23:30',
            'Voluntário',
            'voluntario_perfil',
            'p-1',
            'Alteração',
            'Ana Admin',
            'Administrador',
            'status: pendente → aprovado'
        ])
        // O detalhe expansível da prévia é a mesma diferença.
        expect(resultado.valor.rows[0].detalhe).toEqual([
            { campo: 'status', antes: 'pendente', depois: 'aprovado', tipo: 'alterado' }
        ])
    })

    it('operações sem usuário (cron, seed) aparecem como "Sistema"', async () => {
        trilha.contarTrilhaAuditoria.mockResolvedValue(1)
        trilha.trilhaAuditoria.mockResolvedValue([{ ...REGISTRO, userId: 'sistema', userRole: 'sistema' }])

        const resultado = await uc.pagina('auditoria', {}, AGORA)
        expect(resultado.ok && resultado.valor.rows[0].celulas.slice(5, 7)).toEqual(['Sistema', 'Sistema'])
    })

    it('autor sem conta aparece como "usuário não encontrado"', async () => {
        trilha.contarTrilhaAuditoria.mockResolvedValue(1)
        trilha.trilhaAuditoria.mockResolvedValue([{ ...REGISTRO, userId: 'u-removido' }])

        const resultado = await uc.pagina('auditoria', {}, AGORA)
        expect(resultado.ok && resultado.valor.rows[0].celulas[5]).toBe('usuário não encontrado')
    })

    it('passa período, assunto, ação e autor à leitura e descreve o autor pelo nome', async () => {
        trilha.contarTrilhaAuditoria.mockResolvedValue(0)
        trilha.trilhaAuditoria.mockResolvedValue([])

        const resultado = await uc.completo(
            'auditoria',
            { de: '2026-10-01', ate: '2026-10-05', entidade: 'Doacao', acao: 'delete', autorId: 'u-ana' },
            { nome: 'Ana' },
            AGORA
        )

        expect(trilha.contarTrilhaAuditoria).toHaveBeenLastCalledWith({
            intervalo: {
                inicio: new Date('2026-10-01T03:00:00.000Z'),
                fimExclusivo: new Date('2026-10-06T03:00:00.000Z')
            },
            entidade: 'Doacao',
            acao: 'delete',
            userId: 'u-ana'
        })
        expect(resultado.ok && resultado.valor.aba.cabecalhoDocumento?.slice(2, 5)).toEqual([
            { rotulo: 'Assunto', valor: 'Doação' },
            { rotulo: 'Ação', valor: 'Exclusão' },
            { rotulo: 'Autor', valor: 'Ana Admin (ana@x)' }
        ])
    })
})
