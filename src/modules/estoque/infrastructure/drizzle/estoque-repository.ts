import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { escaparLike } from '@/src/shared/busca/escapar-like'
import { db, type Transacao } from '@/src/shared/db/postgres'
import { descarte, entrada, item, kit, kitReceitaItem, saida, saidaItem, saldoEstoque } from '@/db/schema/estoque'
import { arredondar, paraNumeric, paraNumero } from '../../domain/quantidade'
import {
    normalizarNomeItem,
    type ComponenteInformado,
    type ComponenteReceita,
    type ItemConsolidado,
    type NovoItem
} from '../../domain/receita-kit'
import type {
    ConflitoComposicao,
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
    unidadeMedida: item.unidadeMedida,
    estoqueMinimo: item.estoqueMinimo,
    aguardandoPrimeiraEntrada: item.aguardandoPrimeiraEntrada
}

type LinhaItem = Omit<Item, 'estoqueMinimo'> & { estoqueMinimo: string | null }

/**
 * `numeric` volta do driver como `string`; o domínio trabalha com `number`.
 * `COLUNAS_ITEM` é um mapa de `select`, então a conversão é feita aqui, depois
 * da leitura, e não no mapa.
 */
function paraItem(linha: LinhaItem): Item {
    return { ...linha, estoqueMinimo: linha.estoqueMinimo === null ? null : paraNumero(linha.estoqueMinimo) }
}

// -- Item (BR-EST-01) ---------------------------------------------------------

export const itemRepository: ItemRepository = {
    async buscarPorId(id) {
        const [linha] = await db.select(COLUNAS_ITEM).from(item).where(eq(item.id, id)).limit(1)
        return linha ? paraItem(linha as LinhaItem) : null
    },

    async criar(dados) {
        const [linha] = await db.insert(item).values(dados).returning(COLUNAS_ITEM)
        // Todo item nasce com uma linha de saldo: assim toda leitura de saldo é
        // um join simples, sem `coalesce` espalhado por cada consulta.
        await db.insert(saldoEstoque).values({ itemId: linha.id, quantidadeAtual: '0' }).onConflictDoNothing()
        return paraItem(linha as LinhaItem)
    },

    async definirEstoqueMinimo(id, estoqueMinimo) {
        await db
            .update(item)
            .set({ estoqueMinimo: estoqueMinimo === null ? null : paraNumeric(estoqueMinimo) })
            .where(eq(item.id, id))
    }
}

// -- Entrada (DESIGN.md §9.1) -------------------------------------------------

