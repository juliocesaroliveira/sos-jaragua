import { relations, sql } from 'drizzle-orm'
import { boolean, date, index, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { user } from './identidade'

/**
 * Módulo Estoque/Doações (DB_SCHEMA.md §6).
 *
 * Modelo **ledger + saldo materializado**: `entrada`, `saida_item` e `descarte`
 * são linhas imutáveis de movimento; `saldo_estoque` é o read-model atualizado
 * na mesma transação de cada movimento — é o que sustenta o NFR de leitura
 * <300ms sem reagregar o ledger.
 */

// -- Enums (listas fechadas do BRD §4.1) --------------------------------------

export const categoriaItemEnum = pgEnum('categoria_item', [
    'agua',
    'alimentacao',
    'higiene',
    'limpeza',
    'acomodacao',
    'materiais_construcao',
    'vestuario',
    'outros'
])

export const unidadeMedidaEnum = pgEnum('unidade_medida', ['unidade', 'kg', 'litro', 'fardo', 'caixa'])

export const condicaoItemEnum = pgEnum('condicao_item', ['novo', 'usado_bom_estado', 'necessita_higienizacao'])

export const tipoSaidaEnum = pgEnum('tipo_saida', ['avulso', 'kit'])

/** Quantidades são decimais (kg/litro) — nunca inteiros. */
const quantidade = () => numeric({ precision: 14, scale: 3 })

// -- Item e saldo (DB_SCHEMA.md §6.1, §6.6) -----------------------------------

export const item = pgTable(
    'item',
    {
        id: uuid().primaryKey().defaultRandom(),
        nome: text().notNull(),
        categoria: categoriaItemEnum().notNull(),
        unidadeMedida: unidadeMedidaEnum().notNull(),
        criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow()
    },
    (t) => [
        // Índice trigram para o autocomplete-dedup da Entrada (BR-EST-01).
        // A extensão `pg_trgm` é criada por um statement manual na migration.
        index('item_nome_trgm_idx').using('gin', sql`${t.nome} gin_trgm_ops`),
        index('item_categoria_idx').on(t.categoria)
    ]
)

export const saldoEstoque = pgTable('saldo_estoque', {
    itemId: uuid()
        .primaryKey()
        .references(() => item.id, { onDelete: 'cascade' }),
    quantidadeAtual: quantidade().notNull().default('0'),
    atualizadoEm: timestamp({ withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date())
})

// -- Kits e receitas (DB_SCHEMA.md §6.3) --------------------------------------

export const kit = pgTable('kit', {
    id: uuid().primaryKey().defaultRandom(),
    nome: text().notNull(),
    descricao: text(),
    ativo: boolean().notNull().default(true),
    criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp({ withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date())
})

export const kitReceitaItem = pgTable(
    'kit_receita_item',
    {
        id: uuid().primaryKey().defaultRandom(),
        kitId: uuid()
            .notNull()
            .references(() => kit.id, { onDelete: 'cascade' }),
        itemId: uuid()
            .notNull()
            .references(() => item.id, { onDelete: 'restrict' }),
        /** Quantidade do item por **uma** unidade de kit. */
        quantidade: quantidade().notNull()
    },
    (t) => [uniqueIndex('kit_receita_item_unico_idx').on(t.kitId, t.itemId)]
)

// -- Entrada (DB_SCHEMA.md §6.2) ----------------------------------------------

export const entrada = pgTable(
    'entrada',
    {
        id: uuid().primaryKey().defaultRandom(),
        itemId: uuid()
            .notNull()
            .references(() => item.id, { onDelete: 'restrict' }),
        quantidade: quantidade().notNull(),
        condicao: condicaoItemEnum().notNull(),
        perecivel: boolean().notNull(),
        /** Obrigatória e não-retroativa quando `perecivel` — validado no `domain`. */
        dataValidade: date(),
        /**
         * Destinação informativa (decisão confirmada, DESIGN.md §9.1): não
         * reserva saldo — o item entra no saldo geral e pode sair avulso.
         */
        kitDestinoId: uuid().references(() => kit.id, { onDelete: 'set null' }),
        registradoPor: text()
            .notNull()
            .references(() => user.id),
        criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow()
    },
    (t) => [index('entrada_item_criado_idx').on(t.itemId, t.criadoEm)]
)

// -- Saída (DB_SCHEMA.md §6.4) ------------------------------------------------

export const saida = pgTable(
    'saida',
    {
        id: uuid().primaryKey().defaultRandom(),
        tipo: tipoSaidaEnum().notNull(),
        destino: text().notNull(),
        responsavelTransporte: text().notNull(),
        registradoPor: text()
            .notNull()
            .references(() => user.id),
        criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow()
    },
    (t) => [index('saida_criado_idx').on(t.criadoEm)]
)

export const saidaItem = pgTable(
    'saida_item',
    {
        id: uuid().primaryKey().defaultRandom(),
        saidaId: uuid()
            .notNull()
            .references(() => saida.id, { onDelete: 'cascade' }),
        itemId: uuid()
            .notNull()
            .references(() => item.id, { onDelete: 'restrict' }),
        /** Quantidade efetivamente deduzida do saldo. */
        quantidade: quantidade().notNull()
    },
    (t) => [index('saida_item_item_idx').on(t.itemId)]
)

// -- Descarte (DB_SCHEMA.md §6.5) ---------------------------------------------

/**
 * Tabela dedicada, nunca uma flag em `saida` (BR-EST-05, DESIGN.md §9.4):
 * garante exclusão **estrutural** dos relatórios de "itens entregues à
 * população", sem depender de um filtro que um relatório futuro possa esquecer.
 */
export const descarte = pgTable(
    'descarte',
    {
        id: uuid().primaryKey().defaultRandom(),
        itemId: uuid()
            .notNull()
            .references(() => item.id, { onDelete: 'restrict' }),
        quantidade: quantidade().notNull(),
        motivo: text(),
        registradoPor: text()
            .notNull()
            .references(() => user.id),
        criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow()
    },
    (t) => [index('descarte_item_criado_idx').on(t.itemId, t.criadoEm)]
)

// -- Relations ----------------------------------------------------------------

export const itemRelations = relations(item, ({ one, many }) => ({
    saldo: one(saldoEstoque, { fields: [item.id], references: [saldoEstoque.itemId] }),
    entradas: many(entrada),
    saidaItens: many(saidaItem),
    descartes: many(descarte),
    receitas: many(kitReceitaItem)
}))

export const saldoEstoqueRelations = relations(saldoEstoque, ({ one }) => ({
    item: one(item, { fields: [saldoEstoque.itemId], references: [item.id] })
}))

export const kitRelations = relations(kit, ({ many }) => ({
    receita: many(kitReceitaItem)
}))

export const kitReceitaItemRelations = relations(kitReceitaItem, ({ one }) => ({
    kit: one(kit, { fields: [kitReceitaItem.kitId], references: [kit.id] }),
    item: one(item, { fields: [kitReceitaItem.itemId], references: [item.id] })
}))

export const entradaRelations = relations(entrada, ({ one }) => ({
    item: one(item, { fields: [entrada.itemId], references: [item.id] }),
    kitDestino: one(kit, { fields: [entrada.kitDestinoId], references: [kit.id] })
}))

export const saidaRelations = relations(saida, ({ many }) => ({
    itens: many(saidaItem)
}))

export const saidaItemRelations = relations(saidaItem, ({ one }) => ({
    saida: one(saida, { fields: [saidaItem.saidaId], references: [saida.id] }),
    item: one(item, { fields: [saidaItem.itemId], references: [item.id] })
}))

export const descarteRelations = relations(descarte, ({ one }) => ({
    item: one(item, { fields: [descarte.itemId], references: [item.id] })
}))
