# Fase 0 — Pesquisa e Decisões Técnicas

**Feature**: Migração do Toast para react-toastify

**Data**: 2026-08-13

**Método**: as afirmações abaixo sobre o `react-toastify` não vêm de memória nem da documentação online — o pacote `react-toastify@11.1.0` foi baixado e inspecionado (`dist/index.d.ts`, `dist/unstyled.mjs`, `dist/ReactToastify.css`, `package.json#exports`). Onde há número, ele foi medido.

---

## D1 — Usar `react-toastify/unstyled`, nunca o build padrão

**Decisão**: importar de `react-toastify/unstyled` e **não** importar `react-toastify/ReactToastify.css`.

**Evidência levantada**:

- O `package.json#exports` do pacote declara três entry points relevantes: `.`, `./unstyled` e `./ReactToastify.css`.
- Comparando os builds: `dist/index.mjs` tem **34.441 bytes**, `dist/unstyled.mjs` tem **16.684 bytes** — menos da metade.
- O `diff` entre `index.d.ts` e `unstyled.d.ts` mostra que a **API é idêntica**: ambos exportam `ToastContainer`, `toast`, `Bounce/Slide/Zoom/Flip`, `cssTransition`, `Icons`, `CloseButton` e todos os tipos. A única diferença é que o entry padrão exporta `StyledToastContainer as ToastContainer`, enquanto o `unstyled` exporta o `ToastContainer` cru.
- O `ReactToastify.css` define a aparência inteira via variáveis próprias: `--toastify-color-success: #07bc0c`, `--toastify-color-error: hsl(6, 78%, 57%)`, `--toastify-toast-bd-radius: 6px`, `--toastify-toast-width: 320px`, entre dezenas de outras, além de **22 blocos `@keyframes`**.

**Rationale**: adotar o build padrão significaria importar uma paleta completa (verde `#07bc0c`, raio de 6px, sombra própria) e depois combatê-la token a token. Isso cria duas fontes de verdade para o mesmo pixel e viola frontalmente a regra do design system de que variantes "seguem o mapeamento de cores da §3 — nunca cores ad-hoc". Qualquer estado que esquecêssemos de sobrescrever vazaria o visual da biblioteca para dentro da aplicação, e o modo de falha é silencioso: ninguém percebe até ver a tela.

Com o `unstyled` não existe CSS padrão. Não há o que sobrescrever, logo não há como vazar. O componente entrega apenas comportamento; a aparência é 100% nossa, pelos mesmos utilitários Tailwind que o toast atual já usa.

**Custo aceito**: o build `unstyled` também não traz o posicionamento do container nem as animações de entrada/saída. Ambos passam a ser responsabilidade nossa — tratados em D5 (animação) e resolvidos por classes Tailwind no container (posicionamento). É um custo pequeno e explícito, preferível a um custo difuso e recorrente de override.

> ### ⚠️ Correção pós-implementação — o custo de D1 estava subestimado
>
> A frase acima descrevia o custo do `unstyled` como sendo **visual**: posicionamento e animação. **Isso estava incompleto, e a diferença não é acadêmica — quebrou a feature.**
>
> No `react-toastify`, o auto-dismiss **não** é um `setTimeout`. A biblioteca renderiza uma barra de progresso, escreve nela `animation-duration` e `animation-play-state` **inline**, e fecha o aviso no `animationend` dessa animação (confirmado em `dist/unstyled.mjs`: `onAnimationEnd: () => { isIn && closeToast() }`). O `animation-name`, porém, vem da folha de estilo — que o `unstyled` não traz.
>
> Consequência observada na implementação: os avisos apareciam corretos e **nunca se fechavam sozinhos**. A pausa em hover, que é apenas `animation-play-state: paused`, também não funcionava, pelo mesmo motivo.
>
> Correção: `app/globals.css` passou a declarar `@keyframes aviso-progresso` e a regra `.Toastify__progress-bar--animated`. A barra segue invisível (paridade — o componente anterior não tinha progresso), mas com `opacity: 0` e **nunca** `display: none`: elemento com `display: none` não anima, e sem animação não há `animationend` — esconder do jeito errado voltaria a quebrar o fechamento automático.
>
> **A lição, para quem for revisitar esta decisão**: em `unstyled`, o CSS ausente não é só aparência. Parte do **comportamento** da biblioteca é implementada em CSS. D1 continua sendo a decisão certa — a paridade visual foi atingida exatamente porque não herdamos a paleta —, mas o custo real inclui possuir as regras de que o comportamento depende, não apenas as que se veem.
>
> Diagnosticar isso levou tempo porque as primeiras medições foram feitas com a aba em segundo plano, onde `requestAnimationFrame` é congelado e `pauseOnFocusLoss` está ativo — os avisos ficavam parados por motivo **legítimo**, o que mascarou o defeito real. Validação de comportamento temporal exige a aba visível e em foco.

