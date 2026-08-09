import type { DadosTurno } from '../../domain/turno'

/** Ports de Atividade/Turno/Alocação (BRD §3.3, DB_SCHEMA.md §5). */

export type StatusAtividade = 'aberta' | 'encerrada' | 'cancelada'

export type Atividade = {
    id: string
    titulo: string
    categoriaId: string
    local: string
    status: StatusAtividade
}

export type Turno = {
    id: string
    atividadeId: string
    inicio: Date
    fim: Date
    vagas: number
}

export type DestinatarioAlocacao = {
    /** `user.id` do voluntário — destinatário das notificações. */
    userId: string
    nomeCompleto: string
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

    /** `null` quando o voluntário já está alocado neste turno (unique). */
    alocar(entrada: {
        turnoId: string
        voluntarioPerfilId: string
        alocadoPor: string
    }): Promise<{ alocacaoId: string } | null>

    cancelarAlocacao(alocacaoId: string): Promise<void>

    /** Destinatários das notificações de alteração/cancelamento de atividade. */
    destinatariosDaAtividade(atividadeId: string): Promise<DestinatarioAlocacao[]>

    destinatarioDaAlocacao(alocacaoId: string): Promise<DestinatarioAlocacao | null>
}
