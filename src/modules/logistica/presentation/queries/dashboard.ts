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
 *
 * **`'use cache: remote'`** (DESIGN.md §7): em serverless o `'use cache'`
 * padrão guarda o resultado na memória de cada instância, que raramente
 * atende o request seguinte. Dados de referência — poucas chaves, lidos em
 * quase toda tela — vão para o cache remoto da plataforma, compartilhado entre
 * instâncias; `cacheTag` + `updateTag`/`revalidateTag` o invalidam igual.
 */
export async function projecaoDeCrise(): Promise<Projecao> {
    'use cache: remote'
    cacheTag(CACHE_TAGS.dashboardKits)
    cacheLife(CACHE_LIFE.curto)

    const useCase = new ProjetarDemandaUseCase(criseRepository, metricaKitRepository, estoqueQueryPort)
    return useCase.executar()
}

/** Histórico append-only das variáveis da crise (BRD §5). */
export async function historicoDaCrise(limite = 10) {
    'use cache: remote'
    cacheTag(CACHE_TAGS.dashboardKits)
    cacheLife(CACHE_LIFE.curto)

    return criseRepository.historico(limite)
}

/** Métricas configuradas por kit — insumo da tela de configuração (LOG-03). */
export async function metricasConfiguradas() {
    'use cache: remote'
    cacheTag(CACHE_TAGS.dashboardKits)
    cacheLife(CACHE_LIFE.curto)

    return metricaKitRepository.listar()
}

/**
 * A mesma projeção de `projecaoDeCrise`, **sem cache** — para a avaliação de
 * alertas logo após uma escrita (`notificacoes/presentation/alertas.ts`).
 * Mutações de estoque invalidam `dashboard:kits` com stale-while-revalidate,
 * então a versão cacheada ainda poderia devolver o estado anterior à escrita.
 */
export async function projecaoAtual(): Promise<Projecao> {
    return new ProjetarDemandaUseCase(criseRepository, metricaKitRepository, estoqueQueryPort).executar()
}
