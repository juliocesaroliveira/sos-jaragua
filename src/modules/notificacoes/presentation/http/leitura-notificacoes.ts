import { NextResponse } from 'next/server'
import { resolverSessao } from '@/src/shared/auth/sessao'
import { lerEstadoNotificacoes, versaoNotificacoes } from '../queries/notificacoes'

/**
 * Leitura periódica do sino (012-notificacoes-tempo-real,
 * contracts/leitura-notificacoes.md).
 *
 * Vive no módulo e não em `app/api/` — que apenas reexporta — por dois motivos:
 * é `presentation` do módulo dono do dado (Princípio I), e o `vitest` só
 * enxerga `src/**`, então um handler escrito direto em `app/` ficaria sem teste
 * de contrato.
 *
 * **Route Handler e não Server Action**: a documentação do Next instalado
 * (`docs/01-app/02-guides/server-actions.md`) é explícita — Server Actions são
 * despachadas "one at a time per client", e ela recomenda Route Handler "for
 * non-mutation requests". Uma leitura recorrente a cada 30s naquela fila
 * atrasaria as ações reais do usuário (marcar como lida, enviar candidatura,
 * registrar saída de estoque). O mesmo raciocínio já descartou o prefetch de
 * páginas vizinhas em `src/shared/query/use-listagem-paginada.ts`.
 *
 * **A rota está fora do matcher do `proxy.ts`**, ao lado de `api/auth`, por duas
 * razões verificadas — o comentário completo está no próprio `proxy.ts`:
 * o proxy redirecionaria em vez de responder 401 (e o cliente nunca pararia de
 * consultar), e renovaria `lastActivityAt` a cada consulta automática, anulando
 * o timeout de inatividade de staff. Atividade de fundo não é atividade do
 * usuário.
 *
 * A autorização não fica mais fraca por isso: `resolverSessao()` é a checagem
 * autoritativa — a mesma das Server Actions — e **lê** a sessão sem renovar
 * carimbo, inclusive encerrando as que já expiraram por inatividade. Os
 * `Set-Cookie` que ela devolve (cookie cache renovado) vão na resposta: uma
 * aba parada numa página, só consultando o sino, mantém assim o cache vivo sem
 * passar pelo proxy.
 *
 * **Custo por ciclo.** O cliente envia a `versao` do que já exibe; se nada
 * mudou, a resposta é `204` sem corpo, ao preço de uma consulta agregada
 * pequena. A lista só é lida quando a versão difere.
 */
export async function lerNotificacoesDaSessao(request: Request): Promise<NextResponse> {
    const { ator, setCookies } = await resolverSessao(request.headers)

    // Sem corpo: logout, expiração por inatividade e conta desativada colapsam
    // no mesmo 401, porque `resolverSessao()` já trata os três como ausência de
    // sessão. O cliente usa este status para parar em definitivo.
    if (!ator) return comCookies(new NextResponse(null, { status: 401 }), setCookies)

    const versaoDoCliente = new URL(request.url).searchParams.get('versao')
    if (versaoDoCliente && versaoDoCliente === (await versaoNotificacoes(ator.userId))) {
        return comCookies(new NextResponse(null, { status: 204, headers: SEM_CACHE }), setCookies)
    }

    // Lista, contador e versão saem da mesma consulta: dois endpoints ou duas
    // leituras poderiam devolver estados de instantes diferentes, e o contador
    // é justamente o que não pode divergir da lista (SC-006).
    return comCookies(NextResponse.json(await lerEstadoNotificacoes(ator.userId), { headers: SEM_CACHE }), setCookies)
}

/**
 * Dado por-usuário derivado de sessão: DESIGN.md §7 proíbe cachear. Sem isto,
 * um intermediário poderia servir as notificações de uma pessoa para outra.
 */
const SEM_CACHE = { 'Cache-Control': 'no-store' }

function comCookies(resposta: NextResponse, setCookies: string[]) {
    for (const cookie of setCookies) resposta.headers.append('set-cookie', cookie)
    return resposta
}
