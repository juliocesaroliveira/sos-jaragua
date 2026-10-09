import 'server-only'
import { and, asc, count, desc, eq, gte, lt, sql, type SQL } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import {
    alocacao,
    atividade,
    atividadeCategoria,
    habilidade,
    turno,
    voluntarioHabilidade,
    voluntarioPerfil
} from '@/db/schema/voluntariado'
import type { Disponibilidade, TipoVeiculo } from '../../domain/candidatura'

/**
 * Leituras de Voluntariado para a central de relatórios
 * (specs/023-central-relatorios, US3, research D4/D5/D11).
 *
 * Mesmas regras das portas de leitura de Estoque: sem `'use cache'`
 * (FR-009), período em instantes UTC já resolvidos, nomes de usuário por id
 * (resolvidos em lote por Identidade) e paginação por janela com desempate
 * pelo id.
 *
 * CPF e restrições de saúde saem **completos** (Clarification Q1); o aviso de
 * LGPD fica na tela de exportação.
 */

export type Intervalo = { inicio: Date; fimExclusivo: Date }
export type Janela = { limite: number; deslocamento: number }
export type StatusVoluntario = 'pendente' | 'aprovado' | 'rejeitado'
export type StatusAtividade = 'aberta' | 'encerrada' | 'cancelada'

/** Mesmo bairro com outra caixa ou espaço é o mesmo bairro. */
function mesmoBairro(bairro: string): SQL {
    return sql`lower(trim(${voluntarioPerfil.bairro})) = lower(trim(${bairro}))`
}

/**
 * Habilidades do perfil, em ordem alfabética, numa string só (para a planilha).
 *
 * Nomes de tabela escritos à mão, com alias: numa consulta de tabela única o
 * Drizzle não qualifica as colunas, e `"id"` dentro da subconsulta ficaria
 * ambíguo entre `habilidade` e `voluntario_perfil`.
 */
const habilidadesDoPerfil = sql<string | null>`(
    select string_agg(h.nome, ', ' order by h.nome)
    from voluntario_habilidade vh
    inner join habilidade h on h.id = vh.habilidade_id
    where vh.voluntario_perfil_id = "voluntario_perfil"."id"
)`

// -- R-09 Voluntários cadastrados ------------------------------------------------

export type FiltrosVoluntarios = {
    status?: StatusVoluntario
    bairro?: string
    habilidadeId?: string
    tipoVeiculo?: TipoVeiculo
    disponibilidade?: Disponibilidade
}

export type LinhaVoluntarioRelatorio = {
    id: string
    nomeCompleto: string
    cpf: string
    status: StatusVoluntario
    telefone: string
    bairro: string
    profissao: string
    habilidades: string | null
    veiculoProprio: boolean
    tipoVeiculo: TipoVeiculo | null
    disponibilidade: Disponibilidade[]
    restricoesSaude: string | null
    criadoEm: Date
    decididoEm: Date | null
}

function condicoesVoluntarios(f: FiltrosVoluntarios): SQL | undefined {
    return and(
        f.status ? eq(voluntarioPerfil.status, f.status) : undefined,
        f.bairro ? mesmoBairro(f.bairro) : undefined,
        f.habilidadeId
            ? sql`exists (select 1 from voluntario_habilidade vh where vh.voluntario_perfil_id = "voluntario_perfil"."id" and vh.habilidade_id = ${f.habilidadeId})`
            : undefined,
        f.tipoVeiculo ? eq(voluntarioPerfil.tipoVeiculo, f.tipoVeiculo) : undefined,
        f.disponibilidade ? sql`${f.disponibilidade} = any(${voluntarioPerfil.disponibilidade})` : undefined
    )
}

export async function voluntariosRelatorio(
    filtros: FiltrosVoluntarios,
    janela: Janela
): Promise<LinhaVoluntarioRelatorio[]> {
    return db
        .select({
            id: voluntarioPerfil.id,
            nomeCompleto: voluntarioPerfil.nomeCompleto,
            cpf: voluntarioPerfil.cpf,
            status: voluntarioPerfil.status,
            telefone: voluntarioPerfil.telefone,
            bairro: voluntarioPerfil.bairro,
            profissao: voluntarioPerfil.profissao,
            habilidades: habilidadesDoPerfil,
            veiculoProprio: voluntarioPerfil.veiculoProprio,
            tipoVeiculo: voluntarioPerfil.tipoVeiculo,
            disponibilidade: voluntarioPerfil.disponibilidade,
            restricoesSaude: voluntarioPerfil.restricoesSaude,
            criadoEm: voluntarioPerfil.criadoEm,
            decididoEm: voluntarioPerfil.aprovadoEm
        })
        .from(voluntarioPerfil)
        .where(condicoesVoluntarios(filtros))
        .orderBy(asc(voluntarioPerfil.nomeCompleto), asc(voluntarioPerfil.id))
        .limit(janela.limite)
        .offset(janela.deslocamento)
}

