import 'server-only'
import { and, count, desc, eq, gte, lt, type SQL } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { notificacao, notificacaoEnvio } from '@/db/schema/notificacoes'
import type { CanalNotificacao, EventoNotificacao } from '../../application/ports/notificacao-service'

/**
 * Leituras de Notificações para a central de relatórios — R-16 Envio de
 * notificações (specs/023-central-relatorios, US5, FR-031).
 *
 * A unidade é o **envio** (`notificacao_envio`), não a notificação: a mesma
 * notificação pode ter chegado pela plataforma e falhado no e-mail. O período
 * é o da criação da notificação. Sem `'use cache'` (FR-009); destinatário como
 * id, nome resolvido por Identidade.
 */

export type Intervalo = { inicio: Date; fimExclusivo: Date }
export type StatusEnvio = 'pendente' | 'enviado' | 'falhou'

export type FiltrosEnvios = {
    intervalo: Intervalo
    tipo?: EventoNotificacao
    canal?: CanalNotificacao
    status?: StatusEnvio
}

export type LinhaEnvio = {
    id: string
    criadoEm: Date
    tipo: EventoNotificacao
    canal: CanalNotificacao
    status: StatusEnvio
    destinatarioUserId: string
    erro: string | null
}

export type TotalEnvios = { tipo: EventoNotificacao; canal: CanalNotificacao; status: StatusEnvio; total: number }

function condicoes(f: FiltrosEnvios): SQL | undefined {
    return and(
        gte(notificacao.criadoEm, f.intervalo.inicio),
        lt(notificacao.criadoEm, f.intervalo.fimExclusivo),
        f.tipo ? eq(notificacao.tipo, f.tipo) : undefined,
        f.canal ? eq(notificacaoEnvio.canal, f.canal) : undefined,
        f.status ? eq(notificacaoEnvio.status, f.status) : undefined
    )
}

export async function enviosNotificacoesRelatorio(
    filtros: FiltrosEnvios,
    janela: { limite: number; deslocamento: number }
): Promise<LinhaEnvio[]> {
    return db
        .select({
            id: notificacaoEnvio.id,
            criadoEm: notificacao.criadoEm,
            tipo: notificacao.tipo,
            canal: notificacaoEnvio.canal,
            status: notificacaoEnvio.status,
            destinatarioUserId: notificacao.destinatarioUserId,
            erro: notificacaoEnvio.erro
        })
        .from(notificacaoEnvio)
        .innerJoin(notificacao, eq(notificacao.id, notificacaoEnvio.notificacaoId))
        .where(condicoes(filtros))
        .orderBy(desc(notificacao.criadoEm), desc(notificacaoEnvio.id))
        .limit(janela.limite)
        .offset(janela.deslocamento)
}

export async function contarEnviosNotificacoes(filtros: FiltrosEnvios): Promise<number> {
    const [linha] = await db
        .select({ total: count() })
        .from(notificacaoEnvio)
        .innerJoin(notificacao, eq(notificacao.id, notificacaoEnvio.notificacaoId))
        .where(condicoes(filtros))
    return linha?.total ?? 0
}

/** Totais por tipo × canal × situação — ignora o filtro de situação, que é da lista. */
export async function totaisEnviosNotificacoes(filtros: Omit<FiltrosEnvios, 'status'>): Promise<TotalEnvios[]> {
    return db
        .select({
            tipo: notificacao.tipo,
            canal: notificacaoEnvio.canal,
            status: notificacaoEnvio.status,
            total: count()
        })
        .from(notificacaoEnvio)
        .innerJoin(notificacao, eq(notificacao.id, notificacaoEnvio.notificacaoId))
        .where(condicoes(filtros))
        .groupBy(notificacao.tipo, notificacaoEnvio.canal, notificacaoEnvio.status)
}
