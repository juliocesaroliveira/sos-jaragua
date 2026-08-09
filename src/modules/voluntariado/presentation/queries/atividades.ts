import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { and, asc, desc, eq, gte, sql } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { alocacao, atividade, atividadeCategoria, turno, voluntarioPerfil } from '@/db/schema/voluntariado'
import { CACHE_LIFE, CACHE_TAGS, tagAtividade } from '@/src/shared/cache'
import type { StatusAtividade } from '../../application/ports/atividade-repository'

export type LinhaAtividade = {
    id: string
    titulo: string
    categoria: string
    local: string
    status: StatusAtividade
    totalTurnos: number
    vagasTotais: number
    vagasPreenchidas: number
}

/**
 * Contagem de alocações confirmadas de um turno.
 *
 * Os nomes são escritos qualificados à mão em vez de interpolar as colunas do
 * Drizzle: em um `sql` correlacionado guardado em constante de módulo, o
 * Drizzle emite as colunas **sem prefixo de tabela**, e
 * `where "turno_id" = "id"` passa a comparar duas colunas de `alocacao` —
 * a contagem dá zero silenciosamente. Qualificar remove a ambiguidade.
 */
const CONFIRMADOS_NO_TURNO = sql<number>`(
    select count(*)::int from "alocacao"
    where "alocacao"."turno_id" = "turno"."id" and "alocacao"."status" = 'confirmado'
)`

/** Lista de atividades para a tela de gestão (BRD §3.3). */
export async function listarAtividades(): Promise<LinhaAtividade[]> {
    'use cache'
    cacheTag(CACHE_TAGS.atividades)
    cacheLife(CACHE_LIFE.curto)

    const linhas = await db
        .select({
            id: atividade.id,
            titulo: atividade.titulo,
            categoria: atividadeCategoria.nome,
            local: atividade.local,
            status: atividade.status,
            totalTurnos: sql<number>`count(${turno.id})::int`,
            vagasTotais: sql<number>`coalesce(sum(${turno.vagas}), 0)::int`,
            vagasPreenchidas: sql<number>`coalesce(sum(${CONFIRMADOS_NO_TURNO}), 0)::int`
        })
        .from(atividade)
        .innerJoin(atividadeCategoria, eq(atividadeCategoria.id, atividade.categoriaId))
        .leftJoin(turno, eq(turno.atividadeId, atividade.id))
        .groupBy(atividade.id, atividadeCategoria.nome)
        .orderBy(desc(atividade.criadoEm))

    return linhas as LinhaAtividade[]
}

export type AlocadoNoTurno = {
    alocacaoId: string
    voluntarioPerfilId: string
    nomeCompleto: string
}

export type TurnoDetalhado = {
    id: string
    inicio: string
    fim: string
    vagas: number
    preenchidas: number
    alocados: AlocadoNoTurno[]
}

export type AtividadeDetalhada = {
    id: string
    titulo: string
    categoriaId: string
    categoria: string
    local: string
    status: StatusAtividade
    turnos: TurnoDetalhado[]
}

/**
 * Kanban de uma atividade (BR-VOL-04/05, DESIGN.md §10.2). Cacheada **por
 * atividade** (`atividades:{id}`), invalidada por criação/edição de turno e por
 * criação/cancelamento de alocação.
 */
