import { NextResponse } from 'next/server'
import { obterSessao } from '@/src/shared/auth/sessao'
import { contarNaoLidas, listarNotificacoes } from '../queries/notificacoes'

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
 * A autorização não fica mais fraca por isso: `obterSessao()` é a checagem
 * autoritativa — a mesma das Server Actions — e **lê** a sessão sem renovar
 * carimbo, inclusive encerrando as que já expiraram por inatividade.
 */
export async function lerNotificacoesDaSessao(): Promise<NextResponse> {
    const ator = await obterSessao()

    // Sem corpo: logout, expiração por inatividade e conta desativada colapsam
    // no mesmo 401, porque `obterSessao()` já trata os três como ausência de
    // sessão. O cliente usa este status para parar em definitivo.
    if (!ator) return new NextResponse(null, { status: 401 })

    // Em paralelo e na mesma resposta: dois endpoints separados poderiam
    // devolver estados de instantes diferentes, e o contador é justamente o que
    // não pode divergir da lista (SC-006).
    const [notificacoes, naoLidas] = await Promise.all([listarNotificacoes(ator.userId), contarNaoLidas(ator.userId)])

    return NextResponse.json(
        { notificacoes, naoLidas },
        {
            headers: {
                // Dado por-usuário derivado de sessão: DESIGN.md §7 proíbe
                // cachear. Sem isto, um intermediário poderia servir as
                // notificações de uma pessoa para outra.
                'Cache-Control': 'no-store'
            }
        }
    )
}
