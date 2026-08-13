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
import { validarTurno, type DadosTurno } from '../../domain/turno'
import type { Atividade, AtividadeRepository, StatusAtividade } from '../ports/atividade-repository'

export type EntradaCriarAtividade = {
    titulo: string
    categoriaId: string
    local: string
    criadoPor: string
    turnos: DadosTurno[]
}

/**
 * BRD §3.3 + BR-VOL-04 — criação de atividade já fragmentada em turnos de 4h.
 *
 * A duração de cada turno é validada aqui, no domínio (`validarTurno`), e não
 * por um `CHECK` de banco: é o que permite a mensagem específica exigida pela
 * spec e flexibilizar a regra sem migration (DESIGN.md §10.2).
 */
export class CriarAtividadeUseCase implements UseCase<EntradaCriarAtividade, Atividade> {
    constructor(private readonly atividades: AtividadeRepository) {}

    async executar(entrada: EntradaCriarAtividade): Promise<Result<Atividade, DomainError>> {
        const base = validarCamposAtividade(entrada)
        if (base) return falha(base)

        if (entrada.turnos.length === 0) {
            return falha(
                new ValidacaoError('Informe ao menos um turno.', {
                    campos: { turnos: 'A atividade precisa de pelo menos um turno de 4 horas.' }
                })
            )
        }

        for (const [indice, t] of entrada.turnos.entries()) {
            const validacao = validarTurno(t)
            if (!validacao.ok) {
                return falha(
                    new ValidacaoError(`Turno ${indice + 1}: ${mensagemDoPrimeiroCampo(validacao.erro)}`, {
                        campos: { turnos: mensagemDoPrimeiroCampo(validacao.erro) },
                        indiceTurno: indice
                    })
                )
            }
        }

        const criada = await withAudit(
            {
                entidade: 'Atividade',
                acao: 'create',
                tabela: 'atividade',
                extrair: (atividade) => ({
                    entidadeId: atividade.id,
                    dadosNovos: { ...atividade, turnos: entrada.turnos.length }
                })
            },
            () => this.atividades.criar(entrada)
        )

        return ok(criada)
    }
}

export type EntradaEditarAtividade = {
    id: string
    titulo: string
    categoriaId: string
    local: string
}

/**
 * Edição de atividade. Notifica quem já está alocado (BRD §6 — "Alteração de
 * Atividade"), best-effort e depois da escrita.
 */
export class EditarAtividadeUseCase implements UseCase<EntradaEditarAtividade, Atividade> {
    constructor(
        private readonly atividades: AtividadeRepository,
        private readonly notificacoes: NotificacaoService
    ) {}

    async executar(entrada: EntradaEditarAtividade): Promise<Result<Atividade, DomainError>> {
        const base = validarCamposAtividade(entrada)
        if (base) return falha(base)

        const atualizada = await withAudit(
            {
                entidade: 'Atividade',
                acao: 'update',
                tabela: 'atividade',
                dadosAnteriores: async () => {
                    const anterior = await this.atividades.buscarPorId(entrada.id)
                    return anterior ? { ...anterior } : null
                },
                extrair: (resultado) => ({
                    entidadeId: entrada.id,
                    dadosNovos: resultado ? { ...resultado } : null
                })
            },
            () => this.atividades.atualizar(entrada)
        )

        if (!atualizada) return falha(new NaoEncontradoError('Atividade não encontrada.'))

        await this.avisarAlocados(entrada.id, atualizada.titulo, 'alterada')
        return ok(atualizada)
    }

    private async avisarAlocados(atividadeId: string, titulo: string, o_que: 'alterada' | 'cancelada') {
        const destinatarios = await this.atividades.destinatariosDaAtividade(atividadeId)
        if (destinatarios.length === 0) return

        await this.notificacoes.enviarEmLote(
            destinatarios.map((d) => ({
                evento: 'alteracao_atividade' as const,
                destinatarioUserId: d.userId,
                titulo: o_que === 'cancelada' ? 'Atividade cancelada' : 'Atividade alterada',
                mensagem:
                    o_que === 'cancelada'
                        ? `A atividade "${titulo}" foi cancelada. Você não precisa comparecer.`
                        : `A atividade "${titulo}" teve local, título ou categoria alterados. Confira os detalhes.`,
                contexto: { atividadeId }
            }))
        )
    }
}

export type EntradaAlterarStatusAtividade = {
    id: string
    status: StatusAtividade
}

/** Encerramento/cancelamento de atividade (BRD §3.3). */
export class AlterarStatusAtividadeUseCase implements UseCase<EntradaAlterarStatusAtividade, { id: string }> {
    constructor(
        private readonly atividades: AtividadeRepository,
        private readonly notificacoes: NotificacaoService
    ) {}

    async executar({ id, status }: EntradaAlterarStatusAtividade): Promise<Result<{ id: string }, DomainError>> {
        const atividade = await this.atividades.buscarPorId(id)
        if (!atividade) return falha(new NaoEncontradoError('Atividade não encontrada.'))

        // Lista os destinatários **antes** de mudar o status: cancelar não
        // remove alocações, mas manter a ordem deixa a intenção explícita.
        const destinatarios = status === 'cancelada' ? await this.atividades.destinatariosDaAtividade(id) : []

        await withAudit(
            {
                entidade: 'Atividade',
                acao: 'update',
                tabela: 'atividade',
                dadosAnteriores: async () => ({ ...atividade }),
                extrair: () => ({ entidadeId: id, dadosNovos: { ...atividade, status } })
            },
            () => this.atividades.alterarStatus({ id, status })
        )

        if (destinatarios.length > 0) {
            await this.notificacoes.enviarEmLote(
                destinatarios.map((d) => ({
                    evento: 'alteracao_atividade' as const,
                    destinatarioUserId: d.userId,
                    titulo: 'Atividade cancelada',
                    mensagem: `A atividade "${atividade.titulo}" foi cancelada. Você não precisa comparecer.`,
                    contexto: { atividadeId: id }
                }))
            )
        }

        return ok({ id })
    }
}

function validarCamposAtividade(entrada: {
    titulo: string
    categoriaId: string
    local: string
}): ValidacaoError | null {
    const campos: Record<string, string> = {}
    if (!entrada.titulo.trim()) campos.titulo = 'Informe o título da atividade.'
    if (!entrada.categoriaId) campos.categoriaId = 'Selecione a categoria.'
    if (!entrada.local.trim()) campos.local = 'Informe o local.'
    return Object.keys(campos).length > 0 ? new ValidacaoError('Revise os campos destacados.', { campos }) : null
}

function mensagemDoPrimeiroCampo(erro: DomainError): string {
    const campos = erro.detalhes?.campos as Record<string, string> | undefined
    return campos ? (Object.values(campos)[0] ?? erro.message) : erro.message
}
