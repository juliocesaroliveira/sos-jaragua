import type { DadosTurno } from '../../domain/turno'
import type { MotivoRecusaInscricao } from '../../domain/inscricao'

/** Ports de Atividade/Turno/Alocação (BRD §3.3, DB_SCHEMA.md §5). */

export type StatusAtividade = 'aberta' | 'encerrada' | 'cancelada'

export type Atividade = {
    id: string
    titulo: string
    categoriaId: string
    local: string
    status: StatusAtividade
    /** `user.id` de quem criou — destinatário dos avisos de inscrição própria. */
    criadoPor: string
}

export type Turno = {
    id: string
    atividadeId: string
    inicio: Date
    fim: Date
    vagas: number
}

export type DestinatarioAlocacao = {
    /** `user.id` do participante — destinatário das notificações. */
    userId: string
    /** Nome do perfil de voluntário, ou o nome da conta para quem não tem perfil. */
    nome: string
}

export type OrigemAlocacao = 'gestao' | 'inscricao_propria'

/** Participante + dados da alocação — comum à alocação manual e à inscrição própria. */
export type EntradaAlocacao = {
    turnoId: string
    participanteUserId: string
    voluntarioPerfilId: string | null
    alocadoPor: string
    origem: OrigemAlocacao
}

/**
 * Resultado da inscrição própria (research D3). A decisão é tomada dentro da
 * transação, com o turno travado, por isso o repositório devolve o motivo em
 * vez de um booleano.
 */
export type ResultadoInscricao =
    | { ok: true; alocacaoId: string; turno: Turno; atividade: Atividade }
    | { ok: false; motivo: Exclude<MotivoRecusaInscricao, 'nao_elegivel'> | 'nao_encontrado'; mensagem: string }

export type AlocacaoDoParticipante = {
    alocacaoId: string
    status: 'confirmado' | 'cancelado'
    turno: Turno
    atividade: Atividade
}

export interface AtividadeRepository {
    criar(entrada: {
        titulo: string
        categoriaId: string
        local: string
        criadoPor: string
        turnos: DadosTurno[]
    }): Promise<Atividade>

    buscarPorId(id: string): Promise<Atividade | null>

    atualizar(entrada: { id: string; titulo: string; categoriaId: string; local: string }): Promise<Atividade | null>

    alterarStatus(entrada: { id: string; status: StatusAtividade }): Promise<void>

    adicionarTurnos(entrada: { atividadeId: string; turnos: DadosTurno[] }): Promise<Turno[]>

    buscarTurno(turnoId: string): Promise<Turno | null>

    /** Alocações confirmadas de um turno — base da contagem de vagas. */
    contarConfirmadosNoTurno(turnoId: string): Promise<number>

    /**
     * Alocação manual da gestão. `null` quando o participante já está
     * alocado neste turno (unique). Não verifica vagas (FR-019).
     */
    alocar(entrada: EntradaAlocacao): Promise<{ alocacaoId: string } | null>

    /**
     * Inscrição própria (research D3): numa transação, trava o participante
     * (lock consultivo) e o turno (`FOR UPDATE`), valida com
     * `validarInscricao` e grava com `origem = 'inscricao_propria'`.
     */
    inscreverComTrava(entrada: {
        turnoId: string
        participanteUserId: string
        voluntarioPerfilId: string | null
        agora: Date
    }): Promise<ResultadoInscricao>

    /** Alocação de `participanteUserId`, ou `null` se não existir ou for de outra pessoa. */
    buscarAlocacaoDoParticipante(alocacaoId: string, participanteUserId: string): Promise<AlocacaoDoParticipante | null>

    cancelarAlocacao(alocacaoId: string): Promise<void>

    /** Destinatários das notificações de alteração/cancelamento de atividade. */
    destinatariosDaAtividade(atividadeId: string): Promise<DestinatarioAlocacao[]>

    destinatarioDaAlocacao(alocacaoId: string): Promise<DestinatarioAlocacao | null>
}
