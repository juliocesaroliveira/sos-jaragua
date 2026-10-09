import 'server-only'
import { and, asc, count, desc, eq, gte, lt, lte, sql, type AnyColumn, type SQL } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { descarte, entrada, item, kit, saida, saidaItem, saldoEstoque } from '@/db/schema/estoque'
import { escaparLike } from '@/src/shared/busca/escapar-like'
import { itensCriticos, limiarDoItem } from '../../domain/estoque-minimo'
import { paraNumero } from '../../domain/quantidade'
import type { CategoriaItem, CondicaoItem, TipoSaida, UnidadeMedida } from '../../domain/item'

/**
 * Leituras de Estoque para a central de relatórios
 * (specs/023-central-relatorios, research D4/D5).
 *
 * São as **portas de leitura** que o módulo Contingência/Relatórios usa: ele não
 * importa `db/schema` de Estoque (Princípio I). Todas:
 * - **sem `'use cache'`** — relatório é retrato do momento (FR-009);
 * - recebem o período já convertido em instantes UTC (`intervalo`), porque a
 *   regra do fuso mora em um lugar só (`contingencia/domain/periodo.ts`);
 * - devolvem ids de quem registrou (`registradoPorId`), não nomes: o nome é
 *   resolvido em lote por Identidade (regra da feature, T017);
 * - paginam por janela (`limite`/`deslocamento`) com ordenação **estável** —
 *   desempate pelo id da linha —, senão a exportação em lotes repetiria ou
 *   pularia linhas com o mesmo `criado_em`.
 */

export type Intervalo = { inicio: Date; fimExclusivo: Date }
export type Janela = { limite: number; deslocamento: number }

function noIntervalo(coluna: AnyColumn, intervalo: Intervalo): SQL {
    return and(gte(coluna, intervalo.inicio), lt(coluna, intervalo.fimExclusivo))!
}

/** Contém o termo, sem acento e sem caixa — mesma semântica do Lookup (021). */
function contemTexto(coluna: AnyColumn, termo: string): SQL {
    return sql`f_unaccent(${coluna}) ilike '%' || f_unaccent(${escaparLike(termo)}) || '%' escape '\\'`
}

// -- R-01 Inventário atual ------------------------------------------------------

export type SituacaoEstoque = 'abaixo' | 'ok' | 'aguardando'
export type OrigemMinimo = 'proprio' | 'padrao' | 'sem_alerta'

export type LinhaInventario = {
    id: string
    nome: string
    categoria: CategoriaItem
    unidadeMedida: UnidadeMedida
    saldo: number
    /** Limiar efetivo; `null` quando o alerta está desligado (mínimo 0). */
    minimoAplicado: number | null
    origemMinimo: OrigemMinimo
    situacao: SituacaoEstoque
}

export type FiltrosInventario = { categoria?: CategoriaItem; situacao?: SituacaoEstoque }

/**
 * Inventário com o mínimo efetivo de cada item.
 *
 * Carrega todos os itens e calcula em memória, com `limiarDoItem` — a única
 * fonte da semântica do mínimo (feature 020). Repetir a regra num `CASE` SQL
 * para poder paginar no banco criaria uma segunda definição que um dia
 * divergiria; o cadastro de itens tem centenas de linhas, não milhares.
 */
export async function inventarioRelatorio(
    filtros: FiltrosInventario,
    limiarGlobal: number
): Promise<LinhaInventario[]> {
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
        .where(filtros.categoria ? eq(item.categoria, filtros.categoria) : undefined)
        .orderBy(asc(item.nome), asc(item.id))

    return linhas
        .map((l): LinhaInventario => {
            const saldo = paraNumero(l.saldo ?? '0')
            const estoqueMinimo = l.estoqueMinimo === null ? null : paraNumero(l.estoqueMinimo)
            const minimoAplicado = limiarDoItem(estoqueMinimo, limiarGlobal)
            const origemMinimo: OrigemMinimo =
                estoqueMinimo === null ? 'padrao' : estoqueMinimo === 0 ? 'sem_alerta' : 'proprio'
            // Item criado pelo kit nasce com saldo 0 por planejamento, não por
            // falta (022, FR-015) — não é "abaixo do mínimo".
            const situacao: SituacaoEstoque = l.aguardandoPrimeiraEntrada
                ? 'aguardando'
                : minimoAplicado !== null && saldo <= minimoAplicado
                  ? 'abaixo'
                  : 'ok'
            return {
                id: l.id,
                nome: l.nome,
                categoria: l.categoria,
                unidadeMedida: l.unidadeMedida,
                saldo,
                minimoAplicado,
                origemMinimo,
                situacao
            }
        })
        .filter((l) => !filtros.situacao || l.situacao === filtros.situacao)
}

