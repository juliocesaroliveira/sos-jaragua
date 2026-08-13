---
description: "Task list for feature implementation"
---

# Tasks: Shell de Navegação por Perfil (Topbar + Sidebar)

**Input**: Design documents from `/specs/002-role-based-app-shell/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Test tasks ARE included. Justification: [contracts/navegacao.md](./contracts/navegacao.md) defines INV-01…INV-06 as invariants that MUST exist as tests, and the registry is a pure function — exactly the kind of code the constitution (Princípio III) says carries the highest test value. UI layers stay thin by design and get contract-level validation only.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Monolito modular Next.js: rotas em `app/` na raiz, código compartilhado em `src/shared/`, design system em `src/shared/ui/`. Sem `tests/` separado — testes ficam co-locados (`*.test.ts`), como já é a convenção do repositório (`src/shared/auth/rotas.test.ts`).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Pré-requisitos de validação. Sem contas dos 5 perfis, nenhuma história pode ser verificada.

- [X] T001 Garantir que `db/seed.ts` cria uma conta por perfil (`usuario`, `voluntario`, `membro_defesa_civil`, `coordenador`, `administrador`); estender o seed se algum estiver faltando, e registrar as credenciais em `specs/002-role-based-app-shell/quickstart.md` na seção de pré-requisitos

- [X] T002 [P] Registrar o manifesto de rotas atual como linha de base para o check de preservação de URL: rodar `npm run build` e salvar a lista de rotas em `specs/002-role-based-app-shell/rotas-baseline.txt` (arquivo temporário, removido na T037)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extrair o shell existente para um componente compartilhado, **sem mudança de comportamento**. Toda história P1 depende disto.

**⚠️ CRITICAL**: Nenhuma história pode começar antes desta fase terminar.

**⚠️ Refatoração pura**: ao fim desta fase, a aplicação deve se comportar **exatamente** como antes — mesmo shell, mesmas telas, mesmos itens de menu. Só a localização do código muda. Se algo visível mudou, a extração saiu errada.

- [X] T003 [P] Criar `src/shared/ui/shell/topbar.tsx` extraindo a região `<header>` de `app/(staff)/staff-shell.tsx` (identificação, slot de notificações, `ThemeToggle`, avatar/nome/perfil, sair, botão de menu), recebendo estado da gaveta e `onAlternarMenu` por props

- [X] T004 [P] Criar `src/shared/ui/shell/sidebar-nav.tsx` extraindo a região `<nav>` de `app/(staff)/staff-shell.tsx`, incluindo temporariamente a constante `NAV` e a filtragem por `podeAcessar` no estado em que estão hoje — ambas serão substituídas na T023

- [X] T005 Criar `src/shared/ui/shell/app-shell.tsx` compondo `Topbar` + `SidebarNav` + `<main>`, com a interface `AppShellProps` de [contracts/app-shell.md](./contracts/app-shell.md) (`role`, `nome`, `rotuloRole`, `notificacoes?`, `children`), mantendo `'use client'` e o `useState` da gaveta (depende de T003, T004)

- [X] T006 Exportar `AppShell` e `AppShellProps` no barrel `src/shared/ui/index.ts`, junto aos demais componentes de layout (depende de T005)

- [X] T007 Apontar `app/(staff)/layout.tsx` para `AppShell` em vez de `StaffShell` e excluir `app/(staff)/staff-shell.tsx` (depende de T006)

- [X] T008 Verificar que a refatoração não alterou comportamento: `npx tsc --noEmit`, `npm run lint`, `npm test`, e conferir manualmente como `coordenador` que `/dashboard` e `/estoque` renderizam idênticos ao estado anterior (depende de T007)

**Checkpoint**: shell compartilhado existe e é consumido pela área de staff. Comportamento inalterado. As histórias podem começar.

---

## Phase 3: User Story 1 - Navegação presente em toda página autenticada (Priority: P1) 🎯 MVP

**Goal**: Toda página que exige sessão passa a renderizar topbar + sidebar; nenhuma página pré-autenticação passa a renderizá-los.

**Independent Test**: Autenticar com cada um dos 5 perfis e percorrer todas as páginas acessíveis àquele perfil, confirmando topbar e sidebar em cada uma — e confirmar sua ausência em `/login`, `/cadastro` e `/`. Entrega valor mesmo com o menu ainda não diferenciado por perfil: `usuario` e `voluntario` ganham identificação, tema, notificações e ação de sair, que hoje não têm.

**Nota sobre o menu nesta fase**: com o registro ainda não implementado (US2), a filtragem por `podeAcessar` produz menu **vazio** para `usuario` e `voluntario` — todos os itens atuais são de staff. Isso é esperado e é exatamente o caso de borda "sem itens visíveis" da spec: a T019 garante que a topbar permaneça e a sidebar não renderize uma coluna vazia. US2 preenche o menu.

### Implementação da User Story 1

- [X] T009 [US1] Criar o grupo `app/(publico)/` e mover para dentro dele, preservando as URLs: `app/(public)/page.tsx` → `app/(publico)/page.tsx`, `app/(auth)/login/` → `app/(publico)/login/`, `app/(auth)/cadastro/` → `app/(publico)/cadastro/`; remover os diretórios `app/(auth)/` e `app/(public)/` já vazios

- [X] T010 [US1] Criar `app/(interno)/layout.tsx` como Server Component conforme [contracts/app-shell.md](./contracts/app-shell.md): `export const instant = false`, `exigirSessao()`, busca paralela de `listarNotificacoes`/`contarNaoLidas` por `ator.userId`, e render de `<AppShell>` com `SinoNotificacoes` no slot — o sino passa a valer para **todos** os perfis (research.md D5)

- [X] T011 [US1] Mover `app/(staff)/` para `app/(interno)/(staff)/` e reduzir `app/(interno)/(staff)/layout.tsx` a apenas `await exigirRoles(ROLES_STAFF)` + `return children`, removendo o render do shell, a busca de notificações e o `instant = false` (agora no pai); mover junto `sino-notificacoes.tsx` (depende de T010)

- [X] T012 [P] [US1] Mover `app/sem-permissao/` → `app/(interno)/sem-permissao/`, removendo o wrapper `min-h-dvh` e o `<main>` próprios da página, agora fornecidos pelo shell (depende de T010)

- [X] T013 [P] [US1] Mover `app/(public)/voluntariado/candidatura/` → `app/(interno)/voluntariado/candidatura/` (depende de T009, T010)

- [X] T014 [P] [US1] Mover `app/voluntariado/minhas-atividades/` → `app/(interno)/voluntariado/minhas-atividades/`; remover o diretório `app/voluntariado/` já vazio (depende de T010)

- [X] T015 [P] [US1] Mover `app/design-system/` → `app/(interno)/design-system/` — a rota já exige sessão pelo deny-by-default do `proxy.ts`, então herdar o shell a torna coerente com SC-001; não entra no menu (é rota de desenvolvimento, não destino de produto) (depende de T010)

- [X] T016 [US1] Remover de `app/(interno)/voluntariado/candidatura/page.tsx` o `<header>` improvisado com `Link` e `ThemeToggle` e o wrapper `min-h-dvh`/`<main>`, deixando a página com apenas seu conteúdo (depende de T013)

- [X] T017 [US1] Remover de `app/(interno)/voluntariado/minhas-atividades/page.tsx` o `<header>` improvisado com `Link` e `ThemeToggle` e o wrapper `min-h-dvh`/`<main>`; manter o `export const instant = false` da página (depende de T014)

- [X] T018 [US1] Confirmar que `app/(publico)/page.tsx` **mantém** seu header próprio — é pré-autenticação e não recebe shell (depende de T009)

- [X] T019 [US1] Tratar em `src/shared/ui/shell/sidebar-nav.tsx` o caso de lista vazia: não renderizar `<nav>` nem o botão de menu da topbar quando não há itens, preservando topbar e conteúdo (depende de T005)

- [X] T020 [US1] Verificar preservação de URL: rodar `npm run build` e comparar a lista de rotas com `specs/002-role-based-app-shell/rotas-baseline.txt` da T002 — nenhuma URL pode ter mudado; rodar `npx tsc --noEmit`, `npm run lint`, `npm test` (depende de T009–T019)

- [ ] T021 [US1] Executar o Nível 2 do [quickstart.md](./quickstart.md): shell presente em todas as páginas autenticadas nos 5 perfis, e ausente em `/login`, `/cadastro`, `/` (depende de T020)

**Checkpoint**: US1 completa e demonstrável. Todo perfil autenticado tem topbar e sidebar, identificação, tema, notificações e ação de sair em qualquer página. **MVP entregável.**

---

## Phase 4: User Story 2 - Itens de menu carregados por perfil de acesso (Priority: P1)

**Goal**: O menu passa a mostrar, para cada perfil, exatamente os destinos da matriz de [data-model.md](./data-model.md) — nada a mais, nada a menos.

**Independent Test**: Autenticar com cada um dos 5 perfis e comparar a sidebar renderizada contra a matriz; acionar todos os itens visíveis e confirmar que nenhum resulta em `/sem-permissao` ou 404.

### Testes da User Story 2 ⚠️

> **Escrever primeiro; devem FALHAR (o módulo `navegacao.ts` ainda não existe).**

- [X] T022 [US2] Criar `src/shared/auth/navegacao.test.ts` cobrindo as invariantes de [contracts/navegacao.md](./contracts/navegacao.md): INV-01 (igualdade — não subconjunto — entre `item.roles` e `rolesExigidas(href)` quando houver regra), INV-02 (`roles` não vazio), INV-03 (todo `href` corresponde a um `page.tsx` existente sob `app/`, normalizando os route groups `(publico)`/`(interno)`/`(staff)`), INV-04 (matriz por perfil: um caso por role, com a lista de `href` esperada escrita literalmente conforme data-model.md), INV-05 (`href` único), INV-06 (rótulos de item e grupo não vazios); incluir as garantias G-08/G-09 de `itemAtivo` (`/estoque` casa `/estoque/entrada` mas não `/estoquex`; `/estoque/kits` ativa "Kits", não "Estoque")

### Implementação da User Story 2

- [X] T023 [US2] Criar `src/shared/auth/navegacao.ts` com os tipos `IdGrupo`/`NomeIcone`/`ItemNavegacao`/`GrupoNavegacao`/`SecaoNavegacao`, a constante `GRUPOS` com rótulos pt-BR e `ordem`, e a constante `NAVEGACAO` preenchida conforme a matriz de [data-model.md](./data-model.md) — ícones como **identificadores string**, nunca JSX, para o módulo permanecer puro e testável sem React (research.md D7); o módulo NÃO importa React, Next.js, Drizzle nem nada de `src/modules/` (depende de T022)

- [X] T024 [US2] Implementar em `src/shared/auth/navegacao.ts` as funções `itensDeNavegacao(role)` (G-01…G-04) e `itemAtivo(pathname, itens)` com correspondência por segmento e desempate pelo `href` mais longo (G-08/G-09) — corrige o defeito latente do shell atual, que usa a primeira correspondência e marcaria dois itens de estoque como ativos ao mesmo tempo (depende de T023)

- [X] T025 [US2] Criar `src/shared/ui/shell/icones.ts` mapeando `NomeIcone` → componente `lucide-react`, mantendo a fronteira entre o registro (dado puro) e a camada de UI (depende de T023)

- [X] T026 [US2] Alterar `src/shared/ui/shell/sidebar-nav.tsx` para receber `itens: readonly ItemNavegacao[]` por props e resolver ícones via `icones.ts`, removendo a constante `NAV` temporária e a chamada a `podeAcessar` introduzidas na T004; usar `itemAtivo` para o destaque e `aria-current="page"` (depende de T024, T025)

- [X] T027 [US2] Propagar `itens` de `AppShell` para `SidebarNav` em `src/shared/ui/shell/app-shell.tsx`, acrescentando `itens` a `AppShellProps` (depende de T026)

- [X] T028 [US2] Chamar `itensDeNavegacao(ator.role)` **no servidor**, em `app/(interno)/layout.tsx`, e passar o resultado já filtrado como prop — o navegador de um voluntário nunca recebe a lista de destinos internos (S-02 de [contracts/app-shell.md](./contracts/app-shell.md)) (depende de T027)

- [X] T029 [US2] Rodar `npm test` e confirmar que T022 agora passa; rodar `npx tsc --noEmit` e `npm run lint` (depende de T028)

- [ ] T030 [US2] Executar o Nível 3 do [quickstart.md](./quickstart.md): matriz conferida nos 5 perfis, item ativo correto em `/estoque/kits`, e todos os itens visíveis acionados sem 404 nem `/sem-permissao` (depende de T029)

**Checkpoint**: US1 e US2 completas. Menu correto por perfil, travado por teste contra a autorização de rota.

---

## Phase 5: User Story 3 - Agrupamento e legibilidade do menu (Priority: P2)

**Goal**: Para perfis com muitos destinos, os itens aparecem sob rótulos de área; grupos sem item visível não são renderizados.

**Independent Test**: Como `coordenador`, verificar itens sob cabeçalhos de área em pt-BR; como `membro_defesa_civil`, verificar que "Coordenação" e "Administração" não aparecem.

### Testes da User Story 3 ⚠️

- [X] T031 [US3] Acrescentar a `src/shared/auth/navegacao.test.ts` os casos de `gruposVisiveis`: G-05 (nenhuma seção com `itens` vazio), G-06 (seções ordenadas por `GrupoNavegacao.ordem`), G-07 (união das seções igual ao conjunto de entrada, sem perda nem duplicação); incluir o caso de `membro_defesa_civil` não produzir as seções "Coordenação" nem "Administração"

### Implementação da User Story 3

- [X] T032 [US3] Implementar `gruposVisiveis(itens)` em `src/shared/auth/navegacao.ts`, derivando as seções **a partir da lista já filtrada** para que a poda de grupos vazios seja consequência estrutural e não uma regra a lembrar (research.md D6) (depende de T031)

- [X] T033 [US3] Renderizar seções em `src/shared/ui/shell/sidebar-nav.tsx` usando `gruposVisiveis`, com o rótulo do grupo como cabeçalho não interativo e a lista de itens abaixo, preservando a semântica de `<nav>` e o `aria-current` do item ativo (depende de T032)

- [ ] T034 [US3] Rodar `npm test`, `npx tsc --noEmit`, `npm run lint` e executar o Nível 4 do [quickstart.md](./quickstart.md) (depende de T033)

**Checkpoint**: as três histórias completas e independentemente verificáveis.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Requisitos transversais que só fazem sentido validar com o shell inteiro no lugar.

- [ ] T035 [P] Acessibilidade em `src/shared/ui/shell/`: `<nav aria-label>` em pt-BR, foco visível, ordem de tabulação previsível, ausência de armadilha de foco na gaveta e alvos de toque ≥44px (FR-023, FR-024); executar o Nível 5 do [quickstart.md](./quickstart.md) por teclado

- [ ] T036 [P] Responsividade em 360px: gaveta recolhida por padrão, fechamento automático ao escolher destino (FR-022), conteúdo sem rolagem horizontal (SC-008)

- [ ] T037 [P] Validar os casos de borda de sessão do Nível 6 do [quickstart.md](./quickstart.md): sair de qualquer página em ≤2 cliques com `router.refresh()` impedindo conteúdo autenticado ao voltar no navegador; sessão expirada redirecionando a `/login?redirecionar=` e retornando ao destino pretendido (FR-027); mudança de perfil em sessão (`usuario` → `voluntario`) refletida no menu sem logout manual

- [ ] T038 Verificar performance (SC-009, Nível 7 do quickstart): `npm run build && npm run start`, comparando a primeira renderização útil de `/dashboard` e `/estoque` com o estado anterior — atenção às duas consultas de notificação, que passaram a rodar para todos os perfis (research.md D5)

- [X] T039 [P] Registrar em `spec/DESIGN.md` a nova estrutura de route groups (`(publico)` / `(interno)` / `(staff)` aninhado) e o registro de navegação como fonte única dos itens de menu — a constituição (Princípio VI) exige que decisão arquitetural seja registrada, não implícita no código

- [X] T040 Remover o arquivo temporário `specs/002-role-based-app-shell/rotas-baseline.txt` criado na T002 (depende de T020)

- [ ] T041 Executar o [quickstart.md](./quickstart.md) completo, do Nível 1 ao 7, confirmando SC-001 a SC-009; rodar `npm run test:tudo`, `npx tsc --noEmit` e `npm run lint` (depende de todas as anteriores)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — pode começar imediatamente
- **Foundational (Phase 2)**: depende do Setup — **BLOQUEIA** todas as histórias
- **US1 (Phase 3)**: depende da Phase 2
- **US2 (Phase 4)**: depende da Phase 2. Tecnicamente pode começar em paralelo a US1 (o registro é um módulo isolado, sem contato com `app/`), mas a **integração** (T028) precisa de `app/(interno)/layout.tsx`, criado na T010
- **US3 (Phase 5)**: depende de US2 — o agrupamento opera sobre a lista filtrada que US2 produz
- **Polish (Phase 6)**: depende de todas as histórias desejadas

### User Story Dependencies

- **US1 (P1)**: independente. Entregável sozinho como MVP.
- **US2 (P1)**: o núcleo (T022–T025) é independente de US1; a integração final (T026–T028) precisa de T010. Sem US1, US2 só afetaria o menu de staff.
- **US3 (P2)**: depende de US2. Não é independente por natureza — agrupar exige ter o que agrupar.

### Ordem sequencial recomendada

`T001 → T002 → T003…T008 → T009…T021 (MVP) → T022…T030 → T031…T034 → T035…T041`

### Parallel Opportunities

- **Setup**: T002 é [P]
- **Phase 2**: T003 e T004 em paralelo (arquivos distintos); T005 depende de ambos
- **US1**: T012, T013, T014, T015 em paralelo — quatro movimentações de diretórios distintos, todas dependentes apenas de T010
- **US2**: sem paralelismo interno relevante — a cadeia registro → ícones → sidebar → layout é sequencial por dependência de tipo
- **Polish**: T035, T036, T037 e T039 em paralelo

---

## Parallel Example: User Story 1

```bash
# Depois da T010 (layout de (interno) criado), as quatro movimentações são independentes:
Task: "Mover app/sem-permissao/ → app/(interno)/sem-permissao/"
Task: "Mover app/(public)/voluntariado/candidatura/ → app/(interno)/voluntariado/candidatura/"
Task: "Mover app/voluntariado/minhas-atividades/ → app/(interno)/voluntariado/minhas-atividades/"
Task: "Mover app/design-system/ → app/(interno)/design-system/"
```

```bash
# Na Phase 2, as duas extrações de região tocam arquivos distintos:
Task: "Criar src/shared/ui/shell/topbar.tsx a partir do <header> de staff-shell.tsx"
Task: "Criar src/shared/ui/shell/sidebar-nav.tsx a partir do <nav> de staff-shell.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Setup (T001–T002)
2. Phase 2: Foundational (T003–T008) — **crítico**, bloqueia tudo; refatoração sem mudança de comportamento
3. Phase 3: US1 (T009–T021)
4. **PARAR e VALIDAR**: Nível 2 do quickstart nos 5 perfis
5. Entregável: todo perfil autenticado ganha identificação, tema, notificações e ação de sair em qualquer página — a lacuna mais grave fechada

