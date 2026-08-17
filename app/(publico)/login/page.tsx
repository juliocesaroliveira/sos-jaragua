import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { obterSessao } from '@/src/shared/auth/sessao'
import { AREA_PADRAO } from '@/src/shared/auth/rotas'
import { SkeletonLista } from '@/src/shared/ui'
import { FundoLogin } from './fundo-login'
import { PainelMarca } from './painel-marca'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
    title: 'Entrar — SOS Jaraguá'
}

/**
 * Checa sessão a cada requisição para redirecionar quem já está autenticado
 * (FR-003) — dado derivado de sessão, não prerenderizável (DESIGN.md §7).
 */
export const instant = false

/**
 * Tela de login (014-redesign-tela-login).
 *
 * Composição em três camadas (`contracts/tela-login.md`):
 *
 * 1. Fundo decorativo, fora do fluxo — `FundoLogin`
 * 2. Scrim de contraste, dentro do mesmo componente
 * 3. Conteúdo, no fluxo: painel institucional e cartão de acesso
 *
 * Duas composições distintas, separadas em `lg`:
 *
 * - **Base**: coluna única. Marca compacta acima, cartão abaixo. Sem
 *   translucidez e **sem desfoque** — não há fotografia atrás no celular, e
 *   `backdrop-filter` é caro em Android de baixo custo (research.md D1).
 * - **`lg`+**: duas zonas lado a lado, cartão translúcido sobre a fotografia.
 *
 * `min-h-dvh` e não `h-dvh`: em celular na horizontal (~360×400) o conteúdo não
 * cabe, e precisa rolar em vez de ser cortado.
 */
export default async function LoginPage() {
    // Usuário já autenticado não deve ver o formulário de login (FR-003).
    const ator = await obterSessao()
    if (ator) redirect(AREA_PADRAO)

    return (
        <>
            <FundoLogin />

            {/*
              `isolate` cria o contexto de empilhamento que mantém o `-z-10` do
              fundo contido nesta tela, em vez de o jogar atrás do `<body>`.
            */}
            {/*
              **Ancorado pelo topo, não centralizado verticalmente** (FR-020).

              A versão centralizada parecia melhor e estava errada: a alternância
              entre "opções" e "e-mail e senha" muda a altura do cartão em ~36px,
              e com `justify-center` metade disso vira deslocamento do topo — o
              cartão saltava 18px sob os olhos de quem só clicou em um botão.
              Medido, não suposto.

              Centralização vertical e altura variável são incompatíveis: ou se
              trava a altura com um número mágico, ou não se centraliza. O
              contrato escolheu não centralizar, então o cartão cresce **só para
              baixo** e o que já estava sob os olhos do usuário fica onde estava.

              A folga vertical cresce com a largura para que em telas altas o
              conteúdo não fique colado no topo.
            */}
            <main className="isolate flex min-h-dvh w-full flex-col items-center justify-start gap-8 p-4 py-10 sm:p-6 sm:py-14 lg:flex-row lg:items-start lg:justify-center lg:gap-16 lg:p-12 lg:py-24">
                <PainelMarca />

                {/*
                  O cartão de acesso. `w-full max-w-md` limita a largura de
                  leitura para que em 2560px ele não se estique (FR-009);
                  `lg:shrink-0` impede que o painel institucional o comprima.
                */}
                <div className="w-full max-w-md lg:shrink-0">
                    {/*
                      Superfície do cartão.

                      Base: `bg-surface` sólido, sem desfoque.
                      `md`+: translúcido com desfoque — mas com opacidade **alta**
                      (`/95`), porque o contraste do texto é calculado contra o
                      token de superfície, não contra a fotografia (research.md
                      D3). O "vidro" é efeito de borda, não transparência de
                      leitura.

                      `supports-[backdrop-filter]`: onde o desfoque não existe, o
                      fundo fica opaco em vez de translúcido sem desfoque — que
                      seria o pior dos dois mundos.
                    */}
                    <div className="rounded-xl border border-border bg-surface p-6 shadow-lg sm:p-8 md:bg-surface/95 md:supports-[backdrop-filter]:backdrop-blur-xl">
                        {/* `useSearchParams` no formulário exige um limite de Suspense. */}
                        <Suspense fallback={<SkeletonLista linhas={4} />}>
                            <LoginForm />
                        </Suspense>
                    </div>

                    {/*
                      Convite ao cadastro **fora** do cartão e fora do bloco que
                      alterna entre opções e credenciais (FR-028): precisa
                      continuar acessível nos dois estados da tela.

                      Texto claro fixo pelo mesmo motivo do `PainelMarca`: está
                      sobre o fundo escuro, que não muda entre os temas.
                    */}
                </div>
            </main>
        </>
    )
}
