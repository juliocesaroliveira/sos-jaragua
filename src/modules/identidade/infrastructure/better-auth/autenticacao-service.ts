import { APIError } from 'better-auth'
import { auth } from '@/src/shared/auth/auth'
import type { AutenticacaoService } from '../../application/ports/autenticacao-service'

/**
 * Implementação sobre `auth.api.signUpEmail` (research.md D5) — a senha é
 * hasheada pelo próprio better-auth, nunca por código deste módulo. `role` é
 * `additionalField` com `input: false` em `auth.ts`, então não vai neste
 * corpo; quem chama define o papel depois, via `UsuarioRepository`.
 *
 * A redefinição administrativa de senha (008-admin-password-reset) usa
 * `auth.$context` em vez do plugin `admin` do better-auth: o plugin traz seu
 * próprio modelo de papéis (exige `"admin"` em `user.role`), incompatível com
 * `src/shared/auth/roles.ts`. A sequência abaixo é a mesma que o plugin executa
 * internamente — hash pelo provedor, escrita pelo adapter interno.
 */
export const autenticacaoService: AutenticacaoService = {
    async criarConta({ nome, email, senha }) {
        try {
            const { user } = await auth.api.signUpEmail({
                body: { name: nome, email, password: senha }
            })
            return { ok: true, userId: user.id }
        } catch (erro) {
            // `UNPROCESSABLE_ENTITY` é o único status que signUpEmail lança
            // para e-mail já cadastrado (better-auth, sign-up.mjs).
            if (erro instanceof APIError && erro.status === 'UNPROCESSABLE_ENTITY') {
                return { ok: false, erro: 'email_duplicado' }
            }
            throw erro
        }
    },

    async definirSenha(userId, senha) {
        const ctx = await auth.$context

        // `updatePassword` filtra por `providerId = 'credential'`: uma conta
        // sem senha própria simplesmente não seria tocada. Ainda assim quem
        // chama verifica antes — o silêncio aqui seria um sucesso enganoso.
        const hash = await ctx.password.hash(senha)
        await ctx.internalAdapter.updatePassword(userId, hash)
    },

    async encerrarSessoes(userId, exceto) {
        const ctx = await auth.$context

        const sessoes = await ctx.internalAdapter.listSessions(userId)
        const tokens = sessoes.map((sessao) => sessao.token).filter((token) => token !== exceto)

        if (tokens.length === 0) return

        // `deleteSessions(tokens)` e não `deleteUserSessions(userId)`: este
        // último apagaria também a sessão de quem executa a ação, deslogando a
        // pessoa administradora que acabou de redefinir a própria senha.
        await ctx.internalAdapter.deleteSessions(tokens)
    }
}
