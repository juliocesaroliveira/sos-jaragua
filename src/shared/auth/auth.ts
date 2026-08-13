import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/src/shared/db/postgres'
import * as schema from '@/db/schema'
import { ROLE_PADRAO } from './roles'

/**
 * Instância better-auth (DESIGN.md §6.1).
 *
 * - `emailAndPassword` habilitado como fallback independente de provedor social.
 * - `socialProviders`: Google + Facebook. **Instagram fora do MVP** — a API
 *   atual é voltada a contas business/creator, inviável para login pessoal de
 *   voluntários; documentado como escopo v2.
 * - `role`/`ativo` como additionalFields em `user` e `lastActivityAt` em
 *   `session`, refletidos manualmente em `db/schema/identidade.ts`.
 */
export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: {
        allowedHosts: [process.env.BETTER_AUTH_URL!.replace('https://', ''), '*.vercel.app', 'localhost:3000'],
        protocol: 'https',
        fallback: process.env.BETTER_AUTH_URL!
    },

    database: drizzleAdapter(db, {
        provider: 'pg',
        schema: {
            user: schema.user,
            session: schema.session,
            account: schema.account,
            verification: schema.verification
        }
    }),

    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        autoSignIn: true
    },

    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID ?? '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ''
        },
        facebook: {
            clientId: process.env.FACEBOOK_CLIENT_ID ?? '',
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET ?? ''
        }
    },

    user: {
        additionalFields: {
            role: {
                type: 'string',
                required: false,
                defaultValue: ROLE_PADRAO,
                // Nunca aceito do cliente: a promoção para `voluntario` acontece
                // dentro de AprovarCandidaturaUseCase (BR-VOL-03).
                input: false
            },
            ativo: {
                type: 'boolean',
                required: false,
                defaultValue: true,
                input: false
            }
        }
    },

    session: {
        additionalFields: {
            lastActivityAt: {
                type: 'date',
                required: false,
                input: false
            }
        },
        // Cookie cache evita um hit ao banco a cada leitura de sessão; o
        // timeout de inatividade de staff é tratado à parte (DESIGN.md §6.3).
        cookieCache: { enabled: true, maxAge: 60 }
    },

    advanced: {
        // NFR §3 / DESIGN.md §6.4 — httpOnly e sameSite=lax são padrão do
        // better-auth; `secure` é forçado fora de desenvolvimento.
        useSecureCookies: process.env.NODE_ENV === 'production'
    }
})

export type Sessao = typeof auth.$Infer.Session
