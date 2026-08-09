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
