---
description: 'Task list template for feature implementation'
---

# Tasks: Menu Mobile/Tablet Abaixo do Topbar

**Input**: Design documents from `/specs/005-mobile-menu-panel/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/mobile-menu-panel.md](./contracts/mobile-menu-panel.md), [quickstart.md](./quickstart.md)

**Tests**: Não solicitados — research.md D6 reafirma a decisão de `004-sticky-topbar` de não introduzir tooling de teste de componente para mudanças de composição/apresentação. Validação por `quickstart.md`.

**Organization**: A implementação real (novo componente + rewiring de `AppShell`/`Topbar`/`SidebarNav`) é uma única mudança estrutural compartilhada por todas as user stories — por isso vive na fase Foundational. Cada fase de user story abaixo é o checkpoint de validação daquele cenário específico via `quickstart.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: A qual user story esta tarefa pertence (US1, US2, US3)

## Path Conventions

Projeto único Next.js — código em `src/`, sem `tests/` dedicados nesta feature (ver seção Tests acima).

---

## Phase 1: Setup

**Purpose**: Estabelecer a linha de base do defeito atual, para comparação depois da mudança.

- [ ] T001 Reproduzir o defeito atual: em `npm run dev`, acessar uma página autenticada em viewport mobile (`≤ lg`), tocar no botão de menu e confirmar visualmente que o painel de navegação aparece **acima** de `Topbar` (`src/shared/ui/shell/topbar.tsx`), não abaixo — este é o comportamento que as tarefas seguintes corrigem. **Não executado neste ambiente**: mesmo bloqueio de conectividade com o banco (`DATABASE_URL`) registrado em `004-sticky-topbar` — a implementação (T002–T005) foi concluída e verificada por tipo/lint (T015) e revisão de contrato (T016) sem depender de sessão autenticada.

**Checkpoint**: Defeito reproduzido e documentado como referência antes/depois.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: A reestruturação do shell que todas as user stories dependem — um único painel mobile/tablet novo, ancorado ao `Topbar`, substituindo a gaveta hoje embutida em `SidebarNav`.

**⚠️ CRITICAL**: Nenhuma fase de user story pode ser validada até esta fase estar completa.

- [x] T002 [P] Simplificar `src/shared/ui/shell/sidebar-nav.tsx` para ser exclusivamente a coluna desktop: trocar a classe condicional `menuAberto ? 'border-b' : 'hidden lg:flex'` por `hidden lg:flex` incondicional; remover `menuAberto` e `onNavegar` de `SidebarNavProps` e do corpo do componente (a variante mobile deixa de existir aqui — research.md D5, contracts/mobile-menu-panel.md M-08).
- [x] T003 Criar `src/shared/ui/shell/menu-mobile.tsx`: componente `MenuMobile` que renderiza `Ark.Menu.Positioner` + `Ark.Menu.Content` (via `Portal`), com uma seção `Ark.Menu.ItemGroup` + `Ark.Menu.ItemGroupLabel` por `SecaoNavegacao` (usando `gruposVisiveis(itens)`, igual a `sidebar-nav.tsx` hoje) e um `Ark.Menu.Item asChild` envolvendo `<Link href={item.href}>` por `ItemNavegacao`, com `value={item.href}` e as mesmas classes visuais/estado ativo (`itemAtivo`) de `sidebar-nav.tsx`. Renderizado só abaixo de `lg` (`lg:hidden` no `Positioner`). Consome o menu compartilhado por contexto (via `Ark.RootProvider` em `app-shell.tsx`) — não precisou de `Ark.Menu.Context` render-prop, já que `Positioner`/`Content`/`Item` leem o contexto do provider ancestral automaticamente (research.md D4, contracts/mobile-menu-panel.md M-09).
- [x] T004 Em `src/shared/ui/shell/app-shell.tsx`: criado `const topbarRef = useRef<HTMLElement>(null)`; `useState(false)` agora alimenta `const menu = useMenu({ open: menuAberto, onOpenChange, positioning: { getAnchorElement: () => topbarRef.current, placement: 'bottom', sameWidth: true, gutter: 0 } })` (`menuAberto`/`setMenuAberto` continuam a fonte de verdade — research.md D3); árvore envolvida em `<Ark.RootProvider value={menu}>`; `topbarRef` passado para `Topbar`; `<MenuMobile itens={itens} />` renderizado dentro do provider. Ver research.md D2/D3, contracts/mobile-menu-panel.md M-01/M-03.
- [x] T005 Em `src/shared/ui/shell/topbar.tsx`: `Topbar` convertido para `forwardRef<HTMLElement, TopbarProps>` e a ref aplicada ao `<header>` (âncora de posicionamento, research.md D2); o `IconButton` do botão de menu envolvido em `<Ark.Trigger asChild>`, mantendo o ícone alternante (`X`/`MenuIcon`) conforme `menuAberto` recebido por prop (contracts/mobile-menu-panel.md M-03/M-07). **Achado durante a implementação, fora do escopo literal da tarefa mas necessário para ela funcionar**: `IconButton` (`src/shared/ui/icon-button/icon-button.tsx`) não encaminhava `ref` (era função comum, não `forwardRef`) — sem isso, `asChild` não teria um nó DOM real para o Ark gerenciar foco/posicionamento. Convertido para `forwardRef`, sem mudança de API pública.