export const entradaRepository: EntradaRepository = {
    async registrar(dados) {
        return db.transaction(async (tx) => {
            let itemId = dados.itemId ?? null

            if (!itemId) {
                if (!dados.novoItem) throw new Error('Entrada sem item nem novoItem.')
                const { estoqueMinimo, ...novoItem } = dados.novoItem
                const [criado] = await tx
                    .insert(item)
                    .values({
                        ...novoItem,
                        // Ausente ou `null`: herda o padrão global (feature 020).
                        estoqueMinimo: estoqueMinimo == null ? null : paraNumeric(estoqueMinimo)
                    })
                    .returning({ id: item.id })
                itemId = criado.id
                await tx.insert(saldoEstoque).values({ itemId, quantidadeAtual: '0' }).onConflictDoNothing()
            } else {
                // Item criado pelo kit (feature 022) passa a contar no alerta de
                // estoque crítico a partir daqui: a entrada é a primeira
                // movimentação possível, porque saída e descarte exigem saldo.
                await tx
                    .update(item)
                    .set({ aguardandoPrimeiraEntrada: false })
                    .where(and(eq(item.id, itemId), eq(item.aguardandoPrimeiraEntrada, true)))
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

    async receita(kitId) {
        const linhas = await db
            .select({ itemId: kitReceitaItem.itemId, quantidade: kitReceitaItem.quantidade })
            .from(kitReceitaItem)
            .where(eq(kitReceitaItem.kitId, kitId))
        return linhas.map((l) => ({ itemId: l.itemId, quantidadePorKit: paraNumero(l.quantidade) }))
    },

    async salvarComposicao({ id, nome, descricao, ativo, componentes }) {
        try {
            return await db.transaction(async (tx) => {
                const { ids, itensCriados, vinculos, conflitos } = await resolverComponentes(tx, componentes)

                // Depois de resolvidos, dois componentes podem apontar para o mesmo
                // item — um nome novo que vinculou a um item já escolhido em outra
                // linha. `unique(kitId, itemId)` recusaria com erro de constraint;
                // aqui vira mensagem na linha certa.
                const vistos = new Set<string>()
                ids.forEach((itemId, indice) => {
                    if (!itemId) return
                    if (vistos.has(itemId)) conflitos.push({ indice, tipo: 'repetido' })
                    vistos.add(itemId)
                })

                if (conflitos.length > 0) {
                    throw new ComposicaoRecusada({ conflitos: conflitos.sort((a, b) => a.indice - b.indice) })
                }

                const [salvo] = id
                    ? await tx
                          .update(kit)
                          .set({ nome, descricao: descricao ?? null, ativo })
                          .where(eq(kit.id, id))
                          .returning(COLUNAS_KIT)
                    : await tx
                          .insert(kit)
                          .values({ nome, descricao: descricao ?? null, ativo })
                          .returning(COLUNAS_KIT)
                // Kit inexistente: o throw desfaz os itens que já tinham sido criados.
                if (!salvo) throw new ComposicaoRecusada(null)

                const receita: ComponenteReceita[] = componentes.map((c, indice) => ({
                    itemId: ids[indice] as string,
                    quantidadePorKit: c.quantidadePorKit
                }))

                // Substituição completa: a receita enviada é a verdade. Fazer diff
                // incremental abriria espaço para componente órfão de uma edição
                // anterior continuar sendo deduzido nas saídas.
                await tx.delete(kitReceitaItem).where(eq(kitReceitaItem.kitId, salvo.id))
                if (receita.length > 0) {
                    await tx.insert(kitReceitaItem).values(
                        receita.map((c) => ({
                            kitId: salvo.id,
                            itemId: c.itemId,
                            quantidade: paraNumeric(c.quantidadePorKit)
                        }))
                    )
                }

                return { kit: salvo as Kit, receita, itensCriados, vinculos }
            })
        } catch (erro) {
            if (erro instanceof ComposicaoRecusada) return erro.resultado
            throw erro
        }
    }
}

/**
 * Sai da transação **lançando**, que é o que faz o Drizzle dar rollback; o
 * `catch` de `salvarComposicao` devolve o resultado como valor. Nada do que foi
 * criado antes do conflito (itens novos de outras linhas) sobrevive.
 */
class ComposicaoRecusada extends Error {
    constructor(readonly resultado: { conflitos: ConflitoComposicao[] } | null) {
        super('composição recusada')
    }
}

/**
 * Resolve cada componente para um id de item, criando os itens novos que não
 * existem (feature 022, research R3/R4).
 *
 * Os nomes novos são processados em ordem de nome normalizado: dois kits com os
 * mesmos nomes em ordens diferentes pegariam os locks em ordem cruzada e
 * entrariam em deadlock.
 */
async function resolverComponentes(tx: Transacao, componentes: ComponenteInformado[]) {
    const ids: (string | null)[] = componentes.map((c) => (c.tipo === 'existente' ? c.itemId : null))
    const itensCriados: Item[] = []
    const vinculos: { indice: number; itemId: string }[] = []
    const conflitos: ConflitoComposicao[] = []

    const novos = componentes
        .map((c, indice) => (c.tipo === 'novo' ? { indice, novoItem: c.novoItem } : null))
        .filter((c): c is { indice: number; novoItem: NovoItem } => c !== null)
        .sort((a, b) => normalizarNomeItem(a.novoItem.nome).localeCompare(normalizarNomeItem(b.novoItem.nome)))

    for (const { indice, novoItem } of novos) {
        const nome = novoItem.nome.trim()

        // Serializa quem cria o mesmo nome ao mesmo tempo: o segundo espera o
        // commit do primeiro e então o encontra na busca abaixo. O lock vive só
        // até o fim da transação.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'item-nome:' + normalizarNomeItem(nome)}))`)

        // `ILIKE` sem curinga = igualdade sem diferença de caixa; com
        // `f_unaccent` dos dois lados, também sem acento. Usa o índice trigram
        // `item_nome_unaccent_trgm_idx` (021).
        const equivalentes = await tx
            .select({ id: item.id })
            .from(item)
            .where(sql`f_unaccent(${item.nome}) ilike f_unaccent(${escaparLike(nome)}) escape '\\'`)
            .limit(2)

        if (equivalentes.length > 1) {
            conflitos.push({ indice, tipo: 'ambiguo' })
            continue
        }

        if (equivalentes.length === 1) {
            ids[indice] = equivalentes[0].id
            vinculos.push({ indice, itemId: equivalentes[0].id })
            continue
        }

        const [criado] = await tx
            .insert(item)
            .values({
                nome,
                categoria: novoItem.categoria,
                unidadeMedida: novoItem.unidadeMedida,
                // Ausente ou `null`: herda o padrão global (feature 020).
                estoqueMinimo: novoItem.estoqueMinimo == null ? null : paraNumeric(novoItem.estoqueMinimo),
                // Saldo 0 por planejamento, não por falta (FR-015).
                aguardandoPrimeiraEntrada: true
            })
            .returning(COLUNAS_ITEM)
        await tx.insert(saldoEstoque).values({ itemId: criado.id, quantidadeAtual: '0' }).onConflictDoNothing()

        ids[indice] = criado.id
        itensCriados.push(paraItem(criado as LinhaItem))
    }

    return { ids, itensCriados, vinculos, conflitos }
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

/** Nomes de vários kits de uma vez — rótulos da saída, sem uma consulta por kit. */
export async function nomesDeKits(kitIds: string[]): Promise<Map<string, string>> {
    if (kitIds.length === 0) return new Map()

    const linhas = await db.select({ id: kit.id, nome: kit.nome }).from(kit).where(inArray(kit.id, kitIds))
    return new Map(linhas.map((l) => [l.id, l.nome]))
}
