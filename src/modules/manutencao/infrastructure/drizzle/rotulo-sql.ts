import 'server-only'
import { sql, type SQL } from 'drizzle-orm'
import { tabelaDoCatalogo } from '../../domain/catalogo'

/**
 * Rótulo legível de uma linha (`rotuloRegistro` do catálogo) como expressão
 * SQL sobre o alias `f`, com a junção ao pai quando o rótulo é herdado.
 * Compartilhado pela amostra da prévia e pela listagem de registros, para que
 * a mesma linha tenha o mesmo nome nas duas telas.
 */
export function rotuloSql(nomeTabela: string): { expressao: SQL; juncao: SQL } {
    const tabela = tabelaDoCatalogo(nomeTabela)
    if (!tabela) throw new Error(`Tabela fora do catálogo: ${nomeTabela}`)

    const partes: SQL[] = []
    let juncao = sql``
    const pai = tabela.rotuloRegistro.pai
    if (pai) {
        const pkPai = tabelaDoCatalogo(pai.tabela)!.chavePrimaria[0]
        juncao = sql`left join ${sql.identifier(pai.tabela)} p on p.${sql.identifier(pkPai)} = f.${sql.identifier(pai.coluna)}`
        partes.push(sql`p.${sql.identifier(pai.colunaRotulo)}::text`)
    }
    for (const c of tabela.rotuloRegistro.colunas) partes.push(sql`f.${sql.identifier(c)}::text`)
    return { expressao: sql`concat_ws(' · ', ${sql.join(partes, sql`, `)})`, juncao }
}
