import 'server-only'
import { inArray } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { notificacao, notificacaoEnvio } from '@/db/schema/notificacoes'
import type { Notificacao } from '../application/ports/notificacao-service'

/**
 * Adapter in-plataforma (DESIGN.md §12): grava em `notificacao` e registra o
 * envio do canal `plataforma` — é o que alimenta o sino in-app.
 *
 * Este canal é a **única cópia durável** da mensagem, então é gravado primeiro
 * e de forma síncrona; o e-mail é acessório e vem depois.
 */
export type NotificacaoGravada = {
    notificacaoId: string
    destinatarioUserId: string
}

export async function gravarNaPlataforma(notificacoes: Notificacao[]): Promise<NotificacaoGravada[]> {
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
        .returning({ id: notificacao.id, destinatarioUserId: notificacao.destinatarioUserId })

    await db.insert(notificacaoEnvio).values(
        linhas.map((l) => ({
            notificacaoId: l.id,
            canal: 'plataforma' as const,
            status: 'enviado' as const,
            enviadoEm: new Date()
        }))
    )

    return linhas.map((l) => ({ notificacaoId: l.id, destinatarioUserId: l.destinatarioUserId }))
}

export type ContatoDestinatario = {
    userId: string
    email: string
    nome: string
    ativo: boolean
}

/** Contatos dos destinatários, para o canal de e-mail. */
export async function buscarContatos(userIds: string[]): Promise<Map<string, ContatoDestinatario>> {
    if (userIds.length === 0) return new Map()

    const linhas = await db
        .select({ userId: user.id, email: user.email, nome: user.name, ativo: user.ativo })
        .from(user)
        .where(inArray(user.id, [...new Set(userIds)]))

    return new Map(linhas.map((l) => [l.userId, l]))
}

/**
 * Registra o resultado do canal de e-mail. Separado de `notificacao` de
 * propósito (DB_SCHEMA.md §8.2): um bounce não pode corromper o estado
 * lido/não-lido in-app.
 */
export async function registrarEnvioEmail(
    registros: { notificacaoId: string; status: 'enviado' | 'falhou'; erro?: string }[]
): Promise<void> {
    if (registros.length === 0) return

    await db.insert(notificacaoEnvio).values(
        registros.map((r) => ({
            notificacaoId: r.notificacaoId,
            canal: 'email' as const,
            status: r.status,
            enviadoEm: r.status === 'enviado' ? new Date() : null,
            erro: r.erro ?? null
        }))
    )
}
