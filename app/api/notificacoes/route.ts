/**
 * Leitura periódica do sino (012-notificacoes-tempo-real).
 *
 * Ponto de entrada apenas — a implementação vive em
 * `src/modules/notificacoes/presentation/http/`, que é o módulo dono do dado
 * (Princípio I) e o único lugar que o `vitest` enxerga para o teste de contrato.
 */
export { lerNotificacoesDaSessao as GET } from '@/src/modules/notificacoes/presentation/http/leitura-notificacoes'
