import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from './client'
import { ordemAlfabetica } from './ordenacao'

/**
 * A collation `pt-BR-x-icu` só existe se o Postgres foi compilado com ICU. Se
 * um banco novo não a tiver, toda listagem ordenada por nome quebra com
 * `collation "pt-BR-x-icu" does not exist` — este teste denuncia isso antes.
 */
describe('ordemAlfabetica', () => {
    it('ordena como o português: caixa e acento não empurram nomes para o fim', async () => {
        const nomes = sql`(values ('Zona'), ('teste'), ('Água'), ('Teste B'), ('abrigo')) as t(nome)`
        const coluna = sql`nome`

        const linhas = await db
            .select({ nome: sql<string>`nome` })
            .from(nomes)
            .orderBy(ordemAlfabetica(coluna))

        const ordenados = linhas.map((l) => l.nome)
        expect(ordenados).toEqual(['abrigo', 'Água', 'teste', 'Teste B', 'Zona'])
        expect(ordenados).toEqual([...ordenados].sort((a, b) => a.localeCompare(b, 'pt-BR')))
    })
})
