import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_LIFE, CACHE_TAGS } from '@/src/shared/cache'
import { paginarComClamp, type PaginaDe, type ParametrosPaginacao } from '@/src/shared/paginacao'
import { criarHabilidadeRepository } from '../../infrastructure/drizzle/habilidade-repository'
import type { LinhaHabilidade } from '../../application/ports/habilidade-repository'

export type { LinhaHabilidade }

/**
 * Listagem paginada de habilidades (017-gestao-habilidades, US1).
 *
 * Distinta de `listarHabilidades` em `lookups.ts`, que devolve a lista
 * **inteira** para preencher combos de candidatura/alocação e é cacheada sob
 * `lookups`. Esta é paginada, traz a contagem de vínculos e tem tag própria —
 * as duas mudam em ritmos diferentes e ambas são invalidadas por qualquer
 * escrita de habilidade (research.md D6).
 *
 * `paginarComClamp` cobre a exclusão do último item de uma página: em vez de
 * devolver lista vazia, serve a última página válida.
 */
export async function listarHabilidadesPaginado(filtros: ParametrosPaginacao): Promise<PaginaDe<LinhaHabilidade>> {
    'use cache'
    cacheTag(CACHE_TAGS.habilidadesListagem)
    cacheLife(CACHE_LIFE.medio)

    const repositorio = criarHabilidadeRepository()
    return paginarComClamp(filtros, (p) => repositorio.listar(p))
}
