import { betterAuth } from 'better-auth'
import { RegistrarAutoCadastroUseCase } from '@/src/modules/identidade/application/use-cases/registrar-auto-cadastro'
import { opcoesAuth } from './opcoes'
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
 * Instância better-auth completa (DESIGN.md §6.1): a configuração comum de
 * `opcoes.ts` mais o hook de auditoria do auto-cadastro. É a que atende
 * `/api/auth/*` e as leituras autoritativas de `sessao.ts`; o `proxy.ts` usa
 * `auth-proxy.ts`, sem o hook.
 */
export const auth = betterAuth({
    ...opcoesAuth,

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
    }
})

export type Sessao = typeof auth.$Infer.Session
