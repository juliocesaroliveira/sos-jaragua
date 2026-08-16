# Research — Navegação lateral responsiva

**Feature**: `013-navegacao-lateral-responsiva` | **Data**: 2026-08-16

Investigações feitas contra o código e os pacotes **instalados** neste repositório
(`@ark-ui/react@5.38`, `@zag-js/dialog`, `next@16.3.0`). Cada decisão cita o arquivo verificado.

---

## D1 — A rolagem passa a ser a da página

**Decision**: remover a caixa de altura travada do shell. `app-shell.tsx` deixa de usar
`h-dvh overflow-hidden` no contêiner externo e `overflow-y-auto` no `<main>`; quem rola passa a
ser o documento.

**Achado** — `src/shared/ui/shell/app-shell.tsx:64,78`:

```
<div className="flex h-dvh flex-col overflow-hidden lg:flex-row">
  …
  <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
```

Essa dupla é a origem de todos os sintomas relatados. Com a página travada na altura da janela,
o navegador nunca detecta rolagem de documento — e é a rolagem de documento que aciona o recolher
da barra de endereço no celular. Não é ajuste de altura: enquanto a caixa existir, qualquer
correção pontual continua tratando sintoma.

**Barra superior e coluna passam a `sticky`**: a topbar (`sticky top-0`) e a coluna lateral
(`sticky top-0` com altura de viewport) permanecem visíveis enquanto a página rola. É o padrão
que substitui o layout de caixa sem reintroduzir contêiner rolante.

**Alternatives considered**: manter a caixa e tentar corrigir o travamento de rolagem do painel.
Rejeitado — não resolve a barra de endereço (FR-002) nem as barras duplas (FR-001), que são dois
terços da queixa.

---

## D2 — "Uma única região de rolagem" tem uma definição precisa

**Decision**: a regra do FR-001 vale para o **conteúdo da página**. Duas exceções são legítimas e
necessárias:

| Região | Rola? | Por quê |
| --- | --- | --- |
| Conteúdo da página | **Sim** — é a rolagem principal | FR-001, FR-002 |
| Coluna lateral (telas grandes) | Só se os destinos excederem a altura da janela | Landmark próprio, não compete com o conteúdo |
| Gaveta aberta (telas pequenas) | Sim, internamente | FR-005 exige, com 16 destinos em aparelho pequeno |
| Tabelas largas | **Horizontal apenas** (`table.tsx:92`) | Eixo diferente, não produz duas barras verticais |

**Rationale**: sem essa precisão, alguém lê FR-001 como "nenhum `overflow` em lugar nenhum" e
quebra a gaveta ou a tabela. O que o requisito proíbe é **duas barras verticais disputando o
mesmo conteúdo**, que é o que acontece hoje.

**Complemento**: a lista dentro da gaveta recebe contenção de rolagem, para que chegar ao fim dela
não transfira o gesto para a página atrás (FR-005).

---

## D3 — Nenhuma tela depende do contêiner rolante atual

**Decision**: a troca para rolagem de página pode ser feita sem varrer as telas uma a uma.

**Verificação**: busca por `overflow-y-auto`, `overflow-auto`, `sticky`, `h-full`, `h-dvh` e
`h-screen` em `app/` e nos componentes de tabela e kanban retornou **apenas**
`app/(publico)/cadastro/page.tsx` e `app/(publico)/login/page.tsx`, ambas com `min-h-dvh` — e
ambas **fora** do shell autenticado, logo não afetadas. `src/shared/ui/table/table.tsx:92` usa
`overflow-x-auto`, eixo horizontal, que permanece.

**Consequência para o plano**: a User Story 1 é uma mudança concentrada em `app-shell.tsx`, sem
efeito cascata previsto nas telas. Reduz muito o risco da fase que parecia mais arriscada.

---

## D4 — Gaveta reusa o `Drawer` existente, com um lado novo

**Decision**: estender `src/shared/ui/drawer/drawer.tsx` com `lado: 'left'` e construir a
navegação móvel sobre ele, em vez de criar um componente de gaveta próprio.