export async function contarVoluntariosRelatorio(filtros: FiltrosVoluntarios): Promise<number> {
    const [linha] = await db.select({ total: count() }).from(voluntarioPerfil).where(condicoesVoluntarios(filtros))
    return linha?.total ?? 0
}

// -- R-10 Triagem de candidaturas ----------------------------------------------

/**
 * Data de envio (Clarification de FR-025): para pendentes, o último envio — um
 * reenvio reaproveita a linha e só mexe em `atualizado_em`; para as decididas,
 * o primeiro envio (`criado_em`), que é a base do tempo até decisão.
 */
const envio = sql<Date>`case when ${voluntarioPerfil.status} = 'pendente' then ${voluntarioPerfil.atualizadoEm} else ${voluntarioPerfil.criadoEm} end`

export type LinhaTriagem = {
    id: string
    nomeCompleto: string
    telefone: string
    bairro: string
    status: StatusVoluntario
    enviadoEm: Date
    primeiroEnvio: Date
    decididoEm: Date | null
}

function condicoesTriagem(intervalo: Intervalo): SQL {
    return sql`${envio} >= ${intervalo.inicio} and ${envio} < ${intervalo.fimExclusivo}`
}

const COLUNAS_TRIAGEM = {
    id: voluntarioPerfil.id,
    nomeCompleto: voluntarioPerfil.nomeCompleto,
    telefone: voluntarioPerfil.telefone,
    bairro: voluntarioPerfil.bairro,
    status: voluntarioPerfil.status,
    enviadoEm: sql<Date>`${envio}`.mapWith(voluntarioPerfil.criadoEm),
    primeiroEnvio: voluntarioPerfil.criadoEm,
    decididoEm: voluntarioPerfil.aprovadoEm
}

/** Pendentes primeiro, da mais antiga para a mais nova (FR-025); depois as decididas. */
export async function triagemRelatorio(intervalo: Intervalo, janela: Janela): Promise<LinhaTriagem[]> {
    return db
        .select(COLUNAS_TRIAGEM)
        .from(voluntarioPerfil)
        .where(condicoesTriagem(intervalo))
        .orderBy(
            desc(sql`${voluntarioPerfil.status} = 'pendente'`),
            sql`case when ${voluntarioPerfil.status} = 'pendente' then ${envio} end asc`,
            desc(envio),
            asc(voluntarioPerfil.id)
        )
        .limit(janela.limite)
        .offset(janela.deslocamento)
}

export async function contarTriagem(intervalo: Intervalo): Promise<number> {
    const [linha] = await db.select({ total: count() }).from(voluntarioPerfil).where(condicoesTriagem(intervalo))
    return linha?.total ?? 0
}

/** Só as colunas do resumo, de todas as candidaturas do período. */
export async function candidaturasParaResumo(
    intervalo: Intervalo
): Promise<{ status: StatusVoluntario; primeiroEnvio: Date; decididoEm: Date | null }[]> {
    return db
        .select({
            status: voluntarioPerfil.status,
            primeiroEnvio: voluntarioPerfil.criadoEm,
            decididoEm: voluntarioPerfil.aprovadoEm
        })
        .from(voluntarioPerfil)
        .where(condicoesTriagem(intervalo))
}

// -- R-11 Capacidade por habilidade ----------------------------------------------

export type ContagensCapacidade = {
    porHabilidade: { habilidade: string; total: number }[]
    porVeiculo: { tipoVeiculo: TipoVeiculo; total: number }[]
    porDisponibilidade: { disponibilidade: Disponibilidade; total: number }[]
}

/**
 * Voluntários **aprovados** por habilidade, veículo e disponibilidade (FR-026).
 * Toda habilidade cadastrada aparece, mesmo com zero — "ninguém tem barco" é
 * justamente a resposta que a Defesa Civil precisa ver.
 */
