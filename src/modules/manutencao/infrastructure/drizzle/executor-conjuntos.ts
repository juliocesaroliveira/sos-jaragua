import 'server-only'
import { sql, type SQL } from 'drizzle-orm'
import { db, type Transacao } from '@/src/shared/db/postgres'
import { REGISTROS_SISTEMA, REGISTRO_SISTEMA_POR_TABELA } from '@/src/shared/kernel/registros-sistema'
import { CATALOGO, tabelaDoCatalogo, type Catalogo, type TabelaGerenciavel, type Vinculo } from '../../domain/catalogo'
import { ordemDeExclusao } from '../../domain/grafo'
import type { ImpressaoDigital, SaldoPrevisto } from '../../domain/previa'
import type { ExecutorConjuntos, Protecao, Semente, SessaoConjuntos } from '../../application/ports/executor-conjuntos'
import type { SnapshotLinha } from '../../application/ports/registro-execucao'
import { rotuloSql } from './rotulo-sql'

/**
 * Executor SQL dos conjuntos-alvo da Danger Zone (research D6–D8).
 *
 * Cada conjunto é uma tabela temporária `ON COMMIT DROP` com as chaves das
 * linhas a apagar (`dz_a_<tabela>`) ou a redirecionar
 * (`dz_r_<filho>__<coluna>`). A coluna `k` tem o **mesmo tipo** da chave da
 * tabela de origem (criada com `CREATE … AS SELECT … WITH NO DATA`), então as
 * comparações usam os índices das FKs sem cast.
 *
 * **Nomes no SQL**: tabelas e colunas vêm só do catálogo — constantes do código
 * —, nunca do cliente, e entram por `sql.identifier`. Valores (chaves
 * selecionadas, ids protegidos) entram sempre como parâmetro.
 */

const LOTE_SNAPSHOT = 500

class RollbackIntencional extends Error {
    constructor(readonly valor: unknown) {
        super('rollback intencional da prévia')
    }
}

type Executor = Pick<Transacao, 'execute'>

const id = (nome: string) => sql.identifier(nome)
const nomeApagar = (tabela: string) => `dz_a_${tabela}`
const nomeRedirecionar = (v: Pick<Vinculo, 'filho' | 'coluna'>) => `dz_r_${v.filho}__${v.coluna}`

function tabela(nome: string): TabelaGerenciavel {
    const t = tabelaDoCatalogo(nome)
    if (!t) throw new Error(`Tabela fora do catálogo: ${nome}`)
    if (t.chavePrimaria.length !== 1) throw new Error(`Chave composta não suportada: ${nome}`)
    return t
}

const pk = (nome: string) => tabela(nome).chavePrimaria[0]

/** Lista de parâmetros `($1, $2, …)`; vazia vira `(NULL)`, que nunca casa. */
function lista(valores: readonly string[]): SQL {
    return valores.length === 0
        ? sql`(null)`
        : sql`(${sql.join(
              valores.map((v) => sql`${v}`),
              sql`, `
          )})`
}

/** Condição "linha protegida" para o alias `f` de `tabela` (FR-018). */
function protegida(nomeTabela: string, protecoes: readonly Protecao[]): SQL {
    const regras = protecoes.filter((p) => p.tabela === nomeTabela)
    if (regras.length === 0) return sql`false`
    return sql.join(
        regras.map((p) => sql`coalesce(${id('f')}.${id(p.coluna)}::text in ${lista(p.valores)}, false)`),
        sql` or `
    )
}

/** Valor que o vínculo histórico recebe: o registro padrão do pai, ou `NULL`. */
function valorRedirecionado(v: Vinculo): string | null {
    return v.obrigatorio ? (REGISTRO_SISTEMA_POR_TABELA[v.pai] ?? null) : null
}

async function linhas<T>(ex: Executor, consulta: SQL): Promise<T[]> {
    const r = await ex.execute(consulta)
    return r.rows as T[]
}

async function afetadas(ex: Executor, consulta: SQL): Promise<number> {
    const r = await ex.execute(consulta)
    return r.rowCount ?? 0
}

