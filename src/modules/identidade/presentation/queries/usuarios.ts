import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_LIFE, CACHE_TAGS } from '@/src/shared/cache'
import { criarUsuarioRepository } from '../../infrastructure/drizzle/usuario-repository'
import type { LinhaUsuario } from '../../application/ports/usuario-repository'

export type { LinhaUsuario }

export type FiltrosUsuarios = {
    page: number
    pageSize: number
}

/**
 * Listagem paginada de todas as contas (contracts/gestao-usuarios.md L-01..L-03).
 * Paginação **server-side** obrigatória (NFR §2.1) — mesmo contrato de
 * `listarVoluntarios`.
 */
export async function listarUsuarios(filtros: FiltrosUsuarios): Promise<{ rows: LinhaUsuario[]; totalCount: number }> {
    'use cache'
    cacheTag(CACHE_TAGS.identidadeListagem)
    cacheLife(CACHE_LIFE.medio)

    return criarUsuarioRepository().listar(filtros)
}