export async function capacidadeRelatorio(filtros: { bairro?: string }): Promise<ContagensCapacidade> {
    const aprovados = and(
        eq(voluntarioPerfil.status, 'aprovado'),
        filtros.bairro ? mesmoBairro(filtros.bairro) : undefined
    )

    const [porHabilidade, porVeiculo, porDisponibilidade] = await Promise.all([
        db
            .select({
                habilidade: habilidade.nome,
                total: sql<number>`count(${voluntarioPerfil.id})`.mapWith(Number)
            })
            .from(habilidade)
            .leftJoin(voluntarioHabilidade, eq(voluntarioHabilidade.habilidadeId, habilidade.id))
            .leftJoin(
                voluntarioPerfil,
                and(eq(voluntarioPerfil.id, voluntarioHabilidade.voluntarioPerfilId), aprovados)
            )
            .groupBy(habilidade.id, habilidade.nome)
            .orderBy(asc(habilidade.nome)),
        db
            .select({ tipoVeiculo: voluntarioPerfil.tipoVeiculo, total: count() })
            .from(voluntarioPerfil)
            .where(and(aprovados, eq(voluntarioPerfil.veiculoProprio, true)))
            .groupBy(voluntarioPerfil.tipoVeiculo),
        db
            .select({
                disponibilidade: sql<Disponibilidade>`d.valor`,
                total: sql<number>`count(*)`.mapWith(Number)
            })
            .from(sql`${voluntarioPerfil} cross join lateral unnest(${voluntarioPerfil.disponibilidade}) as d(valor)`)
            .where(aprovados)
            .groupBy(sql`d.valor`)
    ])

    return {
        porHabilidade,
        porVeiculo: porVeiculo
            .filter((l): l is { tipoVeiculo: TipoVeiculo; total: number } => l.tipoVeiculo !== null)
            .map((l) => ({ tipoVeiculo: l.tipoVeiculo, total: l.total })),
        porDisponibilidade
    }
}

// -- R-12 Ocupação de turnos -----------------------------------------------------

export type FiltrosOcupacao = {
    intervalo: Intervalo
    atividadeId?: string
    categoriaAtividadeId?: string
    statusAtividade?: StatusAtividade
    apenasComVagas?: boolean
}

export type LinhaOcupacao = {
    turnoId: string
    atividade: string
    categoria: string
    local: string
    statusAtividade: StatusAtividade
    inicio: Date
    fim: Date
    vagas: number
    confirmados: number
}

/** Inscrições canceladas não ocupam vaga (FR-027). */
const confirmados = sql<number>`(
    select count(*) from ${alocacao}
    where ${alocacao.turnoId} = ${turno.id} and ${alocacao.status} = 'confirmado'
)`.mapWith(Number)

function condicoesOcupacao(f: FiltrosOcupacao): SQL | undefined {
    return and(
        gte(turno.inicio, f.intervalo.inicio),
        lt(turno.inicio, f.intervalo.fimExclusivo),
        f.atividadeId ? eq(atividade.id, f.atividadeId) : undefined,
        f.categoriaAtividadeId ? eq(atividade.categoriaId, f.categoriaAtividadeId) : undefined,
        f.statusAtividade ? eq(atividade.status, f.statusAtividade) : undefined,
        f.apenasComVagas ? sql`${confirmados} < ${turno.vagas}` : undefined
    )
}

function baseOcupacao() {
    return db
        .select({
            turnoId: turno.id,
            atividade: atividade.titulo,
            categoria: atividadeCategoria.nome,
            local: atividade.local,
            statusAtividade: atividade.status,
            inicio: turno.inicio,
            fim: turno.fim,
            vagas: turno.vagas,
            confirmados
        })
        .from(turno)
        .innerJoin(atividade, eq(atividade.id, turno.atividadeId))
        .innerJoin(atividadeCategoria, eq(atividadeCategoria.id, atividade.categoriaId))
}

export async function ocupacaoTurnosRelatorio(filtros: FiltrosOcupacao, janela: Janela): Promise<LinhaOcupacao[]> {
    return baseOcupacao()
        .where(condicoesOcupacao(filtros))
        .orderBy(asc(turno.inicio), asc(atividade.titulo), asc(turno.id))
        .limit(janela.limite)
        .offset(janela.deslocamento)
}

