import { db } from '@/src/shared/db/postgres'
import { notificacao, notificacaoEnvio } from '@/db/schema/notificacoes'
import type { Notificacao } from '../application/ports/notificacao-service'

/**
 * Adapter in-plataforma (DESIGN.md §12): grava a notificação em `notificacao`
 * e registra o envio do canal `plataforma` — é o que alimenta o sino in-app.
 *
 * Este canal é sempre síncrono e transacional com a própria escrita: é a única
 * cópia durável da mensagem. O canal de e-mail (Resend) é acessório.
 */
export async function gravarNaPlataforma(notificacoes: Notificacao[]): Promise<string[]> {
    if (notificacoes.length === 0) return []

    const linhas = await db
        .insert(notificacao)
        .values(
            notificacoes.map((n) => ({
                destinatarioUserId: n.destinatarioUserId,
                tipo: n.evento,
                titulo: n.titulo,
                mensagem: n.mensagem,
                contexto: n.contexto ?? null
            }))
        )
        .returning({ id: notificacao.id })

    await db.insert(notificacaoEnvio).values(
        linhas.map((l) => ({
            notificacaoId: l.id,
            canal: 'plataforma' as const,
            status: 'enviado' as const,
            enviadoEm: new Date()
        }))
    )

    return linhas.map((l) => l.id)
}
