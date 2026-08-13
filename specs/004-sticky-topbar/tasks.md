---

description: "Task list template for feature implementation"
---

# Tasks: Topbar Fixo Durante a Rolagem

**Input**: Design documents from `/specs/004-sticky-topbar/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/app-shell-layout.md](./contracts/app-shell-layout.md), [quickstart.md](./quickstart.md)

**Tests**: Não solicitados — research.md D5 registra a decisão de não introduzir tooling de teste de componente (`@testing-library/react`) para uma mudança puramente de CSS/layout. A validação é o roteiro manual em `quickstart.md`, executado como parte de cada fase de user story abaixo.

**Organization**: A implementação real (mudança de layout) é uma única alteração estrutural compartilhada por todas as user stories — por isso vive na fase Foundational. Cada fase de user story abaixo é o checkpoint de validação daquele cenário específico, executável de forma independente via `quickstart.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: A qual user story esta tarefa pertence (US1, US2, US3)

## Path Conventions

Projeto único Next.js — código em `src/`, sem `tests/` dedicados nesta feature (ver seção Tests acima).

---

## Phase 1: Setup

**Purpose**: Estabelecer a linha de base do defeito atual, para comparação depois da mudança.

- [ ] T001 Reproduzir o defeito atual: abrir uma página autenticada com listagem extensa (ex.: `/atividades` ou equivalente com muitos itens) em `npm run dev`, rolar até o final e confirmar visualmente que `Topbar` (`src/shared/ui/shell/topbar.tsx`) some do topo — este é o comportamento que as tarefas seguintes corrigem, servindo de referência antes/depois. **Não executado neste ambiente**: `npm run dev` falha com `DATABASE_URL ausente/inválida` (sem `.env.local` configurado aqui) antes de qualquer página autenticada renderizar — gap pré-existente do ambiente local, não desta feature.

**Checkpoint**: Defeito reproduzido e documentado como referência (sem necessidade de arquivo — apenas confirmação visual antes de prosseguir).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: A alteração estrutural do shell que todas as user stories dependem — não há implementação separada por story, já que o pedido é uma única mudança de layout compartilhada por toda página autenticada.

**⚠️ CRITICAL**: Nenhuma fase de user story pode ser validada até esta fase estar completa.

- [X] T002 Travar a altura da raiz do shell em `src/shared/ui/shell/app-shell.tsx`: trocar `flex min-h-dvh flex-col lg:flex-row` por `flex h-dvh flex-col overflow-hidden lg:flex-row`; adicionar `min-h-0` na `<div>` coluna que envolve `Topbar` + `<main>`; trocar `className="min-w-0 flex-1 p-4"` de `<main>` para incluir `overflow-y-auto` (ex.: `"min-h-0 min-w-0 flex-1 overflow-y-auto p-4"`). Ver research.md D1/D3 e contracts/app-shell-layout.md L-01..L-03.
- [X] T003 [P] Adicionar rolagem própria à coluna desktop de navegação em `src/shared/ui/shell/sidebar-nav.tsx`: incluir `overflow-y-auto` na variante `lg:` do container `<nav>` (mantendo o comportamento atual da gaveta mobile inalterado — ver research.md D2), para que uma lista de itens longa não força a página a crescer. Ver contracts/app-shell-layout.md L-04.
- [X] T004 [P] Revisar `src/shared/ui/shell/topbar.tsx` e confirmar que nenhuma classe ou suposição de layout (`sticky`, `fixed`, cálculo de altura) precisa ser adicionada — a garantia L-02 do contrato (`Topbar` nunca dentro de área que rola) vem inteiramente da estrutura ajustada em T002, não de CSS no próprio componente. Adicionado `shrink-0` explícito no `<header>` para impedir que o flexbox comprima a barra em viewports muito baixas.

**Checkpoint**: Shell reestruturado — `Topbar` deixa de rolar junto com o conteúdo em qualquer página autenticada. As fases seguintes apenas validam cenários específicos, sem código novo.

