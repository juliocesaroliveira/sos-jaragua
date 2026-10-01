---
description: 'Tarefas de implementação: cards de escala na página da atividade'
---

# Tasks: Cards de Escala na Página da Atividade

**Input**: Design documents from `/specs/019-cards-escala-atividade/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-painel-escala.md, quickstart.md

**Tests**: a spec não pede testes automatizados e o projeto não tem infraestrutura de teste de componente (research D5). A validação é feita por lint, typecheck, build e o roteiro do `quickstart.md`. Por isso não há tarefas de teste.

**Organization**: as tarefas estão agrupadas por user story. Quase todas editam o mesmo arquivo (`painel-escala.tsx`), então há pouco paralelismo dentro das stories. Os pontos paralelizáveis são a documentação e a galeria.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência pendente)
- **[Story]**: user story atendida (US1, US2, US3)

## Path Conventions

Monolito Next.js: rotas em `app/`, primitivos de UI em `src/shared/ui/`, documentação em `spec/`. Arquivo central desta feature: `app/(interno)/(staff)/atividades/[id]/painel-escala.tsx`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: confirmar que a base está verde antes de mexer, para que qualquer falha depois seja desta feature.

- [X] T001 Rodar `npm run lint`, `npx tsc --noEmit` e `npm test` na raiz do repositório e registrar que estão verdes antes de qualquer alteração. Se algo já falhar, anotar no PR como pré-existente.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: nenhuma. A feature não tem dados, actions nem primitivos novos. `KanbanCard` (`src/shared/ui/kanban/kanban-card.tsx`) e a query `buscarAtividadeDetalhada` já entregam tudo o que as stories precisam (data-model.md).

**Checkpoint**: as user stories podem começar direto.

---

## Phase 3: User Story 1 - Ver de relance as escalas e quem está em cada uma (Priority: P1) 🎯 MVP

**Goal**: cada turno vira um card próprio, com cabeçalho (horário, data, ocupação) e a lista vertical de voluntários. A área mostra o total de escalas, e um card vazio mostra uma mensagem.

**Independent Test**: abrir `/atividades/{id}` de uma atividade com 3 ou mais turnos, um deles sem ninguém. Conferir que há um card por turno (sem a coluna "Escala" envolvendo todos), que o título "Escalas" mostra "N escalas", que cada card lista seus voluntários um por linha com ícone de papel e selo "Inscrição própria", e que o card vazio mostra "Nenhum voluntário escalado ainda." (quickstart passos 1–3).

### Implementation for User Story 1

- [X] T002 [US1] Em `app/(interno)/(staff)/atividades/[id]/painel-escala.tsx`, substituir o wrapper `<div className="flex flex-col gap-3 md:flex-row md:overflow-x-auto md:pb-2">` + `<KanbanColumn titulo="Escala" …>` por uma `<section aria-labelledby="titulo-escalas" className="flex flex-col gap-3">`. A seção contém um `<header className="flex items-baseline gap-2">` com `<h2 id="titulo-escalas" className="text-xl font-semibold text-foreground">Escalas</h2>` e `<span className="text-sm text-neutral-500 dark:text-neutral-400">{contagem}</span>`, seguido de um `<ul>` com os `KanbanCard` (que já renderizam `<li>`). Remover o import de `KanbanColumn` (contrato U-01.7).
- [X] T003 [US1] No mesmo arquivo, calcular a contagem com o plural tratado: `const contagemEscalas = atividade.turnos.length === 1 ? '1 escala' : \`${atividade.turnos.length} escalas\``e usá-la no`<span>` de T002 (FR-009, research D4).
- [X] T004 [US1] No mesmo arquivo, trocar o `detalhe` de cada `KanbanCard`. Hoje é `t.alocados.length > 0 && (<ul …>)`. Passa a ser um ternário: com alocados, a mesma `<ul className="flex flex-col gap-1">` de hoje (sem alterar os `<li>`, `IconePapel`, `Badge` "Inscrição própria" e botão de remover). Sem alocados, `<p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhum voluntário escalado ainda.</p>` (FR-008, contrato U-01.12).
- [X] T005 [US1] No mesmo arquivo, garantir que o card do turno fique legível em largura estreita: o `<span>` do nome continua com `truncate` dentro de `min-w-0`. Conferir que o container do nome tem `min-w-0 flex-1` para o botão de remover não ser empurrado para fora do card (Edge Case de nome longo).
- [X] T006 [US1] No mesmo arquivo, manter o `Alert` "Esta atividade ainda não tem turnos" quando `atividade.turnos.length === 0`, sem renderizar a `<section>` (contrato U-01.5).

**Checkpoint**: US1 está funcional. Os cards aparecem em lista vertical, que é o comportamento padrão de `<ul>`, com conteúdo correto. A grade horizontal vem na US2.

---