// -- R-02 Histórico de saídas --------------------------------------------------

export type FiltrosSaidas = { intervalo: Intervalo; tipo?: TipoSaida; destino?: string; categoria?: CategoriaItem }

export type LinhaSaidaRelatorio = {
    saidaId: string
    saidaItemId: string
    criadoEm: Date
    tipo: TipoSaida
    destino: string
    responsavelTransporte: string
    item: string
    categoria: CategoriaItem
    quantidade: number
    unidadeMedida: UnidadeMedida
    registradoPorId: string
}

function condicoesSaidas(filtros: FiltrosSaidas): SQL | undefined {
    return and(
        noIntervalo(saida.criadoEm, filtros.intervalo),
        filtros.tipo ? eq(saida.tipo, filtros.tipo) : undefined,
        filtros.destino ? contemTexto(saida.destino, filtros.destino) : undefined,
        filtros.categoria ? eq(item.categoria, filtros.categoria) : undefined
    )
}

/**
 * Uma linha por item entregue. Vem de `saida_item`, então o descarte fica de
 * fora por construção (BR-EST-05) — não depende de um filtro que alguém possa
 * esquecer.
 */
export async function saidasNoPeriodo(filtros: FiltrosSaidas, janela: Janela): Promise<LinhaSaidaRelatorio[]> {
    const linhas = await db
        .select({
            saidaId: saida.id,
            saidaItemId: saidaItem.id,
            criadoEm: saida.criadoEm,
            tipo: saida.tipo,
            destino: saida.destino,
            responsavelTransporte: saida.responsavelTransporte,
            item: item.nome,
            categoria: item.categoria,
            quantidade: saidaItem.quantidade,
            unidadeMedida: item.unidadeMedida,
            registradoPorId: saida.registradoPor
        })
        .from(saidaItem)
        .innerJoin(saida, eq(saida.id, saidaItem.saidaId))
        .innerJoin(item, eq(item.id, saidaItem.itemId))
        .where(condicoesSaidas(filtros))
        .orderBy(desc(saida.criadoEm), asc(item.nome), asc(saidaItem.id))
        .limit(janela.limite)
        .offset(janela.deslocamento)

    return linhas.map((l) => ({ ...l, quantidade: paraNumero(l.quantidade) }))
}

export async function contarSaidasNoPeriodo(filtros: FiltrosSaidas): Promise<number> {
    const [linha] = await db
        .select({ total: count() })
        .from(saidaItem)
        .innerJoin(saida, eq(saida.id, saidaItem.saidaId))
        .innerJoin(item, eq(item.id, saidaItem.itemId))
        .where(condicoesSaidas(filtros))
    return linha?.total ?? 0
}

// -- R-03 Doações recebidas ----------------------------------------------------

export type FiltrosEntradas = { intervalo: Intervalo; categoria?: CategoriaItem; condicao?: CondicaoItem }

export type LinhaEntradaRelatorio = {
    id: string
    criadoEm: Date
    item: string
    categoria: CategoriaItem
    quantidade: number
    unidadeMedida: UnidadeMedida
    condicao: CondicaoItem
    perecivel: boolean
    /** `AAAA-MM-DD` (coluna `date`). */
    dataValidade: string | null
    kitDestino: string | null
    registradoPorId: string
}

function condicoesEntradas(filtros: FiltrosEntradas): SQL | undefined {
    return and(
        noIntervalo(entrada.criadoEm, filtros.intervalo),
        filtros.categoria ? eq(item.categoria, filtros.categoria) : undefined,
        filtros.condicao ? eq(entrada.condicao, filtros.condicao) : undefined
    )
}

