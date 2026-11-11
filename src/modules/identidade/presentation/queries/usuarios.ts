import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { inArray } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { CACHE_LIFE, CACHE_TAGS } from '@/src/shared/cache'
import { paginarComClamp, type PaginaDe, type ParametrosPaginacao } from '@/src/shared/paginacao/esquema'
import { criarUsuarioRepository } from '../../infrastructure/drizzle/usuario-repository'
import type { LinhaUsuario } from '../../application/ports/usuario-repository'

export type { LinhaUsuario }

export type FiltrosUsuarios = ParametrosPaginacao

/**
 * Listagem paginada de todas as contas (contracts/gestao-usuarios.md L-01..L-03).
 * Paginação **server-side** obrigatória (NFR §2.1) — mesmo contrato de
 * `listarVoluntarios`.
 *
 * Devolve `page`/`pageSize` **efetivos**: o cliente precisa saber quando o
 * servidor corrigiu a entrada, para que o rodapé não anuncie uma página que
 * não é a que está em tela (007-datatable-server-pagination, L-01.3).
 *
 * `pageSize` varia (5/10/20/50) e entra na chave de cache junto de `page` —
 * cada combinação é uma entrada própria, que é o comportamento correto.
 */
export async function listarUsuarios(filtros: FiltrosUsuarios): Promise<PaginaDe<LinhaUsuario>> {
    'use cache'
    cacheTag(CACHE_TAGS.identidadeListagem)
    cacheLife(CACHE_LIFE.medio)

    const repositorio = criarUsuarioRepository()
    return paginarComClamp(filtros, (p) => repositorio.listar(p))
}

/**
 * Nome de cada conta, por id (026-danger-zone-admin, T043): o histórico da
 * Danger Zone mostra quem executou cada ação sem que o módulo `manutencao`
 * leia a tabela `user` por conta própria (Princípio I). Id ausente — conta já
 * apagada — fica de fora do mapa; quem consome decide o rótulo.
 */
export async function nomesDeUsuarios(ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map()
    const linhas = await db
        .select({ id: user.id, nome: user.name })
        .from(user)
        .where(inArray(user.id, [...ids]))
    return new Map(linhas.map((l) => [l.id, l.nome]))
}
