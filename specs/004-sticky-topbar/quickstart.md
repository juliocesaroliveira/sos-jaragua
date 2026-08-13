# Quickstart: Validar Topbar Fixo Durante a Rolagem

**Feature**: [spec.md](./spec.md) · **Contrato**: [contracts/app-shell-layout.md](./contracts/app-shell-layout.md)

## Pré-requisitos

- Sessão autenticada em qualquer perfil (o shell é o mesmo para todos — ver `AppShellProps`).
- Servidor local rodando: `npm run dev`.
- Uma página com conteúdo longo o suficiente para gerar rolagem (ex.: uma listagem com muitos itens) e uma página curta, sem rolagem, para o cenário de US3.

## Roteiro — Desktop (`lg+`)

1. Acesse uma página autenticada com listagem extensa.
2. Role a página inteira até o final.
    - **Esperado**: o `Topbar` permanece visível e no mesmo lugar do topo durante toda a rolagem (US1, L-02). A barra lateral (`SidebarNav`) permanece visível na coluna esquerda.
3. Com a página rolada até o final, clique em "Sair" ou no toggle de tema no `Topbar`.
    - **Esperado**: a ação funciona normalmente, sem precisar rolar de volta ao topo (Acceptance Scenario US1.2).
4. Acesse uma página curta, sem conteúdo suficiente para rolar.
    - **Esperado**: `Topbar` no topo, sem espaço vazio extra nem deslocamento em relação à página com rolagem (US3, L-07).

## Roteiro — Mobile (viewport ≤ `lg`, ex. 375px de largura via DevTools)

1. Acesse a mesma página com listagem extensa em uma viewport mobile.
2. Role o conteúdo até o final.
    - **Esperado**: `Topbar` (incluindo o botão de menu hambúrguer) permanece fixo e legível no topo, sem ser cortado ou sobreposto (US2.1, L-02).
3. Toque no botão de menu para abrir a gaveta de navegação (`menuAberto = true`).
    - **Esperado**: a gaveta aparece abaixo do `Topbar` (nunca sobre ele), empurrando a área de conteúdo — sem duplicar a barra nem escondê-la (US2.2, L-06).
4. Com a gaveta aberta, tente rolar a área de conteúdo abaixo dela.
    - **Esperado**: apenas o conteúdo rola; `Topbar` e a gaveta permanecem no lugar.
5. Feche a gaveta navegando para outro item do menu.
    - **Esperado**: layout volta ao estado normal, `Topbar` continua fixo na nova página.

## Roteiro — Rotação/redimensionamento

1. Com uma página rolada no meio, gire o dispositivo (retrato ↔ paisagem) ou redimensione a janela do navegador.
    - **Esperado**: `Topbar` permanece fixo no topo em ambas orientações, sem sobreposição de conteúdo (edge case da spec).

## Roteiro — Página 404 autenticada

1. Acesse um endereço inexistente estando autenticado (ver `specs/003-not-found-page`).
    - **Esperado**: como a página é renderizada dentro do mesmo shell autenticado, o `Topbar` também aparece fixo aqui, sem tratamento especial (Assumptions da spec).

## Critério de aceite geral

Todos os passos acima devem passar sem necessidade de nenhum `z-index` visível incorreto, sem "salto" de layout ao carregar a página, e sem rolagem horizontal inesperada em nenhuma etapa.
