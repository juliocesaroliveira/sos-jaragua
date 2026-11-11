import { falha, ok, type DomainError, type Result } from '@/src/shared/kernel'
import { CATALOGO, type Catalogo } from '../../domain/catalogo'
import type { Ambiente, PedidoAcao, Previa } from '../../domain/previa'
import type { ExecutorConjuntos } from '../ports/executor-conjuntos'
import type { LeitorEsquema } from '../ports/leitor-esquema'
import {
    calcularConjuntos,
    montarPrevia,
    protecoesDo,
    totais,
    validarPedido,
    type AtorDangerZone
} from './montar-previa'

export type EntradaPrevia = { pedido: PedidoAcao; ator: AtorDangerZone; ambiente: Ambiente }

/**
 * Prévia de impacto (C-03, FR-010 a FR-015a). **Nunca altera nada**: roda numa
 * transação que termina em rollback, só para que as tabelas temporárias dos
 * conjuntos sumam com ela.
 *
 * Sem modo escolhido e com dependentes de histórico, devolve a prévia pendente
 * (`modo: null`) com o total de cada opção — o administrador escolhe vendo o
 * que cada uma apaga e altera (U-05 passo 2). Com só inseparáveis, não há
 * escolha a fazer e a prévia já vem completa (FR-011).
 */
export class GerarPreviaUseCase {
    private readonly catalogo: Catalogo

    constructor(private readonly deps: { leitor: LeitorEsquema; executor: ExecutorConjuntos; catalogo?: Catalogo }) {
        this.catalogo = deps.catalogo ?? CATALOGO
    }

    async executar({ pedido, ator, ambiente }: EntradaPrevia): Promise<Result<Previa, DomainError>> {
        const recusa = await validarPedido(pedido, ator, this.catalogo, this.deps.leitor)
        if (recusa) return falha(recusa)

        const protecoes = protecoesDo(ator)
        const modoCalculo = pedido.modo ?? 'preservacao'

        const previa = await this.deps.executor.emTransacao(
            async (sessao) => {
                const impressao = await calcularConjuntos(sessao, this.catalogo, pedido, modoCalculo, protecoes)
                return montarPrevia(
                    sessao,
                    this.catalogo,
                    pedido,
                    impressao,
                    protecoes,
                    ambiente,
                    pedido.modo ?? null,
                    null
                )
            },
            { confirmar: false }
        )

        if (!previa.temDependentes || pedido.modo) return ok(previa)

        // Escolha pendente: calcula também a cascata, só pelos totais.
        const cascata = await this.deps.executor.emTransacao(
            async (sessao) => totais(await calcularConjuntos(sessao, this.catalogo, pedido, 'cascata', protecoes)),
            { confirmar: false }
        )
        return ok({
            ...previa,
            opcoes: { cascata, preservacao: { apagar: previa.totalApagar, alterar: previa.totalAlterar } }
        })
    }
}
