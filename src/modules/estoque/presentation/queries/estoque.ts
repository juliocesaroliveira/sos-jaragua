import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { and, asc, count, desc, eq, inArray, sql, type AnyColumn, type SQL } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { item, kit, kitReceitaItem, saldoEstoque } from '@/db/schema/estoque'
import { CACHE_LIFE, CACHE_TAGS } from '@/src/shared/cache'
import { paginarComClamp, type PaginaDe, type ParametrosPaginacao } from '@/src/shared/paginacao/esquema'
import { escaparLike } from '@/src/shared/busca/escapar-like'
import { paraNumero } from '../../domain/quantidade'
import type { CategoriaItem, UnidadeMedida } from '../../domain/item'

export type ItemComSaldo = {
    id: string
    nome: string
    categoria: CategoriaItem
    unidadeMedida: UnidadeMedida
    saldo: number
    /** `null` herda o padrão global; `0` desliga o alerta (feature 020, Q3). */
    estoqueMinimo: number | null
    /** Criado pelo kit, sem entrada ainda: fora do alerta de estoque crítico (022, FR-015). */
    aguardandoPrimeiraEntrada: boolean
}

/** `numeric` volta do driver como `string`; a tela e o alerta trabalham com `number`. */
function comNumeros<T extends { saldo: string | null; estoqueMinimo: string | null }>(linha: T) {
    return {
        ...linha,
        saldo: paraNumero(linha.saldo ?? '0'),
        estoqueMinimo: linha.estoqueMinimo === null ? null : paraNumero(linha.estoqueMinimo)
    }
}

export type FiltrosEstoque = ParametrosPaginacao & {
    categoria?: CategoriaItem
    /** Só itens com saldo > 0 — a visão útil na tela de saída. */
    somenteComSaldo?: boolean
}

/**
 * Listagem paginada de estoque (EST-12). O saldo vem de `saldo_estoque`
 * (read-model materializado), não de uma reagregação do ledger — é o que
 * sustenta o requisito de leitura <300ms do NFR §4.1.
 */
export async function listarEstoque(filtros: FiltrosEstoque): Promise<PaginaDe<ItemComSaldo>> {
    'use cache'
    cacheTag(CACHE_TAGS.estoqueListagem, CACHE_TAGS.estoqueSaldo)
    cacheLife(CACHE_LIFE.curto)

    return paginarComClamp(filtros, (p) => buscarEstoque({ ...filtros, ...p }))
}

async function buscarEstoque(filtros: FiltrosEstoque): Promise<{ rows: ItemComSaldo[]; totalCount: number }> {
    const condicoes = [
        filtros.categoria ? eq(item.categoria, filtros.categoria) : undefined,
        filtros.somenteComSaldo ? sql`coalesce(${saldoEstoque.quantidadeAtual}, 0) > 0` : undefined
    ].filter(Boolean)

    const where = condicoes.length > 0 ? sql.join(condicoes, sql` and `) : undefined

    const [linhas, [total]] = await Promise.all([
        db
            .select({
                id: item.id,
                nome: item.nome,
                categoria: item.categoria,
                unidadeMedida: item.unidadeMedida,
                saldo: saldoEstoque.quantidadeAtual,
                estoqueMinimo: item.estoqueMinimo,
                aguardandoPrimeiraEntrada: item.aguardandoPrimeiraEntrada
            })
            .from(item)
            .leftJoin(saldoEstoque, eq(saldoEstoque.itemId, item.id))
            .where(where)
            .orderBy(asc(item.nome))
            .limit(filtros.pageSize)
            .offset((filtros.page - 1) * filtros.pageSize),
        db.select({ total: count() }).from(item).leftJoin(saldoEstoque, eq(saldoEstoque.itemId, item.id)).where(where)
    ])

    return {
        rows: linhas.map(comNumeros) as ItemComSaldo[],
        totalCount: total?.total ?? 0
    }
}

// -- Leituras do Lookup (021, contracts/leituras-lookup.md) ------------------
//
// **Sem `'use cache'`**, de propósito: o termo muda a cada tecla, e cachear por
// termo encheria o cache de entradas de uso único — a mesma decisão do antigo
// autocomplete da Entrada. A velocidade vem do índice
// `item_nome_unaccent_trgm_idx` e do read-model `saldo_estoque`; a repetição
// imediata (voltar a uma página, reabrir as sugestões) é absorvida pelo
// TanStack Query no cliente.

/** Limite fixo de sugestões por digitação (L-02) — o cliente não escolhe. */
const LIMITE_SUGESTOES = 5

export type FiltrosLookup = ParametrosPaginacao & { termo?: string }

