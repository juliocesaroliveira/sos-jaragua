import { describe, expect, it, vi } from 'vitest'
import type { Notificacao, NotificacaoService } from '@/src/modules/notificacoes/application/ports/notificacao-service'
import type {
    AlocacaoDoParticipante,
    Atividade,
    AtividadeRepository,
    ResultadoInscricao,
    Turno
} from '../ports/atividade-repository'
import type { PerfilVoluntario, VoluntarioRepository } from '../ports/voluntario-repository'
import { DesistirDeTurnoUseCase, InscreverEmTurnoUseCase } from './inscricao-turno'

const auditoria = vi.hoisted(() => ({ chamadas: [] as Array<Record<string, unknown>> }))

vi.mock('@/src/modules/auditoria', () => ({
    withAudit: async <T>(
        opcoes: {
            acao: string
            dadosAnteriores?: () => Promise<unknown>
            extrair: (r: T) => { entidadeId: string; dadosNovos: unknown }
        },
        fn: () => Promise<T>
    ) => {
        const anteriores = opcoes.dadosAnteriores ? await opcoes.dadosAnteriores() : null
        const resultado = await fn()
        auditoria.chamadas.push({ acao: opcoes.acao, anteriores, ...opcoes.extrair(resultado) })
        return resultado
    }
}))

/** 018-inscricao-atividades — contratos I-01 e I-02. */

const h = (hora: number, minuto = 0) =>
    new Date(`2026-10-06T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00-03:00`)

const TURNO: Turno = { id: 't1', atividadeId: 'a1', inicio: h(8), fim: h(12), vagas: 5 }
const ATIVIDADE: Atividade = {
    id: 'a1',
    titulo: 'Limpeza no Centro',
    categoriaId: 'c1',
    local: 'Praça Ângelo Piazera',
    status: 'aberta',
    criadoPor: 'coordenadora'
}
const PERFIL: PerfilVoluntario = {
    id: 'perfil-1',
    userId: 'u1',
    nomeCompleto: 'Ana Souza',
    cpf: '00000000000',
    status: 'aprovado'
}

function montar({
    perfil = PERFIL as PerfilVoluntario | null,
    resultado = { ok: true, alocacaoId: 'aloc-1', turno: TURNO, atividade: ATIVIDADE } as ResultadoInscricao,
    alocacao = null as AlocacaoDoParticipante | null,
    notificacaoFalha = false
} = {}) {
    auditoria.chamadas = []
    const atividades = {
        inscreverComTrava: vi.fn(async () => resultado),
        buscarAlocacaoDoParticipante: vi.fn(async () => alocacao),
        cancelarAlocacao: vi.fn(async () => {})
    } as unknown as AtividadeRepository & {
        inscreverComTrava: ReturnType<typeof vi.fn>
        buscarAlocacaoDoParticipante: ReturnType<typeof vi.fn>
        cancelarAlocacao: ReturnType<typeof vi.fn>
    }
    const voluntarios = {
        buscarPorUserId: vi.fn(async () => perfil)
    } as unknown as VoluntarioRepository
    const enviar = vi.fn<(notificacao: Notificacao) => Promise<void>>(async () => {
        if (notificacaoFalha) throw new Error('fora do ar')
    })
    const notificacoes = { enviar, enviarEmLote: vi.fn() } as unknown as NotificacaoService
    return { atividades, voluntarios, notificacoes, enviar }
}

const ENTRADA_INSCRICAO = {
    turnoId: 't1',
    participanteUserId: 'u1',
    nomeParticipante: 'Ana (conta)',
    equipeInterna: false,
    agora: h(6)
}

