import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ImpressaoDigital } from '../../domain/previa'
import { ExecutarAcaoUseCase } from './executar-acao'
import { executorFalso, leitorFalso, registroFalso, type ConfiguracaoSessao } from './testes/fakes'

const AGORA = new Date('2026-11-10T12:00:00Z')

const ATOR = {
    userId: 'admin-1',
    role: 'administrador' as const,
    sessionToken: 'tok-admin',
    sessaoCriadaEm: new Date(AGORA.getTime() - 60_000)
}

const IMPRESSAO: ImpressaoDigital = {
    kit: { apagar: 2, redirecionar: {} },
    kit_receita_item: { apagar: 5, redirecionar: {} }
}

const PEDIDO = { acao: 'resetar_tabela' as const, tabela: 'kit' }

function caso(config: Partial<ConfiguracaoSessao> = {}, falhas: Parameters<typeof registroFalso>[1] = {}) {
    const chamadas: string[] = []
    const { executor, transacoes } = executorFalso({ impressao: { padrao: IMPRESSAO }, ...config }, chamadas)
    const { registro, eventos } = registroFalso(chamadas, falhas)
    const uc = new ExecutarAcaoUseCase({
        leitor: leitorFalso(),
        executor,
        registro,
        relogio: () => AGORA,
        novoId: () => 'exec-1'
    })
    const executar = (extra: Partial<Parameters<typeof uc.executar>[0]> = {}) =>
        uc.executar({
            pedido: PEDIDO,
            impressaoDigital: IMPRESSAO,
            confirmacao: 'RESETAR kit',
            ator: ATOR,
            ambiente: 'development',
            ...extra
        })
    return { executar, chamadas, transacoes, eventos }
}

afterEach(() => vi.restoreAllMocks())

describe('ExecutarAcaoUseCase — recusas antes de tocar no banco', () => {
    it('sessão com mais de 15 min → reautenticacao_necessaria, sem executor, evento recusada', async () => {
        const { executar, chamadas, eventos } = caso()
        const r = await executar({ ator: { ...ATOR, sessaoCriadaEm: new Date(AGORA.getTime() - 16 * 60_000) } })
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.erro.codigo).toBe('reautenticacao_necessaria')
        expect(chamadas).not.toContain('semear')
        expect(eventos.map((e) => [e.fase, e.resumo.motivo])).toEqual([['recusada', 'reautenticacao_necessaria']])
    })

    it('confirmação diferente → confirmacao_invalida', async () => {
        const { executar, chamadas } = caso()
        const r = await executar({ confirmacao: 'resetar kit' })
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.erro.codigo).toBe('confirmacao_invalida')
        expect(chamadas).not.toContain('semear')
    })

    it('ping da auditoria falha → auditoria_indisponivel, sem transação', async () => {
        const { executar, chamadas } = caso({}, { ping: true })
        const r = await executar()
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.erro.codigo).toBe('auditoria_indisponivel')
        expect(chamadas.some((c) => c.startsWith('travar'))).toBe(false)
    })
})

describe('ExecutarAcaoUseCase — dentro da transação', () => {
    it('caminho feliz segue a ordem de research D8', async () => {
        vi.spyOn(console, 'info').mockImplementation(() => {})
        const { executar, chamadas, transacoes } = caso()
        const r = await executar()
        expect(r.ok).toBe(true)
        const marcos = chamadas.filter(
            (c) =>
                [
                    'verificarDisponibilidade',
                    'contar',
                    'registrarInicio',
                    'aplicar',
                    'recalcularSaldos',
                    'commit',
                    'registrarDesfecho:concluida'
                ].includes(c) || c.startsWith('travar')
        )
        expect(marcos.map((c) => (c.startsWith('travar') ? 'travar' : c))).toEqual([
            'verificarDisponibilidade',
            'travar',
            'contar',
            'registrarInicio',
            'aplicar',
            'recalcularSaldos',
            'commit',
            'registrarDesfecho:concluida'
        ])
        expect(transacoes).toEqual([{ confirmar: true, resultado: 'commit' }])
        if (r.ok) expect(r.valor.execucaoId).toBe('exec-1')
    })

    it('impressão digital diferente → dados_mudaram com prévia nova, rollback, evento recusada', async () => {
        const { executar, chamadas, eventos } = caso({
            impressao: { padrao: { ...IMPRESSAO, kit: { apagar: 3, redirecionar: {} } } }
        })
        const r = await executar()
        expect(r.ok).toBe(false)
        if (!r.ok) {
            expect(r.erro.codigo).toBe('dados_mudaram')
            expect((r.erro.detalhes?.previa as { totalApagar: number }).totalApagar).toBe(8)
        }
        expect(chamadas).toContain('rollback')
        expect(chamadas).not.toContain('registrarInicio')
        expect(chamadas).not.toContain('aplicar')
        expect(eventos.at(-1)?.fase).toBe('recusada')
    })

    it('registrarInicio falha → rollback, auditoria_indisponivel, sem aplicar', async () => {
        const { executar, chamadas } = caso({}, { inicio: true })
        const r = await executar()
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.erro.codigo).toBe('auditoria_indisponivel')
        expect(chamadas).not.toContain('aplicar')
        expect(chamadas).toContain('rollback')
    })

    it('aplicar falha → rollback e desfecho falhou', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const { executar, chamadas, eventos } = caso({ falhaEm: 'aplicar' })
        const r = await executar()
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.erro.codigo).toBe('falha_execucao')
        expect(chamadas).toContain('rollback')
        expect(chamadas).not.toContain('commit')
        expect(eventos.map((e) => e.fase)).toEqual(['iniciada', 'falhou'])
    })

    it('desfecho falha depois do commit → sucesso, com console.error', async () => {
        vi.spyOn(console, 'info').mockImplementation(() => {})
        const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { executar, chamadas } = caso({}, { desfecho: true })
        const r = await executar()
        expect(r.ok).toBe(true)
        expect(chamadas).toContain('commit')
        expect(erro).toHaveBeenCalled()
    })

    it('ação que deixaria o sistema sem administrador é recusada (FR-018)', async () => {
        const { executar, chamadas } = caso({ administradores: 0 })
        const r = await executar()
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.erro.codigo).toBe('ultimo_administrador')
        expect(chamadas).not.toContain('aplicar')
    })

    it('com dependentes de histórico e sem modo → modo_obrigatorio', async () => {
        const historico: ImpressaoDigital = {
            item: { apagar: 1, redirecionar: {} },
            entrada: { apagar: 0, redirecionar: { item_id: 2 } }
        }
        const { executar } = caso({ impressao: { padrao: historico } })
        const r = await executar({
            pedido: { acao: 'resetar_tabela', tabela: 'item' },
            confirmacao: 'RESETAR item',
            impressaoDigital: historico
        })
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.erro.codigo).toBe('modo_obrigatorio')
    })
})