**Alternativas consideradas**:

| Alternativa                                             | Por que foi rejeitada                                                                                                                          |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Build padrão + sobrescrever as variáveis `--toastify-*` | Exige mapear ~30 variáveis para os nossos tokens e manter esse mapa vivo a cada upgrade da lib. Duas fontes de verdade para a mesma aparência. |
| Build padrão + Tailwind com `!important`                | Guerra de especificidade contra uma folha de estilo que não controlamos. Frágil por natureza.                                                  |
| Manter o Ark e não migrar                               | Fora de escopo — a troca é o pedido explícito do usuário.                                                                                      |

---

## D2 — Tema por variante `dark:` do Tailwind, nunca pela prop `theme` da biblioteca

**Decisão**: nunca passar a prop `theme` do `react-toastify`. Todo o tema sai de classes Tailwind com variante `dark:`.

**Evidência levantada**:

- `app/globals.css` declara `@custom-variant dark (&:where(.dark, .dark *))` — o modo escuro do projeto é **dirigido por classe** no `<html>`, não por `prefers-color-scheme` puro.
- `src/shared/ui/theme/theme-provider.tsx` alterna `.dark`/`.light` no `document.documentElement`.
- O tipo da biblioteca é `Theme = 'light' | 'dark' | 'colored' | (string & {})`, aplicado por toast no momento da criação.

**Rationale**: esta decisão resolve de graça um requisito que, pelo caminho da prop, exigiria trabalho e ainda ficaria errado.

O cenário 3 da US2 pede que **um aviso já visível adote o novo tema quando o usuário alterna claro/escuro**. Pela prop `theme`, o valor é fixado no instante em que o aviso é criado: um aviso aberto continuaria com o tema antigo até morrer, e seria preciso assinar o `useTheme()` no container e forçar re-render para corrigir. Por classe Tailwind, a troca do `.dark` no `<html>` re-estiliza tudo que está na tela instantaneamente, em CSS puro, sem uma linha de JavaScript.

É o caminho mais simples **e** o mais correto ao mesmo tempo — os dois raramente coincidem, e aqui coincidem porque o projeto já escolheu tema por classe.

**Alternativa rejeitada**: passar `theme={theme}` lendo do `useTheme()`. Acopla o container ao contexto de tema, exige re-render e ainda deixa avisos abertos desatualizados.

---

## D3 — Preservar a API `avisar`; remover `toaster` do barrel

**Decisão**: `avisar.sucesso`, `avisar.erro`, `avisar.atencao` e `avisar.info` mantêm assinatura idêntica — `(titulo: string, descricao?: string)`. O export `toaster` sai de `src/shared/ui/index.ts`.

**Evidência levantada**:

- `src/shared/ui/index.ts:23` exporta hoje `{ Toaster, toaster, avisar }`.
- Busca por uso de `toaster.` em `app/` e `src/`, excluindo o próprio `src/shared/ui/toast/`: **zero ocorrências**. O `toaster` era detalhe de implementação do `createToaster` do Ark que vazou para o barrel público.
- Distribuição real dos 26 disparos: `avisar.sucesso` × 14, `avisar.erro` × 10, `avisar.info` × 2. **`avisar.atencao` não tem nenhum uso hoje** — é mantido mesmo assim, por simetria dos quatro tons do design system e porque a galeria o demonstra.

**Rationale**: preservar a assinatura é o que torna FR-012/SC-001 verificáveis por construção — se nenhum arquivo de tela precisa mudar, não há como esquecer um ponto de disparo e descobrir em produção. Remover `toaster` fecha a única porta pela qual o motor anterior vazava para fora do módulo, e é seguro porque foi verificado, não presumido.

**Durações preservadas** (medidas no componente atual): sucesso 5000ms, erro 8000ms, atenção 6000ms, informação 5000ms.

---

## D4 — O aviso inteiro é conteúdo nosso; a biblioteca não desenha nada

**Decisão**: renderizar o cartão completo (ícone + título + descrição + botão fechar) como conteúdo do toast, desligando os slots visuais da biblioteca: `icon: false`, `closeButton: false`, `hideProgressBar: true`.

