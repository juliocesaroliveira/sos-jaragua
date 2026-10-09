import 'server-only'
import { asc, inArray } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'

/**
 * Leituras de Identidade para a central de relatórios
 * (specs/023-central-relatorios, research D4/D9).
 *
 * **Regra da feature:** todo nome de usuário exibido num relatório é resolvido
 * aqui, em lote, a partir de ids. As consultas dos outros módulos devolvem só
 * ids (`registradoPor`, `atualizadoPor`, `participanteUserId`…) e não fazem
 * join com `user`: a tabela é de Identidade (Princípio I), e a trilha de
 * auditoria — que vem do Mongo — não teria como fazer join nenhum. Com uma
 * regra só, os 17 relatórios resolvem nomes do mesmo jeito.
 *
 * Sem `'use cache'`: relatório reflete o momento (FR-009), e um nome trocado
 * agora deve aparecer no próximo relatório.
 */

/** `id → nome` para os ids pedidos; ids sem conta simplesmente não aparecem no mapa. */
export async function nomesPorIds(ids: readonly (string | null | undefined)[]): Promise<Map<string, string>> {
    const unicos = [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    if (unicos.length === 0) return new Map()

    const linhas = await db.select({ id: user.id, nome: user.name }).from(user).where(inArray(user.id, unicos))
    return new Map(linhas.map((l) => [l.id, l.nome]))
}

/**
 * Opções do filtro de autor da trilha de auditoria: todas as contas, ativas ou
 * não — uma conta desativada continua autora do que fez.
 */
export async function opcoesUsuarios(): Promise<{ valor: string; rotulo: string }[]> {
    const linhas = await db
        .select({ id: user.id, nome: user.name, email: user.email })
        .from(user)
        .orderBy(asc(user.name))
    return linhas.map((l) => ({ valor: l.id, rotulo: `${l.nome} (${l.email})` }))
}
