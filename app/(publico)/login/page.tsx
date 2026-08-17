import type { Metadata } from 'next'
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
              **Centralizado nos dois eixos**, em todas as larguras.

              Centralização vertical e altura variável brigam entre si: a
              alternância entre "opções" e "e-mail e senha" muda a altura do
              cartão, e centralizado metade dessa variação vira deslocamento do
              topo — na primeira versão desta tela o cartão saltava 18px sob os
              olhos de quem só havia clicado em um botão (FR-020).

              A saída **não** foi abrir mão da centralização, e sim tirar a
              variação: `login-form.tsx` reserva a altura do estado mais alto,
              então o cartão tem altura constante e centralizá-lo é seguro. Ver
              o comentário do `min-h` lá.

              `min-h-dvh` e não `h-dvh`: em tela baixa (celular em paisagem) o
              conteúdo não cabe e precisa rolar, não ser cortado — e aí
              `justify-center` degrada sozinho para o topo, sem cortar nada.
            */}
            <main className="isolate flex min-h-dvh w-full flex-col items-center justify-center gap-8 p-4 py-10 sm:p-6 sm:py-14 lg:flex-row lg:items-center lg:justify-center lg:gap-16 lg:p-12">
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
                </div>
            </main>
        </>
    )
}