describe('InscreverEmTurnoUseCase', () => {
    it('voluntário sem perfil aprovado é recusado sem tocar a escala (FR-011)', async () => {
        const m = montar({ perfil: { ...PERFIL, status: 'pendente' } })
        const r = await new InscreverEmTurnoUseCase(m.atividades, m.voluntarios, m.notificacoes).executar(
            ENTRADA_INSCRICAO
        )
        expect(r.ok).toBe(false)
        if (r.ok) return
        expect(r.erro.codigo).toBe('nao_elegivel')
        expect(m.atividades.inscreverComTrava).not.toHaveBeenCalled()
    })

    it('equipe interna sem perfil se inscreve com voluntarioPerfilId nulo', async () => {
        const m = montar({ perfil: null })
        const r = await new InscreverEmTurnoUseCase(m.atividades, m.voluntarios, m.notificacoes).executar({
            ...ENTRADA_INSCRICAO,
            equipeInterna: true
        })
        expect(r.ok).toBe(true)
        expect(m.atividades.inscreverComTrava).toHaveBeenCalledWith(
            expect.objectContaining({ participanteUserId: 'u1', voluntarioPerfilId: null })
        )
    })

    it('voluntário aprovado passa o próprio perfil', async () => {
        const m = montar()
        await new InscreverEmTurnoUseCase(m.atividades, m.voluntarios, m.notificacoes).executar(ENTRADA_INSCRICAO)
        expect(m.atividades.inscreverComTrava).toHaveBeenCalledWith(
            expect.objectContaining({ voluntarioPerfilId: 'perfil-1', agora: h(6) })
        )
    })

    it.each(['lotado', 'ja_inscrito', 'conflito_horario', 'atividade_fechada', 'turno_iniciado'] as const)(
        'traduz a recusa "%s" do repositório para erro com o mesmo código',
        async (motivo) => {
            const m = montar({ resultado: { ok: false, motivo, mensagem: `mensagem ${motivo}` } })
            const r = await new InscreverEmTurnoUseCase(m.atividades, m.voluntarios, m.notificacoes).executar(
                ENTRADA_INSCRICAO
            )
            expect(r.ok).toBe(false)
            if (r.ok) return
            expect(r.erro.codigo).toBe(motivo)
            expect(r.erro.message).toBe(`mensagem ${motivo}`)
            expect(m.enviar).not.toHaveBeenCalled()
        }
    )

    it('turno inexistente vira nao_encontrado', async () => {
        const m = montar({ resultado: { ok: false, motivo: 'nao_encontrado', mensagem: 'Turno não encontrado.' } })
        const r = await new InscreverEmTurnoUseCase(m.atividades, m.voluntarios, m.notificacoes).executar(
            ENTRADA_INSCRICAO
        )
        expect(r.ok).toBe(false)
        if (r.ok) return
        expect(r.erro.codigo).toBe('nao_encontrado')
    })

    it('no sucesso avisa o participante e quem criou a atividade (FR-021/FR-022)', async () => {
        const m = montar()
        const r = await new InscreverEmTurnoUseCase(m.atividades, m.voluntarios, m.notificacoes).executar(
            ENTRADA_INSCRICAO
        )
        expect(r.ok).toBe(true)

        expect(m.enviar).toHaveBeenCalledWith(
            expect.objectContaining({ evento: 'atividade_atribuida', destinatarioUserId: 'u1' })
        )
        const paraGestao = m.enviar.mock.calls.map(([n]) => n).find((n) => n.evento === 'inscricao_turno')
        expect(paraGestao?.destinatarioUserId).toBe('coordenadora')
        expect(paraGestao?.mensagem).toContain('Ana Souza se inscreveu')
        expect(paraGestao?.mensagem).toContain('Limpeza no Centro')
    })

    it('audita a criação com origem inscricao_propria (FR-023)', async () => {
        const m = montar()
        await new InscreverEmTurnoUseCase(m.atividades, m.voluntarios, m.notificacoes).executar(ENTRADA_INSCRICAO)
        expect(auditoria.chamadas[0]).toMatchObject({
            acao: 'create',
            entidadeId: 'aloc-1',
            dadosNovos: expect.objectContaining({ origem: 'inscricao_propria', participanteUserId: 'u1' })
        })
    })

    it('falha ao notificar não desfaz a inscrição', async () => {
        const m = montar({ notificacaoFalha: true })
        const erroConsole = vi.spyOn(console, 'error').mockImplementation(() => {})
        const r = await new InscreverEmTurnoUseCase(m.atividades, m.voluntarios, m.notificacoes).executar(
            ENTRADA_INSCRICAO
        )
        expect(r.ok).toBe(true)
        erroConsole.mockRestore()
    })
})

const ALOCACAO: AlocacaoDoParticipante = {
    alocacaoId: 'aloc-1',
    status: 'confirmado',
    turno: TURNO,
    atividade: ATIVIDADE
}
const ENTRADA_DESISTENCIA = {
    alocacaoId: 'aloc-1',
    participanteUserId: 'u1',
    nomeParticipante: 'Ana Souza',
    agora: h(6)
}

describe('DesistirDeTurnoUseCase', () => {
    it('alocação inexistente ou de outra pessoa → nao_encontrado', async () => {
        const m = montar({ alocacao: null })
        const r = await new DesistirDeTurnoUseCase(m.atividades, m.notificacoes).executar(ENTRADA_DESISTENCIA)
        expect(r.ok).toBe(false)
        if (r.ok) return
        expect(r.erro.codigo).toBe('nao_encontrado')
        expect(r.erro.message).toBe('Alocação não encontrada.')
    })

    it('alocação já cancelada → nao_encontrado', async () => {
        const m = montar({ alocacao: { ...ALOCACAO, status: 'cancelado' } })
        const r = await new DesistirDeTurnoUseCase(m.atividades, m.notificacoes).executar(ENTRADA_DESISTENCIA)
        expect(r.ok).toBe(false)
        if (r.ok) return
        expect(r.erro.codigo).toBe('nao_encontrado')
    })

    it('dentro do prazo de 30 minutos → prazo_desistencia, sem cancelar', async () => {
        const m = montar({ alocacao: ALOCACAO })
        const r = await new DesistirDeTurnoUseCase(m.atividades, m.notificacoes).executar({
            ...ENTRADA_DESISTENCIA,
            agora: h(7, 45)
        })
        expect(r.ok).toBe(false)
        if (r.ok) return
        expect(r.erro.codigo).toBe('prazo_desistencia')
        expect(m.atividades.cancelarAlocacao).not.toHaveBeenCalled()
    })

    it('cancela, audita e avisa só quem criou a atividade (FR-018/FR-022)', async () => {
        const m = montar({ alocacao: ALOCACAO })
        const r = await new DesistirDeTurnoUseCase(m.atividades, m.notificacoes).executar(ENTRADA_DESISTENCIA)
        expect(r.ok).toBe(true)
        expect(m.atividades.cancelarAlocacao).toHaveBeenCalledWith('aloc-1')

        expect(auditoria.chamadas[0]).toMatchObject({
            acao: 'update',
            entidadeId: 'aloc-1',
            anteriores: expect.objectContaining({ status: 'confirmado' }),
            dadosNovos: expect.objectContaining({ status: 'cancelado' })
        })

        expect(m.enviar).toHaveBeenCalledTimes(1)
        expect(m.enviar).toHaveBeenCalledWith(
            expect.objectContaining({
                evento: 'inscricao_turno',
                destinatarioUserId: 'coordenadora',
                mensagem: expect.stringContaining('Ana Souza desistiu do turno')
            })
        )
    })
})
