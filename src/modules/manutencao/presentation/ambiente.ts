import type { Ambiente } from '../domain/previa'

/**
 * Ambiente exibido na faixa do topo e na confirmação final (FR-002a, research D17).
 *
 * `VERCEL_ENV` é a fonte na plataforma; localmente cai em `NODE_ENV`. Um valor
 * desconhecido vira `production` — errar para o lado do aviso mais alarmante é
 * o comportamento seguro numa tela que apaga dados.
 */
export function ambienteAtual(env: Record<string, string | undefined> = process.env): Ambiente {
    const vercel = env.VERCEL_ENV
    if (vercel === 'production' || vercel === 'preview' || vercel === 'development') return vercel
    if (vercel) return 'production'
    return env.NODE_ENV === 'production' ? 'production' : 'development'
}

export const ROTULO_AMBIENTE: Record<Ambiente, string> = {
    production: 'PRODUÇÃO',
    preview: 'PRÉ-VISUALIZAÇÃO',
    development: 'DESENVOLVIMENTO'
}
