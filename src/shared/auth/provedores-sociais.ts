/**
 * Provedores de login social com credencial completa no ambiente
 * (specs/020-resolver-pendencias, FR-010).
 *
 * Desde a decisão de 2026-08-16 (PENDENCIAS §2), o login social é o **único**
 * auto-cadastro público. Um botão de provedor sem credencial falha no clique, e
 * o voluntário novo desiste. Por isso o botão só aparece, e o provedor só é
 * registrado no better-auth, quando o ID **e** o segredo estão preenchidos.
 *
 * Não importa `server-only` de propósito: só **nomes** de provedores saem
 * daqui, nunca os valores das variáveis. Quem lê o ambiente é sempre o
 * servidor (`opcoes.ts` e a página de login), que repassa a lista ao cliente.
 */
export type ProvedorSocial = 'google' | 'facebook'

/** Ordem fixa: é a ordem em que os botões aparecem na tela de login. */
const VARIAVEIS: Record<ProvedorSocial, { id: string; segredo: string }> = {
    google: { id: 'GOOGLE_CLIENT_ID', segredo: 'GOOGLE_CLIENT_SECRET' },
    facebook: { id: 'FACEBOOK_CLIENT_ID', segredo: 'FACEBOOK_CLIENT_SECRET' }
}

function preenchida(valor: string | undefined): boolean {
    return Boolean(valor?.trim())
}

export function provedoresSociaisConfigurados(env: Record<string, string | undefined> = process.env): ProvedorSocial[] {
    return (Object.keys(VARIAVEIS) as ProvedorSocial[]).filter(
        (provedor) => preenchida(env[VARIAVEIS[provedor].id]) && preenchida(env[VARIAVEIS[provedor].segredo])
    )
}
