'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { db } from '@/src/shared/db/postgres'
import { notificacao } from '@/db/schema/notificacoes'
import { user } from '@/db/schema/identidade'
import { voluntarioHabilidade, voluntarioPerfil } from '@/db/schema/voluntariado'
import { erroAction, type ResultadoAction } from '@/src/shared/kernel'
import type { Role } from '@/src/shared/auth/roles'
import { obterSessao } from '@/src/shared/auth/sessao'
import { notificacaoService } from '../../infrastructure'

const ROLES_COORDENACAO: readonly Role[] = ['coordenador', 'administrador']

/** Marca uma notificação como lida — só o próprio destinatário pode. */
export async function marcarComoLida(entrada: { id: string }): Promise<ResultadoAction<{ id: string }>> {
    const ator = await obterSessao()
    if (!ator) return erroAction('nao_autenticado', 'Entre na sua conta.')

    const parse = z.object({ id: z.uuid() }).safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Notificação inválida.')

    // O filtro por destinatário é a autorização: sem ele, qualquer usuário
    // autenticado marcaria a notificação de outro como lida.
    await db
        .update(notificacao)
        .set({ lida: true })
        .where(and(eq(notificacao.id, parse.data.id), eq(notificacao.destinatarioUserId, ator.userId)))

    return { ok: true, valor: { id: parse.data.id } }
}

export async function marcarTodasComoLidas(): Promise<ResultadoAction<{ total: number }>> {
    const ator = await obterSessao()
    if (!ator) return erroAction('nao_autenticado', 'Entre na sua conta.')

    const atualizadas = await db
        .update(notificacao)
        .set({ lida: true })
        .where(and(eq(notificacao.destinatarioUserId, ator.userId), eq(notificacao.lida, false)))
        .returning({ id: notificacao.id })

    return { ok: true, valor: { total: atualizadas.length } }
}

const esquemaBroadcast = z.object({
    titulo: z.string().min(1).max(120),
    mensagem: z.string().min(1).max(2000),
    /** Sem filtro, vai para todos os voluntários aprovados. */
    habilidadeId: z.uuid().nullable().optional()
})

export type EntradaBroadcast = z.infer<typeof esquemaBroadcast>

/**
 * Broadcast de Urgência (BRD §6, NOT-05) — Coordenador convoca todos os
 * voluntários aprovados, ou o subconjunto que tem uma habilidade.
 *
 * **Uma única** Server Action processando tudo em chunks dentro da mesma
 * invocação (DESIGN.md §12): o Next despacha Server Actions sequencialmente
 * por cliente, então fatiar em várias chamadas só tornaria o envio mais lento.
 *
 * Risco documentado na spec: sem infra de fila, uma lista muito grande pode se
 * aproximar do limite de duração de função da Vercel. Mitigado pelos chunks;
 * migrar para fan-out fica para depois do MVP.
 */
export async function enviarBroadcast(entrada: EntradaBroadcast): Promise<ResultadoAction<{ destinatarios: number }>> {
    const ator = await obterSessao()
    if (!ator || !ROLES_COORDENACAO.includes(ator.role)) {
        return erroAction('nao_autorizado', 'Somente coordenação pode enviar convocações em massa.')
    }

    const parse = esquemaBroadcast.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Informe título e mensagem da convocação.')

    const destinatarios = await destinatariosDoBroadcast(parse.data.habilidadeId ?? null)
    if (destinatarios.length === 0) {
        return erroAction('sem_destinatarios', 'Nenhum voluntário aprovado corresponde a este filtro.')
    }

    await notificacaoService.enviarEmLote(
        destinatarios.map((userId) => ({
            evento: 'broadcast_urgencia' as const,
            destinatarioUserId: userId,
            titulo: parse.data.titulo,
            mensagem: parse.data.mensagem,
            contexto: { enviadoPor: ator.userId }
        }))
    )

    return { ok: true, valor: { destinatarios: destinatarios.length } }
}

/** Voluntários aprovados e ativos, opcionalmente filtrados por habilidade. */
async function destinatariosDoBroadcast(habilidadeId: string | null): Promise<string[]> {
    const condicoes = [eq(voluntarioPerfil.status, 'aprovado'), eq(user.ativo, true)]

    if (habilidadeId) {
        const comHabilidade = await db
            .select({ perfilId: voluntarioHabilidade.voluntarioPerfilId })
            .from(voluntarioHabilidade)
            .where(eq(voluntarioHabilidade.habilidadeId, habilidadeId))

        if (comHabilidade.length === 0) return []
        condicoes.push(
            inArray(
                voluntarioPerfil.id,
                comHabilidade.map((c) => c.perfilId)
            )
        )
    }

    const linhas = await db
        .select({ userId: voluntarioPerfil.userId })
        .from(voluntarioPerfil)
        .innerJoin(user, eq(user.id, voluntarioPerfil.userId))
        .where(and(...condicoes))

    return linhas.map((l) => l.userId)
}
