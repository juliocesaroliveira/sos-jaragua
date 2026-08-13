# Research: Menu Mobile/Tablet Abaixo do Topbar

**Feature**: [spec.md](./spec.md)

## Contexto atual

Hoje, `SidebarNav` (`src/shared/ui/shell/sidebar-nav.tsx`) é um único componente para as duas variantes:

- **Desktop (`lg+`)**: coluna fixa lateral (`lg:w-72 lg:shrink-0 lg:overflow-y-auto lg:border-r`).
- **Mobile/tablet (abaixo de `lg`)**: o mesmo `<nav>`, alternando `hidden` / visível conforme `menuAberto`, **renderizado como sibling antes** da coluna que contém `Topbar` + `<main>` (`app-shell.tsx`). É por isso que o painel aparece **acima** da barra superior quando aberto — puro efeito de ordem no fluxo do flexbox, não uma escolha deliberada.

O botão de menu (hambúrguer) vive dentro de `Topbar` (`topbar.tsx`) e hoje é um `IconButton` comum com `onClick={onAlternarMenu}`; o estado `menuAberto` é local a `AppShell` (`useState`).

O projeto já tem dois wrappers Ark UI relevantes em `src/shared/ui/`:

- `menu/menu.tsx` — `Ark.Menu` para **ações contextuais** (Aprovar/Rejeitar/Editar): lista plana, sem grupos, item selecionado via `onSelect` (não é link), posicionado relativo ao próprio botão-gatilho (`bottom-end`), largura pequena (`min-w-48`).
- `drawer/drawer.tsx` — `Ark.Dialog` com backdrop e posicionamento `fixed inset-0`: painel modal de tela cheia/parcial, com título obrigatório.

## D1 — Por que nem o `Menu` existente nem o `Drawer` existente servem como estão

**Decisão**: construir um componente novo (`menu-mobile.tsx`) sobre os primitivos Ark UI Menu (`@ark-ui/react/menu`), não reaproveitar `src/shared/ui/menu/menu.tsx` nem `src/shared/ui/drawer/drawer.tsx` como estão.

**Por quê**:

- `Menu` (wrapper atual) foi desenhado para uma lista plana de ações via `onSelect`, sem `Ark.Menu.ItemGroup`/`ItemGroupLabel`, sem itens como link (`<Link>`), e com posicionamento relativo ao próprio botão pequeno — não ao contêiner inteiro do topbar. Adaptá-lo genericamente para os dois casos (ação contextual de linha vs. navegação principal) misturaria dois contratos diferentes num componente só.
- `Drawer` é exatamente o padrão que a spec **não** pede: tem backdrop (`bg-black/50` cobrindo a tela) e título obrigatório — um overlay modal, não um painel "pendurado" abaixo da barra. O pedido do stakeholder de usar "o Menu do ark-ui", e não o Drawer já disponível, é consistente com essa distinção (Assumptions da spec).
- Os primitivos brutos do Ark UI Menu (`Menu.RootProvider`/`useMenu`, `Menu.Trigger`, `Menu.Positioner`, `Menu.Content`, `Menu.ItemGroup`, `Menu.ItemGroupLabel`, `Menu.Item`) suportam tudo que a spec pede sem adaptação forçada: `open`/`onOpenChange` controlado (FR-003), `closeOnSelect` (padrão `true`, FR-004), dismissable por clique fora/Esc (FR-005) e navegação por teclado/typeahead nativos (FR-006) — confirmado em `@zag-js/menu` (`menu.types.d.ts`).

**Alternativas consideradas**: estender `menu.tsx` com uma prop de "modo navegação" (grupos + links). Rejeitado — o componente genérico é usado em vários lugares para ações de linha; acoplar um modo especial de navegação principal a ele reduziria a clareza de ambos os usos (Princípio VI).

## D2 — Ancorar o painel ao topbar inteiro, não ao botão

**Decisão**: usar `positioning.getAnchorElement` (opção documentada em `@zag-js/popper`, `types.d.ts`) apontando para o elemento `<header>` do `Topbar` — não para o botão de hambúrguer — combinado com `placement: 'bottom'` e `sameWidth: true`.

**Por quê**: o `MenuTrigger` é o botão pequeno de hambúrguer; se o painel for ancorado a ele (comportamento padrão de qualquer menu Ark), o resultado seria um dropdown estreito preso ao botão, não um painel de largura cheia "abaixo do topbar" como a spec descreve (FR-001). `getAnchorElement` permite manter o `Trigger` no botão (preservando a semântica de abrir/fechar — FR-003) enquanto o posicionamento visual usa o retângulo do topbar inteiro.