**Checkpoint**: Painel mobile/tablet reestruturado — abre sempre abaixo do `Topbar`, compartilhando o mesmo estado `menuAberto` de antes. As fases seguintes apenas validam cenários específicos, sem código novo.

---

## Phase 3: User Story 1 - Abrir o menu em mobile/tablet (Priority: P1) 🎯 MVP

> **Bloqueio de ambiente (T006–T014)**: assim como em `004-sticky-topbar`, estas tarefas exigem sessão autenticada em `npm run dev`. Neste ambiente o driver `@neondatabase/serverless` continua falhando a conexão (mesmo diagnóstico de renegociação TLS já registrado em `004-sticky-topbar` — reconfirmado antes de iniciar esta implementação). T002–T005 (a implementação) foram concluídas e verificadas por `tsc --noEmit`, lint e revisão de contrato (T015–T016); T006–T014 seguem pendentes de execução manual em um ambiente com banco acessível.

**Goal**: Em mobile/tablet, tocar no botão de menu abre um painel de navegação sempre abaixo da barra superior, nunca acima ou sobre ela.

**Independent Test**: Em viewport mobile/tablet, tocar no botão de menu e confirmar que o painel aparece abaixo do `Topbar`; tocar em um destino e confirmar que navega e o painel fecha.

- [ ] T006 [US1] Executar o roteiro "Mobile/Tablet" de `quickstart.md` (passos 1–3): abrir o menu em uma viewport mobile (~375px) e em uma viewport tablet (~800px), confirmando em ambas que o painel aparece abaixo da barra superior, nunca sobre ou acima dela (Acceptance Scenario 1, M-01/M-02).
- [ ] T007 [US1] Executar o roteiro "Mobile/Tablet" de `quickstart.md` (passo 4): tocar em um destino de navegação com o painel aberto, confirmando que navega ao destino e o painel fecha automaticamente (Acceptance Scenario 2, M-04).

**Checkpoint**: User Story 1 validada de forma independente — o fluxo básico de navegação mobile/tablet funciona.

---

## Phase 4: User Story 2 - Fechar o menu sem navegar (Priority: P2)

**Goal**: É possível fechar o painel de navegação sem navegar, por mais de uma via.

**Independent Test**: Abrir o painel mobile/tablet e fechá-lo tocando novamente no botão de menu, e em outra tentativa tocando fora do painel — confirmando em ambos os casos que a página permanece a mesma.

- [ ] T008 [US2] Executar o roteiro "Mobile/Tablet" de `quickstart.md` (passo 5): abrir o painel e tocar novamente no botão de menu, confirmando que ele fecha sem navegar (Acceptance Scenario 1, M-05).
- [ ] T009 [P] [US2] Executar o roteiro "Mobile/Tablet" de `quickstart.md` (passo 6): abrir o painel e tocar em uma área fora dele (sobre o conteúdo da página), confirmando que fecha sem navegar (Acceptance Scenario 2, M-05).

**Checkpoint**: User Story 2 validada de forma independente — fechar sem navegar funciona por toque no botão e por toque fora.

---

## Phase 5: User Story 3 - Navegação acessível por teclado e leitor de tela (Priority: P2)

**Goal**: Todo o fluxo de abrir, percorrer, escolher e fechar o painel é operável só por teclado, com foco gerenciado corretamente.

**Independent Test**: Usando apenas o teclado, alcançar o botão de menu, abrir o painel, mover o foco entre destinos, confirmar um deles, e em outra tentativa fechar com Esc e confirmar que o foco volta ao botão.

- [ ] T010 [US3] Executar o roteiro "Teclado" de `quickstart.md` (passos 1–2): alcançar o botão de menu só com Tab e abrir o painel com Enter/Espaço, confirmando que o foco move para dentro do painel (Acceptance Scenario 1, M-06).
- [ ] T011 [US3] Executar o roteiro "Teclado" de `quickstart.md` (passos 3–4): percorrer os destinos com teclado (setas/Tab) confirmando destaque de foco visível, e confirmar um destino com Enter, checando que navega e o painel fecha (Acceptance Scenario 2, M-06).
- [ ] T012 [P] [US3] Executar o roteiro "Teclado" de `quickstart.md` (passo 5): abrir o painel novamente e pressionar Esc, confirmando que fecha e o foco retorna ao botão de menu (Acceptance Scenario 3, M-06).

**Checkpoint**: Todas as user stories validadas de forma independente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Conferir aderência ao contrato, regressão de desktop e o caso de borda de perfil sem itens.

