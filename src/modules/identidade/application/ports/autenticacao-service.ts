/**
 * Port sobre a criação de conta autenticável (DESIGN.md §4). `application`
 * não conhece better-auth — só este contrato; `infrastructure` implementa
 * com `auth.api.signUpEmail` (research.md D5).
 */
export type ResultadoCriarConta = { ok: true; userId: string } | { ok: false; erro: 'email_duplicado' }

export interface AutenticacaoService {
    /** Cria a conta com senha já hasheada pelo provedor — nunca hash manual. */
    criarConta(dados: { nome: string; email: string; senha: string }): Promise<ResultadoCriarConta>

    /**
     * Substitui a senha de uma conta que **já possui** senha própria
     * (008-admin-password-reset, S-03.1).
     *
     * Não cria a credencial quando ela não existe — e é aqui que divergimos de
     * propósito do plugin `admin` do better-auth, que cria: uma conta que entra
     * por Google/Facebook não ganha senha por esta via (FR-005/FR-013). Quem
     * chama é responsável por verificar `possuiSenhaPropria` antes.
     *
     * O hash continua sendo do provedor de autenticação, nunca deste projeto.
     */
    definirSenha(userId: string, senha: string): Promise<void>

    /**
     * Encerra as sessões abertas da conta, preservando a de `exceto` quando
     * informada — sem isso, a pessoa administradora que redefine a própria
     * senha seria deslogada logo após ver a confirmação (FR-016).
     */
    encerrarSessoes(userId: string, exceto?: string): Promise<void>
}
