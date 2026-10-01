import {
    DomainError,
    NaoEncontradoError,
    ValidacaoError,
    falha,
    ok,
    type Result,
    type UseCase
} from '@/src/shared/kernel'
import { withAudit } from '@/src/modules/auditoria'
import { validarEstoqueMinimo } from '../../domain/estoque-minimo'
import type { ItemRepository } from '../ports/estoque-repository'

export type EntradaDefinirEstoqueMinimo = {
    itemId: string
    /** `null` volta a herdar o padrão global. */
    estoqueMinimo: number | null
}

/**
 * Define, altera ou limpa o mínimo de segurança de um item existente
 * (specs/020-resolver-pendencias, Q3 / I1; DESIGN.md §19).
 *
 * Escrita em Estoque, então auditada (Constituição, Princípio V). O
 * `dadosAnteriores` guarda só o mínimo, que é o único campo alterado.
 */
export class DefinirEstoqueMinimoUseCase implements UseCase<EntradaDefinirEstoqueMinimo, EntradaDefinirEstoqueMinimo> {
    constructor(private readonly itens: ItemRepository) {}

    async executar(entrada: EntradaDefinirEstoqueMinimo): Promise<Result<EntradaDefinirEstoqueMinimo, DomainError>> {
        const erro = validarEstoqueMinimo(entrada.estoqueMinimo)
        if (erro) {
            return falha(new ValidacaoError('Revise os campos destacados.', { campos: { estoqueMinimo: erro } }))
        }

        const anterior = await this.itens.buscarPorId(entrada.itemId)
        if (!anterior) return falha(new NaoEncontradoError('Item não encontrado.'))

        await withAudit(
            {
                entidade: 'Doacao',
                acao: 'update',
                tabela: 'item',
                dadosAnteriores: async () => ({ estoqueMinimo: anterior.estoqueMinimo }),
                extrair: () => ({
                    entidadeId: entrada.itemId,
                    dadosNovos: { estoqueMinimo: entrada.estoqueMinimo }
                })
            },
            () => this.itens.definirEstoqueMinimo(entrada.itemId, entrada.estoqueMinimo)
        )

        return ok({ itemId: entrada.itemId, estoqueMinimo: entrada.estoqueMinimo })
    }
}