**Evidência levantada** (opções confirmadas em `dist/index.d.ts`):

- `icon?: ToastIcon` — aceita `false`.
- `closeButton?: boolean | ((props) => ReactNode) | ReactElement` — aceita `false`.
- `hideProgressBar?: boolean`.
- `ToastContentProps` entrega `closeToast` ao conteúdo — ou seja, o nosso próprio botão de fechar tem acesso à função de dismiss, sem precisar do slot da lib.
- O build `unstyled` ainda aplica classes `Toastify__*` no DOM, mas **sem CSS correspondente** — são ganchos inertes, inofensivos.

**Rationale**: um único componente interno concentra a aparência do aviso. Isso evita o estado intermediário confuso em que parte do cartão vem de props da lib (`icon`) e parte vem do nosso conteúdo — que é onde divergências visuais nascem. Também elimina a necessidade de estilizar o botão de fechar da biblioteca por classe: ele simplesmente não existe.

`hideProgressBar` é paridade, não preferência: o toast atual do Ark não tem barra de progresso, e exibi-la seria uma mudança visual não pedida.

---

## D5 — Animação própria, com respeito a `prefers-reduced-motion`

**Decisão**: declarar dois `@keyframes` em `app/globals.css` (entrada: fade + deslize de baixo para cima; saída: o inverso) e ligá-los via `cssTransition`, exportado por `react-toastify/unstyled`.

**Evidência levantada**: os 22 `@keyframes` da biblioteca vivem em `ReactToastify.css`, que D1 decidiu não importar. As transições `Bounce`/`Slide`/`Zoom`/`Flip` continuam exportadas, mas dependem daquelas classes CSS — sem a folha, não animam.

**Rationale**: sem animação o aviso aparece por corte seco, o que é uma regressão perceptível frente ao toast atual. Duas regras de keyframe (~10 linhas de CSS) restauram a paridade com custo desprezível.

O bloco `prefers-reduced-motion` não é enfeite: avisos que entram deslizando podem incomodar usuários sensíveis a movimento, e o contexto de uso do sistema é operação sob estresse.

**Alternativa rejeitada**: importar apenas o trecho de animação do `ReactToastify.css`. Não é possível — o arquivo é monolítico e traria junto a paleta que D1 justamente evita.

---

## D6 — Reutilizar a escala de empilhamento existente

**Decisão**: o container recebe `z-100`, correspondente a `CAMADA.toast = 100`, já declarado em `src/shared/ui/cn.ts`.

**Evidência levantada**: `cn.ts` define a escala única `{ backdrop: 40, dialogo: 50, flutuante: 60, toast: 100 }`, com comentário explicando que a ordem é deliberada.

**Rationale**: o edge case "aviso exibido sobre um diálogo aberto" da spec já está resolvido pela escala existente (100 > 50). Inventar um valor novo criaria um segundo sistema de camadas e quebraria a garantia. Reutilizar é a resposta certa e não custa nada.

---

## D7 — Validação manual roteirizada, sem introduzir stack de teste de componente

**Decisão**: não escrever teste automatizado para este componente. A validação é o roteiro de `quickstart.md` mais a galeria em `/design-system`.

**Evidência levantada**:

- `vitest.config.ts` usa `environment: 'node'` e `include: ['src/**/*.test.ts']` — não coleta `.tsx` e não tem DOM.
- `package.json` não traz `jsdom`, `happy-dom`, `@testing-library/react` nem `@testing-library/jest-dom`.
- O projeto, hoje, **não tem nenhum teste de componente** — todos os testes existentes são de `domain/` e `application/`.

**Rationale**: esta é uma escolha deliberada, não uma omissão por conveniência. O Princípio III da constituição afirma textualmente que `presentation/` é fina por design e não exige a mesma cobertura de `domain`/`application`; e não há nenhuma regra de negócio nesta feature — o que se está trocando é o motor de exibição.

Cobrir este componente exigiria adicionar ao projeto um ambiente DOM, uma biblioteca de renderização e uma configuração de coleta nova, só para este arquivo. Isso é exatamente o tipo de complexidade sem valor comprovado que o Princípio VI manda evitar, e o custo recairia sobre toda a equipe a cada `npm test`.

O que **de fato** protege esta mudança é diferente e mais barato: preservar a assinatura de `avisar` (D3) faz o compilador TypeScript verificar os 26 pontos de disparo de graça — qualquer divergência de assinatura vira erro de build, não bug em produção.

**Se o projeto adotar teste de componente no futuro**, este é um bom primeiro candidato. Mas essa decisão pertence a uma discussão própria, não a um efeito colateral desta migração.

