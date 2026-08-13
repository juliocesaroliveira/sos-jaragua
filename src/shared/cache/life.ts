/**
 * Perfis de `cacheLife` usados na tabela de DESIGN.md §7.
 *
 * São os perfis embutidos do Next.js — o alias existe para que a intenção
 * ("curto/médio/longo", como escrito na spec) apareça no call site em vez de
 * uma string solta, e para que ajustar um perfil seja uma mudança em um lugar.
 */
export const CACHE_LIFE = {
    /** Curto — leituras operacionais que mudam a cada movimentação. */
    curto: 'minutes',
    /** Médio — listagens que toleram defasagem (voluntários). */
    medio: 'hours',
    /** Longo — shell estático (formulário público de candidatura). */
    longo: 'days'
} as const

export type PerfilCacheLife = (typeof CACHE_LIFE)[keyof typeof CACHE_LIFE]

/**
 * Perfil passado a `revalidateTag(tag, perfil)` — semântica
 * stale-while-revalidate: a leitura defasada é servida enquanto a nova é
 * buscada em segundo plano (DESIGN.md §7).
 *
 * Usado onde uma pequena defasagem é aceitável (ex.: recalcular o dashboard
 * após uma entrada registrada em outro terminal). Quando a mudança precisa
 * aparecer na **mesma** resposta, a Server Action usa `updateTag` em vez disto.
 */
export const PERFIL_REVALIDACAO = CACHE_LIFE.curto
