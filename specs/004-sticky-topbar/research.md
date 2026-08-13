# Research: Topbar Fixo Durante a Rolagem

**Feature**: [spec.md](./spec.md)

## Contexto atual

`AppShell` (`src/shared/ui/shell/app-shell.tsx`) monta:

```
<div class="flex min-h-dvh flex-col lg:flex-row">
  <SidebarNav .../>                        <!-- coluna em lg+, gaveta inline abaixo de lg -->
  <div class="flex min-w-0 flex-1 flex-col">
    <Topbar .../>
    <main class="min-w-0 flex-1 p-4">{children}</main>
  </div>
</div>
```

`min-h-dvh` só garante altura **mínima**; a `<div>` raiz cresce livremente com o conteúdo e é o `<html>`/`<body>` quem rola. `Topbar` está no fluxo normal — some ao rolar, que é exatamente o defeito descrito na spec (FR-001, US1, US2).

## D1 — Como fixar o topbar: `position: sticky` vs. contêiner de altura travada

**Decisão**: travar a altura do shell em `h-dvh` + `overflow-hidden` na raiz, e mover a rolagem para dentro de `<main>` (`overflow-y-auto`). O `Topbar` deixa de precisar de qualquer `position` especial — ele simplesmente nunca entra em uma área que rola.

**Alternativas consideradas**:

- **`sticky top-0` no `Topbar`, mantendo a página inteira rolável.** Funciona isoladamente, mas exige um `z-index` explícito e uma decisão de empilhamento em relação à gaveta mobile — que hoje é renderizada **acima** do `Topbar` no fluxo (mesmo container `flex-col`), então ao abrir a gaveta e rolar, o `Topbar` sticky ficaria colado no topo _sobre_ uma gaveta que não é sticky, produzindo exatamente o "corte/sobreposição incorreta" que o FR-006/edge case da spec proíbe. Corrigir isso exigiria também tornar a gaveta sticky ou transformá-la em overlay — mudança maior, fora do que a spec pede.
- **`position: fixed` no `Topbar` + `padding-top` no `main` do tamanho da barra.** Precisa manter o padding sincronizado com a altura real do topbar (que varia: nome/role só aparecem em `sm:flex`, botão de menu só existe com `mostrarBotaoMenu`), correndo risco de gap ou sobreposição de 1px em algum breakpoint. O contêiner de altura travada não tem esse acoplamento — a altura do topbar é apenas mais uma linha do flexbox.

**Rationale**: contêiner travado é a opção mais simples (Princípio VI) — zero `z-index`, zero sincronização de altura, e a gaveta mobile continua exatamente onde está hoje (empurra o layout, não sobrepõe), sem precisar de nenhuma mudança de comportamento nela.

## D2 — Gaveta mobile (drawer) dentro do contêiner travado

**Decisão**: manter `SidebarNav` como está — sibling em fluxo normal, antes da coluna Topbar+main no `flex-col` mobile. Ao abrir a gaveta dentro do container `h-dvh overflow-hidden`, ela consome altura do flexbox; a coluna Topbar+main simplesmente recebe menos espaço, e é `<main>` (com seu próprio `overflow-y-auto`) que absorve a diferença encolhendo — nunca o `Topbar`.

**Alternativas consideradas**:

- **Transformar a gaveta em overlay (`position: fixed`/`absolute`) sobre o conteúdo.** Resolveria o mesmo problema por outro caminho, mas é uma mudança de comportamento de navegação não pedida pela spec (que só fala do topbar) e exigiria seu próprio gerenciamento de `z-index` e clique-fora-para-fechar. Rejeitado por escopo.

**Rationale**: o comportamento observável pedido (drawer não escondido, sem corte) já é satisfeito pela composição do D1, sem tocar `SidebarNav`.

## D3 — `min-h-0` nos ramos flex intermediários

**Decisão**: adicionar `min-h-0` na `<div>` coluna (Topbar+main) e manter `flex-1` em `<main>` com `overflow-y-auto`.

**Rationale**: o padrão do Flexbox é `min-height: auto`, que impede um item flex de encolher além do tamanho do seu conteúdo — sem `min-h-0`, `<main>` tentaria crescer para caber todo o conteúdo em vez de ativar sua própria rolagem, e a rolagem voltaria a "vazar" para a raiz (regressão do próprio bug que a feature corrige). É um detalhe de implementação bem documentado do Flexbox, não uma decisão de produto.

## D4 — Unidade de viewport (`dvh` vs. `vh`)

**Decisão**: manter `dvh` (já em uso em `min-h-dvh`), só trocando `min-` por altura fixa.

**Rationale**: `100vh` em navegadores mobile (Safari/Chrome) inclui a área ocupada pela barra de endereço retrátil, causando um contêiner ligeiramente maior que a área visível real e reintroduzindo rolagem residual da página. `dvh` (dynamic viewport height) já resolve isso e é suportado pelos browsers-alvo do projeto; não há motivo para trocar.

## D5 — Testes

**Decisão**: sem novo teste automatizado. A mudança é puramente de CSS/layout (classes Tailwind), sem lógica nova em `domain`/`application` — cai na categoria "apresentação fina" do Princípio III, validada por contrato (este plano) e pelo roteiro manual em `quickstart.md`. O projeto não tem `@testing-library/react`/`jsdom` instalado hoje; introduzir esse tooling só para travar classNames de layout seria complexidade nova sem necessidade comprovada (Princípio VI).

**Alternativas consideradas**: teste de snapshot das classes do `AppShell`. Rejeitado — travaria a implementação (nomes de classes Tailwind) em vez do comportamento, e quebraria a cada ajuste visual não relacionado a esta feature.

## Resumo das decisões

| #   | Decisão                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Contêiner de altura travada (`h-dvh overflow-hidden` na raiz, `overflow-y-auto` em `main`) em vez de `sticky`/`fixed` no `Topbar` |
| D2  | `SidebarNav` inalterada — a gaveta mobile continua empurrando o layout, agora dentro do contêiner travado                         |
| D3  | `min-h-0` nos ramos flex intermediários para a rolagem realmente ficar em `main`                                                  |
| D4  | Manter `dvh` como unidade de viewport                                                                                             |
| D5  | Sem teste automatizado novo; validação por `quickstart.md`                                                                        |