export async function entradasNoPeriodo(filtros: FiltrosEntradas, janela: Janela): Promise<LinhaEntradaRelatorio[]> {
    const linhas = await db
        .select({
            id: entrada.id,
            criadoEm: entrada.criadoEm,
            item: item.nome,
            categoria: item.categoria,
            quantidade: entrada.quantidade,
            unidadeMedida: item.unidadeMedida,
            condicao: entrada.condicao,
            perecivel: entrada.perecivel,
            dataValidade: entrada.dataValidade,
            kitDestino: kit.nome,
            registradoPorId: entrada.registradoPor
        })
        .from(entrada)
        .innerJoin(item, eq(item.id, entrada.itemId))
        .leftJoin(kit, eq(kit.id, entrada.kitDestinoId))
        .where(condicoesEntradas(filtros))
        .orderBy(desc(entrada.criadoEm), asc(entrada.id))
        .limit(janela.limite)
        .offset(janela.deslocamento)

    return linhas.map((l) => ({ ...l, quantidade: paraNumero(l.quantidade) }))
}

export async function contarEntradasNoPeriodo(filtros: FiltrosEntradas): Promise<number> {
    const [linha] = await db
        .select({ total: count() })
        .from(entrada)
        .innerJoin(item, eq(item.id, entrada.itemId))
        .where(condicoesEntradas(filtros))
    return linha?.total ?? 0
}

// -- R-04 Descartes ------------------------------------------------------------

export type FiltrosDescartes = { intervalo: Intervalo; categoria?: CategoriaItem }

export type LinhaDescarteRelatorio = {
    id: string
    criadoEm: Date
    item: string
    categoria: CategoriaItem
    quantidade: number
    unidadeMedida: UnidadeMedida
    motivo: string | null
    registradoPorId: string
}

function condicoesDescartes(filtros: FiltrosDescartes): SQL | undefined {
    return and(
        noIntervalo(descarte.criadoEm, filtros.intervalo),
        filtros.categoria ? eq(item.categoria, filtros.categoria) : undefined
    )
}

export async function descartesNoPeriodo(filtros: FiltrosDescartes, janela: Janela): Promise<LinhaDescarteRelatorio[]> {
    const linhas = await db
        .select({
            id: descarte.id,
            criadoEm: descarte.criadoEm,
            item: item.nome,
            categoria: item.categoria,
            quantidade: descarte.quantidade,
            unidadeMedida: item.unidadeMedida,
            motivo: descarte.motivo,
            registradoPorId: descarte.registradoPor
        })
        .from(descarte)
        .innerJoin(item, eq(item.id, descarte.itemId))
        .where(condicoesDescartes(filtros))
        .orderBy(desc(descarte.criadoEm), asc(descarte.id))
        .limit(janela.limite)
        .offset(janela.deslocamento)

    return linhas.map((l) => ({ ...l, quantidade: paraNumero(l.quantidade) }))
}

export async function contarDescartesNoPeriodo(filtros: FiltrosDescartes): Promise<number> {
    const [linha] = await db
        .select({ total: count() })
        .from(descarte)
        .innerJoin(item, eq(item.id, descarte.itemId))
        .where(condicoesDescartes(filtros))
    return linha?.total ?? 0
}

// -- R-05 Estoque crítico ------------------------------------------------------

export type LinhaItemCritico = {
    id: string
    nome: string
    categoria: CategoriaItem
    unidadeMedida: UnidadeMedida
    saldo: number
    limiar: number
}

/**
 * Itens no mínimo ou abaixo dele, decididos por `itensCriticos` — a **mesma**
 * função do alerta de estoque crítico. O relatório nunca discorda do sino.
 */
export async function itensCriticosRelatorio(
    filtros: { categoria?: CategoriaItem },
    limiarGlobal: number
): Promise<LinhaItemCritico[]> {
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
        .where(filtros.categoria ? eq(item.categoria, filtros.categoria) : undefined)

    const comNumeros = linhas.map((l) => ({
        ...l,
        saldo: paraNumero(l.saldo ?? '0'),
        estoqueMinimo: l.estoqueMinimo === null ? null : paraNumero(l.estoqueMinimo)
    }))

    return itensCriticos(comNumeros, limiarGlobal).map(({ id, nome, categoria, unidadeMedida, saldo, limiar }) => ({
        id,
        nome,
        categoria,
        unidadeMedida,
        saldo,
        limiar
    }))
}

// -- R-06 Validades ------------------------------------------------------------