/**
 * Filtro por nome sem acento e sem caixa (FR-015). `%` (similaridade trigram)
 * usa o índice `item_nome_unaccent_trgm_idx`; o `ilike` cobre o termo curto,
 * cuja similaridade ainda não passa do limiar padrão do `pg_trgm` — o mesmo
 * par que `buscarPorNome` usava, agora sobre `f_unaccent`.
 */
function condicaoNome(coluna: AnyColumn, termo: string): SQL {
    return sql`(f_unaccent(${coluna}) % f_unaccent(${termo}) or f_unaccent(${coluna}) ilike '%' || f_unaccent(${escaparLike(termo)}) || '%' escape '\\')`
}

function ordemPorSemelhanca(coluna: AnyColumn, termo: string | undefined): SQL[] {
    return termo ? [desc(sql`similarity(f_unaccent(${coluna}), f_unaccent(${termo}))`), asc(coluna)] : [asc(coluna)]
}

const COLUNAS_ITEM_COM_SALDO = {
    id: item.id,
    nome: item.nome,
    categoria: item.categoria,
    unidadeMedida: item.unidadeMedida,
    saldo: saldoEstoque.quantidadeAtual,
    estoqueMinimo: item.estoqueMinimo,
    aguardandoPrimeiraEntrada: item.aguardandoPrimeiraEntrada
}

/** Sugestões de item para o Lookup — até 5, por semelhança com o termo. */
export async function sugerirItens(termo: string): Promise<ItemComSaldo[]> {
    const linhas = await db
        .select(COLUNAS_ITEM_COM_SALDO)
        .from(item)
        .leftJoin(saldoEstoque, eq(saldoEstoque.itemId, item.id))
        .where(condicaoNome(item.nome, termo))
        .orderBy(...ordemPorSemelhanca(item.nome, termo))
        .limit(LIMITE_SUGESTOES)

    return linhas.map(comNumeros) as ItemComSaldo[]
}

/** Página da tabela de pesquisa de itens do Lookup (FR-005, FR-007). */
export async function listarItensLookup(filtros: FiltrosLookup): Promise<PaginaDe<ItemComSaldo>> {
    return paginarComClamp(filtros, async ({ page, pageSize }) => {
        const where = filtros.termo ? condicaoNome(item.nome, filtros.termo) : undefined
        const [linhas, [total]] = await Promise.all([
            db
                .select(COLUNAS_ITEM_COM_SALDO)
                .from(item)
                .leftJoin(saldoEstoque, eq(saldoEstoque.itemId, item.id))
                .where(where)
                .orderBy(...ordemPorSemelhanca(item.nome, filtros.termo))
                .limit(pageSize)
                .offset((page - 1) * pageSize),
            db.select({ total: count() }).from(item).where(where)
        ])
        return { rows: linhas.map(comNumeros) as ItemComSaldo[], totalCount: total?.total ?? 0 }
    })
}

export type KitLookup = {
    id: string
    nome: string
    ativo: boolean
    /** `0` ⇒ kit sem receita — não selecionável na saída (FR-023). */
    totalComponentes: number
}

const COLUNAS_KIT_LOOKUP = {
    id: kit.id,
    nome: kit.nome,
    ativo: kit.ativo,
    // `count` da coluna do lado direito do left join: kit sem receita conta 0.
    totalComponentes: count(kitReceitaItem.itemId)
}

/** Só kits ativos: é o que a saída e a destinação da entrada aceitam. */
function condicaoKit(termo: string | undefined): SQL {
    const ativo = eq(kit.ativo, true)
    return termo ? (and(ativo, condicaoNome(kit.nome, termo)) as SQL) : ativo
}

/** Sugestões de kit para o Lookup — até 5, só ativos. */
export async function sugerirKits(termo: string): Promise<KitLookup[]> {
    return db
        .select(COLUNAS_KIT_LOOKUP)
        .from(kit)
        .leftJoin(kitReceitaItem, eq(kitReceitaItem.kitId, kit.id))
        .where(condicaoKit(termo))
        .groupBy(kit.id)
        .orderBy(...ordemPorSemelhanca(kit.nome, termo))
        .limit(LIMITE_SUGESTOES)
}