**Rationale**: o `Drawer` já é o primitivo `Dialog` do Ark
(`drawer.tsx:3,45`), já usado pelo sino de notificações. Seu mapa de posição
(`drawer.tsx:28-31`) hoje cobre `bottom` e `right`; falta `left`. Acrescentar uma entrada é
menor que duplicar backdrop, portal, cabeçalho, botão de fechar e área rolável — Princípio VI.

**Semântica**: o `Dialog` é anunciado como diálogo com o título "Navegação", e os destinos ficam
dentro de um `<nav aria-label>`. Isso atende FR-007 — o que a spec rejeita é a semântica **de
menu de ações** que existe hoje, não a existência do diálogo. Ver contrato G-02.

**Alternatives considered**: componente `GavetaNavegacao` próprio sobre `Dialog`. Rejeitado —
recriaria o que o `Drawer` já resolve, e faria a navegação divergir visualmente do sino.

---

## D5 — Contenção de foco, travamento de fundo e restauração vêm de graça

**Decision**: **não** escrever código de trap de foco, de travamento de rolagem de fundo nem de
devolução de foco ao gatilho.

**Achado** — `node_modules/@zag-js/dialog/dist/dialog.types.d.mts:33-56`:

| Opção | Default | Requisito que atende |
| --- | --- | --- |
| `trapFocus` | `true` | FR-009 (foco contido) |
| `preventScroll` | `true` | FR-003 (fundo não rola) |
| `restoreFocus` | `true` | FR-009 (foco volta ao gatilho) |
| `modal` | `true` | conteúdo abaixo escondido de leitores de tela |
| `closeOnEscape` / `closeOnInteractOutside` | `true` | FR-008 (Esc e toque fora) |

**Ligação crítica entre as histórias**: `preventScroll` age sobre o **documento**. Hoje ele já
está ativo no menu, e mesmo assim o fundo rola — porque quem rola não é o documento, é o `<main>`
(D1). Ou seja, **a US2 só entrega FR-003 depois da US1**. Essa dependência é real e não de
conveniência; construir a gaveta primeiro reproduziria o mesmo defeito com um componente novo.

---

## D6 — Fechar pelo gesto de voltar exige entrada de histórico

**Decision**: ao abrir a gaveta, empilhar uma entrada de histórico; ao fechar por qualquer outro
caminho, desempilhá-la. Um ouvinte de `popstate` fecha a gaveta.

**Rationale**: FR-008 exige fechar pelo botão/gesto de voltar do sistema — comportamento esperado
em Android. Sem entrada de histórico, o voltar **sai da tela atual** com a gaveta aberta, que é o
oposto do esperado.

A documentação do Next instalado autoriza explicitamente o uso da API nativa —
`docs/01-app/01-getting-started/04-linking-and-navigating.md:345-347`:

> "Next.js allows you to use the native `window.history.pushState` and `window.history.replaceState`
> methods to update the browser's history stack without reloading the page. `pushState` and
> `replaceState` calls integrate into the Next.js Router."

**Cuidado obrigatório**: fechar sem desempilhar deixaria lixo no histórico — o usuário teria que
apertar voltar duas vezes para sair da tela. O contrato G-04 fixa o par empilhar/desempilhar.

**Risco residual**: é a única parte da feature que mexe em histórico do navegador. Se o
comportamento se mostrar instável na integração com o roteador, a degradação aceitável é perder
só o fechamento por voltar — os outros três caminhos de fechamento (destino, fora, Esc)
continuam.

---

## D7 — Preferência da coluna segue o padrão anti-flash do tema

**Decision**: persistir em `localStorage` e aplicar por **script inline no `<head>`**, espelhando
`themeInitScript`.

**Achado** — `src/shared/ui/theme/theme-provider.tsx:19-30` e `app/layout.tsx:49`: o projeto já
resolve exatamente este problema para o tema, com script inline que grava classes no
`<html>` antes da hidratação, e um comentário explicando por que o estado do React começa no
padrão (`theme-provider.tsx:39-46`) — ler o DOM no inicializador do `useState` causaria erro de
hidratação.

