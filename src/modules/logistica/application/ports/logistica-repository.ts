import type { BaseDemanda, VariaveisCrise } from '../../domain/projecao'

/** Ports do módulo de Logística/Inteligência (DESIGN.md §3, §11). */

export type CriseVariaveis = VariaveisCrise & {
    id: string
    atualizadoEm: string
}

export interface CriseRepository {
    /** Linha vigente = a mais recente da tabela append-only (DB_SCHEMA.md §7.1). */
    vigente(): Promise<CriseVariaveis | null>
    /** Append-only: **sempre** insere; nunca atualiza a linha anterior. */
    registrar(entrada: VariaveisCrise & { atualizadoPor: string }): Promise<CriseVariaveis>
    historico(limite?: number): Promise<CriseVariaveis[]>
}

export type MetricaKitConfigurada = {
    id: string
    kitId: string
    baseDemanda: BaseDemanda
    proporcao: number
}

export interface MetricaKitRepository {
    listar(): Promise<MetricaKitConfigurada[]>
    /** Uma métrica por kit (`unique(kitId)`) — cria ou substitui. */
    definir(entrada: { kitId: string; baseDemanda: BaseDemanda; proporcao: number }): Promise<MetricaKitConfigurada>
    remover(kitId: string): Promise<void>
}

/**
 * Leitura que Logística faz de Estoque — **apenas** por este port
 * (DESIGN.md §3). Logística nunca importa os repositórios de Estoque, mesmo com
 * as tabelas no mesmo Postgres: é o que mantém o isolamento entre os contextos.
 */
export type KitParaProjecao = {
    kitId: string
    nome: string
    ativo: boolean
    componentes: { itemId: string; nome: string; quantidadePorKit: number }[]
}

export interface EstoqueQueryPort {
    kitsComReceita(): Promise<KitParaProjecao[]>
    saldoPorItem(): Promise<Map<string, number>>
}