## Phase 4: User Story 2 - Layout se adapta ao tamanho da tela (Priority: P1)

**Goal**: os cards ficam lado a lado e quebram para a linha de baixo quando não cabem. No celular, ficam um por linha. Todos têm a mesma largura, um card sozinho não estica e nunca aparece rolagem horizontal.

**Independent Test**: com uma atividade de 5 turnos, redimensionar de 1920px a 320px. Conferir que os cards quebram progressivamente, que há pelo menos 3 por linha em 1280px, 1 por linha abaixo de ~600px e nenhuma rolagem horizontal. Com uma atividade de um turno em 1920px, conferir que o card tem a largura de uma coluna (quickstart passos 5–7).

### Implementation for User Story 2

- [X] T007 [US2] Em `app/(interno)/(staff)/atividades/[id]/painel-escala.tsx`, aplicar ao `<ul>` criado em T002 a classe `grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] items-start gap-3`. Usar `auto-fill`, não `auto-fit`, para o card único não esticar, e `min(100%,18rem)` para não estourar em 320px (research D1, contrato U-01.8). Confirmar que não sobrou `overflow-x-auto` nem `md:flex-row` na área de escalas.
- [X] T008 [US2] Verificar no navegador (`npm run dev`) as larguras 320, 375, 768, 1280 e 1920px. `document.documentElement.scrollWidth <= window.innerWidth` em todas. 1 card por linha em 320/375 e ≥ 3 em 1280. Card com 6+ voluntários alinhado no topo, sem esticar os vizinhos. Repetir em tema escuro (quickstart passos 5–7 e 13). Se a classe arbitrária do Tailwind v4 não gerar o CSS esperado, trocar por `style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 18rem), 1fr))' }}` e registrar o motivo em comentário.

**Checkpoint**: US1 e US2 juntas entregam o pedido visual completo.

---

## Phase 5: User Story 3 - Gerir a escala diretamente no card (Priority: P2)

**Goal**: alocar e remover continuam funcionando a partir de cada card, com o mesmo comportamento de hoje. A ação de alocar passa a ter nome acessível que identifica o turno.

**Independent Test**: numa atividade aberta, alocar um voluntário pelo botão de um card e vê-lo aparecer naquele card. Depois, removê-lo pelo próprio card. Numa atividade encerrada, nenhum card mostra o botão de alocar. Com leitor de tela, cada "Alocar…" anuncia data e horário (quickstart passos 8–12).

### Implementation for User Story 3

- [X] T009 [US3] Em `app/(interno)/(staff)/atividades/[id]/painel-escala.tsx`, remover a constante `ROTULO_ALOCAR` e, dentro do `map` dos turnos, calcular `const rotuloAlocar = \`Alocar voluntário no turno de ${formatarData(t.inicio)}, ${formatarHora(t.inicio)} – ${formatarHora(t.fim)}\``. Usar esse rótulo tanto no `aria-label`do`IconButton` `UserPlus`quanto no`conteudo`do`Tooltip` (um rótulo para os dois consumidores, C-04.3, research D3). Atualizar o comentário que hoje acompanha a constante.
- [X] T010 [US3] No mesmo arquivo, confirmar que `acoes` do card só é renderizado quando `podeAlocar` (`atividade.status === 'aberta'`) e que o `Alert` "Atividade não está aberta" e o `Select` de filtro por habilidade permanecem acima da `<section>` de escalas, sem alteração de comportamento (FR-012/FR-013, contrato U-01.3/U-01.4).
- [ ] T011 [US3] Validar no navegador o fluxo completo: alocar pelo card (o diálogo mostra o horário do turno, o voluntário aparece naquele card e a ocupação atualiza), remover (toast "Alocação cancelada" e o voluntário sai do card), filtrar por habilidade (nenhum card ou voluntário escalado some) e atividade encerrada (sem botão de alocar). Também navegar por teclado para conferir que o foco percorre os botões de cada card na ordem visual (quickstart passos 8–12).