/** `limite`: última validade incluída (`AAAA-MM-DD`) — hoje + horizonte. */
export type FiltrosValidades = { limite: string; categoria?: CategoriaItem }

export type LinhaValidade = {
    id: string
    criadoEm: Date
    item: string
    categoria: CategoriaItem
    quantidade: number
    unidadeMedida: UnidadeMedida
    /** `AAAA-MM-DD`. */
    dataValidade: string
}

function condicoesValidades(filtros: FiltrosValidades): SQL | undefined {
    return and(
        eq(entrada.perecivel, true),
        // `date` comparado a `date`: data civil, sem fuso.
        lte(entrada.dataValidade, filtros.limite),
        filtros.categoria ? eq(item.categoria, filtros.categoria) : undefined
    )
}

/**
 * Entradas perecíveis vencidas ou que vencem até `limite`. A validade é da
 * **doação recebida**: o estoque não guarda lotes, então o relatório não sabe
 * quanto daquela entrada ainda está no galpão — a definição avisa isso.
 */
export async function validadesRelatorio(filtros: FiltrosValidades, janela: Janela): Promise<LinhaValidade[]> {
    const linhas = await db
        .select({
            id: entrada.id,
            criadoEm: entrada.criadoEm,
            item: item.nome,
            categoria: item.categoria,
            quantidade: entrada.quantidade,
            unidadeMedida: item.unidadeMedida,
            dataValidade: entrada.dataValidade
        })
        .from(entrada)
        .innerJoin(item, eq(item.id, entrada.itemId))
        .where(condicoesValidades(filtros))
        .orderBy(asc(entrada.dataValidade), asc(item.nome), asc(entrada.id))
        .limit(janela.limite)
        .offset(janela.deslocamento)

    return linhas.map((l) => ({
        ...l,
        quantidade: paraNumero(l.quantidade),
        // `perecivel = true` garante a validade (regra da Entrada, BR-EST-01).
        dataValidade: l.dataValidade ?? ''
    }))
}

export async function contarValidadesRelatorio(filtros: FiltrosValidades): Promise<number> {
    const [linha] = await db
        .select({ total: count() })
        .from(entrada)
        .innerJoin(item, eq(item.id, entrada.itemId))
        .where(condicoesValidades(filtros))
    return linha?.total ?? 0
}

// -- R-07 Movimentação por item --------------------------------------------------

export type MovimentosItem = { entradas: number; saidas: number; descartes: number }

export type LinhaMovimentacao = {
    id: string
    nome: string
    categoria: CategoriaItem
    unidadeMedida: UnidadeMedida
    saldoAtual: number
    noPeriodo: MovimentosItem
    aposPeriodo: MovimentosItem
}

/**
 * Somas do ledger por item: no período e **depois** dele. O balanço (saldo
 * inicial e final) é montado no domínio a partir do saldo de hoje
 * (`contingencia/domain/calculos-consolidados.ts`), que é o único saldo que o
 * sistema guarda.
 *
 * Uma linha por item do cadastro (centenas, não milhares): a página é
 * recortada em memória depois do balanço, que decide quem fica de fora.
 */