/** `INSERT` idempotente dos registros padrão — mesmos valores da migração 0012. */
async function garantirRegistrosPadrao(ex: Executor): Promise<void> {
    await ex.execute(sql`
        insert into "user" ("id", "name", "email", "email_verified", "role", "ativo")
        values (${REGISTROS_SISTEMA.usuario}, 'Usuário removido', 'usuario-removido@sistema.invalid', false, 'usuario', false)
        on conflict ("id") do nothing`)
    await ex.execute(sql`
        insert into "item" ("id", "nome", "categoria", "unidade_medida")
        values (${REGISTROS_SISTEMA.item}::uuid, 'Item removido', 'outros', 'unidade')
        on conflict ("id") do nothing`)
    await ex.execute(sql`
        insert into "atividade_categoria" ("id", "nome")
        values (${REGISTROS_SISTEMA.categoriaAtividade}::uuid, 'Categoria removida')
        on conflict ("id") do nothing`)
}

/**
 * Saldo = Σ entrada − Σ saída − Σ descarte, para os itens dados (research D10).
 * Exportada à parte para o teste de invariância (T024).
 */
export async function recalcularSaldosDeItens(ex: Executor, itemIds: readonly string[]): Promise<SaldoPrevisto[]> {
    if (itemIds.length === 0) return []
    const ids = lista(itemIds)
    const novos = await linhas<{ itemId: string; item: string; saldo: number }>(
        ex,
        sql`
        with soma as (
            select item_id, sum(quantidade) as q from entrada where item_id::text in ${ids} group by item_id
            union all
            select item_id, -sum(quantidade) from saida_item where item_id::text in ${ids} group by item_id
            union all
            select item_id, -sum(quantidade) from descarte where item_id::text in ${ids} group by item_id
        ), total as (
            select i.id as item_id, coalesce(sum(s.q), 0) as q
              from item i left join soma s on s.item_id = i.id
             where i.id::text in ${ids}
             group by i.id
        ), gravado as (
            insert into saldo_estoque (item_id, quantidade_atual, atualizado_em)
            select item_id, q, now() from total
            on conflict (item_id) do update set quantidade_atual = excluded.quantidade_atual, atualizado_em = now()
            returning item_id, quantidade_atual
        )
        select g.item_id::text as "itemId", i.nome as item, g.quantidade_atual::float8 as saldo
          from gravado g join item i on i.id = g.item_id
         order by i.nome`
    )
    return novos.map((n) => ({
        itemId: n.itemId,
        item: n.item,
        atual: Number(n.saldo),
        resultante: Number(n.saldo),
        negativo: Number(n.saldo) < 0
    }))
}

