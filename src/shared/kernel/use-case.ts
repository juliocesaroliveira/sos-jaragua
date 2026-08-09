import type { DomainError, Result } from './result'

/**
 * Contrato de caso de uso (DESIGN.md §4/§5): uma transação de negócio por
 * classe, entrada e saída explícitas, sempre devolvendo `Result` em vez de
 * lançar exceções de negócio.
 */
export interface UseCase<TEntrada, TSaida, TErro = DomainError> {
    executar(entrada: TEntrada): Promise<Result<TSaida, TErro>>
}