---

## Phase 3: User Story 1 - Acessar o menu em qualquer ponto da rolagem (Priority: P1) 🎯 MVP

> **Bloqueio de ambiente (T005–T011)**: as tarefas de validação desta e das próximas fases exigem uma sessão autenticada em `npm run dev`. Neste ambiente, o servidor falha ao iniciar (`DATABASE_URL ausente/inválida`, sem `.env.local` configurado) — gap pré-existente, não introduzido por esta feature. T002–T004 (a implementação) foram concluídas e passam por `lint`/`format` (T012) e revisão de contrato (T013); T005–T011 seguem pendentes de execução manual em um ambiente com banco configurado.

**Goal**: Em desktop, o `Topbar` permanece visível e utilizável durante toda a rolagem de uma página longa.

**Independent Test**: Abrir uma página autenticada com conteúdo mais alto que a tela em viewport desktop, rolar até o final e confirmar que o `Topbar` (e seus controles) permanecem visíveis e clicáveis.

- [ ] T005 [US1] Executar o roteiro "Desktop (`lg+`)" de `quickstart.md` (passos 1–4): rolar uma página longa até o final confirmando `Topbar` fixo (Acceptance Scenario 1) e acionar uma ação do `Topbar` (ex.: alternar tema) sem rolar de volta ao topo (Acceptance Scenario 2).
- [ ] T006 [US1] Confirmar, na mesma sessão, que uma página curta (sem rolagem) mantém o `Topbar` no mesmo lugar e sem espaço vazio adicional em relação à página longa (FR-007, cenário compartilhado com US3 mas verificável já aqui).

**Checkpoint**: User Story 1 validada de forma independente — desktop coberto.

---

## Phase 4: User Story 2 - Uso em dispositivo móvel (Priority: P1)

**Goal**: Em viewport mobile, o `Topbar` permanece fixo e a gaveta de navegação continua funcional, sem sobreposição.

**Independent Test**: Em uma viewport mobile (DevTools, ex. 375px), rolar uma página longa confirmando `Topbar` fixo; abrir a gaveta de navegação e confirmar que ela não sobrepõe nem esconde o `Topbar`.

- [ ] T007 [US2] Executar o roteiro "Mobile" de `quickstart.md` (passos 1–2): confirmar `Topbar`, incluindo o botão de menu hambúrguer, fixo e legível durante a rolagem de uma página longa (Acceptance Scenario 1).
- [ ] T008 [US2] Executar o roteiro "Mobile" de `quickstart.md` (passos 3–5): abrir a gaveta de navegação, confirmar que ela aparece abaixo do `Topbar` sem sobrepor ou duplicar a barra (Acceptance Scenario 2 / FR-006), rolar o conteúdo com a gaveta aberta, e fechar navegando para outro item.
- [ ] T009 [P] [US2] Executar o roteiro "Rotação/redimensionamento" de `quickstart.md`: girar/redimensionar com a página rolada e confirmar que o `Topbar` permanece fixo sem sobreposição em nenhuma orientação (edge case da spec).

**Checkpoint**: User Story 2 validada de forma independente — mobile e gaveta cobertos.

---

## Phase 5: User Story 3 - Consistência entre páginas autenticadas (Priority: P2)

**Goal**: O comportamento de `Topbar` fixo é idêntico em qualquer página autenticada, com ou sem rolagem, incluindo a página 404.

**Independent Test**: Navegar por ao menos três páginas autenticadas distintas (uma sem rolagem, uma com rolagem longa, e a página 404 autenticada) confirmando comportamento fixo idêntico em todas.

- [ ] T010 [US3] Navegar por ao menos três páginas autenticadas de módulos diferentes (incluindo uma com e uma sem rolagem) confirmando que o `Topbar` aparece fixo de forma idêntica em todas (Acceptance Scenario 1/2 de US3).
- [ ] T011 [P] [US3] Executar o roteiro "Página 404 autenticada" de `quickstart.md`: acessar um endereço inexistente autenticado e confirmar que o `Topbar` também aparece fixo ali, sem tratamento especial (Assumptions da spec, reaproveitando o shell da feature `003-not-found-page`).

