import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { asc } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { atividadeCategoria, habilidade } from '@/db/schema/voluntariado'
import { CACHE_LIFE, CACHE_TAGS } from '@/src/shared/cache'

export type Lookup = { id: string; nome: string }

/**
 * Tabelas lookup livres (`habilidade`, `atividade_categoria`) — mudam
 * raramente e são lidas em quase toda tela de voluntariado, então cacheiam sob
 * uma tag comum (DESIGN.md §7).
 */
export async function listarHabilidades(): Promise<Lookup[]> {
    'use cache'
    cacheTag(CACHE_TAGS.lookups)
    cacheLife(CACHE_LIFE.medio)

    return db.select({ id: habilidade.id, nome: habilidade.nome }).from(habilidade).orderBy(asc(habilidade.nome))
}

export async function listarCategoriasAtividade(): Promise<Lookup[]> {
    'use cache'
    cacheTag(CACHE_TAGS.lookups)
    cacheLife(CACHE_LIFE.medio)

    return db
        .select({ id: atividadeCategoria.id, nome: atividadeCategoria.nome })
        .from(atividadeCategoria)
        .orderBy(asc(atividadeCategoria.nome))
}
