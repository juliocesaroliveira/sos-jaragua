import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { and, asc, desc, eq, gt, inArray, sql } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { alocacao, atividade, atividadeCategoria, turno, voluntarioPerfil } from '@/db/schema/voluntariado'
import { CACHE_LIFE, CACHE_TAGS, tagAtividade } from '@/src/shared/cache'
import { ROLES_STAFF, type Role } from '@/src/shared/auth/roles'
import { MENSAGEM_NAO_ELEGIVEL, podeSeInscrever } from '../../domain/inscricao'
import type { OrigemAlocacao, StatusAtividade } from '../../application/ports/atividade-repository'

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
    participanteUserId: string
    /** `null` para a equipe interna sem perfil de voluntário (research D1). */
    voluntarioPerfilId: string | null
    nome: string
    /** Papel na aplicação — decide o ícone exibido ao lado do nome (FR-024). */
    role: Role
    origem: OrigemAlocacao
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

    // Leitura de `user` (nome/papel) é a exceção documentada do Princípio I —
    // plan.md, Complexity Tracking.
    const nome = sql<string>`coalesce(${voluntarioPerfil.nomeCompleto}, ${user.name})`
    const alocados = await db
        .select({
            turnoId: alocacao.turnoId,
            alocacaoId: alocacao.id,
            participanteUserId: alocacao.participanteUserId,
            voluntarioPerfilId: alocacao.voluntarioPerfilId,
            nome,
            role: user.role,
            origem: alocacao.origem
        })
        .from(alocacao)
        .innerJoin(turno, eq(turno.id, alocacao.turnoId))
        .innerJoin(user, eq(user.id, alocacao.participanteUserId))
        .leftJoin(voluntarioPerfil, eq(voluntarioPerfil.id, alocacao.voluntarioPerfilId))
        .where(and(eq(turno.atividadeId, atividadeId), eq(alocacao.status, 'confirmado')))
        .orderBy(asc(nome))

    const porTurno = new Map<string, AlocadoNoTurno[]>()
    for (const { turnoId, ...alocado } of alocados) {
        const lista = porTurno.get(turnoId) ?? []
        lista.push(alocado)
        porTurno.set(turnoId, lista)
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
 * Turnos atribuídos ao usuário logado (VOL-13) — voluntário ou equipe interna
 * inscrita sem perfil. **Não** cacheada: o resultado depende de quem está
 * autenticado (DESIGN.md §7).
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
        .innerJoin(turno, eq(turno.id, alocacao.turnoId))
        .innerJoin(atividade, eq(atividade.id, turno.atividadeId))
        .innerJoin(atividadeCategoria, eq(atividadeCategoria.id, atividade.categoriaId))
        .where(and(eq(alocacao.participanteUserId, userId), eq(alocacao.status, 'confirmado')))
        .orderBy(asc(turno.inicio))

    return linhas.map((l) => ({
        ...(l as Omit<MinhaAtividade, 'inicio' | 'fim'>),
        inicio: l.inicio.toISOString(),
        fim: l.fim.toISOString()
    }))
}

export type TurnoAberto = {
    id: string
    inicio: string
    fim: string
    vagas: number
    preenchidas: number
}

/** Vitrine de "Atividades abertas" — igual para todos, **sem nomes** (FR-010a). */
export type AtividadeAberta = {
    id: string
    titulo: string
    categoriaId: string
    categoria: string
    local: string
    turnos: TurnoAberto[]
}

/**
 * Atividades `aberta` com turnos ainda não terminados (018, FR-004/FR-005).
 *
 * Cacheada e compartilhada entre usuários (research D8): não contém nada da
 * sessão. O `fim > now()` é avaliado quando o cache é preenchido — a página
 * filtra de novo com o `agora` da requisição. Duas consultas, sem N+1.
 */
export async function listarAtividadesAbertas(): Promise<AtividadeAberta[]> {
    'use cache'
    cacheTag(CACHE_TAGS.atividades)
    cacheLife(CACHE_LIFE.curto)

    const turnos = await db
        .select({
            id: turno.id,
            atividadeId: turno.atividadeId,
            inicio: turno.inicio,
            fim: turno.fim,
            vagas: turno.vagas,
            preenchidas: CONFIRMADOS_NO_TURNO
        })
        .from(turno)
        .innerJoin(atividade, eq(atividade.id, turno.atividadeId))
        .where(and(eq(atividade.status, 'aberta'), gt(turno.fim, sql`now()`)))
        .orderBy(asc(turno.inicio))

    if (turnos.length === 0) return []

    const cabecalhos = await db
        .select({
            id: atividade.id,
            titulo: atividade.titulo,
            categoriaId: atividade.categoriaId,
            categoria: atividadeCategoria.nome,
            local: atividade.local
        })
        .from(atividade)
        .innerJoin(atividadeCategoria, eq(atividadeCategoria.id, atividade.categoriaId))
        .where(inArray(atividade.id, [...new Set(turnos.map((t) => t.atividadeId))]))

    const porAtividade = new Map<string, TurnoAberto[]>()
    for (const t of turnos) {
        const lista = porAtividade.get(t.atividadeId) ?? []
        lista.push({
            id: t.id,
            inicio: t.inicio.toISOString(),
            fim: t.fim.toISOString(),
            vagas: t.vagas,
            preenchidas: t.preenchidas
        })
        porAtividade.set(t.atividadeId, lista)
    }

    return cabecalhos.map((c) => ({ ...c, turnos: porAtividade.get(c.id) ?? [] }))
}

export type MeuTurnoConfirmado = {
    turnoId: string
    alocacaoId: string
    atividadeId: string
    inicio: string
    fim: string
}

/**
 * Turnos confirmados do usuário logado — marca "Você está inscrito" na
 * vitrine. **Não** cacheada: depende da sessão (DESIGN.md §7).
 */
export async function listarMeusTurnosConfirmados(userId: string): Promise<MeuTurnoConfirmado[]> {
    const linhas = await db
        .select({
            turnoId: alocacao.turnoId,
            alocacaoId: alocacao.id,
            atividadeId: turno.atividadeId,
            inicio: turno.inicio,
            fim: turno.fim
        })
        .from(alocacao)
        .innerJoin(turno, eq(turno.id, alocacao.turnoId))
        .where(
            and(eq(alocacao.participanteUserId, userId), eq(alocacao.status, 'confirmado'), gt(turno.fim, sql`now()`))
        )

    return linhas.map((l) => ({ ...l, inicio: l.inicio.toISOString(), fim: l.fim.toISOString() }))
}

export type Elegibilidade = { elegivel: true } | { elegivel: false; motivo: string }

/** FR-011 — se o usuário logado pode se inscrever, e por que não. */
export async function obterElegibilidade(userId: string, role: Role): Promise<Elegibilidade> {
    const equipeInterna = ROLES_STAFF.includes(role)
    const perfil = equipeInterna ? null : await buscarMinhaCandidatura(userId)
    return podeSeInscrever({ equipeInterna, statusPerfil: perfil?.status ?? null })
        ? { elegivel: true }
        : { elegivel: false, motivo: MENSAGEM_NAO_ELEGIVEL }
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
