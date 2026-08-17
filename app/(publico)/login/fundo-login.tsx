/**
 * Camada de fundo da tela de login (014-redesign-tela-login, FR-006a a FR-006g).
 *
 * São **duas** camadas empilhadas, e a ordem importa:
 *
 * 1. `gradiente de marca` — sempre presente, derivado de tokens. É **ele** que
 *    garante o contraste do conteúdo, não a fotografia.
 * 2. `fotografia` — opcional, só a partir de `md`, com um scrim por cima.
 *
 * A separação é o que torna a fotografia um ativo trocável em vez de um
 * pré-requisito: enquanto `public/login/fundo-login.jpg` não existir, a tela
 * fica completa e correta com o gradiente, e o dia em que a foto chegar é um
 * import a mais (research.md D2).
 *
 * O contraste **nunca** é calculado contra a fotografia (research.md D3): todo
 * texto vive ou dentro do cartão de acesso — cuja opacidade é alta o bastante
 * para o fundo efetivo ser praticamente o token de superfície — ou sobre a zona
 * coberta pelo scrim, que tem opacidade mínima garantida. Por isso trocar a
 * imagem depois não reabre a auditoria de contraste.
 *
 * Server Component: é imagem e gradiente, sem estado. Nada disto precisa
 * atravessar para o cliente (research.md D9).
 */

/*
 * Descomentar junto com o bloco `<Image>` abaixo quando a fotografia chegar,
 * com procedência registrada em `public/login/PROCEDENCIA.md` (FR-006g).
 *
 * O import é estático de propósito: é o que faz o build embutir dimensões e
 * `blurDataURL`, e é o `blurDataURL` que impede o deslocamento de layout na
 * chegada da imagem (SC-006).
 */
// import Image from 'next/image'
// import fotografia from '@/public/login/fundo-login.jpg'

export function FundoLogin() {
    return (
        /*
          `fixed inset-0` e não `absolute`: a tela rola em telas baixas (celular
          em paisagem) e o fundo precisa acompanhar a viewport, não o documento.

          `-z-10` mantém a camada atrás do conteúdo sem entrar na escala `CAMADA`
          de `cn.ts` — aquela escala é para elementos flutuantes (diálogo, menu,
          toast), e um fundo decorativo não pertence a ela.

          `aria-hidden` e `pointer-events-none`: é decoração. Não é anunciado por
          leitor de tela (FR-014) e não intercepta toque.
        */
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            {/*
              Camada 1 — gradiente de marca, incondicional (FR-006d).

              Sai dos tokens da §1.1 do design system: laranja da marca no canto
              superior, azul-ardósia descendo para a superfície. Nenhuma cor
              avulsa (FR-005).

              É esta camada que responde por o contraste estar correto antes de
              a fotografia carregar — ou para sempre, se ela nunca chegar.
            */}
            <div className="absolute inset-0 bg-linear-160 from-primary-700 via-neutral-800 to-neutral-950 dark:from-primary-950 dark:via-neutral-950 dark:to-black" />

            {/*
              Camada 2 — fotografia, só a partir de `md` (FR-006e).

              Ausente no celular por decisão explícita (research.md D1): sob 3G,
              em campo, a foto pagaria bytes por uma área que o cartão de acesso
              já cobre quase inteira. Cortá-la é o que entrega a SC-006a.

              Quando descomentar:
              - `sizes="(min-width: 768px) 100vw, 0px"` — o `0px` abaixo de `md`
                é o que impede o celular de baixar a variante de desktop.
              - sem `priority`: a foto não pode competir com o conteúdo (FR-006d).
              - `object-cover` preserva o assunto sem distorcer quando a
                proporção da viewport não bate com a da imagem.

              **Sem transição de opacidade na chegada da imagem.** A tentação é
              fazer a foto surgir em fade, mas isso exigiria um componente de
              cliente só para saber quando ela carregou — e o `placeholder="blur"`
              já entrega a transição percebida, do desfoque para o nítido, sem
              JavaScript. Menos uma animação a suprimir sob movimento reduzido
              (FR-015) e menos um byte no cliente.
            */}
            {/*
            <div className="absolute inset-0 hidden md:block">
                <Image
                    src={fotografia}
                    alt=""
                    fill
                    placeholder="blur"
                    sizes="(min-width: 768px) 100vw, 0px"
                    className="object-cover object-center"
                />
            </div>
            */}

            {/*
              Scrim sobre a fotografia (FR-006c).

              O gradiente **não chega a zero** em lugar nenhum: `from-neutral-950/85`
              cobre a faixa onde vive o painel institucional e o mínimo de
              `to-neutral-950/60` vale para o resto. Um scrim que desvanecesse até
              transparente devolveria o contraste para as mãos da fotografia, que
              é exatamente o que a FR-006c proíbe.

              Tratamento próprio por tema (FR-006f): no escuro o scrim é mais
              denso, porque o cartão translúcido também é mais escuro e precisa
              continuar se distinguindo do fundo.

              Fica fora do bloco comentado acima de propósito: sobre o gradiente
              sozinho ele apenas aprofunda o tom, o que é inofensivo, e assim não
              há um segundo trecho a lembrar de descomentar depois.

              **Presente em todas as larguras, não só onde há fotografia.** Foi
              assim que nasceu — `hidden md:block` — e estava errado: medido no
              navegador, sem o scrim a parada mais clara do gradiente no tema
              claro (`primary-700`, rgb(202,53,0)) deixava a descrição em 3,51:1
              e o link do cadastro em 3,06:1, contra o mínimo de 4,5:1 da
              FR-012. Com o scrim, os mesmos textos ficam em 9,39:1 e 8,19:1.

              O scrim não é "a camada que trata a foto": é a camada que torna o
              contraste independente do que estiver atrás. Limitá-lo ao desktop
              abria um buraco justamente no mobile, que é o cenário de campo.
              Custo de mantê-lo sempre: zero — é um gradiente CSS.
            */}
            <div className="absolute inset-0 bg-linear-to-br from-neutral-950/85 via-neutral-950/70 to-neutral-950/60 dark:from-black/90 dark:via-black/80 dark:to-black/75" />
        </div>
    )
}