---

## D8 — Layout em coluna, não pilha colapsada (decisão do usuário, tomada durante a implementação)

**Decisão**: os avisos são dispostos em **coluna**, todos visíveis simultaneamente. O comportamento atual de pilha colapsada **não** é preservado.

**Como isto apareceu**: só na medição. Ao capturar a linha de base, os 4 avisos apareceram todos em `left: 691`, `top` entre 787 e 809 — sobrepostos, não em coluna. O `overlap: true` do `createToaster` do Ark monta uma pilha colapsada que expande no hover, e o `gap: 8` é o recuo entre cartões empilhados, **não** espaço de coluna.

Isso invalidou a premissa que eu havia escrito em `data-model.md` ("`gap-2`, equivalente ao `gap: 8` atual"), que era inferência a partir do nome da opção, não observação.

**Rationale da escolha**: a pilha colapsada só expande no **hover**, e mobile não tem hover. O contexto primário de uso deste sistema é operação em campo, no celular — onde os avisos ocultos ficariam inalcançáveis. Preservar o comportamento seria preservar um defeito de acessibilidade.

**Custo evitado**: manter a pilha exigiria portar ~60 linhas do `ReactToastify.css` (regras de `Toastify__toast--stacked`, com `--y`/`--s`/`--g`, `data-collapsed` e pseudo-elementos) que o projeto passaria a manter a cada upgrade da biblioteca. Coluna custa 3 classes Tailwind.

> Nota: essas ~60 linhas são puramente mecânicas (transform, position, opacity) — portá-las **não** feriria D1, que trata de não herdar defaults **visuais** (cor, raio, sombra). A rejeição aqui é por custo de manutenção e por acessibilidade, não por conflito com D1.

**Impacto na validação**: o Cenário 6 de `quickstart.md` muda de critério — o esperado passa a ser "4 avisos visíveis em coluna", não "empilhados".

**Alternativa rejeitada**: `stacked: true` do react-toastify + porte do CSS de empilhamento. Recria fielmente o comportamento atual, incluindo o problema em mobile.

---

## D10 — `pointer-events` no container e no cartão (achado durante a validação)

**Decisão**: o container recebe `pointer-events-none` e o cartão do aviso recebe `pointer-events-auto`.

**Como apareceu**: ao validar o edge case "aviso sobre diálogo aberto", o aviso ficava visível e por cima, mas o `elementFromPoint` no centro dele devolvia o `<html>` — ou seja, o cartão não era alcançável por clique. Causa: o `Dialog` do Ark escreve `pointer-events: none` inline no `<body>` enquanto está aberto, e `pointer-events` é herdado.

**É pré-existente, não regressão**: o toast anterior também vivia dentro do `<body>` e herdaria a mesma inércia. A spec listava "continua legível e **clicável**" como esperado, o que na prática não era verdade antes.

**Rationale**: é o mesmo padrão que o build estilizado da própria biblioteca usa. Resolve duas coisas de uma vez — o aviso volta a ser clicável com diálogo aberto, e a área vazia do container deixa de interceptar cliques destinados à tela por baixo.

---

## Resumo das decisões

| #   | Decisão                                               | Requisito que atende                            |
| --- | ----------------------------------------------------- | ----------------------------------------------- |
| D1  | Entry point `react-toastify/unstyled`                 | FR-008, FR-009, SC-003                          |
| D2  | Tema por variante `dark:` do Tailwind                 | FR-009, US2 cenário 3                           |
| D3  | API `avisar` preservada; `toaster` removido do barrel | FR-011, FR-012, FR-013, SC-001, SC-005          |
| D4  | Cartão inteiro renderizado por nós                    | FR-002, FR-005, FR-008, FR-010                  |
| D5  | Keyframes próprios + `prefers-reduced-motion`         | Paridade visual (SC-003)                        |
| D6  | `z-100` da escala `CAMADA` existente                  | Edge case "aviso sobre diálogo"                 |
| D7  | Validação manual roteirizada                          | Princípios III e VI                             |
| D8  | Coluna em vez de pilha colapsada                      | FR-007 (não obstruir), acessibilidade em mobile |
| D9  | CSS da barra de progresso (é o cronômetro)            | FR-003, FR-004 — ver correção em D1             |
| D10 | `pointer-events` none no container / auto no cartão   | Edge case "aviso sobre diálogo"                 |

**Nenhum `NEEDS CLARIFICATION` permaneceu em aberto.**
