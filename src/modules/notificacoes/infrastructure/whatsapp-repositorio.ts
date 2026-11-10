import 'server-only'
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import {
    consentimentoWhatsapp,
    notificacaoEnvio,
    preferenciaWhatsapp,
    whatsappRespostaAutomatica
} from '@/db/schema/notificacoes'
import type { EnviosWhatsapp, SituacoesEnvioWhatsapp } from '../application/ports/envios-whatsapp'
import type { PreferenciasWhatsapp } from '../application/ports/preferencias-whatsapp'

/**
 * Persistência do canal WhatsApp (024, data-model.md §2–§5). Só toca tabelas do
 * próprio módulo Notificações (Princípio I).
 */
export const whatsappRepositorio = {
    async lerPreferencias(userIds) {
        if (userIds.length === 0) return new Map()

        const linhas = await db
            .select({ userId: preferenciaWhatsapp.userId, ativo: preferenciaWhatsapp.ativo })
            .from(preferenciaWhatsapp)
            .where(inArray(preferenciaWhatsapp.userId, [...new Set(userIds)]))

        return new Map(linhas.map((l) => [l.userId, l.ativo]))
    },

    async registrarTentativas(tentativas) {
        if (tentativas.length === 0) return []

        // Uma instrução só, e `DO NOTHING` no índice `(notificacao_id, canal)`:
        // o que já estava registrado não volta no `RETURNING`, e por isso não é
        // despachado de novo (FR-008).
        const linhas = await db
            .insert(notificacaoEnvio)
            .values(
                tentativas.map((t) => ({
                    notificacaoId: t.notificacaoId,
                    canal: 'whatsapp' as const,
                    status: t.status,
                    destino: t.status === 'pendente' ? t.destino : null,
                    motivo: t.status === 'nao_enviado' ? t.motivo : null
                }))
            )
            .onConflictDoNothing({ target: [notificacaoEnvio.notificacaoId, notificacaoEnvio.canal] })
            .returning({
                id: notificacaoEnvio.id,
                notificacaoId: notificacaoEnvio.notificacaoId,
                status: notificacaoEnvio.status,
                destino: notificacaoEnvio.destino
            })

        return linhas.map((l) => ({ ...l, status: l.status === 'pendente' ? 'pendente' : 'nao_enviado' }))
    },

    async marcarEnviado(id, idExterno) {
        const agora = new Date()
        await db
            .update(notificacaoEnvio)
            .set({ status: 'enviado', idExterno, enviadoEm: agora, atualizadoEm: agora })
            .where(and(eq(notificacaoEnvio.id, id), eq(notificacaoEnvio.status, 'pendente')))
    },

    async marcarFalha(id, motivo, erro) {
        await db
            .update(notificacaoEnvio)
            .set({ status: 'falhou', motivo, erro, atualizadoEm: new Date() })
            .where(and(eq(notificacaoEnvio.id, id), eq(notificacaoEnvio.status, 'pendente')))
    },

    async situacaoPorIdExterno(idExterno) {
        const [envio] = await db
            .select({ status: notificacaoEnvio.status })
            .from(notificacaoEnvio)
            .where(eq(notificacaoEnvio.idExterno, idExterno))
        return envio?.status ?? null
    },

    async atualizarSituacao(idExterno, de, para, extras?) {
        const agora = new Date()
        await db
            .update(notificacaoEnvio)
            .set({
                status: para,
                atualizadoEm: agora,
                ...(para === 'enviado' ? { enviadoEm: agora } : {}),
                ...(extras?.motivo ? { motivo: extras.motivo } : {}),
                ...(extras?.erro ? { erro: extras.erro } : {})
            })
            // `status = de`: o que o caso de uso leu ainda vale — senão outro
            // webhook chegou antes, e este não deve sobrescrevê-lo.
            .where(and(eq(notificacaoEnvio.idExterno, idExterno), eq(notificacaoEnvio.status, de)))
    },

    async lerPreferencia(userId) {
        const [preferencia] = await db
            .select({ ativo: preferenciaWhatsapp.ativo })
            .from(preferenciaWhatsapp)
            .where(eq(preferenciaWhatsapp.userId, userId))
        if (!preferencia) return null
        if (!preferencia.ativo) return { ativo: false, ativoDesde: null }

        const [concessao] = await db
            .select({ criadoEm: consentimentoWhatsapp.criadoEm })
            .from(consentimentoWhatsapp)
            .where(and(eq(consentimentoWhatsapp.userId, userId), eq(consentimentoWhatsapp.acao, 'concedido')))
            .orderBy(desc(consentimentoWhatsapp.criadoEm))
            .limit(1)
        return { ativo: true, ativoDesde: concessao?.criadoEm ?? null }
    },

    async salvarPreferencia(userId, ativo, origem, telefone) {
        // Estado e histórico na mesma transação: uma concessão sem histórico
        // seria um opt-in sem evidência (FR-011).
        await db.transaction(async (tx) => {
            const agora = new Date()
            await tx
                .insert(preferenciaWhatsapp)
                .values({ userId, ativo, atualizadoEm: agora })
                .onConflictDoUpdate({ target: preferenciaWhatsapp.userId, set: { ativo, atualizadoEm: agora } })
            await tx.insert(consentimentoWhatsapp).values({
                userId,
                acao: ativo ? 'concedido' : 'revogado',
                origem,
                telefone
            })
        })
    },

    /**
     * Uma resposta automática por número a cada 24h (024, research D15). Um
     * único upsert condicional: só devolve linha quando inseriu ou quando a
     * última resposta já passou de 24h — dois webhooks simultâneos do mesmo
     * número não respondem os dois.
     */
    async podeResponderAutomaticamente(telefone: string): Promise<boolean> {
        const agora = new Date()
        const linhas = await db
            .insert(whatsappRespostaAutomatica)
            .values({ telefone, ultimaEm: agora })
            .onConflictDoUpdate({
                target: whatsappRespostaAutomatica.telefone,
                set: { ultimaEm: agora },
                setWhere: lt(whatsappRespostaAutomatica.ultimaEm, sql`now() - interval '24 hours'`)
            })
            .returning({ telefone: whatsappRespostaAutomatica.telefone })
        return linhas.length > 0
    }
} satisfies EnviosWhatsapp &
    SituacoesEnvioWhatsapp &
    PreferenciasWhatsapp & {
        podeResponderAutomaticamente(telefone: string): Promise<boolean>
    }