**Checkpoint**: todas as stories estão funcionais e verificadas.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T012 [P] Atualizar o comentário JSDoc do topo de `app/(interno)/(staff)/atividades/[id]/painel-escala.tsx`, que hoje fala em "turnos lado a lado com rolagem horizontal… coluna colapsa para lista vertical". O novo texto deve descrever um card por turno em grade `auto-fill` que quebra a linha, com um card por linha no celular (contrato U-02.2).
- [X] T013 [P] Atualizar `spec/DESIGN_SYSTEM.md` §4.16 (KanbanCard / KanbanColumn): acrescentar um item dizendo que, no painel de escala de uma atividade, cada `KanbanCard` é exibido sozinho numa grade `repeat(auto-fill, minmax(min(100%, 18rem), 1fr))` com `items-start`, sem `KanbanColumn`, e que a `KanbanColumn` segue para agrupar turnos por atividade (contrato U-02.1, research D6).
- [X] T014 [P] (Opcional) Em `app/(interno)/design-system/galeria.tsx`, na seção "Kanban de turnos", adicionar abaixo do exemplo existente um exemplo "Escalas em grade": um `<ul>` com a mesma classe de grade de T007 e 3 `KanbanCard`, sendo um com `detalhe` vazio ("Nenhum voluntário escalado ainda.").
- [X] T015 Rodar `npx prettier --write` nos arquivos alterados e depois `npm run lint`, `npx tsc --noEmit`, `npm test` e `npm run build`. Todos devem passar.
- [ ] T016 Executar o roteiro completo de `specs/019-cards-escala-atividade/quickstart.md` (passos 1–13). Opcionalmente, rodar a verificação automatizada de overflow com Playwright (Chromium em `/opt/pw-browsers`).
- [X] T017 Commitar com Conventional Commits (ex.: `feat: show each activity shift as its own card in the schedule panel`) e fazer push.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: vazia.
- **US1 (Phase 3)**: depende de T001.
- **US2 (Phase 4)**: depende de T002, porque precisa do `<ul>` da seção para aplicar a grade.
- **US3 (Phase 5)**: independente de US2. Pode ser feita logo após US1, ou até antes, já que só mexe em `acoes` e no rótulo. Como edita o mesmo arquivo, deve ser sequencial a US1 para evitar conflito.
- **Polish (Phase 6)**: T012–T014 podem começar a qualquer momento após T002. T015–T017 vêm por último.

### Within Each User Story

- US1: T002 → T003 → T004 → T005 → T006 (mesmo arquivo, sequencial).
- US2: T007 → T008.
- US3: T009 → T010 → T011.

### Parallel Opportunities

- T012, T013 e T014 tocam arquivos diferentes entre si (T012 é só o comentário do topo de `painel-escala.tsx`). Podem rodar em paralelo uns com os outros e com a validação manual (T008/T011).
- As tarefas de código das stories editam todas `painel-escala.tsx` e não devem ser paralelizadas.

## Parallel Example: Polish

```bash
# Em paralelo, depois de T002:
Task: "T013 Atualizar spec/DESIGN_SYSTEM.md §4.16 com o uso em grade"
Task: "T014 Adicionar exemplo 'Escalas em grade' em app/(interno)/design-system/galeria.tsx"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

As duas stories P1 juntas formam o MVP: sozinha, a US1 entrega cards empilhados, e a grade da US2 é o que realiza o pedido de "preencher na horizontal e quebrar". Faça T001 → T008 e valide pelos passos 1–7 do quickstart.

### Incremental Delivery

1. T001 → base verde.
2. US1 (T002–T006) → um card por escala, com lista, contagem e estado vazio.
3. US2 (T007–T008) → grade responsiva. **MVP entregável.**
4. US3 (T009–T011) → rótulos acessíveis e fluxo de gestão revalidado.
5. Polish (T012–T017) → documentação, checks, roteiro completo, commit.

---

## Notes

- Não alterar `src/shared/ui/kanban/kanban-card.tsx` nem `kanban-column.tsx`. A feature reaproveita os dois como estão (research D2).
- Não alterar `page.tsx`, queries, actions nem nada em `src/modules/`. A mudança é só de apresentação (Princípio I).
- Todos os textos novos ficam em pt-BR: "Escalas", "N escalas", "Nenhum voluntário escalado ainda." e "Alocar voluntário no turno de …".

## Registro de execução (2026-10-01)

- **T001:** a base tinha 318 testes verdes. Lint e `tsc` já falhavam antes desta feature, sem relação com ela: 8 `no-restricted-imports` nos arquivos de `habilidades`, e os tipos de imagem `@/public/*` ausentes porque falta o `next-env.d.ts`, que é gerado pelo build. Nenhum erro novo nos arquivos alterados.
- **T008:** como o ambiente de nuvem não tem banco, a validação usou um harness estático com o CSS compilado pelo `next build` e a mesma marcação do painel, medido com Playwright. Resultados:
    - Não há rolagem horizontal em 320, 375, 768, 1280 e 1920px.
    - Cards por linha: 1, 1, 2, 4 e 5, respectivamente.
    - Todos os cards têm a mesma largura e as alturas são independentes (`items-start`).
    - Um card sozinho em 1920px fica com 303px e não estica.
    - O botão de remover fica dentro do card mesmo com nome longo.
- **T015:** `npm test` passou com 318 testes. ESLint e `tsc` não apontam erro nos arquivos alterados. O `next build` compila e passa no TypeScript, mas falha na coleta de dados das páginas por falta de `DATABASE_URL` válido.
- **Pendentes:** T011 e T016 dependem de banco e sessão reais. É preciso rodar localmente com `.env` os passos 8–13 do `quickstart.md`: alocar, remover, filtrar, atividade encerrada, teclado/leitor de tela e tema escuro.
