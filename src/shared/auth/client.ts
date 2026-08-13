'use client'

import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'
import type { auth } from './auth'

/**
 * Cliente better-auth para uso em Client Components (formulário de login,
 * botões de login social, sign-out). `inferAdditionalFields` traz `role`/`ativo`
 * para a tipagem do cliente sem duplicar a definição.
 */
export const authClient = createAuthClient({
    plugins: [inferAdditionalFields<typeof auth>()]
})

export const { signIn, signUp, signOut, useSession } = authClient
