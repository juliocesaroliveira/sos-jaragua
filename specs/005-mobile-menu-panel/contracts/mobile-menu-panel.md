# Contrato — Painel de Navegação Mobile/Tablet

**Módulos**: `src/shared/ui/shell/app-shell.tsx`, `src/shared/ui/shell/topbar.tsx`, `src/shared/ui/shell/sidebar-nav.tsx`, `src/shared/ui/shell/menu-mobile.tsx` (novo)

Este contrato descreve as garantias que a composição `AppShell` + `Topbar` + `MenuMobile` oferece a qualquer página autenticada, em telas abaixo do breakpoint `lg`. Não exige nenhuma prop nova de quem consome `AppShell` — a superfície pública (`AppShellProps`) não muda.

---

## 1. Garantias estruturais

| Garantia | Descrição |
|----------|-----------|
| M-01 | O painel de navegação mobile/tablet nunca é renderizado acima ou sobreposto ao `Topbar` — ele é posicionado (via `positioning.getAnchorElement`, research.md D2) sempre abaixo do retângulo inteiro da barra superior (FR-001). |
| M-02 | O `Topbar` permanece completamente visível e utilizável (inclusive o próprio botão que abre/fecha o painel) enquanto o painel estiver aberto (FR-002). |
| M-03 | O botão de menu em `Topbar` continua sendo o único gatilho de abrir/fechar o painel — a alternância usa o mesmo estado `menuAberto` já existente em `AppShell` (FR-003). |
| M-04 | Escolher um destino de navegação dentro do painel fecha o painel e navega para o destino, sem passo manual adicional (FR-004) — comportamento padrão (`closeOnSelect`) do primitivo Ark Menu. |
| M-05 | O painel pode ser fechado sem navegar de três formas: tocando o botão de menu novamente, tocando fora do painel, ou pressionando Esc (FR-005). |
| M-06 | Toda a interação do painel é operável por teclado: abrir move o foco para dentro do painel; navegar entre itens com teclado realça cada um; confirmar com teclado navega e fecha; fechar devolve o foco ao botão de menu (FR-006). |
| M-07 | O botão de menu continua ausente quando o perfil não tem nenhum destino de navegação (`itens.length === 0`), como hoje (FR-007). |
| M-08 | A navegação em viewports desktop (`lg+`, coluna fixa lateral de `SidebarNav`) não muda — nem estrutura, nem comportamento, nem props (FR-008). |
| M-09 | Os destinos dentro do painel mobile/tablet continuam organizados nas mesmas seções/grupos usados hoje (`gruposVisiveis`), na mesma ordem (FR-009). |

---

## 2. O que este contrato NÃO exige

- Nenhuma prop nova em `AppShellProps`.
- Nenhuma mudança nos dados de navegação (`ItemNavegacao`, `SecaoNavegacao`, `NAVEGACAO`) em `src/shared/auth/navegacao.ts`.
- Nenhuma mudança de breakpoint — "mobile/tablet" continua sendo "abaixo de `lg`", igual à navegação atual.
- Nenhum backdrop/overlay modal — diferente do `Drawer` já existente no design system (research.md D1), o painel não escurece o restante da tela.

---

## 3. O que este contrato proíbe

- Reaproveitar `src/shared/ui/menu/menu.tsx` (wrapper genérico de ações contextuais) ou `src/shared/ui/drawer/drawer.tsx` (modal com backdrop) sem adaptação — nenhum dos dois atende ao posicionamento/agrupamento exigidos aqui sem virar um contrato ambíguo para os usos que já têm (research.md D1).
- Ancorar o painel ao botão de hambúrguer em vez do `Topbar` inteiro — produziria um dropdown estreito, não o painel de largura cheia exigido por M-01.
- Alterar `SidebarNav` para continuar servindo as duas variantes (desktop e mobile) — a variante mobile sai inteiramente dela (research.md D5).
