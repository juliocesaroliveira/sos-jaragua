import { NextResponse, type NextRequest } from 'next/server'
import { applySetCookies, getCookieCache, getSessionCookie } from 'better-auth/cookies'
import { eq } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { session as sessionTable } from '@/db/schema/identidade'
import { authProxy } from '@/src/shared/auth/auth-proxy'
import { ehRole, type Role } from '@/src/shared/auth/roles'
import { expirouPorInatividade, sujeitoATimeout } from '@/src/shared/auth/inatividade'
import { ehRotaPublica, rolesExigidas } from '@/src/shared/auth/rotas'

/**
 * Gate de autenticação/autorização (DESIGN.md §6.2). Roda no runtime Node
 * (Next 16 não suporta Edge em `proxy.ts`).
 *
 * Esta é a **barreira rápida**: decide a partir do cookie cache assinado. A
 * fonte de verdade continua sendo a re-checagem via `auth.api.getSession` em
 * `(staff)/layout.tsx` e em cada Server Action — cookies podem estar forjados
 * ou defasados entre o proxy e o render.
 *
 * É também **quem mantém o cookie cache vivo**. Server Components não gravam
 * cookie; sem o proxy renovando, o cache expiraria minutos depois do login e
 * toda leitura de sessão dali em diante (layout, actions, sino) iria ao banco.
 * Quando o cache falta, o proxy lê a sessão uma vez, devolve o cookie novo ao
 * navegador **e** o injeta no request repassado ao render — que então resolve
 * a sessão sem consulta.
 */

/** Intervalo mínimo entre gravações de `lastActivityAt` (DESIGN.md §6.3). */
const INTERVALO_MINIMO_ATUALIZACAO_MS = 60_000

/** O que o proxy lê da sessão — comum ao cookie cache e ao `getSession`. */
type DadosSessao = {
    user: Record<string, unknown>
    session: { token: string } & Record<string, unknown>
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Rota pública (só `/login`): nada a checar, mesmo sem sessão.
    if (ehRotaPublica(pathname)) return NextResponse.next()

    // Deny-by-default: toda outra rota exige sessão válida (FR-001/FR-002).
    // 1. Presença de sessão via cookie — sem consulta ao banco.
    if (!getSessionCookie(request)) return redirecionarParaLogin(request)

    // 2. Sessão a partir do cache assinado (sem banco) ou, quando ele expirou,
    //    lida uma vez do banco — o que já emite o cookie cache renovado.
    const setCookies: string[] = []
    let dados: DadosSessao | null = await getCookieCache(request, {
        secret: process.env.BETTER_AUTH_SECRET,
        isSecure: process.env.NODE_ENV === 'production'
    })

    if (!dados) {
        const lida = await lerSessao(request.headers)
        // Falha de leitura não derruba a navegação: o layout faz a checagem
        // autoritativa logo em seguida.
        if (lida === 'falhou') return NextResponse.next()
        setCookies.push(...lida.setCookies)
        if (!lida.sessao) return comCookies(redirecionarParaLogin(request), setCookies)
        dados = lida.sessao
    }

    if (dados.user.ativo === false) return comCookies(redirecionarParaLogin(request), setCookies)

    const role: Role | undefined = ehRole(dados.user.role) ? dados.user.role : undefined
    // `lastActivityAt` é um additionalField: chega como string ISO no cookie
    // cache e como `Date` do banco.
    const carimbo = dados.session.lastActivityAt as string | Date | null | undefined
    const ultimaAtividade = carimbo ? new Date(carimbo) : null

    // 3. Timeout de inatividade de staff (NFR §3, DESIGN.md §6.3).
    if (expirouPorInatividade(role, ultimaAtividade)) {
        return comCookies(redirecionarParaLogin(request, 'expirado'), setCookies)
    }

    // 4. Role específica, quando a rota exigir uma (mapa em rotas.ts). Rotas
    //    ausentes do mapa só exigem sessão válida (qualquer role), já
    //    garantida acima.
    const exigidas = rolesExigidas(pathname)
    if (exigidas && (!role || !exigidas.includes(role))) {
        return comCookies(NextResponse.redirect(new URL('/sem-permissao', request.url)), setCookies)
    }

    // 5. Renova o carimbo de atividade para as roles sujeitas ao timeout.
    //    Throttled: uma gravação por minuto, no máximo.
    if (sujeitoATimeout(role)) {
        const precisaAtualizar =
            !ultimaAtividade || Date.now() - ultimaAtividade.getTime() > INTERVALO_MINIMO_ATUALIZACAO_MS
        if (precisaAtualizar) setCookies.push(...(await registrarAtividade(dados.session.token, request.headers)))
    }

    return seguir(request, setCookies)
}