**Por que importa aqui**: sem o script, a coluna renderiza expandida no HTML do servidor e salta
para recolhida após a hidratação. Um salto de largura de ~224px em toda navegação é pior que não
ter a funcionalidade.

**Forma**: atributo no `<html>` (ex.: `data-nav`), lido por CSS para dimensionar a coluna antes de
qualquer JavaScript de aplicação rodar. FR-017 (padrão expandida sem preferência gravada) fica no
próprio script, como o tema faz com `'light'`.

**Alternatives considered**: cookie lido no servidor. Funcionaria e evitaria o script, mas
introduziria leitura de cookie no layout — e o precedente do projeto para preferência de interface
já está estabelecido em `localStorage`. Divergir exigiria justificativa que não existe.

---

## D8 — Rótulo acessível não é o mesmo que dica visual

**Decision**: na coluna recolhida, cada destino mantém **sempre** um nome acessível textual (texto
visualmente oculto ou `aria-label`), **além** da dica visual em `Tooltip`.

**Rationale**: FR-018 e FR-019 são requisitos diferentes e a distinção é fácil de perder. O
`Tooltip` (`src/shared/ui/tooltip/tooltip.tsx:20`, com `posicao` e `atrasoMs`) resolve a dica
visual ao apontar ou focar — mas tooltip **não** é nome acessível, e não aparece em toque. Um
ícone sem texto associado é anunciado como link sem nome.

Como a coluna só existe em `lg+`, o toque é caso de borda (notebooks híbridos); ainda assim o
nome acessível é obrigatório em qualquer entrada.

---

## D9 — O menu de ações e sua fiação de âncora saem inteiros

**Decision**: remover `src/shared/ui/shell/menu-mobile.tsx`, o `useMenu`/`Ark.RootProvider` de
`app-shell.tsx:43-52,63` e o `Ark.Trigger`/`ref` de `topbar.tsx:39,47-58`.

**Rationale**: a fiação atual existe só para ancorar um menu suspenso à largura do `<header>` —
`app-shell.tsx:40-42` documenta essa intenção, herdada da feature 005. Com uma gaveta lateral,
âncora e posicionamento deixam de existir: a gaveta se posiciona pela borda da viewport.

**Simplificação colateral**: `Topbar` deixa de encaminhar `ref` e de depender do contexto do menu.
O botão de navegação vira um botão comum com `onClick`, e `TopbarProps` perde `menuAberto`. Menos
acoplamento entre topbar e navegação do que existe hoje.

**Atenção**: `topbar.tsx:61` esconde a identificação em `lg+` (`lg:hidden`), porque a coluna
expandida já a exibe (`sidebar-nav.tsx:36`). Com a coluna recolhida, **nenhuma das duas** a
mostraria. Ver contrato C-05.

---

## D10 — Limiar e destinos permanecem

**Decision**: o corte entre gaveta e coluna continua em `lg`; o catálogo de destinos, grupos,
ícones, ordem e filtragem por perfil não é tocado.

**Rationale**: FR-023, FR-024 e a Assumption da spec. `gruposVisiveis` e `itemAtivo`
(`src/shared/auth/navegacao.ts`) continuam sendo a fonte da estrutura, e os itens seguem chegando
já filtrados do servidor — `sidebar-nav.tsx:14-15` documenta que o navegador de um voluntário
nunca recebe destinos internos. Nada nesta feature toca esse caminho.

---

## Riscos residuais

| Risco | Mitigação |
| --- | --- |
| Fechamento por voltar instável na integração com o roteador (D6) | Degradar para os outros três caminhos de fechamento; nenhum outro requisito depende disso. |
| Salto visual da coluna na primeira pintura | Script inline no `<head>`, mesmo padrão já validado pelo tema (D7). |
| Alguma tela depender de altura de viewport de forma não detectada pela busca | A busca de D3 cobriu `app/` e os componentes de altura; qualquer resíduo aparece como conteúdo cortado, visível no roteiro de validação. |
| Coluna recolhida deixar a aplicação sem identificação visível (D9) | Contrato C-05 exige que a identificação permaneça em algum lugar nos dois estados. |
