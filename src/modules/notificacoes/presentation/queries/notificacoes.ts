import 'server-only'
import { desc, eq, sql } from 'drizzle-orm'
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
 * O que o sino exibe: a lista recente, o total de não-lidas e a `versao` desse
 * estado — o que permite ao cliente perguntar "mudou algo?" sem trazer a lista.
 */
export type EstadoNotificacoes = {
    notificacoes: NotificacaoInApp[]
    naoLidas: number
    versao: string
}

/**
 * Impressão digital do estado do sino: total, não-lidas e instante da mais
 * recente. Qualquer evento que muda o que o sino mostra muda ao menos um dos
 * três — notificação nova (total e mais recente) ou marcação de leitura
 * (não-lidas), inclusive feita em outra aba.
 *
 * É a **mesma expressão** nas duas consultas abaixo — uma como agregado, outra
 * como janela — para que a versão comparada seja sempre byte a byte igual.
 */
function expressaoVersao(janela: boolean) {
    const sobre = janela ? sql.raw(' over ()') : sql.raw('')
    return sql<string>`concat(
        count(*)${sobre}, ':',
        count(*) filter (where not ${notificacao.lida})${sobre}, ':',
        coalesce(floor(extract(epoch from max(${notificacao.criadoEm})${sobre}) * 1000)::bigint, 0)
    )`
}

/**
 * Versão atual do sino do usuário — uma consulta agregada pequena, servida
 * pelo índice `notificacao(destinatarioUserId, lida)`. É o custo de um ciclo
 * do sino em que nada mudou (a maioria deles).
 */
export async function versaoNotificacoes(userId: string): Promise<string> {
    const [linha] = await db
        .select({ versao: expressaoVersao(false) })
        .from(notificacao)
        .where(eq(notificacao.destinatarioUserId, userId))
    return linha?.versao ?? '0:0:0'
}

/**
 * Notificações do usuário logado (NOT-09), com contador e versão na **mesma
 * consulta**: as funções de janela são avaliadas antes do `LIMIT`, então
 * contam todas as linhas do usuário — não só as 30 exibidas.
 *
 * **Não** cacheadas: o resultado depende de quem está autenticado, e
 * DESIGN.md §7 é explícito em nunca cachear dado derivado de sessão.
 */
export async function lerEstadoNotificacoes(userId: string, limite = 30): Promise<EstadoNotificacoes> {
    const linhas = await db
        .select({
            id: notificacao.id,
            tipo: notificacao.tipo,
            titulo: notificacao.titulo,
            mensagem: notificacao.mensagem,
            lida: notificacao.lida,
            criadoEm: notificacao.criadoEm,
            naoLidas: sql<number>`(count(*) filter (where not ${notificacao.lida}) over ())::int`,
            versao: expressaoVersao(true)
        })
        .from(notificacao)
        .where(eq(notificacao.destinatarioUserId, userId))
        .orderBy(desc(notificacao.criadoEm))
        .limit(limite)

    return {
        notificacoes: linhas.map((l) => ({
            id: l.id,
            tipo: l.tipo as EventoNotificacao,
            titulo: l.titulo,
            mensagem: l.mensagem,
            lida: l.lida,
            criadoEm: l.criadoEm.toISOString()
        })),
        naoLidas: linhas[0]?.naoLidas ?? 0,
        versao: linhas[0]?.versao ?? '0:0:0'
    }
}