**Alternativas consideradas**: `sameWidth` relativo ao próprio `Trigger` mais CSS `w-screen` manual sobrepondo o cálculo do Floating UI. Rejeitado — brigaria com o middleware de posicionamento do Ark em vez de usar a opção que ele já expõe para esse exato caso.

## D3 — Estado controlado único, compartilhado entre `Topbar` e o novo painel

**Decisão**: manter `menuAberto`/`setMenuAberto` como a única fonte de verdade em `AppShell` (sem mudança de forma), só que agora alimentando `useMenu({ open: menuAberto, onOpenChange, positioning })`. O `store` resultante é compartilhado entre `Topbar` (que renderiza `Menu.Trigger asChild` em volta do `IconButton` já existente) e o novo painel via `Menu.RootProvider`, já que ambos precisam estar no mesmo "menu" mas vivem em componentes-irmãos dentro de `AppShell`.

**Por quê**: `Menu.RootProvider` existe exatamente para esse caso — separar o *store* (criado uma vez, no componente pai) do *trigger* e do *conteúdo* (que podem viver em componentes-filhos diferentes) — documentado em `menu-root-provider.d.ts`. Sem isso, `Menu.Trigger` e `Menu.Positioner`/`Content` precisariam estar na mesma árvore direta de `Menu.Root`, o que forçaria fundir `Topbar` e o painel num único componente.

**Alternativas consideradas**: mover o botão de hambúrguer para dentro do próprio componente de painel (eliminando a necessidade de compartilhar o store). Rejeitado — o botão pertence visualmente e semanticamente ao topbar (FR-002/FR-003), e movê-lo mudaria a barra superior sem necessidade.

## D4 — Grupos e itens dentro do painel

**Decisão**: espelhar a estrutura que `sidebar-nav.tsx` já usa para desktop — `gruposVisiveis(itens)` para seções, renderizadas como `Menu.ItemGroup` + `Menu.ItemGroupLabel`, e cada `ItemNavegacao` como `Menu.Item asChild` envolvendo um `<Link>` do Next.js (FR-009).

**Por quê**: `Menu.Item` aceita `asChild` (via `PolymorphicProps`, confirmado em `menu-item.d.ts`), então o mesmo `<Link href>` de hoje continua funcionando dentro do primitivo Ark — sem reescrever a navegação em si, só o contêiner visual. `closeOnSelect` (padrão `true`) fecha o painel ao escolher um item sem precisar do `onClick={onNavegar}` manual que existe hoje.

## D5 — Escopo desktop inalterado

**Decisão**: `SidebarNav` (desktop) perde a variante mobile — passa a ser sempre `hidden lg:flex` (sem depender de `menuAberto`), e `menuAberto`/`onNavegar` saem de `SidebarNavProps`. A navegação mobile/tablet deixa de existir dentro de `SidebarNav`.

**Por quê**: FR-008 exige zero mudança de comportamento em desktop. Como o painel mobile/tablet passa a ser um componente próprio anexado ao `Topbar` (não mais um sibling em fluxo normal), `SidebarNav` só precisa continuar existindo para `lg+` — simplifica sua responsabilidade em vez de acumular duas variantes num componente (Princípio VI).

## D6 — Sem novo teste automatizado

**Decisão**: mesma linha de `004-sticky-topbar` (research.md D5) — sem `@testing-library/react`/`jsdom` no projeto hoje, a mudança é de apresentação/composição de componentes já existentes com um primitivo já usado no design system. Validação por contrato (`contracts/mobile-menu-panel.md`) e roteiro manual (`quickstart.md`).

**Alternativas consideradas**: nenhuma — decisão consistente com a feature anterior, sem motivo novo para revisitá-la.

## Resumo das decisões

| # | Decisão |
|---|---------|
| D1 | Primitivos brutos do Ark UI Menu, não o wrapper `Menu` existente nem `Drawer` |
| D2 | `positioning.getAnchorElement` no `<header>` do Topbar + `placement: 'bottom'` + `sameWidth: true` |
| D3 | `useMenu` controlado por `menuAberto`, compartilhado via `Menu.RootProvider` entre `Topbar` e o novo painel |
| D4 | `Menu.ItemGroup`/`ItemGroupLabel` + `Menu.Item asChild` com `<Link>`, espelhando a estrutura de `sidebar-nav.tsx` |
| D5 | `SidebarNav` volta a ser desktop-only; a variante mobile some dela |
| D6 | Sem teste automatizado novo |
