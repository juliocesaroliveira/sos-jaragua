import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from '@/db/schema'

if (!process.env.DATABASE_URL) {
    throw new Error('Variável de ambiente ausente/inválida: "DATABASE_URL"')
}

/**
 * O transporte HTTP do driver Neon não suporta transações multi-statement, e
 * `RegistrarSaidaUseCase` depende de `SELECT ... FOR UPDATE` + escrita na mesma
 * transação (DESIGN.md §9.3). Por isso usamos o transporte WebSocket (`Pool`).
 * Node 22+ expõe `WebSocket` globalmente; o guard cobre runtimes que não o têm.
 */
if (typeof WebSocket !== 'undefined') {
    neonConfig.webSocketConstructor = WebSocket
}

const globalParaPg = global as typeof globalThis & { _pgPool?: Pool }

// Em desenvolvimento, preserva o pool entre reloads de módulo do HMR — mesmo
// racional do cliente Mongo em `src/shared/db/mongo/client.ts`.
const pool =
    process.env.NODE_ENV === 'development'
        ? (globalParaPg._pgPool ??= new Pool({ connectionString: process.env.DATABASE_URL }))
        : new Pool({ connectionString: process.env.DATABASE_URL })

/**
 * Cliente Drizzle de runtime, sobre a conexão **pooled** (`DATABASE_URL`).
 * Migrations usam a conexão direta via `drizzle.config.ts` (DB_SCHEMA.md §11).
 */
export const db = drizzle({ client: pool, schema, casing: 'snake_case' })

export type Database = typeof db
/** Handle de transação — o tipo recebido pelo callback de `db.transaction()`. */
export type Transacao = Parameters<Parameters<typeof db.transaction>[0]>[0]