### Entrega incremental

1. Setup + Foundational → shell compartilhado, comportamento inalterado
2. + US1 → shell em toda página autenticada (**MVP**)
3. + US2 → menu correto por perfil, travado por teste contra a autorização
4. + US3 → menu agrupado e legível para perfis com muitos destinos
5. + Polish → acessibilidade, responsividade, casos de borda de sessão, performance

Cada incremento é demonstrável e não quebra o anterior.

### Estratégia com equipe paralela

Com dois desenvolvedores, depois da Phase 2:

- Dev A: US1 (movimentação de route groups) — toca `app/`
- Dev B: US2 núcleo, T022–T025 (registro + testes + ícones) — toca `src/shared/`

Os dois convergem em T026–T028. A divisão é limpa porque a fronteira `app/` ÷ `src/shared/` é exatamente onde as histórias se separam.

---

## Status da implementação (2026-08-12)

**33 de 41 tarefas concluídas.** Todo o código está implementado e verificado por
`npx tsc --noEmit`, `npm run lint`, `npm test` (106 testes, 8 arquivos) e `npm run build`.

As 8 pendentes são **exclusivamente validação manual em navegador** (T021, T030, T034 parcial,
T035 parcial, T036, T037, T038, T041). Todas dependem de subir a aplicação com as contas de
teste dos 5 perfis semeadas em um banco Neon real.

