import { asc, sql, type AnyColumn, type SQL } from 'drizzle-orm'

/**
 * Ordem alfabética do português para colunas de texto exibidas ao usuário.
 *
 * O banco usa a collation `C.UTF-8` (ordem de bytes): maiúsculas vêm antes de
 * minúsculas e letras acentuadas depois do "z" — "teste" depois de "Zona",
 * "Água" no fim da lista. A collation ICU `pt-BR-x-icu` ordena como uma pessoa
 * espera, e acompanha `localeCompare(…, 'pt-BR')` no JavaScript.
 *
 * Só para ORDER BY: índices e comparações de igualdade continuam na collation
 * do banco. Para SQL escrito à mão, use `COLLATE_PT_BR`.
 */
export const COLLATE_PT_BR = sql.raw('collate "pt-BR-x-icu"')

export function ordemAlfabetica(coluna: AnyColumn | SQL): SQL {
    return asc(sql`${coluna} ${COLLATE_PT_BR}`)
}
