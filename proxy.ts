import { NextResponse, type NextRequest } from 'next/server'
import { getCookieCache, getSessionCookie } from 'better-auth/cookies'
import { eq } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { session as sessionTable } from '@/db/schema/identidade'
import { ehRole, type Role } from '@/src/shared/auth/roles'
import { expirouPorInatividade, sujeitoATimeout } from '@/src/shared/auth/inatividade'
import { ehRotaPublica, rolesExigidas } from '@/src/shared/auth/rotas'

/**
 * Gate de autenticação/autorização (DESIGN.md §6.2). Roda no runtime Node
 * (Next 16 não suporta Edge em `proxy.ts`).
 *
 * Esta é a **barreira rápida**: decide a partir do cookie, sem hit ao banco no
 * caminho feliz. A fonte de verdade continua sendo a re-checagem via
 * `auth.api.getSession` em `(staff)/layout.tsx` e em cada Server Action —
 * cookies podem estar forjados ou defasados entre o proxy e o render.
 */

/** Intervalo mínimo entre gravações de `lastActivityAt` (DESIGN.md §6.3). */
const INTERVALO_MINIMO_ATUALIZACAO_MS = 60_000

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Rota pública (só `/login`): nada a checar, mesmo sem sessão.
    if (ehRotaPublica(pathname)) return NextResponse.next()

    // Deny-by-default: toda outra rota exige sessão válida (FR-001/FR-002).
    // 1. Presença de sessão via cookie — sem consulta ao banco.
    if (!getSessionCookie(request)) return redirecionarParaLogin(request)

    // 2. Role a partir do cache de sessão assinado (também sem banco). Quando o
    //    cache não está disponível, deixamos passar: o layout/Server Action faz
    //    a checagem autoritativa logo em seguida.
    const cache = await getCookieCache(request, {
        secret: process.env.BETTER_AUTH_SECRET,
        isSecure: process.env.NODE_ENV === 'production'
    })
    if (!cache) return NextResponse.next()

    if (cache.user.ativo === false) return redirecionarParaLogin(request)

    const role: Role | undefined = ehRole(cache.user.role) ? cache.user.role : undefined
    // `lastActivityAt` é um additionalField: chega como string ISO no cache.
    const carimbo = cache.session.lastActivityAt as string | Date | null | undefined
    const ultimaAtividade = carimbo ? new Date(carimbo) : null

    // 3. Timeout de inatividade de staff (NFR §3, DESIGN.md §6.3).
    if (expirouPorInatividade(role, ultimaAtividade)) {
        return redirecionarParaLogin(request, 'expirado')
    }

    // 4. Role específica, quando a rota exigir uma (mapa em rotas.ts). Rotas
    //    ausentes do mapa só exigem sessão válida (qualquer role), já
    //    garantida acima.
    const exigidas = rolesExigidas(pathname)
    if (exigidas && (!role || !exigidas.includes(role))) {
        return NextResponse.redirect(new URL('/sem-permissao', request.url))
    }

    // 5. Renova o carimbo de atividade para as roles sujeitas ao timeout.
    //    Throttled: uma gravação por minuto, no máximo.
    if (sujeitoATimeout(role)) {
        const precisaAtualizar =
            !ultimaAtividade || Date.now() - ultimaAtividade.getTime() > INTERVALO_MINIMO_ATUALIZACAO_MS
        if (precisaAtualizar) await registrarAtividade(cache.session.token)
    }

    return NextResponse.next()
}

function redirecionarParaLogin(request: NextRequest, motivo?: 'expirado') {
    const url = new URL('/login', request.url)
    url.searchParams.set('redirecionar', request.nextUrl.pathname + request.nextUrl.search)
    if (motivo) url.searchParams.set('motivo', motivo)
    return NextResponse.redirect(url)
}

/**
 * Falha aqui não pode derrubar a navegação: no pior caso o carimbo fica
 * defasado e o usuário é deslogado mais cedo do que o necessário.
 */
async function registrarAtividade(token: string) {
    try {
        await db.update(sessionTable).set({ lastActivityAt: new Date() }).where(eq(sessionTable.token, token))
    } catch (erro) {
        console.error('[proxy] falha ao atualizar lastActivityAt', erro)
    }
}

export const config = {
    matcher: [
        // Tudo, exceto o handler do better-auth, a leitura periódica do sino,
        // assets estáticos e arquivos de metadata (DESIGN.md §6.2, item 4). A
        // única rota de navegação isenta de sessão é `/login` (`ehRotaPublica`,
        // checado no corpo).
        //
        // `api/notificacoes` é isenta por duas razões (012-notificacoes-tempo-real):
        // o proxy **redireciona** quem não tem sessão, e um `fetch` seguiria o
        // 302 recebendo o HTML do login com status 200 — o cliente nunca veria
        // o 401 que o faz parar; e o passo 5 abaixo renovaria `lastActivityAt` a
        // cada consulta automática, anulando o timeout de inatividade de staff,
        // que o Princípio IV declara não contornável. A rota faz sua própria
        // checagem autoritativa com `obterSessao()`.
        //
        // `webmanifest` entra na mesma classe de `favicon.ico`/`robots.txt`:
        // metadata pública, sem dado de sessão. Sem a isenção, o navegador
        // recebe um redirect para `/login` ao buscar o manifest e a aplicação
        // deixa de ser instalável — falha silenciosa, porque nada na interface
        // indica que o manifest não carregou.
        '/((?!api/auth|api/notificacoes|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js|webmanifest)$).*)'
    ]
}
