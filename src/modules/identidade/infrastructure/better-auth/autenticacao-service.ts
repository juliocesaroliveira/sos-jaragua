import { APIError } from 'better-auth'
import { auth } from '@/src/shared/auth/auth'
import type { AutenticacaoService } from '../../application/ports/autenticacao-service'

/**
 * Implementação sobre `auth.api.signUpEmail` (research.md D5) — a senha é
 * hasheada pelo próprio better-auth, nunca por código deste módulo. `role` é
 * `additionalField` com `input: false` em `auth.ts`, então não vai neste
 * corpo; quem chama define o papel depois, via `UsuarioRepository`.
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
    }
}
