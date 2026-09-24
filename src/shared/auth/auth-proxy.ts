import { betterAuth } from 'better-auth'
import { opcoesAuth } from './opcoes'

/**
 * Instância better-auth do `proxy.ts`: mesma configuração de `auth.ts`, sem
 * `databaseHooks` (ver `opcoes.ts`). Usada só para **ler** a sessão e renovar
 * o cookie cache — nunca para criar usuários ou atender `/api/auth/*`.
 */
export const authProxy = betterAuth(opcoesAuth)
