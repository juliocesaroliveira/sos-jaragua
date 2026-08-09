import { DomainError, ValidacaoError, falha, ok, type Result, type UseCase } from '@/src/shared/kernel'
import { ABREVIACAO_UNIDADE } from '../../domain/item'
import { ehQuantidadePositiva, formatarQuantidade } from '../../domain/quantidade'
import type { DescarteRepository } from '../ports/estoque-repository'

export type EntradaRegistrarDescarte = {
    itemId: string
    quantidade: number
    motivo?: string | null
    registradoPor: string
}

/**
 * BR-EST-05 / DESIGN.md §9.4 — baixa por descarte.
 *
 * Deduz o saldo como uma saída, mas grava em tabela **dedicada**: é o que
 * mantém o descarte estruturalmente fora dos relatórios de "itens entregues à
 * população", sem depender de um filtro que um relatório futuro possa esquecer.
 */
export class RegistrarDescarteUseCase implements UseCase<EntradaRegistrarDescarte, { descarteId: string }> {
    constructor(private readonly descartes: DescarteRepository) {}

    async executar(entrada: EntradaRegistrarDescarte): Promise<Result<{ descarteId: string }, DomainError>> {
        if (!entrada.itemId) {
            return falha(new ValidacaoError('Selecione o item.', { campos: { itemId: 'Informe o item.' } }))
        }

        if (!ehQuantidadePositiva(entrada.quantidade)) {
            return falha(
                new ValidacaoError('A quantidade deve ser maior que zero.', {
                    campos: { quantidade: 'Quantidade inválida.' }
                })
            )
        }

        const resultado = await this.descartes.registrar(entrada)

        if ('deficits' in resultado) {
            const d = resultado.deficits[0]
            return falha(
                new DomainError(
                    'descarte_bloqueado',
                    d
                        ? `Descarte bloqueado. O saldo de ${d.nome} é de ${formatarQuantidade(d.disponivel)} ${ABREVIACAO_UNIDADE[d.unidadeMedida]}.`
                        : 'Descarte bloqueado. Saldo insuficiente.',
                    { deficits: resultado.deficits }
                )
            )
        }

        return ok(resultado)
    }
}
