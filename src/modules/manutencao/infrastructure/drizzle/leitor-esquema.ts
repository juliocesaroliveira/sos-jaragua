import 'server-only'
import { sql, type SQL } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { REGISTRO_SISTEMA_POR_TABELA } from '@/src/shared/kernel/registros-sistema'
import type { RegraBanco } from '../../domain/catalogo'
import { tabelaDoCatalogo } from '../../domain/catalogo'
import type { FkFisica } from '../../domain/conferir-catalogo'
import type { ContagemTabela, LeitorEsquema } from '../../application/ports/leitor-esquema'
import { COLLATE_PT_BR } from '@/src/shared/db/postgres'
import { escaparLike } from '@/src/shared/busca/escapar-like'
import { rotuloSql } from './rotulo-sql'

/** `pg_constraint.confdeltype` → regra legível. `d` (set default) não existe no schema. */
const REGRA: Record<string, RegraBanco> = { a: 'no action', r: 'restrict', c: 'cascade', n: 'set null' }

type LinhaFk = { filho: string; coluna: string; pai: string; regra: string; obrigatorio: boolean }

/**
 * Leitura do schema real (research D2). Fora de transação: é usada pelo
 * inventário e, antes de toda prévia, pela conferência do catálogo.
 */
export function criarLeitorEsquema(): LeitorEsquema {
    return {
        async fksFisicas(): Promise<FkFisica[]> {
            const { rows } = await db.execute<LinhaFk>(sql`
                select filho.relname as filho,
                       coluna.attname as coluna,
                       pai.relname as pai,
                       c.confdeltype as regra,
                       coluna.attnotnull as obrigatorio
                  from pg_constraint c
                  join pg_class filho on filho.oid = c.conrelid
                  join pg_namespace ns on ns.oid = filho.relnamespace
                  join pg_class pai on pai.oid = c.confrelid
                  join pg_attribute coluna on coluna.attrelid = c.conrelid and coluna.attnum = c.conkey[1]
                 where c.contype = 'f' and ns.nspname = 'public'
            `)
            return rows.map((r) => ({
                filho: r.filho,
                coluna: r.coluna,
                pai: r.pai,
                // Regra desconhecida vira `set default`-like inexistente no
                // catálogo e por isso diverge — o que bloqueia, como deve.
                regraBanco: REGRA[r.regra] ?? (`desconhecida:${r.regra}` as RegraBanco),
                obrigatorio: r.obrigatorio
            }))
        },

        async contagens(tabelas: readonly string[]): Promise<Record<string, ContagemTabela>> {
            const partes: SQL[] = tabelas.map((nome) => {
                const tabela = tabelaDoCatalogo(nome)
                if (!tabela) throw new Error(`Tabela fora do catálogo: ${nome}`)
                const pk = sql.identifier(tabela.chavePrimaria[0])
                const sentinela = REGISTRO_SISTEMA_POR_TABELA[nome]
                const ehSistema = sentinela ? sql`${pk}::text = ${sentinela}` : sql`false`
                return sql`select ${nome}::text as tabela,
                                  count(*) filter (where not (${ehSistema}))::int as registros,
                                  count(*) filter (where ${ehSistema})::int as sistema
                             from ${sql.identifier(nome)}`
            })
            const { rows } = await db.execute<{ tabela: string; registros: number; sistema: number }>(
                sql.join(partes, sql` union all `)
            )
            return Object.fromEntries(
                rows.map((r) => [r.tabela, { registros: Number(r.registros), registrosSistema: Number(r.sistema) }])
            )
        },

        async listarRegistros(nome, { page, pageSize, busca }) {
            const tabela = tabelaDoCatalogo(nome)
            if (!tabela) throw new Error(`Tabela fora do catálogo: ${nome}`)
            const pk = sql.identifier(tabela.chavePrimaria[0])
            const { expressao, juncao } = rotuloSql(nome)
            // Só as colunas exibíveis — credenciais nunca saem do banco por aqui.
            const colunas = tabela.colunasExibidas.filter((c) => !tabela.colunasCredencial.includes(c))
            const selecao = colunas.length
                ? sql.join(
                      colunas.map((c) => sql`f.${sql.identifier(c)}::text as ${sql.identifier(c)}`),
                      sql`, `
                  )
                : sql`null`
            const filtro = busca ? sql`${expressao} ilike '%' || ${escaparLike(busca)} || '%' escape '\\'` : sql`true`

            const [{ rows }, { rows: total }] = await Promise.all([
                db.execute<Record<string, string | null>>(sql`
                    select f.${pk}::text as "__chave", ${expressao} as "__rotulo", ${selecao}
                      from ${sql.identifier(nome)} f ${juncao}
                     where ${filtro}
                     order by ${expressao} ${COLLATE_PT_BR}, f.${pk}::text
                     limit ${pageSize} offset ${(page - 1) * pageSize}`),
                db.execute<{ n: number }>(sql`
                    select count(*)::int as n from ${sql.identifier(nome)} f ${juncao} where ${filtro}`)
            ])

            return {
                linhas: rows.map(({ __chave, __rotulo, ...valores }) => ({
                    chave: String(__chave),
                    rotulo: __rotulo || '(sem rótulo)',
                    valores
                })),
                total: Number(total[0]?.n ?? 0)
            }
        }
    }
}
