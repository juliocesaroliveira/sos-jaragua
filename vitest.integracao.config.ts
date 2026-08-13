import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Carrega `.env.local` no processo de teste — o cliente Drizzle exige
 * `DATABASE_URL` já no import do módulo, e o Vitest não lê `.env.local`
 * sozinho. `loadEnvFile` é nativo do Node, então não adiciona dependência.
 */
try {
    process.loadEnvFile('.env.local')
} catch {
    // Sem `.env.local` (ex.: CI), as variáveis vêm do ambiente.
}

/**
 * Testes de integração (TEST-04, TEST-05) — rodam contra o banco Neon de
 * desenvolvimento (DESIGN.md §18).
 *
 * `fileParallelism: false`: os testes competem pelas mesmas linhas de
 * `saldo_estoque` e rodá-los em paralelo produziria falhas intermitentes que
 * não têm nada a ver com o código sob teste.
 */
export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./', import.meta.url)),
            'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url))
        }
    },
    test: {
        environment: 'node',
        globals: false,
        include: ['src/**/*.integracao.test.ts'],
        fileParallelism: false,
        // Conexão com o Neon (e cold start do compute) é mais lenta que o
        // default de 5s.
        testTimeout: 45_000,
        hookTimeout: 45_000
    }
})
