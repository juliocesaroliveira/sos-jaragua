/**
 * Port sobre a criação de conta autenticável (DESIGN.md §4). `application`
 * não conhece better-auth — só este contrato; `infrastructure` implementa
 * com `auth.api.signUpEmail` (research.md D5).
 */
export type ResultadoCriarConta = { ok: true; userId: string } | { ok: false; erro: 'email_duplicado' }

export interface AutenticacaoService {
    /** Cria a conta com senha já hasheada pelo provedor — nunca hash manual. */
    criarConta(dados: { nome: string; email: string; senha: string }): Promise<ResultadoCriarConta>
}
