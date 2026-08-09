import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { CACHE_LIFE, CACHE_TAGS } from '@/src/shared/cache'
import { ProjetarDemandaUseCase, type Projecao } from '../../application/use-cases/projetar-demanda'
import {
    criseRepository,
    estoqueQueryPort,
    metricaKitRepository
} from '../../infrastructure/drizzle/logistica-repository'

/**
 * Indicadores do painel de crise (BR-INT-02).
 *
 * Cacheada sob `dashboard:kits` e invalidada por entrada, saída, descarte,
 * alteração de receita de kit e mudança em `crise_variaveis`/`metrica_kit`
 * (DESIGN.md §7) — exatamente os eventos que mexem em demanda ou capacidade.
 */
export async function projecaoDeCrise(): Promise<Projecao> {
    'use cache'
    cacheTag(CACHE_TAGS.dashboardKits)
    cacheLife(CACHE_LIFE.curto)

    const useCase = new ProjetarDemandaUseCase(criseRepository, metricaKitRepository, estoqueQueryPort)
    return useCase.executar()
}

/** Histórico append-only das variáveis da crise (BRD §5). */
export async function historicoDaCrise(limite = 10) {
    'use cache'
    cacheTag(CACHE_TAGS.dashboardKits)
    cacheLife(CACHE_LIFE.curto)

    return criseRepository.historico(limite)
}

/** Métricas configuradas por kit — insumo da tela de configuração (LOG-03). */
export async function metricasConfiguradas() {
    'use cache'
    cacheTag(CACHE_TAGS.dashboardKits)
    cacheLife(CACHE_LIFE.curto)

    return metricaKitRepository.listar()
}
