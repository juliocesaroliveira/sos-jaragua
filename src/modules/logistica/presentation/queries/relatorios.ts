import 'server-only'
import { and, asc, count, gte, lt, sql } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { criseVariaveis } from '@/db/schema/logistica'

/**
 * Leituras de Logística para a central de relatórios — R-14 Evolução da crise
 * (specs/023-central-relatorios, US5, FR-029).
 *
 * `crise_variaveis` é append-only: cada linha é uma atualização, e o histórico
 * já está todo ali. Sem `'use cache'` (FR-009); o autor sai como id e o nome é
 * resolvido por Identidade.
 */

export type Intervalo = { inicio: Date; fimExclusivo: Date }

export type LinhaEvolucaoCrise = {
    id: string
    atualizadoEm: Date
    totalFamiliasAfetadas: number
    totalPessoasAfetadas: number
    /** Valores da atualização imediatamente anterior — inclusive de antes do período. */
    familiasAnterior: number | null
    pessoasAnterior: number | null
    atualizadoPorId: string
}

/**
 * A anterior é calculada sobre a tabela inteira (`lag` antes do filtro de
 * período): a primeira linha do período compara com a última de antes dele,
 * não com nada. Filtrar primeiro faria toda primeira linha parecer o começo da
 * crise.
 */
function comAnterior() {
    const ordem = sql`order by ${criseVariaveis.atualizadoEm}, ${criseVariaveis.id}`
    return db
        .select({
            id: criseVariaveis.id,
            atualizadoEm: criseVariaveis.atualizadoEm,
            totalFamiliasAfetadas: criseVariaveis.totalFamiliasAfetadas,
            totalPessoasAfetadas: criseVariaveis.totalPessoasAfetadas,
            atualizadoPorId: criseVariaveis.atualizadoPor,
            familiasAnterior: sql<number | null>`lag(${criseVariaveis.totalFamiliasAfetadas}) over (${ordem})`.as(
                'familias_anterior'
            ),
            pessoasAnterior: sql<number | null>`lag(${criseVariaveis.totalPessoasAfetadas}) over (${ordem})`.as(
                'pessoas_anterior'
            )
        })
        .from(criseVariaveis)
        .as('evolucao')
}

/** Em ordem cronológica — é uma evolução, lê-se do começo para o fim. */
export async function evolucaoCriseRelatorio(
    intervalo: Intervalo,
    janela: { limite: number; deslocamento: number }
): Promise<LinhaEvolucaoCrise[]> {
    const evolucao = comAnterior()
    return db
        .select()
        .from(evolucao)
        .where(and(gte(evolucao.atualizadoEm, intervalo.inicio), lt(evolucao.atualizadoEm, intervalo.fimExclusivo)))
        .orderBy(asc(evolucao.atualizadoEm), asc(evolucao.id))
        .limit(janela.limite)
        .offset(janela.deslocamento)
}

export async function contarEvolucaoCrise(intervalo: Intervalo): Promise<number> {
    const [linha] = await db
        .select({ total: count() })
        .from(criseVariaveis)
        .where(
            and(
                gte(criseVariaveis.atualizadoEm, intervalo.inicio),
                lt(criseVariaveis.atualizadoEm, intervalo.fimExclusivo)
            )
        )
    return linha?.total ?? 0
}
