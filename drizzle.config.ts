import { defineConfig } from 'drizzle-kit'

/**
 * Configuração do drizzle-kit (DB_SCHEMA.md §11).
 *
 * Usa `DATABASE_URL_UNPOOLED` (conexão direta): o pooler do Neon opera em modo
 * transação e não suporta bem as operações de sessão exigidas por migrations.
 * O runtime da aplicação usa a conexão pooled (`DATABASE_URL`) — ver
 * `src/shared/db/postgres/client.ts`.
 */
export default defineConfig({
    dialect: 'postgresql',
    schema: './db/schema/index.ts',
    out: './db/migrations',
    casing: 'snake_case',
    dbCredentials: {
        url: process.env.DATABASE_URL_UNPOOLED!
    },
    verbose: true,
    strict: true
})
