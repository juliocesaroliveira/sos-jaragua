/**
 * Barrel do schema Postgres — consumido por `drizzle.config.ts` (geração de
 * migrations) e pelo cliente runtime (`src/shared/db/postgres/client.ts`).
 *
 * O schema físico é centralizado aqui porque o drizzle-kit exige um único ponto
 * de entrada com o schema completo. O isolamento de módulo é preservado no
 * código de acesso: cada `infrastructure/` importa apenas a fatia do seu
 * próprio módulo (DESIGN.md §5).
 */
export * from './identidade'
export * from './voluntariado'
export * from './estoque'
export * from './logistica'
export * from './notificacoes'
