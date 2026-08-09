import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Configuração do Vitest (TEST-01, DESIGN.md §18).
 *
 * Dois projetos separados por um motivo prático: os testes de `domain` e
 * `application` são puros e rodam em milissegundos, enquanto os de integração
 * abrem conexão com o Neon. Manter os dois no mesmo comando faria o retorno
 * rápido — o que se roda a cada save — depender de rede.
 *
 * - `npm test`            → só os unitários (sem rede)
 * - `npm run test:integracao` → os que tocam o banco
 */
export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./', import.meta.url)),
            // `server-only` é resolvido pelo bundler do Next e lança fora dele.
            'server-only': fileURLToPath(new URL('./test/stubs/server-only.ts', import.meta.url))
        }
    },
    test: {
        environment: 'node',
        globals: false,
        include: ['src/**/*.test.ts'],
        exclude: ['**/node_modules/**', 'src/**/*.integracao.test.ts']
    }
})
