import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { db, type Transacao } from '@/src/shared/db/postgres'
import { descarte, entrada, item, kit, kitReceitaItem, saida, saidaItem, saldoEstoque } from '@/db/schema/estoque'
import { arredondar, paraNumeric, paraNumero } from '../../domain/quantidade'
import type { ComponenteReceita, ItemConsolidado } from '../../domain/receita-kit'
import type {
    Deficit,
    DescarteRepository,
    EntradaRepository,
    Item,
    ItemRepository,
    Kit,
    KitRepository,
    SaidaRepository
} from '../../application/ports/estoque-repository'

const COLUNAS_ITEM = {
    id: item.id,
    nome: item.nome,
    categoria: item.categoria,
    unidadeMedida: item.unidadeMedida
}

// -- Item (BR-EST-01) ---------------------------------------------------------

export const itemRepository: ItemRepository = {
    async buscarPorId(id) {
        const [linha] = await db.select(COLUNAS_ITEM).from(item).where(eq(item.id, id)).limit(1)
        return (linha as Item) ?? null
    },

    async buscarPorNome(termo, limite = 10) {
        const busca = termo.trim()
        if (busca.length === 0) {
            return db.select(COLUNAS_ITEM).from(item).orderBy(asc(item.nome)).limit(limite) as Promise<Item[]>
        }

        // `%` (similaridade trigram) usa o índice GIN de `item.nome`; o
        // `ilike` cobre o prefixo curto, onde a similaridade ainda é baixa
        // demais para passar do limiar padrão do pg_trgm.
        const linhas = await db
            .select(COLUNAS_ITEM)
            .from(item)
            .where(sql`${item.nome} % ${busca} or ${item.nome} ilike ${'%' + busca + '%'}`)
            .orderBy(desc(sql`similarity(${item.nome}, ${busca})`), asc(item.nome))
            .limit(limite)

        return linhas as Item[]
    },

    async criar(dados) {
        const [linha] = await db.insert(item).values(dados).returning(COLUNAS_ITEM)
        // Todo item nasce com uma linha de saldo: assim toda leitura de saldo é
        // um join simples, sem `coalesce` espalhado por cada consulta.
        await db.insert(saldoEstoque).values({ itemId: linha.id, quantidadeAtual: '0' }).onConflictDoNothing()
        return linha as Item
    }
}

// -- Entrada (DESIGN.md §9.1) -------------------------------------------------

export const entradaRepository: EntradaRepository = {
    async registrar(dados) {
        return db.transaction(async (tx) => {
            let itemId = dados.itemId ?? null

            if (!itemId) {
                if (!dados.novoItem) throw new Error('Entrada sem item nem novoItem.')
                const [criado] = await tx.insert(item).values(dados.novoItem).returning({ id: item.id })
                itemId = criado.id
                await tx.insert(saldoEstoque).values({ itemId, quantidadeAtual: '0' }).onConflictDoNothing()
            }

            const [linha] = await tx
                .insert(entrada)
                .values({
                    itemId,
                    quantidade: paraNumeric(dados.quantidade),
                    condicao: dados.condicao,
                    perecivel: dados.perecivel,
                    dataValidade: dados.dataValidade ?? null,
                    kitDestinoId: dados.kitDestinoId ?? null,
                    registradoPor: dados.registradoPor
                })
                .returning({ id: entrada.id })

            // `+=` no próprio SQL, não em memória: duas entradas concorrentes do
            // mesmo item não podem sobrescrever uma à outra.
            await tx
                .insert(saldoEstoque)
                .values({ itemId, quantidadeAtual: paraNumeric(dados.quantidade) })
                .onConflictDoUpdate({
                    target: saldoEstoque.itemId,
                    set: {
                        quantidadeAtual: sql`${saldoEstoque.quantidadeAtual} + ${paraNumeric(dados.quantidade)}`,
                        atualizadoEm: new Date()
                    }
                })

            return { entradaId: linha.id, itemId }
        })
    }
}

