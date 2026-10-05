/**
 * Escapa os curingas do `LIKE`/`ILIKE` do Postgres (021, contracts L-04).
 *
 * O termo digitado vai para o banco como parâmetro (sem risco de injeção), mas
 * `%` e `_` continuam sendo curingas dentro do padrão: sem o escape, buscar
 * "50%" listaria tudo que começa com "50". A consulta declara `escape '\'`, por
 * isso a própria barra é escapada primeiro — senão ela anularia os escapes
 * seguintes.
 */
export function escaparLike(termo: string): string {
    return termo.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}