export async function movimentacaoRelatorio(filtros: {
    intervalo: Intervalo
    categoria?: CategoriaItem
}): Promise<LinhaMovimentacao[]> {
    const { inicio, fimExclusivo } = filtros.intervalo

    const somaEntradas = (de: SQL) =>
        sql<string>`coalesce((select sum(e.quantidade) from entrada e where e.item_id = ${item.id} and ${de}), 0)`
    const somaSaidas = (de: SQL) =>
        sql<string>`coalesce((select sum(si.quantidade) from saida_item si inner join saida s on s.id = si.saida_id where si.item_id = ${item.id} and ${de}), 0)`
    const somaDescartes = (de: SQL) =>
        sql<string>`coalesce((select sum(d.quantidade) from descarte d where d.item_id = ${item.id} and ${de}), 0)`

    const linhas = await db
        .select({
            id: item.id,
            nome: item.nome,
            categoria: item.categoria,
            unidadeMedida: item.unidadeMedida,
            saldoAtual: saldoEstoque.quantidadeAtual,
            entradas: somaEntradas(sql`e.criado_em >= ${inicio} and e.criado_em < ${fimExclusivo}`),
            saidas: somaSaidas(sql`s.criado_em >= ${inicio} and s.criado_em < ${fimExclusivo}`),
            descartes: somaDescartes(sql`d.criado_em >= ${inicio} and d.criado_em < ${fimExclusivo}`),
            entradasDepois: somaEntradas(sql`e.criado_em >= ${fimExclusivo}`),
            saidasDepois: somaSaidas(sql`s.criado_em >= ${fimExclusivo}`),
            descartesDepois: somaDescartes(sql`d.criado_em >= ${fimExclusivo}`)
        })
        .from(item)
        .leftJoin(saldoEstoque, eq(saldoEstoque.itemId, item.id))
        .where(filtros.categoria ? eq(item.categoria, filtros.categoria) : undefined)
        .orderBy(asc(item.nome), asc(item.id))

    return linhas.map((l) => ({
        id: l.id,
        nome: l.nome,
        categoria: l.categoria,
        unidadeMedida: l.unidadeMedida,
        saldoAtual: paraNumero(l.saldoAtual ?? '0'),
        noPeriodo: {
            entradas: paraNumero(l.entradas),
            saidas: paraNumero(l.saidas),
            descartes: paraNumero(l.descartes)
        },
        aposPeriodo: {
            entradas: paraNumero(l.entradasDepois),
            saidas: paraNumero(l.saidasDepois),
            descartes: paraNumero(l.descartesDepois)
        }
    }))
}

// -- R-08 Entregas por destino ---------------------------------------------------

export type LinhaEntregaDestino = {
    destino: string
    categoria: CategoriaItem
    unidadeMedida: UnidadeMedida
    quantidade: number
    saidas: number
}

/**
 * Chave de agrupamento do destino: sem caixa, sem espaços nas pontas e com
 * espaços internos colapsados — "Abrigo  Central " e "abrigo central" são o
 * mesmo lugar (FR-019). O destino é texto livre; sem isto, a mesma escola
 * apareceria em três linhas.
 */
const destinoArrumado = sql<string>`regexp_replace(trim(${saida.destino}), '\\s+', ' ', 'g')`
const chaveDestino = sql<string>`lower(${destinoArrumado})`

function consultaEntregas(filtros: { intervalo: Intervalo; categoria?: CategoriaItem }) {
    return db
        .select({
            // Grafia mais frequente do grupo, com os espaços já arrumados, para
            // exibir (empate: alfabética).
            destino: sql<string>`mode() within group (order by ${destinoArrumado})`.as('destino'),
            chave: chaveDestino.as('chave'),
            categoria: item.categoria,
            unidadeMedida: item.unidadeMedida,
            quantidade: sql<string>`sum(${saidaItem.quantidade})`.as('quantidade'),
            saidas: sql<number>`count(distinct ${saida.id})`.mapWith(Number).as('saidas')
        })
        .from(saidaItem)
        .innerJoin(saida, eq(saida.id, saidaItem.saidaId))
        .innerJoin(item, eq(item.id, saidaItem.itemId))
        .where(
            and(
                noIntervalo(saida.criadoEm, filtros.intervalo),
                filtros.categoria ? eq(item.categoria, filtros.categoria) : undefined
            )
        )
        .groupBy(chaveDestino, item.categoria, item.unidadeMedida)
}

/** Vem de `saida_item`: descarte não é entrega e fica de fora por construção. */
export async function entregasPorDestinoRelatorio(
    filtros: { intervalo: Intervalo; categoria?: CategoriaItem },
    janela: Janela
): Promise<LinhaEntregaDestino[]> {
    const grupos = consultaEntregas(filtros).as('grupos')
    const linhas = await db
        .select()
        .from(grupos)
        .orderBy(asc(grupos.chave), asc(grupos.categoria), asc(grupos.unidadeMedida))
        .limit(janela.limite)
        .offset(janela.deslocamento)

    return linhas.map((l) => ({
        destino: l.destino,
        categoria: l.categoria,
        unidadeMedida: l.unidadeMedida,
        quantidade: paraNumero(l.quantidade),
        saidas: l.saidas
    }))
}

export async function contarEntregasPorDestino(filtros: {
    intervalo: Intervalo
    categoria?: CategoriaItem
}): Promise<number> {
    const [linha] = await db.select({ total: count() }).from(consultaEntregas(filtros).as('grupos'))
    return linha?.total ?? 0
}