// -- Saída (BR-EST-04, DESIGN.md §9.3) ----------------------------------------

/**
 * Lê os saldos dos itens envolvidos com `FOR UPDATE`, dentro da transação
 * corrente. É o que serializa duas saídas concorrentes do mesmo item — sem o
 * lock, ambas leriam o mesmo saldo e as duas passariam na validação.
 */
async function travarSaldos(tx: Transacao, itemIds: string[]) {
    return tx
        .select({
            itemId: saldoEstoque.itemId,
            quantidadeAtual: saldoEstoque.quantidadeAtual,
            nome: item.nome,
            unidadeMedida: item.unidadeMedida
        })
        .from(saldoEstoque)
        .innerJoin(item, eq(item.id, saldoEstoque.itemId))
        .where(inArray(saldoEstoque.itemId, itemIds))
        .for('update', { of: saldoEstoque })
}

/** Confronta necessidade × saldo travado e devolve os itens deficitários. */
function calcularDeficits(
    necessidades: ItemConsolidado[],
    saldos: Awaited<ReturnType<typeof travarSaldos>>
): Deficit[] {
    const porItem = new Map(saldos.map((s) => [s.itemId, s]))

    return necessidades.flatMap((necessidade) => {
        const saldo = porItem.get(necessidade.itemId)
        const disponivel = saldo ? paraNumero(saldo.quantidadeAtual) : 0
        if (disponivel >= necessidade.quantidade) return []

        return [
            {
                itemId: necessidade.itemId,
                nome: saldo?.nome ?? 'Item desconhecido',
                unidadeMedida: (saldo?.unidadeMedida ?? 'unidade') as Deficit['unidadeMedida'],
                disponivel,
                necessario: necessidade.quantidade,
                faltam: arredondar(necessidade.quantidade - disponivel)
            }
        ]
    })
}

export const saidaRepository: SaidaRepository = {
    async registrar({ tipo, destino, responsavelTransporte, registradoPor, itens }) {
        return db.transaction(async (tx) => {
            const saldos = await travarSaldos(
                tx,
                itens.map((i) => i.itemId)
            )

            const deficits = calcularDeficits(itens, saldos)
            if (deficits.length > 0) {
                // Sai da transação **sem** ter escrito nada — a saída é
                // tudo-ou-nada (BR-EST-04 cenário B). Retornar é melhor que
                // `tx.rollback()`: aquilo lança uma exceção para abortar, o que
                // obrigaria a reler os saldos fora da transação (com os locks já
                // liberados) só para montar a mensagem — uma janela de corrida
                // desnecessária. Aqui os déficits vêm da leitura travada.
                return { deficits }
            }

            const [linha] = await tx
                .insert(saida)
                .values({ tipo, destino, responsavelTransporte, registradoPor })
                .returning({ id: saida.id })

            await tx.insert(saidaItem).values(
                itens.map((i) => ({
                    saidaId: linha.id,
                    itemId: i.itemId,
                    quantidade: paraNumeric(i.quantidade)
                }))
            )

            for (const i of itens) {
                await tx
                    .update(saldoEstoque)
                    .set({
                        quantidadeAtual: sql`${saldoEstoque.quantidadeAtual} - ${paraNumeric(i.quantidade)}`,
                        atualizadoEm: new Date()
                    })
                    .where(eq(saldoEstoque.itemId, i.itemId))
            }

            return { saidaId: linha.id }
        })
    }
}

// -- Descarte (BR-EST-05, DESIGN.md §9.4) -------------------------------------

export const descarteRepository: DescarteRepository = {
    async registrar({ itemId, quantidade, motivo, registradoPor }) {
        const itens: ItemConsolidado[] = [{ itemId, quantidade }]

        return db.transaction(async (tx) => {
            const saldos = await travarSaldos(tx, [itemId])
            const deficits = calcularDeficits(itens, saldos)
            if (deficits.length > 0) return { deficits }

            const [linha] = await tx
                .insert(descarte)
                .values({
                    itemId,
                    quantidade: paraNumeric(quantidade),
                    motivo: motivo ?? null,
                    registradoPor
                })
                .returning({ id: descarte.id })

            await tx
                .update(saldoEstoque)
                .set({
                    quantidadeAtual: sql`${saldoEstoque.quantidadeAtual} - ${paraNumeric(quantidade)}`,
                    atualizadoEm: new Date()
                })
                .where(eq(saldoEstoque.itemId, itemId))

            return { descarteId: linha.id }
        })
    }
}

