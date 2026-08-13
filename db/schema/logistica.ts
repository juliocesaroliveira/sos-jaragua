import { relations } from 'drizzle-orm'
import { index, integer, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from './identidade'
import { kit } from './estoque'

/** Módulo Logística/Inteligência (DB_SCHEMA.md §7). */

export const baseDemandaEnum = pgEnum('base_demanda', ['por_familia', 'por_pessoa_desabrigada'])

/**
 * `crise_variaveis` é **append-only**: cada atualização insere uma nova linha e
 * a mais recente (`atualizadoEm` mais alto) é o valor vigente. O histórico sai
 * de graça, sem tabela de auditoria dedicada para esta entidade.
 */
export const criseVariaveis = pgTable(
    'crise_variaveis',
    {
        id: uuid().primaryKey().defaultRandom(),
        totalFamiliasAfetadas: integer().notNull(),
        totalPessoasAfetadas: integer().notNull(),
        atualizadoPor: text()
            .notNull()
            .references(() => user.id),
        atualizadoEm: timestamp({ withTimezone: true }).notNull().defaultNow()
    },
    (t) => [index('crise_variaveis_atualizado_idx').on(t.atualizadoEm)]
)

/** Proporção usada no cálculo de demanda de kits (BR-INT-01). */
export const metricaKit = pgTable('metrica_kit', {
    id: uuid().primaryKey().defaultRandom(),
    kitId: uuid()
        .notNull()
        .unique()
        .references(() => kit.id, { onDelete: 'cascade' }),
    baseDemanda: baseDemandaEnum().notNull(),
    /** Ex.: `1` = um kit por família/pessoa. */
    proporcao: numeric({ precision: 10, scale: 3 }).notNull()
})

export const metricaKitRelations = relations(metricaKit, ({ one }) => ({
    kit: one(kit, { fields: [metricaKit.kitId], references: [kit.id] })
}))
