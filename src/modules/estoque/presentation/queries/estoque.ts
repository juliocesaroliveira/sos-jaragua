import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { asc, count, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { item, kit, kitReceitaItem, saida, saidaItem, saldoEstoque } from '@/db/schema/estoque'
import { CACHE_LIFE, CACHE_TAGS } from '@/src/shared/cache'
import { paraNumero } from '../../domain/quantidade'
import type { CategoriaItem, UnidadeMedida } from '../../domain/item'

export type ItemComSaldo = {
    id: string
    nome: string
    categoria: CategoriaItem
    unidadeMedida: UnidadeMedida
    saldo: number
}

/**
 * Catálogo de itens para o autocomplete da Entrada (BR-EST-01).
 * Cacheado sob `estoque:itens`, invalidado por qualquer criação de item.
 */
export async function listarItens(): Promise<ItemComSaldo[]> {
    'use cache'
    cacheTag(CACHE_TAGS.estoqueItens, CACHE_TAGS.estoqueSaldo)
    cacheLife(CACHE_LIFE.curto)

    const linhas = await db
        .select({
            id: item.id,
            nome: item.nome,
            categoria: item.categoria,
            unidadeMedida: item.unidadeMedida,
            saldo: saldoEstoque.quantidadeAtual
        })
        .from(item)
        .leftJoin(saldoEstoque, eq(saldoEstoque.itemId, item.id))
        .orderBy(asc(item.nome))

    return linhas.map((l) => ({ ...l, saldo: paraNumero(l.saldo ?? '0') })) as ItemComSaldo[]
}

export type FiltrosEstoque = {
    page: number
    pageSize: number
    categoria?: CategoriaItem
    /** Só itens com saldo > 0 — a visão útil na tela de saída. */
    somenteComSaldo?: boolean
}

/**
 * Listagem paginada de estoque (EST-12). O saldo vem de `saldo_estoque`
 * (read-model materializado), não de uma reagregação do ledger — é o que
 * sustenta o requisito de leitura <300ms do NFR §4.1.
 */
export async function listarEstoque(filtros: FiltrosEstoque): Promise<{ rows: ItemComSaldo[]; totalCount: number }> {
    'use cache'
    cacheTag(CACHE_TAGS.estoqueListagem, CACHE_TAGS.estoqueSaldo)
    cacheLife(CACHE_LIFE.curto)

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
                saldo: saldoEstoque.quantidadeAtual
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
        rows: linhas.map((l) => ({ ...l, saldo: paraNumero(l.saldo ?? '0') })) as ItemComSaldo[],
        totalCount: total?.total ?? 0
    }
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

/** Kits com a receita completa (BR-EST-02/03), para a tela de kits e a saída. */
export async function listarKitsComReceita(apenasAtivos = false): Promise<KitComReceita[]> {
    'use cache'
    cacheTag(CACHE_TAGS.estoqueKits, CACHE_TAGS.estoqueSaldo)
    cacheLife(CACHE_LIFE.curto)

    const kits = await db
        .select({ id: kit.id, nome: kit.nome, descricao: kit.descricao, ativo: kit.ativo })
        .from(kit)
        .where(apenasAtivos ? eq(kit.ativo, true) : undefined)
        .orderBy(asc(kit.nome))

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

export type LinhaHistoricoSaida = {
    saidaId: string
    tipo: 'avulso' | 'kit'
    destino: string
    responsavelTransporte: string
    criadoEm: string
    itens: { nome: string; quantidade: number; unidadeMedida: UnidadeMedida }[]
}

/** Histórico de saídas — base do relatório BR-REL-01 e da conferência em tela. */
export async function listarHistoricoSaidas(limite = 100): Promise<LinhaHistoricoSaida[]> {
    'use cache'
    cacheTag(CACHE_TAGS.estoqueListagem)
    cacheLife(CACHE_LIFE.curto)

    const saidas = await db
        .select({
            saidaId: saida.id,
            tipo: saida.tipo,
            destino: saida.destino,
            responsavelTransporte: saida.responsavelTransporte,
            criadoEm: saida.criadoEm
        })
        .from(saida)
        .orderBy(desc(saida.criadoEm))
        .limit(limite)

    if (saidas.length === 0) return []

    const itens = await db
        .select({
            saidaId: saidaItem.saidaId,
            nome: item.nome,
            unidadeMedida: item.unidadeMedida,
            quantidade: saidaItem.quantidade
        })
        .from(saidaItem)
        .innerJoin(item, eq(item.id, saidaItem.itemId))

    const porSaida = new Map<string, LinhaHistoricoSaida['itens']>()
    for (const i of itens) {
        const lista = porSaida.get(i.saidaId) ?? []
        lista.push({
            nome: i.nome,
            quantidade: paraNumero(i.quantidade),
            unidadeMedida: i.unidadeMedida as UnidadeMedida
        })
        porSaida.set(i.saidaId, lista)
    }

    return saidas.map((s) => ({
        ...s,
        tipo: s.tipo as 'avulso' | 'kit',
        criadoEm: s.criadoEm.toISOString(),
        itens: porSaida.get(s.saidaId) ?? []
    }))
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

// -- Leituras para exportação (BR-REL-01, BR-CON-01) --------------------------

export type LinhaSaidaPlana = {
    saidaId: string
    criadoEm: string
    tipo: 'avulso' | 'kit'
    destino: string
    responsavelTransporte: string
    item: string
    categoria: CategoriaItem
    quantidade: number
    unidadeMedida: UnidadeMedida
}

/**
 * Histórico de saídas **achatado**: uma linha por item entregue.
 *
 * É a forma que planilha entende — a estrutura aninhada de `saida` +
 * `saida_item` da tela não se transporta para CSV. Por vir de `saida_item`, o
 * descarte fica de fora por construção (BR-EST-05).
 *
 * Sem cache: o relatório precisa refletir o estado exato do momento do
 * download, e é uma leitura pontual, não de tela.
 */
export async function saidasParaExportacao(): Promise<LinhaSaidaPlana[]> {
    const linhas = await db
        .select({
            saidaId: saida.id,
            criadoEm: saida.criadoEm,
            tipo: saida.tipo,
            destino: saida.destino,
            responsavelTransporte: saida.responsavelTransporte,
            item: item.nome,
            categoria: item.categoria,
            quantidade: saidaItem.quantidade,
            unidadeMedida: item.unidadeMedida
        })
        .from(saidaItem)
        .innerJoin(saida, eq(saida.id, saidaItem.saidaId))
        .innerJoin(item, eq(item.id, saidaItem.itemId))
        .orderBy(desc(saida.criadoEm), asc(item.nome))

    return linhas.map((l) => ({
        ...l,
        tipo: l.tipo as 'avulso' | 'kit',
        criadoEm: l.criadoEm.toISOString(),
        quantidade: paraNumero(l.quantidade),
        categoria: l.categoria as CategoriaItem,
        unidadeMedida: l.unidadeMedida as UnidadeMedida
    }))
}

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
            saldo: saldoEstoque.quantidadeAtual
        })
        .from(item)
        .leftJoin(saldoEstoque, eq(saldoEstoque.itemId, item.id))
        .orderBy(asc(item.nome))

    return linhas.map((l) => ({ ...l, saldo: paraNumero(l.saldo ?? '0') })) as ItemComSaldo[]
}
