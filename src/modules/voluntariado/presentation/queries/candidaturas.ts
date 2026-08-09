import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { asc, count, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { voluntarioPerfil } from '@/db/schema/voluntariado'
import { CACHE_LIFE, CACHE_TAGS } from '@/src/shared/cache'
import type { Disponibilidade, TipoVeiculo } from '../../domain/candidatura'

/**
 * Habilidades do perfil, agregadas no próprio banco — uma query por candidatura
 * seria N+1 numa fila que pode ter dezenas de linhas durante uma crise.
 *
 * Nomes qualificados à mão pelo mesmo motivo de `CONFIRMADOS_NO_TURNO` em
 * `atividades.ts`: em um `sql` correlacionado guardado em constante, o Drizzle
 * emite as colunas sem prefixo de tabela e a correlação silenciosamente compara
 * as colunas erradas.
 */
const HABILIDADES_DO_PERFIL = sql<string[]>`coalesce(
    array(
        select "habilidade"."nome"
        from "voluntario_habilidade"
        join "habilidade" on "habilidade"."id" = "voluntario_habilidade"."habilidade_id"
        where "voluntario_habilidade"."voluntario_perfil_id" = "voluntario_perfil"."id"
        order by "habilidade"."nome"
    ),
    '{}'
)`

export type CandidaturaPendente = {
    id: string
    userId: string
    nomeCompleto: string
    email: string
    dataNascimento: string
    cpf: string
    telefone: string
    cep: string
    bairro: string
    profissao: string
    restricoesSaude: string | null
    veiculoProprio: boolean
    tipoVeiculo: TipoVeiculo | null
    disponibilidade: Disponibilidade[]
    habilidades: string[]
    criadoEm: string
}

/**
 * Fila de Cadastros Pendentes (BR-VOL-01) — é literalmente
 * `voluntario_perfil where status = 'pendente'`, servida pelo índice
 * `voluntario_perfil_status_idx`.
 *
 * Cacheada sob `voluntariado:pendentes`, invalidada por submissão de
 * candidatura e por aprovação/rejeição (DESIGN.md §7).
 */
export async function listarCandidaturasPendentes(): Promise<CandidaturaPendente[]> {
    'use cache'
    cacheTag(CACHE_TAGS.voluntariadoPendentes)
    cacheLife(CACHE_LIFE.curto)

    const linhas = await db
        .select({
            id: voluntarioPerfil.id,
            userId: voluntarioPerfil.userId,
            nomeCompleto: voluntarioPerfil.nomeCompleto,
            email: user.email,
            dataNascimento: voluntarioPerfil.dataNascimento,
            cpf: voluntarioPerfil.cpf,
            telefone: voluntarioPerfil.telefone,
            cep: voluntarioPerfil.cep,
            bairro: voluntarioPerfil.bairro,
            profissao: voluntarioPerfil.profissao,
            restricoesSaude: voluntarioPerfil.restricoesSaude,
            veiculoProprio: voluntarioPerfil.veiculoProprio,
            tipoVeiculo: voluntarioPerfil.tipoVeiculo,
            disponibilidade: voluntarioPerfil.disponibilidade,
            criadoEm: voluntarioPerfil.criadoEm,
            habilidades: HABILIDADES_DO_PERFIL
        })
        .from(voluntarioPerfil)
        .innerJoin(user, eq(user.id, voluntarioPerfil.userId))
        .where(eq(voluntarioPerfil.status, 'pendente'))
        .orderBy(asc(voluntarioPerfil.criadoEm))

    return linhas.map((l) => ({
        ...l,
        tipoVeiculo: l.tipoVeiculo as TipoVeiculo | null,
        disponibilidade: l.disponibilidade as Disponibilidade[],
        criadoEm: l.criadoEm.toISOString()
    }))
}

/** Contador usado pelo alerta `cadastros_acumulados` (BRD §6). */
export async function contarCandidaturasPendentes(): Promise<number> {
    'use cache'
    cacheTag(CACHE_TAGS.voluntariadoPendentes)
    cacheLife(CACHE_LIFE.curto)

    const [linha] = await db
        .select({ total: count() })
        .from(voluntarioPerfil)
        .where(eq(voluntarioPerfil.status, 'pendente'))
    return linha?.total ?? 0
}

export type StatusVoluntarioFiltro = 'pendente' | 'aprovado' | 'rejeitado'

export type FiltrosVoluntarios = {
    page: number
    pageSize: number
    status?: StatusVoluntarioFiltro
    habilidadeId?: string
}

export type LinhaVoluntario = {
    id: string
    nomeCompleto: string
    email: string
    bairro: string
    telefone: string
    status: StatusVoluntarioFiltro
    habilidades: string[]
}

/**
 * Listagem paginada de voluntários (VOL-12). Paginação **server-side**
 * obrigatória (NFR §2.1): a query recebe `{page, pageSize, filtros}` e devolve
 * `{ rows, totalCount }` — a tabela inteira nunca vai para o cliente.
 */
export async function listarVoluntarios(
    filtros: FiltrosVoluntarios
): Promise<{ rows: LinhaVoluntario[]; totalCount: number }> {
    'use cache'
    cacheTag(CACHE_TAGS.voluntariadoListagem)
    cacheLife(CACHE_LIFE.medio)

    const condicoes = [
        filtros.status ? eq(voluntarioPerfil.status, filtros.status) : undefined,
        filtros.habilidadeId
            ? sql`exists (
                  select 1 from "voluntario_habilidade"
                  where "voluntario_habilidade"."voluntario_perfil_id" = "voluntario_perfil"."id"
                    and "voluntario_habilidade"."habilidade_id" = ${filtros.habilidadeId}
              )`
            : undefined
    ].filter(Boolean)

    const where = condicoes.length > 0 ? sql.join(condicoes, sql` and `) : undefined

    const [linhas, [total]] = await Promise.all([
        db
            .select({
                id: voluntarioPerfil.id,
                nomeCompleto: voluntarioPerfil.nomeCompleto,
                email: user.email,
                bairro: voluntarioPerfil.bairro,
                telefone: voluntarioPerfil.telefone,
                status: voluntarioPerfil.status,
                habilidades: HABILIDADES_DO_PERFIL
            })
            .from(voluntarioPerfil)
            .innerJoin(user, eq(user.id, voluntarioPerfil.userId))
            .where(where)
            .orderBy(desc(voluntarioPerfil.criadoEm))
            .limit(filtros.pageSize)
            .offset((filtros.page - 1) * filtros.pageSize),
        db.select({ total: count() }).from(voluntarioPerfil).where(where)
    ])

    return {
        rows: linhas as LinhaVoluntario[],
        totalCount: total?.total ?? 0
    }
}

/** Voluntários aprovados — origem da lista de alocação (BR-VOL-05). */
export async function listarVoluntariosAprovados(habilidadeId?: string): Promise<LinhaVoluntario[]> {
    const { rows } = await listarVoluntarios({ page: 1, pageSize: 200, status: 'aprovado', habilidadeId })
    return rows
}
