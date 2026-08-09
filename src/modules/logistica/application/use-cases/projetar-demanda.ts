import {
    CRISE_ZERADA,
    componenteGargalo,
    kitsNecessarios,
    kitsPossiveis,
    percentualAtendido,
    temDeficit,
    type BaseDemanda,
    type VariaveisCrise
} from '../../domain/projecao'
import type { CriseRepository, EstoqueQueryPort, MetricaKitRepository } from '../ports/logistica-repository'

export type ProjecaoKit = {
    kitId: string
    nome: string
    ativo: boolean
    /** `null` quando o kit não tem métrica de demanda configurada (BR-INT-01). */
    baseDemanda: BaseDemanda | null
    proporcao: number | null
    necessarios: number
    possiveis: number
    percentualAtendido: number | null
    deficit: boolean
    /** Nome do componente que limita a capacidade, quando há receita. */
    gargalo: string | null
    temReceita: boolean
}

export type Projecao = {
    crise: VariaveisCrise
    criseAtualizadaEm: string | null
    kits: ProjecaoKit[]
    /** Somatórios dos kits **com métrica configurada** — o painel de topo. */
    totalNecessarios: number
    totalPossiveis: number
    percentualGeral: number | null
    /** Kits com métrica configurada cuja capacidade não cobre a demanda. */
    kitsEmDeficit: number
}

/**
 * BR-INT-01 + BR-INT-02 — projeção de demanda × capacidade (DESIGN.md §11).
 *
 * Lê Estoque apenas pelo `EstoqueQueryPort`, preservando o isolamento entre os
 * bounded contexts mesmo com as tabelas no mesmo banco (DESIGN.md §3).
 */
export class ProjetarDemandaUseCase {
    constructor(
        private readonly crises: CriseRepository,
        private readonly metricas: MetricaKitRepository,
        private readonly estoque: EstoqueQueryPort
    ) {}

    async executar(): Promise<Projecao> {
        const [vigente, metricas, kits, saldos] = await Promise.all([
            this.crises.vigente(),
            this.metricas.listar(),
            this.estoque.kitsComReceita(),
            this.estoque.saldoPorItem()
        ])

        const crise: VariaveisCrise = vigente
            ? {
                  totalFamiliasAfetadas: vigente.totalFamiliasAfetadas,
                  totalPessoasAfetadas: vigente.totalPessoasAfetadas
              }
            : CRISE_ZERADA

        const metricaPorKit = new Map(metricas.map((m) => [m.kitId, m]))
        const nomePorItem = new Map(kits.flatMap((k) => k.componentes.map((c) => [c.itemId, c.nome] as const)))

        const projecoes: ProjecaoKit[] = kits.map((kit) => {
            const metrica = metricaPorKit.get(kit.kitId) ?? null
            const possiveis = kitsPossiveis(kit.componentes, saldos)
            const necessarios = metrica ? kitsNecessarios(metrica, crise) : 0
            const idGargalo = componenteGargalo(kit.componentes, saldos)

            return {
                kitId: kit.kitId,
                nome: kit.nome,
                ativo: kit.ativo,
                baseDemanda: metrica?.baseDemanda ?? null,
                proporcao: metrica?.proporcao ?? null,
                necessarios,
                possiveis,
                percentualAtendido: percentualAtendido(necessarios, possiveis),
                deficit: temDeficit(necessarios, possiveis),
                gargalo: idGargalo ? (nomePorItem.get(idGargalo) ?? null) : null,
                temReceita: kit.componentes.length > 0
            }
        })

        // Os totais consideram só os kits **ativos e com métrica**: somar um kit
        // sem demanda declarada infla a capacidade e esconde o déficit real.
        const comMetrica = projecoes.filter((p) => p.ativo && p.baseDemanda !== null)
        const totalNecessarios = comMetrica.reduce((soma, p) => soma + p.necessarios, 0)
        const totalPossiveis = comMetrica.reduce((soma, p) => soma + p.possiveis, 0)

        return {
            crise,
            criseAtualizadaEm: vigente?.atualizadoEm ?? null,
            kits: projecoes,
            totalNecessarios,
            totalPossiveis,
            percentualGeral: percentualAtendido(totalNecessarios, totalPossiveis),
            kitsEmDeficit: comMetrica.filter((p) => p.deficit).length
        }
    }
}
