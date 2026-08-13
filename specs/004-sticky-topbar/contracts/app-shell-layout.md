# Contrato — Layout do Shell Autenticado (topbar fixo)

**Módulos**: `src/shared/ui/shell/app-shell.tsx`, `src/shared/ui/shell/topbar.tsx`, `src/shared/ui/shell/sidebar-nav.tsx`

Este contrato descreve a estrutura de layout que `AppShell` garante a **toda** página autenticada (`children`), sem exigir nada de quem consome — nenhuma prop nova, nenhuma API nova.

---

## 1. Garantias estruturais

| Garantia | Descrição |
|----------|-----------|
| L-01 | A raiz do shell ocupa exatamente a altura da viewport (`h-dvh`) e não cresce com o conteúdo — quem cresce é a área de conteúdo, não a página. |
| L-02 | `Topbar` nunca está dentro de um contêiner que rola. Ele é visível do primeiro ao último pixel de qualquer sessão de rolagem de `children` (FR-001, SC-001). |
| L-03 | `<main>` é o único contêiner com rolagem vertical própria (`overflow-y-auto`). Todo o conteúdo passado em `children` rola ali, por baixo do `Topbar` (FR-002). |
| L-04 | `SidebarNav`, quando coluna fixa (`lg+`), tem rolagem própria independente de `Topbar` e `main`, para listas de navegação longas não empurrarem o topbar para fora da viewport. |
| L-05 | Nenhum elemento de `children` pode ficar coberto pelo `Topbar` — como `Topbar` não é `sticky`/`fixed` sobreposto, e sim parte do fluxo do flex column, não há necessidade de `padding-top` compensatório nem de `z-index` (FR-003). |
| L-06 | A gaveta mobile de `SidebarNav` (`menuAberto`), ao abrir, encolhe a área visível de `main` em vez de sobrepor ou esconder o `Topbar` (FR-006). |
| L-07 | Em páginas sem conteúdo suficiente para rolar, o layout permanece idêntico — sem espaço vazio adicional nem salto visual (FR-007). |

---

## 2. O que este contrato NÃO exige

- Nenhuma prop nova em `AppShellProps`, `TopbarProps` ou `SidebarNavProps`.
- Nenhuma mudança no comportamento de abrir/fechar a gaveta mobile (continua controlada por `AppShell`, fechada ao navegar).
- Nenhum comportamento de auto-hide (esconder ao rolar para baixo, reaparecer ao rolar para cima) — fora de escopo (Assumptions da spec).
- Nenhum `z-index` ou `position: sticky`/`fixed` no `Topbar` — a garantia L-02 vem da estrutura do layout (research.md D1), não de posicionamento CSS especial.

---

## 3. O que este contrato proíbe

- Adicionar `overflow` visível/scroll na raiz do shell (romperia L-01/L-02 e reintroduziria o defeito original).
- Remover `min-h-0` dos ramos flex intermediários sem substituir por mecanismo equivalente — sem ele, `<main>` deixa de encolher e a rolagem "vaza" de volta para a página (research.md D3).
- Reintroduzir `min-h-dvh` (altura mínima, não travada) na raiz do shell.
