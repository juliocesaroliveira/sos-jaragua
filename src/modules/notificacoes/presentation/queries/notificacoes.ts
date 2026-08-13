import 'server-only'
import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { notificacao } from '@/db/schema/notificacoes'
import type { EventoNotificacao } from '../../application/ports/notificacao-service'

export type NotificacaoInApp = {
    id: string
    tipo: EventoNotificacao
    titulo: string
    mensagem: string
    lida: boolean
    criadoEm: string
}

/**
 * Notificações do usuário logado (NOT-09).
 *
 * **Não** cacheadas: o resultado depende de quem está autenticado, e
 * DESIGN.md §7 é explícito em nunca cachear dado derivado de sessão.
 */
export async function listarNotificacoes(userId: string, limite = 30): Promise<NotificacaoInApp[]> {
    const linhas = await db
        .select({
            id: notificacao.id,
            tipo: notificacao.tipo,
            titulo: notificacao.titulo,
            mensagem: notificacao.mensagem,
            lida: notificacao.lida,
            criadoEm: notificacao.criadoEm
        })
        .from(notificacao)
        .where(eq(notificacao.destinatarioUserId, userId))
        .orderBy(desc(notificacao.criadoEm))
        .limit(limite)

    return linhas.map((l) => ({
        ...l,
        tipo: l.tipo as EventoNotificacao,
        criadoEm: l.criadoEm.toISOString()
    }))
}

/** Contador do sino — servido pelo índice `notificacao(destinatarioUserId, lida)`. */
export async function contarNaoLidas(userId: string): Promise<number> {
    const [linha] = await db
        .select({ total: count() })
        .from(notificacao)
        .where(and(eq(notificacao.destinatarioUserId, userId), eq(notificacao.lida, false)))
    return linha?.total ?? 0
}