function criarSessao(ex: Executor, catalogo: Catalogo): SessaoConjuntos {
    const historicos = catalogo.vinculos.filter((v) => v.classificacao === 'historico')
    let protecoesAtivas: readonly Protecao[] = []
    /** Linhas em cada `dz_a_<tabela>` — mantido a partir do `rowCount` de cada inserção. */
    const tamanhos = new Map<string, number>()
    const somar = (tabela: string, n: number) => tamanhos.set(tabela, (tamanhos.get(tabela) ?? 0) + n)
    /** Redirecionamentos que podem ter linhas (o descarte só remove, então "talvez"). */
    const redirecionamentosUsados = new Set<string>()
    const comLinhas = (tabela: string) => (tamanhos.get(tabela) ?? 0) > 0

    async function criarConjuntos(): Promise<void> {
        // Um único comando com todos os DDL: sem parâmetros, os nomes vêm do
        // catálogo e são citados aqui. Uma ida ao banco em vez de ~90.
        const citar = (n: string) => `"${n.replaceAll('"', '""')}"`
        const ddl: string[] = []
        for (const t of catalogo.tabelas) {
            const k = citar(pk(t.nome))
            ddl.push(
                `create temp table ${citar(nomeApagar(t.nome))} on commit drop as select ${k} as k from ${citar(t.nome)} with no data`,
                `alter table ${citar(nomeApagar(t.nome))} add primary key (k)`
            )
        }
        for (const v of historicos) {
            const k = citar(pk(v.filho))
            ddl.push(
                `create temp table ${citar(nomeRedirecionar(v))} on commit drop as select ${k} as k from ${citar(v.filho)} with no data`,
                `alter table ${citar(nomeRedirecionar(v))} add primary key (k)`
            )
        }
        await ex.execute(sql.raw(ddl.join(';\n')))
    }

    async function* paginarLinhas(
        nomeTabela: string,
        conjunto: string
    ): AsyncIterable<{ chave: string; linha: Record<string, unknown> }> {
        const chave = id(pk(nomeTabela))
        let ultima: string | null = null
        for (;;) {
            const pagina: Array<Record<string, unknown>> = await linhas<Record<string, unknown>>(
                ex,
                sql`select ${id('f')}.*, ${id('f')}.${chave}::text as "__chave"
                      from ${id(nomeTabela)} ${id('f')}
                      join ${id(conjunto)} ${id('c')} on ${id('c')}.k = ${id('f')}.${chave}
                     where ${ultima === null ? sql`true` : sql`${id('f')}.${chave}::text > ${ultima}`}
                     order by ${id('f')}.${chave}::text
                     limit ${LOTE_SNAPSHOT}`
            )
            for (const { __chave, ...linha } of pagina) yield { chave: String(__chave), linha }
            if (pagina.length < LOTE_SNAPSHOT) return
            ultima = String(pagina[pagina.length - 1].__chave)
        }
    }

    return {
        async travar(tabelas) {
            // Ordem alfabética: duas execuções concorrentes pedem as travas na
            // mesma ordem e não entram em deadlock (research D7).
            for (const t of [...tabelas].sort()) {
                await ex.execute(sql`lock table ${id(t)} in share row exclusive mode`)
            }
        },

        async semear(semente: Semente, protecoes) {
            protecoesAtivas = protecoes
            await criarConjuntos()
            const chave = id(pk(semente.tabela))
            const filtroChaves = semente.chaves ? sql`${id('f')}.${chave}::text in ${lista(semente.chaves)}` : sql`true`
            tamanhos.clear()
            redirecionamentosUsados.clear()
            somar(
                semente.tabela,
                await afetadas(
                    ex,
                    sql`insert into ${id(nomeApagar(semente.tabela))} (k)
                        select ${id('f')}.${chave} from ${id(semente.tabela)} ${id('f')}
                         where ${filtroChaves} and not (${protegida(semente.tabela, protecoes)})`
                )
            )
        },

        tamanho: (tabela) => tamanhos.get(tabela) ?? 0,

        async protegidosNaRaiz(semente, protecoes) {
            const chave = id(pk(semente.tabela))
            const filtroChaves = semente.chaves ? sql`${id('f')}.${chave}::text in ${lista(semente.chaves)}` : sql`true`
            const resultado: Array<{ descricao: string; quantidade: number }> = []
            for (const p of protecoes.filter((x) => x.tabela === semente.tabela)) {
                const [linha] = await linhas<{ n: number }>(
                    ex,
                    sql`select count(*)::int as n from ${id(semente.tabela)} ${id('f')}
                         where ${filtroChaves} and ${protegida(semente.tabela, [p])}`
                )
                resultado.push({ descricao: p.descricao, quantidade: Number(linha?.n ?? 0) })
            }
            return resultado
        },

        async propagarExclusao(v) {
            const novas = await afetadas(
                ex,
                sql`insert into ${id(nomeApagar(v.filho))} (k)
                    select ${id('f')}.${id(pk(v.filho))} from ${id(v.filho)} ${id('f')}
                     where ${id('f')}.${id(v.coluna)} in (select k from ${id(nomeApagar(v.pai))})
                       and not (${protegida(v.filho, protecoesAtivas)})
                    on conflict do nothing`
            )
            somar(v.filho, novas)
            return novas
        },

        async propagarRedirecionamento(v) {
            const novas = await afetadas(
                ex,
                sql`insert into ${id(nomeRedirecionar(v))} (k)
                    select ${id('f')}.${id(pk(v.filho))} from ${id(v.filho)} ${id('f')}
                     where ${id('f')}.${id(v.coluna)} in (select k from ${id(nomeApagar(v.pai))})
                       and ${id('f')}.${id(pk(v.filho))} not in (select k from ${id(nomeApagar(v.filho))})
                    on conflict do nothing`
            )
            if (novas > 0) redirecionamentosUsados.add(nomeRedirecionar(v))
            return novas
        },

        async descartarRedirecionamentosApagados(v) {
            await ex.execute(
                sql`delete from ${id(nomeRedirecionar(v))} where k in (select k from ${id(nomeApagar(v.filho))})`
            )
        },

        async contar() {
            const partes: SQL[] = [
                ...catalogo.tabelas.map(
                    (t) =>
                        sql`select ${t.nome}::text as tabela, null::text as coluna, count(*)::int as n from ${id(nomeApagar(t.nome))}`
                ),
                ...historicos.map(
                    (v) =>
                        sql`select ${v.filho}::text, ${v.coluna}::text, count(*)::int from ${id(nomeRedirecionar(v))}`
                )
            ]
            const rows = await linhas<{ tabela: string; coluna: string | null; n: number }>(
                ex,
                sql.join(partes, sql` union all `)
            )
            const impressao: ImpressaoDigital = {}
            for (const r of rows) {
                const atual = (impressao[r.tabela] ??= { apagar: 0, redirecionar: {} })
                if (r.coluna === null) atual.apagar = Number(r.n)
                else if (Number(r.n) > 0) atual.redirecionar[r.coluna] = Number(r.n)
            }
            return impressao
        },

        async amostrar(nomeTabela, limite) {
            const { expressao, juncao } = rotuloSql(nomeTabela)
            const rows = await linhas<{ rotulo: string }>(
                ex,
                sql`select ${expressao} as rotulo
                      from ${id(nomeTabela)} ${id('f')}
                      join ${id(nomeApagar(nomeTabela))} ${id('c')} on ${id('c')}.k = ${id('f')}.${id(pk(nomeTabela))}
                      ${juncao}
                     limit ${limite}`
            )
            return rows.map((r) => r.rotulo || '(sem rótulo)')
        },

        async saldos() {
            const sentinela = REGISTROS_SISTEMA.item
            const movimento = (nomeTabela: string, sinal: SQL) => {
                const r = id(nomeRedirecionar({ filho: nomeTabela, coluna: 'item_id' }))
                const a = id(nomeApagar(nomeTabela))
                return sql`select case when m.id in (select k from ${r}) then ${sentinela}::uuid else m.item_id end as item_id,
                                  m.item_id as original,
                                  ${sinal} * m.quantidade as q,
                                  m.id in (select k from ${a}) as apagada,
                                  m.id in (select k from ${r}) as redirecionada
                             from ${id(nomeTabela)} m`
            }
            const rows = await linhas<{ itemId: string; item: string; atual: number; resultante: number }>(
                ex,
                sql`
                with mov as (
                    ${movimento('entrada', sql`1`)}
                    union all ${movimento('saida_item', sql`-1`)}
                    union all ${movimento('descarte', sql`-1`)}
                ), afetados as (
                    select original as item_id from mov where apagada or redirecionada
                    union
                    select ${sentinela}::uuid where exists (select 1 from mov where redirecionada)
                ), soma as (
                    select item_id, sum(q) filter (where not apagada) as total from mov group by item_id
                )
                select a.item_id::text as "itemId", i.nome as item,
                       coalesce(s.quantidade_atual, 0)::float8 as atual,
                       coalesce(soma.total, 0)::float8 as resultante
                  from afetados a
                  join item i on i.id = a.item_id
                  left join saldo_estoque s on s.item_id = a.item_id
                  left join soma on soma.item_id = a.item_id
                 where a.item_id not in (select k from ${id(nomeApagar('item'))})
                 order by i.nome`
            )
            return rows.map((r) => ({
                itemId: r.itemId,
                item: r.item,
                atual: Number(r.atual),
                resultante: Number(r.resultante),
                negativo: Number(r.resultante) < 0
            }))
        },

        async idsParaInvalidar() {
            const atividades = await linhas<{ id: string }>(
                ex,
                sql`select k::text as id from ${id(nomeApagar('atividade'))}
                    union
                    select t.atividade_id::text from turno t
                     where t.id in (select k from ${id(nomeApagar('turno'))})
                        or t.id in (select a.turno_id from alocacao a
                                     where a.id in (select k from ${id(nomeApagar('alocacao'))})
                                        or a.id in (select k from ${id(nomeRedirecionar({ filho: 'alocacao', coluna: 'participante_user_id' }))})
                                        or a.id in (select k from ${id(nomeRedirecionar({ filho: 'alocacao', coluna: 'alocado_por' }))}))`
            )
            const usuarios = await linhas<{ id: string }>(ex, sql`select k::text as id from ${id(nomeApagar('user'))}`)
            return { atividades: atividades.map((r) => r.id), usuarios: usuarios.map((r) => r.id) }
        },

        async administradoresRestantes() {
            const [linha] = await linhas<{ n: number }>(
                ex,
                sql`select count(*)::int as n from "user"
                     where role = 'administrador' and ativo
                       and id not in (select k from ${id(nomeApagar('user'))})`
            )
            return Number(linha?.n ?? 0)
        },

        async *linhasAfetadas(): AsyncIterable<SnapshotLinha> {
            for (const t of catalogo.tabelas.filter((x) => comLinhas(x.nome))) {
                for await (const { chave, linha } of paginarLinhas(t.nome, nomeApagar(t.nome))) {
                    yield {
                        tabela: t.nome,
                        chave,
                        acao: 'delete',
                        antes: linha,
                        depois: null,
                        colunasOmitidas: t.colunasCredencial
                    }
                }
            }
            for (const v of historicos.filter((x) => redirecionamentosUsados.has(nomeRedirecionar(x)))) {
                const novo = valorRedirecionado(v)
                for await (const { chave, linha } of paginarLinhas(v.filho, nomeRedirecionar(v))) {
                    yield {
                        tabela: v.filho,
                        chave,
                        acao: 'update',
                        antes: linha,
                        depois: { [v.coluna]: novo },
                        colunasOmitidas: tabela(v.filho).colunasCredencial
                    }
                }
            }
        },

        async aplicar(vinculos) {
            await garantirRegistrosPadrao(ex)
            const reais: ImpressaoDigital = {}
            const de = (t: string) => (reais[t] ??= { apagar: 0, redirecionar: {} })

            // 1. Redireciona antes de apagar: quando o pai sumir, o filho
            //    histórico já não aponta para ele e o ON DELETE CASCADE físico
            //    não tem o que levar junto (FR-013).
            for (const v of vinculos.filter((x) => redirecionamentosUsados.has(nomeRedirecionar(x)))) {
                const n = await afetadas(
                    ex,
                    sql`update ${id(v.filho)} set ${id(v.coluna)} = ${valorRedirecionado(v)}
                         where ${id(pk(v.filho))} in (select k from ${id(nomeRedirecionar(v))})`
                )
                if (n > 0) de(v.filho).redirecionar[v.coluna] = n
            }

            // 2. Apaga filhos antes dos pais — atravessa `restrict`/`no action`.
            const ordem = ordemDeExclusao(
                catalogo.tabelas.map((t) => t.nome),
                catalogo.vinculos
            )
            for (const t of ordem.filter(comLinhas)) {
                const n = await afetadas(
                    ex,
                    sql`delete from ${id(t)} where ${id(pk(t))} in (select k from ${id(nomeApagar(t))})`
                )
                if (n > 0) de(t).apagar = n
            }
            return reais
        },

        recalcularSaldos: (itemIds) => recalcularSaldosDeItens(ex, itemIds)
    }
}

export function criarExecutorConjuntos(catalogo: Catalogo = CATALOGO): ExecutorConjuntos {
    return {
        async emTransacao(fn, { confirmar }) {
            try {
                return await db.transaction(async (tx) => {
                    const resultado = await fn(criarSessao(tx, catalogo))
                    // A prévia nunca grava nada: o rollback leva as tabelas
                    // temporárias junto.
                    if (!confirmar) throw new RollbackIntencional(resultado)
                    return resultado
                })
            } catch (erro) {
                if (erro instanceof RollbackIntencional) return erro.valor as Awaited<ReturnType<typeof fn>>
                throw erro
            }
        }
    }
}
