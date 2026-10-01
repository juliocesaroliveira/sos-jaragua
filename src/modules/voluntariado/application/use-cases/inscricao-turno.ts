import { DomainError, NaoEncontradoError, falha, ok, type Result, type UseCase } from '@/src/shared/kernel'
import { withAudit } from '@/src/modules/auditoria'
import type { Notificacao, NotificacaoService } from '@/src/modules/notificacoes/application/ports/notificacao-service'
import { MENSAGEM_NAO_ELEGIVEL, podeSeInscrever, validarDesistencia } from '../../domain/inscricao'
import type { Atividade, AtividadeRepository, ResultadoInscricao, Turno } from '../ports/atividade-repository'
import type { VoluntarioRepository } from '../ports/voluntario-repository'

export type EntradaInscreverEmTurno = {
    turnoId: string
    /** Sempre o usuário da sessão — nunca vem do cliente (contrato A-02). */
    participanteUserId: string
    /** Nome da conta — usado quando o participante não tem perfil de voluntário. */
    nomeParticipante: string
    /** Papel de staff: inscreve-se mesmo sem perfil (FR-011). */
    equipeInterna: boolean
    agora: Date
}

/**
 * Inscrição própria em turno (018-inscricao-atividades, contrato I-01).
 *
 * A decisão de vaga/conflito acontece **dentro** da transação do repositório,
 * com o turno travado (research D3) — aqui só a elegibilidade, a auditoria e
 * os avisos. Não há etapa de aprovação: a vaga é ocupada na hora (FR-013).
 */
export class InscreverEmTurnoUseCase implements UseCase<EntradaInscreverEmTurno, { alocacaoId: string }> {
    constructor(
        private readonly atividades: AtividadeRepository,
        private readonly voluntarios: VoluntarioRepository,
        private readonly notificacoes: NotificacaoService
    ) {}

    async executar(entrada: EntradaInscreverEmTurno): Promise<Result<{ alocacaoId: string }, DomainError>> {
        const { turnoId, participanteUserId, equipeInterna, agora } = entrada

        const perfil = await this.voluntarios.buscarPorUserId(participanteUserId)
        if (!podeSeInscrever({ equipeInterna, statusPerfil: perfil?.status ?? null })) {
            return falha(new DomainError('nao_elegivel', MENSAGEM_NAO_ELEGIVEL))
        }
        const voluntarioPerfilId = perfil?.status === 'aprovado' ? perfil.id : null

        const resultado: ResultadoInscricao = await withAudit(
            {
                entidade: 'Atividade',
                acao: 'create',
                tabela: 'alocacao',
                extrair: (r: ResultadoInscricao) => ({
                    entidadeId: r.ok ? r.alocacaoId : turnoId,
                    dadosNovos: r.ok
                        ? {
                              alocacaoId: r.alocacaoId,
                              turnoId,
                              participanteUserId,
                              voluntarioPerfilId,
                              alocadoPor: participanteUserId,
                              origem: 'inscricao_propria'
                          }
                        : null
                })
            },
            () => this.atividades.inscreverComTrava({ turnoId, participanteUserId, voluntarioPerfilId, agora })
        )

        if (!resultado.ok) {
            return falha(
                resultado.motivo === 'nao_encontrado'
                    ? new NaoEncontradoError(resultado.mensagem)
                    : new DomainError(resultado.motivo, resultado.mensagem)
            )
        }

        const { atividade, turno, alocacaoId } = resultado
        const nome = perfil?.nomeCompleto ?? entrada.nomeParticipante
        const contexto = { atividadeId: atividade.id, turnoId, alocacaoId }

        await notificarSemFalhar(this.notificacoes, [
            {
                evento: 'atividade_atribuida',
                destinatarioUserId: participanteUserId,
                titulo: 'Nova atividade atribuída',
                mensagem: `Você foi escalado para "${atividade.titulo}" em ${atividade.local}, das ${formatarHora(turno.inicio)} às ${formatarHora(turno.fim)} de ${formatarData(turno.inicio)}.`,
                contexto
            },
            avisoParaGestao(atividade, turno, `${nome} se inscreveu no turno`, 'Nova inscrição em turno', contexto)
        ])

        return ok({ alocacaoId })
    }
}

export type EntradaDesistirDeTurno = {
    alocacaoId: string
    participanteUserId: string
    nomeParticipante: string
    agora: Date
}

/**
 * Desistência pela própria pessoa (contrato I-02). Vale para alocações de
 * qualquer origem, até 30 minutos antes do início (FR-017/FR-018a).
 *
 * Alocação de outra pessoa ou já cancelada recebe a **mesma** resposta de
 * inexistente — não revela a escala alheia.
 */
export class DesistirDeTurnoUseCase implements UseCase<EntradaDesistirDeTurno, { alocacaoId: string }> {
    constructor(
        private readonly atividades: AtividadeRepository,
        private readonly notificacoes: NotificacaoService
    ) {}

    async executar(entrada: EntradaDesistirDeTurno): Promise<Result<{ alocacaoId: string }, DomainError>> {
        const { alocacaoId, participanteUserId, agora } = entrada

        const alocacao = await this.atividades.buscarAlocacaoDoParticipante(alocacaoId, participanteUserId)
        if (!alocacao || alocacao.status !== 'confirmado') {
            return falha(new NaoEncontradoError('Alocação não encontrada.'))
        }

        const prazo = validarDesistencia({ inicio: alocacao.turno.inicio, agora })
        if (!prazo.ok) return prazo

        await withAudit(
            {
                entidade: 'Atividade',
                acao: 'update',
                tabela: 'alocacao',
                dadosAnteriores: async () => ({ alocacaoId, participanteUserId, status: 'confirmado' }),
                extrair: () => ({ entidadeId: alocacaoId, dadosNovos: { status: 'cancelado', motivo: 'desistencia' } })
            },
            () => this.atividades.cancelarAlocacao(alocacaoId)
        )

        // O participante acabou de agir e recebe o retorno na tela — só a
        // gestão é avisada (research D6).
        await notificarSemFalhar(this.notificacoes, [
            avisoParaGestao(
                alocacao.atividade,
                alocacao.turno,
                `${entrada.nomeParticipante} desistiu do turno`,
                'Desistência de turno',
                { atividadeId: alocacao.atividade.id, turnoId: alocacao.turno.id, alocacaoId }
            )
        ])

        return ok({ alocacaoId })
    }
}

/** Aviso só na plataforma para quem criou a atividade (FR-022, evento sem e-mail). */
function avisoParaGestao(
    atividade: Atividade,
    turno: Turno,
    acao: string,
    titulo: string,
    contexto: Record<string, unknown>
): Notificacao {
    return {
        evento: 'inscricao_turno',
        destinatarioUserId: atividade.criadoPor,
        titulo,
        mensagem: `${acao} de ${formatarData(turno.inicio)} ${formatarHora(turno.inicio)}–${formatarHora(turno.fim)} de "${atividade.titulo}".`,
        contexto
    }
}

/**
 * O port já promete não derrubar a operação, mas a inscrição está gravada e
 * auditada a esta altura — nenhum aviso pode transformá-la em erro.
 */
async function notificarSemFalhar(servico: NotificacaoService, notificacoes: Notificacao[]): Promise<void> {
    for (const notificacao of notificacoes) {
        try {
            await servico.enviar(notificacao)
        } catch (erro) {
            console.error('[inscricao-turno] falha ao notificar', { evento: notificacao.evento, erro })
        }
    }
}

const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' })

function formatarHora(data: Date): string {
    return HORA.format(data)
}

function formatarData(data: Date): string {
    return DATA.format(data)
}