**Checkpoint**: Todas as user stories validadas de forma independente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Conferir que a mudança respeita o contrato e não introduz superfície nova.

- [X] T012 Rodar `npm run lint` e `npm run format` para confirmar que as classes Tailwind adicionadas em T002–T004 seguem a configuração já estabelecida do projeto. `npm run lint`: sem problemas. `prettier --check` nos 3 arquivos alterados: formatados corretamente.
- [X] T013 Revisar o diff final contra `contracts/app-shell-layout.md` §3 ("O que este contrato proíbe"): confirmar que nenhum `z-index`, `position: sticky/fixed` ou `padding-top` compensatório foi introduzido, e que `min-h-dvh` não foi reintroduzido na raiz do shell. Confirmado — diff final não contém nenhum desses padrões.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências — pode começar imediatamente.
- **Foundational (Phase 2)**: Depende da confirmação do defeito em T001 — BLOQUEIA todas as user stories, pois é a única implementação de código da feature.
- **User Stories (Phase 3–5)**: Todas dependem da conclusão da fase Foundational. Não dependem umas das outras — podem ser validadas em qualquer ordem ou em paralelo (são apenas checkpoints de validação sobre a mesma implementação).
- **Polish (Phase 6)**: Depende de todas as user stories desejadas estarem validadas.

### Within Foundational

- T002 (app-shell.tsx) não depende de T003/T004, mas é a mudança estrutural principal — recomenda-se completá-la primeiro para os outros dois terem o contêiner final para validar contra.
- T003 e T004 são arquivos diferentes e podem rodar em paralelo entre si.

### Parallel Opportunities

- T003 e T004 (Foundational) em paralelo.
- T009 (US2) e T011 (US3) podem rodar em paralelo com as demais tarefas de validação de suas respectivas fases, por serem roteiros independentes do `quickstart.md`.
- Phases 3, 4 e 5 (US1, US2, US3) podem ser executadas em paralelo por pessoas diferentes uma vez que a Phase 2 esteja completa, já que nenhuma altera código — são apenas validações.

---

## Parallel Example: Foundational

```bash
# Após T002 (app-shell.tsx) concluído, rodar em paralelo:
Task: "Adicionar overflow-y-auto à coluna desktop em src/shared/ui/shell/sidebar-nav.tsx"
Task: "Revisar src/shared/ui/shell/topbar.tsx quanto a suposições de layout"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Completar Phase 1: Setup (T001 — reproduzir o defeito).
2. Completar Phase 2: Foundational (T002–T004 — a única implementação de código).
3. Completar Phase 3: User Story 1 (T005–T006 — validação desktop).
4. **PARAR e VALIDAR**: confirmar que o desktop já resolve a queixa original antes de seguir para mobile.

### Incremental Delivery

1. Setup + Foundational → shell reestruturado.
2. User Story 1 (desktop) → validar → já entrega valor (MVP).
3. User Story 2 (mobile) → validar → cobre o caso explicitamente citado no pedido original.
4. User Story 3 (consistência) → validar → fecha a cobertura entre páginas, incluindo a 404 autenticada.
5. Polish → conferir aderência ao contrato antes de considerar a feature concluída.

---

## Notes

- Esta feature não tem tarefas de modelo/serviço/endpoint porque é puramente de apresentação (layout) — a estrutura "Setup → Foundational → User Stories → Polish" foi preservada, mas o trabalho de código concentra-se inteiramente na fase Foundational.
- Todas as tarefas de user story são validações via `quickstart.md`, não implementação nova — reflete a decisão de research.md D5 de não introduzir tooling de teste de componente para esta mudança.
- Commitar após T002–T004 (a mudança de código) e novamente após T012–T013 (polish), conforme o fluxo usual do repositório.