/**
 * Lê a sessão pelo better-auth, devolvendo os `Set-Cookie` emitidos: o cookie
 * cache renovado, ou a limpeza dos cookies quando a sessão não existe mais.
 */
async function lerSessao(
    cabecalhos: Headers,
    opcoes: { ignorarCache?: boolean } = {}
): Promise<{ sessao: DadosSessao | null; setCookies: string[] } | 'falhou'> {
    try {
        const { headers, response } = await authProxy.api.getSession({
            headers: cabecalhos,
            query: opcoes.ignorarCache ? { disableCookieCache: true } : undefined,
            returnHeaders: true
        })
        return { sessao: response, setCookies: headers?.getSetCookie() ?? [] }
    } catch (erro) {
        console.error('[proxy] falha ao ler a sessão', erro)
        return 'falhou'
    }
}

/**
 * Segue para o render. Com cookies renovados, eles vão ao navegador **e** ao
 * `cookie` do request repassado — sem isto, o render deste mesmo request ainda
 * veria o cache expirado e iria ao banco.
 */
function seguir(request: NextRequest, setCookies: string[]) {
    if (setCookies.length === 0) return NextResponse.next()

    const cabecalhos = new Headers(request.headers)
    applySetCookies(cabecalhos, setCookies)
    return comCookies(NextResponse.next({ request: { headers: cabecalhos } }), setCookies)
}

function comCookies(resposta: NextResponse, setCookies: string[]) {
    for (const cookie of setCookies) resposta.headers.append('set-cookie', cookie)
    return resposta
}

function redirecionarParaLogin(request: NextRequest, motivo?: 'expirado') {
    const url = new URL('/login', request.url)
    url.searchParams.set('redirecionar', request.nextUrl.pathname + request.nextUrl.search)
    if (motivo) url.searchParams.set('motivo', motivo)
    return NextResponse.redirect(url)
}

/**
 * Grava o carimbo e reemite o cookie cache com ele. Sem a reemissão, o cache
 * continuaria com o carimbo antigo até expirar, e o proxy — que decide a
 * partir dele — regravaria a cada request depois do primeiro minuto.
 *
 * Falha aqui não pode derrubar a navegação: no pior caso o carimbo fica
 * defasado e o usuário é deslogado mais cedo do que o necessário.
 */
async function registrarAtividade(token: string, cabecalhos: Headers): Promise<string[]> {
    try {
        await db.update(sessionTable).set({ lastActivityAt: new Date() }).where(eq(sessionTable.token, token))
    } catch (erro) {
        console.error('[proxy] falha ao atualizar lastActivityAt', erro)
        return []
    }
    const lida = await lerSessao(cabecalhos, { ignorarCache: true })
    return lida === 'falhou' ? [] : lida.setCookies
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
        // checagem autoritativa com `resolverSessao()`, que também devolve o
        // cookie cache renovado ao navegador.
        //
        // `webmanifest` entra na mesma classe de `favicon.ico`/`robots.txt`:
        // metadata pública, sem dado de sessão. Sem a isenção, o navegador
        // recebe um redirect para `/login` ao buscar o manifest e a aplicação
        // deixa de ser instalável — falha silenciosa, porque nada na interface
        // indica que o manifest não carregou.
        //
        // **Prefetch fica de fora** (`missing`): cada `<Link>` visível dispara
        // um, e a sidebar tem até 16 — sem a isenção, cada página aberta
        // custaria uma invocação do proxy por link. Prefetch não é atividade
        // do usuário (não deve renovar `lastActivityAt`) e não precisa do gate
        // rápido: o render que ele pede passa pela checagem autoritativa dos
        // layouts e páginas, e a navegação real passa pelo proxy normalmente.
        {
            source: '/((?!api/auth|api/notificacoes|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js|webmanifest)$).*)',
            missing: [
                { type: 'header', key: 'next-router-prefetch' },
                { type: 'header', key: 'purpose', value: 'prefetch' }
            ]
        }
    ]
}