export async function contarOcupacaoTurnos(filtros: FiltrosOcupacao): Promise<number> {
    const [linha] = await db
        .select({ total: count() })
        .from(turno)
        .innerJoin(atividade, eq(atividade.id, turno.atividadeId))
        .where(condicoesOcupacao(filtros))
    return linha?.total ?? 0
}

/** Vagas e confirmados de todos os turnos do filtro — insumo do resumo. */
export async function ocupacaoParaResumo(filtros: FiltrosOcupacao): Promise<{ vagas: number; confirmados: number }[]> {
    return db
        .select({ vagas: turno.vagas, confirmados })
        .from(turno)
        .innerJoin(atividade, eq(atividade.id, turno.atividadeId))
        .where(condicoesOcupacao(filtros))
}

// -- R-13 Participação por pessoa --------------------------------------------------

export type LinhaParticipacao = {
    participanteUserId: string
    cpf: string | null
    telefone: string | null
    turnos: number
    /** Soma de `fim − início` dos turnos confirmados, em segundos. */
    segundos: number
}

function condicoesParticipacao(intervalo: Intervalo): SQL | undefined {
    return and(
        eq(alocacao.status, 'confirmado'),
        gte(turno.inicio, intervalo.inicio),
        lt(turno.inicio, intervalo.fimExclusivo)
    )
}

/**
 * Por participante — voluntário ou equipe interna sem perfil (018). CPF e
 * telefone vêm do perfil de voluntário quando existe; o nome, de Identidade.
 */
export async function participacaoRelatorio(intervalo: Intervalo, janela: Janela): Promise<LinhaParticipacao[]> {
    const segundos = sql<number>`coalesce(sum(extract(epoch from ${turno.fim} - ${turno.inicio})), 0)`.mapWith(Number)
    return db
        .select({
            participanteUserId: alocacao.participanteUserId,
            cpf: sql<string | null>`max(${voluntarioPerfil.cpf})`,
            telefone: sql<string | null>`max(${voluntarioPerfil.telefone})`,
            turnos: count(),
            segundos
        })
        .from(alocacao)
        .innerJoin(turno, eq(turno.id, alocacao.turnoId))
        .leftJoin(voluntarioPerfil, eq(voluntarioPerfil.userId, alocacao.participanteUserId))
        .where(condicoesParticipacao(intervalo))
        .groupBy(alocacao.participanteUserId)
        .orderBy(desc(segundos), asc(alocacao.participanteUserId))
        .limit(janela.limite)
        .offset(janela.deslocamento)
}

export async function contarParticipacao(intervalo: Intervalo): Promise<number> {
    const [linha] = await db
        .select({ total: sql<number>`count(distinct ${alocacao.participanteUserId})`.mapWith(Number) })
        .from(alocacao)
        .innerJoin(turno, eq(turno.id, alocacao.turnoId))
        .where(condicoesParticipacao(intervalo))
    return linha?.total ?? 0
}

// -- Opções dos filtros ------------------------------------------------------------

export type OpcaoLookup = { valor: string; rotulo: string }

/** Habilidades, atividades, categorias e bairros para os selects dos filtros. */
export async function opcoesFiltrosVoluntariado(): Promise<{
    habilidades: OpcaoLookup[]
    atividades: OpcaoLookup[]
    categoriasAtividade: OpcaoLookup[]
    bairros: OpcaoLookup[]
}> {
    const [habilidades, atividades, categorias, bairros] = await Promise.all([
        db.select({ valor: habilidade.id, rotulo: habilidade.nome }).from(habilidade).orderBy(asc(habilidade.nome)),
        db.select({ valor: atividade.id, rotulo: atividade.titulo }).from(atividade).orderBy(desc(atividade.criadoEm)),
        db
            .select({ valor: atividadeCategoria.id, rotulo: atividadeCategoria.nome })
            .from(atividadeCategoria)
            .orderBy(asc(atividadeCategoria.nome)),
        db
            .selectDistinct({ bairro: sql<string>`trim(${voluntarioPerfil.bairro})` })
            .from(voluntarioPerfil)
            .orderBy(sql`trim(${voluntarioPerfil.bairro})`)
    ])

    return {
        habilidades,
        atividades,
        categoriasAtividade: categorias,
        bairros: bairros.map((b) => ({ valor: b.bairro, rotulo: b.bairro }))
    }
}
