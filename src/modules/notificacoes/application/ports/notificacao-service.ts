/**
 * Catálogo de eventos de notificação — 1:1 com a matriz de comunicação do
 * BRD §6 e com o enum `tipo_notificacao` do banco (DESIGN.md §12).
 */
export const EVENTOS_NOTIFICACAO = [
    'triagem_concluida',
    'atividade_atribuida',
    'alteracao_atividade',
    'lembrete_turno',
    'broadcast_urgencia',
    'cadastros_acumulados',
    'estoque_critico',
    'deficit_atendimento'
] as const

export type EventoNotificacao = (typeof EVENTOS_NOTIFICACAO)[number]

export type CanalNotificacao = 'email' | 'plataforma'

export type Notificacao = {
    evento: EventoNotificacao
    destinatarioUserId: string
    titulo: string
    mensagem: string
    /** Payload adicional (ex.: `{ atividadeId, turnoId }`). */
    contexto?: Record<string, unknown>
    /** Canais desejados; o default de cada evento é decidido pelo serviço. */
    canais?: CanalNotificacao[]
}

/**
 * Port de notificação (DESIGN.md §12). Os módulos de negócio dependem **apenas**
 * desta interface; os adapters concretos (Resend e in-plataforma) vivem em
 * `notificacoes/infrastructure/`.
 *
 * Contrato de falha: notificar **nunca** derruba a operação de negócio que a
 * disparou — as implementações registram o erro e seguem, do mesmo modo que a
 * auditoria (§13).
 */
export interface NotificacaoService {
    enviar(notificacao: Notificacao): Promise<void>
    /** Envio em lote (broadcast de urgência) — processado em chunks. */
    enviarEmLote(notificacoes: Notificacao[]): Promise<void>
}
