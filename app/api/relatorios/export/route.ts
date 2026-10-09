/**
 * Exportação de relatórios da central (BR-REL-01, specs/023-central-relatorios).
 *
 * Ponto de entrada apenas — a implementação vive em
 * `src/modules/contingencia/presentation/http/`, que é o módulo dono
 * (Princípio I) e o único lugar que o `vitest` enxerga para o teste de
 * contrato e de autorização.
 */
export { exportarRelatorio as GET } from '@/src/modules/contingencia/presentation/http/exportar-relatorio'
