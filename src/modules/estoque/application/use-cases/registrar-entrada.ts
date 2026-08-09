import { DomainError, ok, type Result, type UseCase } from '@/src/shared/kernel'
import { withAudit } from '@/src/modules/auditoria'
import { validarEntrada, type DadosEntrada } from '../../domain/entrada'
import type { EntradaRepository } from '../ports/estoque-repository'

export type EntradaRegistrarEntrada = DadosEntrada & { registradoPor: string }

/**
 * BR-EST-01 / DESIGN.md §9.1 — registra a doação recebida.
 *
 * Cria `entrada` e incrementa `saldo_estoque` na mesma transação (a atomicidade
 * fica no repositório, que é quem tem a transação). A destinação a kit é
 * **apenas informativa**: o item entra no saldo geral e pode sair avulso.
 */
export class RegistrarEntradaUseCase implements UseCase<
    EntradaRegistrarEntrada,
    { entradaId: string; itemId: string }
> {
    constructor(private readonly entradas: EntradaRepository) {}

    async executar(
        entrada: EntradaRegistrarEntrada
    ): Promise<Result<{ entradaId: string; itemId: string }, DomainError>> {
        const validacao = validarEntrada(entrada)
        if (!validacao.ok) return validacao

        const registrada = await withAudit(
            {
                entidade: 'Doacao',
                acao: 'create',
                tabela: 'entrada',
                extrair: (resultado) => ({
                    entidadeId: resultado.entradaId,
                    dadosNovos: {
                        ...validacao.valor,
                        itemId: resultado.itemId,
                        registradoPor: entrada.registradoPor
                    }
                })
            },
            () =>
                this.entradas.registrar({
                    ...validacao.valor,
                    registradoPor: entrada.registradoPor
                })
        )

        return ok(registrada)
    }
}