/** Página da tabela de pesquisa de kits do Lookup — só ativos. */
export async function listarKitsLookup(filtros: FiltrosLookup): Promise<PaginaDe<KitLookup>> {
    return paginarComClamp(filtros, async ({ page, pageSize }) => {
        const where = condicaoKit(filtros.termo)
        const [linhas, [total]] = await Promise.all([
            db
                .select(COLUNAS_KIT_LOOKUP)
                .from(kit)
                .leftJoin(kitReceitaItem, eq(kitReceitaItem.kitId, kit.id))
                .where(where)
                .groupBy(kit.id)
                .orderBy(...ordemPorSemelhanca(kit.nome, filtros.termo))
                .limit(pageSize)
                .offset((page - 1) * pageSize),
            db.select({ total: count() }).from(kit).where(where)
        ])
        return { rows: linhas, totalCount: total?.total ?? 0 }
    })
}

export type ComponenteDoKit = {
    itemId: string
    nome: string
    unidadeMedida: UnidadeMedida
    quantidadePorKit: number
    /** Saldo do componente — usado na tela de kits e no cálculo de capacidade. */
    saldo: number
}

export type KitComReceita = {
    id: string
    nome: string
    descricao: string | null
    ativo: boolean
    componentes: ComponenteDoKit[]
}

/**
 * Kits com a receita completa (BR-EST-02/03), para a tela de kits e a saída.
 * Cache remoto pelo mesmo motivo de `listarItens`.
 */
export async function listarKitsComReceita(apenasAtivos = false): Promise<KitComReceita[]> {
    'use cache: remote'
    cacheTag(CACHE_TAGS.estoqueKits, CACHE_TAGS.estoqueSaldo)
    cacheLife(CACHE_LIFE.curto)

    const kits = await db
        .select({ id: kit.id, nome: kit.nome, descricao: kit.descricao, ativo: kit.ativo })
        .from(kit)
        .where(apenasAtivos ? eq(kit.ativo, true) : undefined)
        .orderBy(asc(kit.nome))

    if (kits.length === 0) return []

    const componentes = await db
        .select({
            kitId: kitReceitaItem.kitId,
            itemId: kitReceitaItem.itemId,
            nome: item.nome,
            unidadeMedida: item.unidadeMedida,
            quantidadePorKit: kitReceitaItem.quantidade,
            saldo: saldoEstoque.quantidadeAtual
        })
        .from(kitReceitaItem)
        .innerJoin(item, eq(item.id, kitReceitaItem.itemId))
        .leftJoin(saldoEstoque, eq(saldoEstoque.itemId, kitReceitaItem.itemId))
        // Só as receitas dos kits retornados — com `apenasAtivos`, as dos
        // inativos seriam lidas e descartadas.
        .where(
            apenasAtivos
                ? inArray(
                      kitReceitaItem.kitId,
                      kits.map((k) => k.id)
                  )
                : undefined
        )
        .orderBy(asc(item.nome))

    const porKit = new Map<string, ComponenteDoKit[]>()
    for (const c of componentes) {
        const lista = porKit.get(c.kitId) ?? []
        lista.push({
            itemId: c.itemId,
            nome: c.nome,
            unidadeMedida: c.unidadeMedida as UnidadeMedida,
            quantidadePorKit: paraNumero(c.quantidadePorKit),
            saldo: paraNumero(c.saldo ?? '0')
        })
        porKit.set(c.kitId, lista)
    }

    return kits.map((k) => ({ ...k, componentes: porKit.get(k.id) ?? [] })) as KitComReceita[]
}

/** Saldo de todos os itens, como mapa — insumo do cálculo de capacidade. */
export async function saldoPorItem(): Promise<Map<string, number>> {
    'use cache'
    cacheTag(CACHE_TAGS.estoqueSaldo)
    cacheLife(CACHE_LIFE.curto)

    const linhas = await db
        .select({ itemId: saldoEstoque.itemId, quantidadeAtual: saldoEstoque.quantidadeAtual })
        .from(saldoEstoque)

    return new Map(linhas.map((l) => [l.itemId, paraNumero(l.quantidadeAtual)]))
}

// -- Leitura para o pacote de contingência e os alertas (BR-CON-01) -------

/**
 * Inventário completo, sem paginação e sem cache — o pacote de contingência
 * precisa do saldo **exato** no instante do download (DESIGN.md §15).
 */
export async function inventarioParaExportacao(): Promise<ItemComSaldo[]> {
    const linhas = await db
        .select({
            id: item.id,
            nome: item.nome,
            categoria: item.categoria,
            unidadeMedida: item.unidadeMedida,
            saldo: saldoEstoque.quantidadeAtual,
            estoqueMinimo: item.estoqueMinimo,
            aguardandoPrimeiraEntrada: item.aguardandoPrimeiraEntrada
        })
        .from(item)
        .leftJoin(saldoEstoque, eq(saldoEstoque.itemId, item.id))
        .orderBy(asc(item.nome))

    return linhas.map(comNumeros) as ItemComSaldo[]
}
