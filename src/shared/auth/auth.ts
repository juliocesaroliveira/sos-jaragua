import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@/src/shared/db/postgres'
import * as schema from '@/db/schema'
import { RegistrarAutoCadastroUseCase } from '@/src/modules/identidade/application/use-cases/registrar-auto-cadastro'
import { ROLE_PADRAO, ehRole } from './roles'

/**
 * Contexto mínimo que o hook de criação de usuário consome. Declarado
 * localmente em vez de importar o tipo do better-auth porque só precisamos de
 * três campos opcionais — e todos podem faltar (o hook também roda em cadastro
 * por e-mail e senha, onde não há `params.id` de provedor).
 */
type ContextoCriacao = {
    params?: { id?: string }
    headers?: Headers
} | null

/**
 * Adapta o objeto de usuário do better-auth para o caso de uso de auditoria
 * (011-auto-cadastro-provedor, FR-009).
 *
 * O provedor vem de `params.id` da rota `/callback/:id`; na ausência dele o
 * cadastro foi por e-mail e senha, que o better-auth grava como `credential`.
 */
async function registrarAutoCadastro(usuario: Record<string, unknown>, contexto: ContextoCriacao): Promise<void> {
    const role = ehRole(usuario.role) ? usuario.role : ROLE_PADRAO

    await new RegistrarAutoCadastroUseCase().executar({
        id: String(usuario.id),
        nome: String(usuario.name ?? ''),
        email: String(usuario.email ?? ''),
        role,
        provedor: contexto?.params?.id ?? 'credential',
        // `x-forwarded-for` pode trazer a cadeia de proxies; o primeiro é o
        // cliente original — mesma leitura de `comAtorDaSessao`.
        ip: contexto?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
        userAgent: contexto?.headers?.get('user-agent') ?? undefined
    })
}

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

    /**
     * **Escopos básicos apenas** — nome e e-mail (011-auto-cadastro-provedor,
     * FR-004/SC-008). Não adicionar `scope` nem `mapProfileToUser` aqui para
     * buscar data de nascimento: no Google isso exige `user.birthday.read` +
     * People API (que costuma omitir o ano), e no Facebook `user_birthday` com
     * App Review. Custo externo alto para um dado que o candidato informa uma
     * única vez no formulário (research.md D2).
     */
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

    /**
     * **Contrato de configuração de vinculação de contas** — os três defaults
     * abaixo são deixados de propósito sem declaração explícita, e mudá-los
     * exige nova decisão documentada (contracts/auto-cadastro.md C-01):
     *
     * - `accountLinking.updateUserInfoOnLink` (default `false`): ativá-lo faria
     *   o nome da conta ser sobrescrito pelo provedor a cada vinculação —
     *   trocaria o nome de um voluntário já aprovado sem rastro (FR-008).
     * - `overrideUserInfo` nos provedores (default `false`): mesmo efeito.
     * - `accountLinking.requireLocalEmailVerified` (default `true`): é o que
     *   impede alguém de pré-registrar uma conta local no e-mail da vítima e
     *   capturar a identidade OAuth dela no primeiro login. O preço é que quem
     *   tem conta com senha **não** consegue entrar por Google com o mesmo
     *   e-mail enquanto não houver verificação de e-mail no projeto — o que é
     *   tratado como recusa explicada na tela de login, não afrouxando o gate
     *   (research.md D4).
     */

    databaseHooks: {
        user: {
            create: {
                // Auditoria do auto-cadastro (FR-009). Roda depois da criação,
                // quando já existe `user.id`; nunca no `before`, que auditaria
                // uma conta que ainda pode falhar ao ser gravada.
                after: async (usuarioCriado, contexto) => {
                    await registrarAutoCadastro(usuarioCriado, contexto)
                }
            }
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
            },
            /**
             * Data de nascimento (`YYYY-MM-DD`), opcional — 011-auto-cadastro-provedor,
             * FR-003. `input: false` pelo mesmo motivo de `role`: nenhum
             * endpoint do better-auth aceita este campo do cliente. A única via
             * de escrita é `UsuarioRepository.definirDataNascimentoSeAusente`,
             * chamada pelo caso de uso da candidatura (FR-016).
             */
            dataNascimento: {
                type: 'string',
                required: false,
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