- [ ] T013 [P] Executar o roteiro "Perfil sem itens de navegação" de `quickstart.md`: confirmar que o botão de menu não aparece quando `itens.length === 0`, como já ocorria antes desta feature (FR-007, M-07).
- [ ] T014 [P] Executar o roteiro "Desktop (regressão)" de `quickstart.md`: confirmar que a navegação em viewport desktop (`lg+`) permanece idêntica — coluna fixa lateral, sem botão de hambúrguer, sem painel flutuante (FR-008, SC-004, M-08).
- [x] T015 Rodar `npm run lint` e `npm run format` para confirmar que os arquivos novos/alterados (T002–T005) seguem a configuração já estabelecida do projeto. `npm run lint`: sem problemas. `tsc --noEmit`: sem erros. `prettier --write` nos 5 arquivos alterados: já formatados corretamente (só reformatou uma linha longa em `topbar.tsx`).
- [x] T016 Revisar o diff final contra `contracts/mobile-menu-panel.md` §3 ("O que este contrato proíbe"): confirmado — `src/shared/ui/menu/menu.tsx` e `src/shared/ui/drawer/drawer.tsx` não aparecem no diff (intactos); o painel é ancorado ao `<header>` via `getAnchorElement` (não ao botão); `SidebarNav` não tem mais `menuAberto`/`onNavegar` (variante mobile removida, não recriada).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — pode começar imediatamente.
- **Foundational (Phase 2)**: Depende da confirmação do defeito em T001 — BLOQUEIA todas as user stories, pois é a única implementação de código da feature.
- **User Stories (Phase 3–5)**: Todas dependem da conclusão da fase Foundational. Não dependem umas das outras — podem ser validadas em qualquer ordem ou em paralelo (são apenas checkpoints de validação sobre a mesma implementação).
- **Polish (Phase 6)**: Depende de todas as user stories desejadas estarem validadas.

### Within Foundational

- T002 (`sidebar-nav.tsx`) é um arquivo independente e pode rodar em paralelo com T003–T005.
- T003 (`menu-mobile.tsx`, novo arquivo) precisa existir antes de T004 poder renderizá-lo, mas pode ser escrito em paralelo com T002.
- T004 (`app-shell.tsx`) depende conceitualmente de T003 existir (para ter o que renderizar) e precede T005 na prática, já que cria a ref compartilhada que `topbar.tsx` recebe — recomenda-se a ordem T003 → T004 → T005.

### Parallel Opportunities

- T002 em paralelo com T003 (arquivos diferentes, sem dependência).
- T009 (US2) e T012 (US3) podem rodar em paralelo com as demais tarefas de validação de suas respectivas fases.
- Phases 3, 4 e 5 (US1, US2, US3) podem ser executadas em paralelo por pessoas diferentes uma vez que a Phase 2 esteja completa, já que nenhuma altera código — são apenas validações.
- T013 e T014 (Polish) em paralelo entre si.

---

## Parallel Example: Foundational

```bash
# No início da Phase 2, em paralelo:
Task: "Simplificar src/shared/ui/shell/sidebar-nav.tsx para coluna desktop-only"
Task: "Criar src/shared/ui/shell/menu-mobile.tsx com os primitivos Ark UI Menu"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Completar Phase 1: Setup (T001 — reproduzir o defeito).
2. Completar Phase 2: Foundational (T002–T005 — a única implementação de código).
3. Completar Phase 3: User Story 1 (T006–T007 — validação do fluxo básico).
4. **PARAR e VALIDAR**: confirmar que o painel já abre corretamente abaixo do topbar antes de seguir para os cenários de fechamento e acessibilidade.

### Incremental Delivery

1. Setup + Foundational → painel mobile/tablet reestruturado.
2. User Story 1 (abrir e navegar) → validar → já entrega o valor central do pedido (MVP).
3. User Story 2 (fechar sem navegar) → validar → cobre o comportamento novo ganho com o primitivo Ark Menu.
4. User Story 3 (teclado/acessibilidade) → validar → confirma que o ganho de acessibilidade do primitivo se sustenta na prática.
5. Polish → conferir aderência ao contrato, regressão de desktop e caso de borda antes de considerar a feature concluída.

---

## Notes

- Esta feature não tem tarefas de modelo/serviço/endpoint porque é puramente de apresentação (composição de UI) — a estrutura "Setup → Foundational → User Stories → Polish" foi preservada, mas o trabalho de código concentra-se inteiramente na fase Foundational.
- Todas as tarefas de user story são validações via `quickstart.md`, não implementação nova — reflete a decisão de research.md D6 de não introduzir tooling de teste de componente para esta mudança.
- Esta feature assume que `Topbar` já está fixo (não rola com a página), conforme `004-sticky-topbar`. Se a validação manual daquela feature (T005–T011 de `004-sticky-topbar`) ainda estiver pendente por causa do bloqueio de ambiente (conectividade com o banco), vale revalidá-la junto com esta.
- Commitar após T002–T005 (a mudança de código) e novamente após T015–T016 (polish), conforme o fluxo usual do repositório.