export async function buscarAtividadeDetalhada(atividadeId: string): Promise<AtividadeDetalhada | null> {
    'use cache'
    cacheTag(tagAtividade(atividadeId))
    cacheLife(CACHE_LIFE.curto)

    const [cabecalho] = await db
        .select({
            id: atividade.id,
            titulo: atividade.titulo,
            categoriaId: atividade.categoriaId,
            categoria: atividadeCategoria.nome,
            local: atividade.local,
            status: atividade.status
        })
        .from(atividade)
        .innerJoin(atividadeCategoria, eq(atividadeCategoria.id, atividade.categoriaId))
        .where(eq(atividade.id, atividadeId))
        .limit(1)

    if (!cabecalho) return null

    const turnos = await db
        .select({
            id: turno.id,
            inicio: turno.inicio,
            fim: turno.fim,
            vagas: turno.vagas,
            preenchidas: CONFIRMADOS_NO_TURNO
        })
        .from(turno)
        .where(eq(turno.atividadeId, atividadeId))
        .orderBy(asc(turno.inicio))

    const alocados = await db
        .select({
            turnoId: alocacao.turnoId,
            alocacaoId: alocacao.id,
            voluntarioPerfilId: alocacao.voluntarioPerfilId,
            nomeCompleto: voluntarioPerfil.nomeCompleto
        })
        .from(alocacao)
        .innerJoin(turno, eq(turno.id, alocacao.turnoId))
        .innerJoin(voluntarioPerfil, eq(voluntarioPerfil.id, alocacao.voluntarioPerfilId))
        .where(and(eq(turno.atividadeId, atividadeId), eq(alocacao.status, 'confirmado')))
        .orderBy(asc(voluntarioPerfil.nomeCompleto))

    const porTurno = new Map<string, AlocadoNoTurno[]>()
    for (const a of alocados) {
        const lista = porTurno.get(a.turnoId) ?? []
        lista.push({ alocacaoId: a.alocacaoId, voluntarioPerfilId: a.voluntarioPerfilId, nomeCompleto: a.nomeCompleto })
        porTurno.set(a.turnoId, lista)
    }

    return {
        ...(cabecalho as Omit<AtividadeDetalhada, 'turnos'>),
        turnos: turnos.map((t) => ({
            id: t.id,
            inicio: t.inicio.toISOString(),
            fim: t.fim.toISOString(),
            vagas: t.vagas,
            preenchidas: t.preenchidas,
            alocados: porTurno.get(t.id) ?? []
        }))
    }
}

export type MinhaAtividade = {
    alocacaoId: string
    atividadeId: string
    titulo: string
    categoria: string
    local: string
    statusAtividade: StatusAtividade
    inicio: string
    fim: string
}

/**
 * Turnos atribuídos ao voluntário logado (VOL-13). **Não** cacheada: o
 * resultado depende de quem está autenticado (DESIGN.md §7).
 */
export async function listarMinhasAtividades(userId: string): Promise<MinhaAtividade[]> {
    const linhas = await db
        .select({
            alocacaoId: alocacao.id,
            atividadeId: atividade.id,
            titulo: atividade.titulo,
            categoria: atividadeCategoria.nome,
            local: atividade.local,
            statusAtividade: atividade.status,
            inicio: turno.inicio,
            fim: turno.fim
        })
        .from(alocacao)
        .innerJoin(voluntarioPerfil, eq(voluntarioPerfil.id, alocacao.voluntarioPerfilId))
        .innerJoin(turno, eq(turno.id, alocacao.turnoId))
        .innerJoin(atividade, eq(atividade.id, turno.atividadeId))
        .innerJoin(atividadeCategoria, eq(atividadeCategoria.id, atividade.categoriaId))
        .where(and(eq(voluntarioPerfil.userId, userId), eq(alocacao.status, 'confirmado')))
        .orderBy(asc(turno.inicio))

    return linhas.map((l) => ({
        ...(l as Omit<MinhaAtividade, 'inicio' | 'fim'>),
        inicio: l.inicio.toISOString(),
        fim: l.fim.toISOString()
    }))
}

/** Perfil de voluntário do usuário logado — usado na tela de candidatura. */
export async function buscarMinhaCandidatura(userId: string) {
    const [linha] = await db
        .select({
            id: voluntarioPerfil.id,
            status: voluntarioPerfil.status,
            nomeCompleto: voluntarioPerfil.nomeCompleto,
            motivoRejeicao: voluntarioPerfil.motivoRejeicao
        })
        .from(voluntarioPerfil)
        .where(eq(voluntarioPerfil.userId, userId))
        .limit(1)
    return linha ?? null
}

/** Turnos futuros de uma atividade — evita oferecer alocação no passado. */
export async function turnosFuturos(atividadeId: string) {
    return db
        .select({ id: turno.id, inicio: turno.inicio, fim: turno.fim })
        .from(turno)
        .where(and(eq(turno.atividadeId, atividadeId), gte(turno.inicio, new Date())))
        .orderBy(asc(turno.inicio))
}
