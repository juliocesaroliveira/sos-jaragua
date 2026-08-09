import {
    DomainError,
    NaoEncontradoError,
    ValidacaoError,
    falha,
    ok,
    type Result,
    type UseCase
} from '@/src/shared/kernel'
import { withAudit } from '@/src/modules/auditoria'
import type { NotificacaoService } from '@/src/modules/notificacoes/application/ports/notificacao-service'
import type { AtividadeRepository } from '../ports/atividade-repository'
import type { VoluntarioRepository } from '../ports/voluntario-repository'

export type EntradaAlocarVoluntario = {
    turnoId: string
    voluntarioPerfilId: string
    alocadoPor: string
}

/**
 * BR-VOL-05 — alocação de voluntário em um turno.
 *
 * A unicidade `(turnoId, voluntarioPerfilId)` é garantida pelo índice do banco,
 * não por uma leitura prévia: duas alocações simultâneas do mesmo voluntário
 * passariam por qualquer checagem feita em memória.
 *
 * Vagas excedentes **não** bloqueiam: `turno.vagas` é a meta que o Kanban usa
 * para sinalizar déficit (DESIGN.md §10.2), e o Coordenador precisa poder
 * escalar alguém a mais em campo sem que o sistema o impeça.
 */
export class AlocarVoluntarioUseCase implements UseCase<EntradaAlocarVoluntario, { alocacaoId: string }> {
    constructor(
        private readonly atividades: AtividadeRepository,
        private readonly voluntarios: VoluntarioRepository,
        private readonly notificacoes: NotificacaoService
    ) {}

    async executar({
        turnoId,
        voluntarioPerfilId,
        alocadoPor
    }: EntradaAlocarVoluntario): Promise<Result<{ alocacaoId: string }, DomainError>> {
        const turno = await this.atividades.buscarTurno(turnoId)
        if (!turno) return falha(new NaoEncontradoError('Turno não encontrado.'))

        const atividade = await this.atividades.buscarPorId(turno.atividadeId)
        if (!atividade) return falha(new NaoEncontradoError('Atividade não encontrada.'))
        if (atividade.status !== 'aberta') {
            return falha(
                new ValidacaoError(`Não é possível alocar em uma atividade ${atividade.status}.`, {
                    campos: { turnoId: 'Atividade não está aberta.' }
                })
            )
        }

        const perfil = await this.voluntarios.buscarPorId(voluntarioPerfilId)
        if (!perfil) return falha(new NaoEncontradoError('Voluntário não encontrado.'))
        if (perfil.status !== 'aprovado') {
            return falha(
                new ValidacaoError('Somente voluntários aprovados podem ser alocados.', {
                    campos: { voluntarioPerfilId: 'Candidatura ainda não aprovada.' }
                })
            )
        }

        const alocado = await withAudit(
            {
                entidade: 'Atividade',
                acao: 'create',
                tabela: 'alocacao',
                extrair: (resultado) => ({
                    entidadeId: resultado?.alocacaoId ?? turnoId,
                    dadosNovos: resultado
                        ? { alocacaoId: resultado.alocacaoId, turnoId, voluntarioPerfilId, alocadoPor }
                        : null
                })
            },
            () => this.atividades.alocar({ turnoId, voluntarioPerfilId, alocadoPor })
        )

        if (!alocado) {
            return falha(
                new ValidacaoError('Este voluntário já está alocado neste turno.', {
                    campos: { voluntarioPerfilId: 'Já alocado neste turno.' }
                })
            )
        }

        await this.notificacoes.enviar({
            evento: 'atividade_atribuida',
            destinatarioUserId: perfil.userId,
            titulo: 'Nova atividade atribuída',
            mensagem: `Você foi escalado para "${atividade.titulo}" em ${atividade.local}, das ${formatarHora(turno.inicio)} às ${formatarHora(turno.fim)} de ${formatarData(turno.inicio)}.`,
            contexto: { atividadeId: atividade.id, turnoId, alocacaoId: alocado.alocacaoId }
        })

        return ok(alocado)
    }
}

export type EntradaCancelarAlocacao = { alocacaoId: string }

export class CancelarAlocacaoUseCase implements UseCase<EntradaCancelarAlocacao, { alocacaoId: string }> {
    constructor(
        private readonly atividades: AtividadeRepository,
        private readonly notificacoes: NotificacaoService
    ) {}

    async executar({ alocacaoId }: EntradaCancelarAlocacao): Promise<Result<{ alocacaoId: string }, DomainError>> {
        const destinatario = await this.atividades.destinatarioDaAlocacao(alocacaoId)
        if (!destinatario) return falha(new NaoEncontradoError('Alocação não encontrada.'))

        await withAudit(
            {
                entidade: 'Atividade',
                acao: 'update',
                tabela: 'alocacao',
                dadosAnteriores: async () => ({ ...destinatario, status: 'confirmado' }),
                extrair: () => ({ entidadeId: alocacaoId, dadosNovos: { status: 'cancelado' } })
            },
            () => this.atividades.cancelarAlocacao(alocacaoId)
        )

        await this.notificacoes.enviar({
            evento: 'alteracao_atividade',
            destinatarioUserId: destinatario.userId,
            titulo: 'Escala cancelada',
            mensagem: 'Sua escala em um turno foi cancelada. Confira suas atividades para os detalhes.',
            contexto: { alocacaoId }
        })

        return ok({ alocacaoId })
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
