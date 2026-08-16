import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { comAtor } from '@/src/shared/contexto/ator'
import { podeAcessar } from './rotas'
import { auth } from './auth'
import { expirouPorInatividade } from './inatividade'
import { ehRole, type Role } from './roles'

export type SessaoAtor = {
    userId: string
    role: Role
    nome: string
    email: string
    ativo: boolean
    /**
     * `YYYY-MM-DD` ou `null` — 011-auto-cadastro-provedor, FR-011. Vem do
     * `additionalField` que o `getSession` já devolve, sem consulta extra: é o
     * que permite ao formulário de candidatura decidir no servidor se o campo
     * de data entra bloqueado ou editável, sem um segundo hit no banco.
     */
    dataNascimento: string | null
    sessionToken: string
}

/**
 * A coluna é `date` no Postgres e o driver a devolve como `YYYY-MM-DD`, mas o
 * cookie cache serializa/desserializa o campo e pode reidratá-lo como `Date`.
 * Normalizamos para a string de data civil que o domínio usa — sem passar por
 * fuso, que é justamente o que a coluna `date` existe para evitar.
 */
function normalizarDataNascimento(valor: unknown): string | null {
    if (typeof valor === 'string') return valor.slice(0, 10) || null
    if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
        return `${valor.getUTCFullYear()}-${String(valor.getUTCMonth() + 1).padStart(2, '0')}-${String(valor.getUTCDate()).padStart(2, '0')}`
    }
    return null
}

/**
 * Sessão autoritativa lida no servidor (`auth.api.getSession`) — a fonte de
 * verdade de autorização, complementando a barreira rápida do `proxy.ts`
 * (defesa em profundidade, DESIGN.md §6.2).
 *
 * Retorna `null` quando não há sessão, quando o usuário foi desativado
 * (`user.ativo = false`) ou quando a sessão de staff expirou por inatividade
 * (DESIGN.md §6.3) — neste último caso a sessão também é invalidada.
 *
 * **Memoizada por request** (`cache` do React). A defesa em profundidade exige
 * que vários pontos releiam a sessão no mesmo render — `(interno)/layout.tsx`
 * exige sessão, `(staff)/layout.tsx` exige role, e Server Actions relêem o ator
 * — mas isso é uma decisão de *autorização*, não um motivo para bater no banco
 * uma vez por checagem. Sem a memoização, cada página de staff dispara dois
 * `getSession` por navegação.
 *
 * A memoização vale só dentro de um request; ela não atravessa requests, então
 * não há risco de servir sessão de um usuário a outro.
 */
export const obterSessao = cache(async function obterSessao(): Promise<SessaoAtor | null> {
    const cabecalhos = await headers()
    const sessao = await auth.api.getSession({ headers: cabecalhos })
    if (!sessao) return null

    const role = ehRole(sessao.user.role) ? sessao.user.role : 'usuario'

    if (!sessao.user.ativo) {
        await auth.api.signOut({ headers: cabecalhos })
        return null
    }

    if (expirouPorInatividade(role, sessao.session.lastActivityAt as Date | null)) {
        await auth.api.signOut({ headers: cabecalhos })
        return null
    }

    return {
        userId: sessao.user.id,
        role,
        nome: sessao.user.name,
        email: sessao.user.email,
        ativo: sessao.user.ativo,
        dataNascimento: normalizarDataNascimento(sessao.user.dataNascimento),
        sessionToken: sessao.session.token
    }
})

/** Exige sessão válida; redireciona para `/login` caso contrário. */
export async function exigirSessao(destinoPosLogin?: string): Promise<SessaoAtor> {
    const ator = await obterSessao()
    if (!ator) {
        const query = destinoPosLogin ? `?redirecionar=${encodeURIComponent(destinoPosLogin)}` : ''
        redirect(`/login${query}`)
    }
    return ator
}

/**
 * Exige sessão com uma das `roles`. Sem sessão → `/login`; com sessão mas sem
 * permissão → `/sem-permissao` (não `/login`, para não sugerir que basta
 * autenticar de novo).
 */
export async function exigirRoles(roles: readonly Role[], destinoPosLogin?: string): Promise<SessaoAtor> {
    const ator = await exigirSessao(destinoPosLogin)
    if (!roles.includes(ator.role)) redirect('/sem-permissao')
    return ator
}

/**
 * Exige que o ator possa acessar `pathname`, conforme `REGRAS_DE_ROTA`.
 *
 * Existe porque o `proxy.ts` **não** é enforcement suficiente para rotas com
 * regra granular: ele decide a partir do cache de sessão em cookie e, quando
 * esse cache não está disponível, deixa passar de propósito — apostando que
 * "o layout faz a checagem autoritativa em seguida". Para `/dashboard` e afins
 * isso é verdade (`(staff)/layout.tsx` exige `ROLES_STAFF`), mas para
 * `/crise`, `/relatorios`, `/estoque/kits`, `/estoque/descarte` e
 * `/convocacao` não havia nenhuma segunda checagem: um perfil de staff sem
 * direito à rota específica passava.
 *
 * Deriva de `rolesExigidas` em vez de receber a lista, para não criar mais uma
 * cópia da regra que possa divergir (DESIGN.md §6.2).
 */
export async function exigirAcessoA(pathname: string): Promise<SessaoAtor> {
    const ator = await exigirSessao(pathname)
    if (!podeAcessar(pathname, ator.role)) redirect('/sem-permissao')
    return ator
}

/**
 * Executa `fn` com a identidade do ator disponível via `AsyncLocalStorage`
 * (DESIGN.md §13) — é o que permite ao `withAudit` saber quem agiu sem que
 * cada camada precise repassar `actor` manualmente.
 *
 * `ip` e `userAgent` alimentam `audit_logs.metadata` (DB_SCHEMA.md §9).
 */
export async function comAtorDaSessao<T>(ator: SessaoAtor, fn: () => Promise<T>): Promise<T> {
    const cabecalhos = await headers()

    return comAtor(
        {
            userId: ator.userId,
            role: ator.role,
            // `x-forwarded-for` pode trazer a cadeia de proxies; o primeiro é o
            // cliente original.
            ip: cabecalhos.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
            userAgent: cabecalhos.get('user-agent') ?? undefined
        },
        fn
    )
}