**Por que não foram executadas**: semear as contas cria, num banco possivelmente compartilhado,
cinco usuários de senha conhecida — um deles `administrador`. É ação de efeito externo e não
trivialmente reversível, então exige autorização explícita antes de rodar. Para executá-las:

```bash
# 1. definir SEED_TESTE_PASSWORD em .env.local
npm run db:seed
npm run dev
# 2. seguir specs/002-role-based-app-shell/quickstart.md, Níveis 2 a 7
```

A parte automatizável de T034 (`npm test`, `tsc`, `lint`) já passou; falta só o Nível 4 visual.
A parte de código de T035 foi feita — `<nav aria-label>`, `aria-current`, `aria-expanded`,
`ANEL_FOCO` nos links (que o shell anterior não tinha) e alvos `min-h-11` — falta a conferência
por teclado no navegador.

---

## Notes

- **A T008 é o portão de qualidade da refatoração.** Se o comportamento mudou ali, a extração está errada e o erro se propaga por todas as histórias. Não avance sem validar.
- **Movimentação de arquivo é o maior risco da feature** (plan.md, risco 1). Route groups não alteram URLs; qualquer 404 após uma movimentação é erro de caminho, não comportamento esperado. A T002/T020 existem só para isso.
- **`instant = false` sobe junto com o gate de sessão** (T010/T011). Esquecer isso faz o Next tentar prerenderizar um segmento que depende de cookies.
- **Nenhuma tarefa altera `src/shared/auth/rotas.ts` ou `proxy.ts`.** A autorização é premissa desta feature, não escopo. Se uma tarefa parecer exigir mudança ali, pare — provavelmente a matriz de `data-model.md` está sendo contrariada.
- **A inconsistência pré-existente de rota pública** (`/`, `/cadastro` e `/voluntariado/candidatura` exigem sessão apesar de terem código para deslogado) está descrita em research.md D1 e **não é resolvida aqui**. Ao validar a T021, comportamento idêntico ao anterior é sucesso, não regressão.
- Commitar após cada tarefa ou grupo lógico, seguindo Conventional Commits (Princípio II).
- Parar em qualquer checkpoint para validar a história isoladamente.