// -- Kits e receitas (BR-EST-02, BR-EST-03) -----------------------------------

const COLUNAS_KIT = { id: kit.id, nome: kit.nome, descricao: kit.descricao, ativo: kit.ativo }

export const kitRepository: KitRepository = {
    async listar(apenasAtivos = false) {
        const linhas = await db
            .select(COLUNAS_KIT)
            .from(kit)
            .where(apenasAtivos ? eq(kit.ativo, true) : undefined)
            .orderBy(asc(kit.nome))
        return linhas as Kit[]
    },

    async buscarPorId(id) {
        const [linha] = await db.select(COLUNAS_KIT).from(kit).where(eq(kit.id, id)).limit(1)
        return (linha as Kit) ?? null
    },

    async criar({ nome, descricao }) {
        const [linha] = await db
            .insert(kit)
            .values({ nome, descricao: descricao ?? null })
            .returning(COLUNAS_KIT)
        return linha as Kit
    },

    async atualizar({ id, nome, descricao, ativo }) {
        const [linha] = await db
            .update(kit)
            .set({ nome, descricao: descricao ?? null, ativo })
            .where(eq(kit.id, id))
            .returning(COLUNAS_KIT)
        return (linha as Kit) ?? null
    },

    async receita(kitId) {
        const linhas = await db
            .select({ itemId: kitReceitaItem.itemId, quantidade: kitReceitaItem.quantidade })
            .from(kitReceitaItem)
            .where(eq(kitReceitaItem.kitId, kitId))
        return linhas.map((l) => ({ itemId: l.itemId, quantidadePorKit: paraNumero(l.quantidade) }))
    },

    async definirReceita(kitId, componentes) {
        // Substituição completa: a receita enviada é a verdade. Fazer diff
        // incremental abriria espaço para componente órfão de uma edição
        // anterior continuar sendo deduzido nas saídas.
        await db.transaction(async (tx) => {
            await tx.delete(kitReceitaItem).where(eq(kitReceitaItem.kitId, kitId))
            if (componentes.length === 0) return
            await tx.insert(kitReceitaItem).values(
                componentes.map((c) => ({
                    kitId,
                    itemId: c.itemId,
                    quantidade: paraNumeric(c.quantidadePorKit)
                }))
            )
        })
    }
}

/** Receitas de vários kits de uma vez — usado pela saída e pelo dashboard. */
export async function receitasDeKits(kitIds: string[]): Promise<Map<string, ComponenteReceita[]>> {
    if (kitIds.length === 0) return new Map()

    const linhas = await db
        .select({
            kitId: kitReceitaItem.kitId,
            itemId: kitReceitaItem.itemId,
            quantidade: kitReceitaItem.quantidade
        })
        .from(kitReceitaItem)
        .where(inArray(kitReceitaItem.kitId, kitIds))

    const porKit = new Map<string, ComponenteReceita[]>()
    for (const l of linhas) {
        const lista = porKit.get(l.kitId) ?? []
        lista.push({ itemId: l.itemId, quantidadePorKit: paraNumero(l.quantidade) })
        porKit.set(l.kitId, lista)
    }
    return porKit
}

/** Guarda contra kit inativo entrando numa saída nova (BR-EST-02). */
export async function kitEstaAtivo(kitId: string): Promise<boolean> {
    const [linha] = await db
        .select({ ativo: kit.ativo })
        .from(kit)
        .where(and(eq(kit.id, kitId), eq(kit.ativo, true)))
        .limit(1)
    return Boolean(linha)
}
