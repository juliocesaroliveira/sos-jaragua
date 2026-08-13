---
description: "Task list for feature implementation"
---

# Tasks: Página Padrão de Endereço Não Encontrado (404)

**Input**: Design documents from `/specs/003-not-found-page/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Incluídos, porém **mínimos e deliberadamente concentrados**. [contracts/nao-encontrado.md](./contracts/nao-encontrado.md) define INV-01…INV-03 sobre `destinoDeRetorno` — a única lógica pura da feature. Todo o resto é apresentação, que por desenho é fina e recebe validação de contrato (Princípio III da constituição). Escrever teste unitário para JSX de uma página de erro seria cerimônia sem valor.

**Organization**: Tarefas agrupadas por user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos distintos, sem dependência pendente)
- **[Story]**: US1, US2, US3
- Caminhos de arquivo exatos nas descrições

## Path Conventions

Monolito modular Next.js: rotas em `app/`, compartilhado em `src/shared/`, design system em `src/shared/ui/`. Testes co-locados (`*.test.ts`).

---

## Phase 1: Setup

**Purpose**: registrar o "antes", sem o qual SC-005 não é verificável.

- [ ] T001 Registrar o comportamento atual como linha de base para SC-005: com `npm run dev`, acessar `http://localhost:3000/pagina-que-nao-existe` autenticado e confirmar que hoje aparece a tela genérica em inglês, sem shell e sem botão de retorno

- [ ] T002 [P] Confirmar que as contas de teste dos 5 perfis existem (feature 002); se não, semear conforme `specs/002-role-based-app-shell/quickstart.md` — a validação por perfil da T014 depende delas

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: as três peças que **todas** as histórias consomem — o destino do botão, o conteúdo compartilhado e a extração do shell.

**⚠️ CRITICAL**: nenhuma história começa antes desta fase terminar.

**⚠️ A T008 é refatoração pura**: ao fim dela a aplicação deve se comportar **exatamente** como antes. Só a localização do código muda.

### Testes da fundação ⚠️

> Escrever primeiro; devem FALHAR (a função ainda não existe).

- [ ] T003 Acrescentar a `src/shared/auth/rotas.test.ts` as invariantes de [contracts/nao-encontrado.md](./contracts/nao-encontrado.md): INV-01 (`podeAcessar(destinoDeRetorno(true), role)` verdadeiro para **todos** os valores de `ROLES` — a trava de SC-004), INV-02 (`ehRotaPublica(destinoDeRetorno(false))` verdadeiro), INV-03 (os dois destinos são distintos)

### Implementação da fundação

- [ ] T004 Implementar `destinoDeRetorno(temSessao: boolean)` em `src/shared/auth/rotas.ts`, reaproveitando as constantes `AREA_PADRAO` e `ROTA_PUBLICA` em vez de literais — sem elas a página divergiria silenciosamente do que a feature 002 estabeleceu (depende de T003)

- [ ] T005 [P] Criar `src/shared/ui/nao-encontrado/nao-encontrado.tsx` conforme o contrato C-01…C-07: Server Component sem hooks e sem I/O, props `destino` e `rotuloBotao` apenas, texto em pt-BR, botão com `ANEL_FOCO` e alvo ≥44px. **Não** recebe `ator` nem lista de navegação — é o que torna a ausência de vazamento uma propriedade do tipo (FR-009)

- [ ] T006 [P] Criar `app/_shell/shell-autenticado.tsx` extraindo de `app/(interno)/layout.tsx` a montagem do shell (busca paralela de notificações, `itensDeNavegacao(ator.role)`, render do `<AppShell>`), recebendo `ator: SessaoAtor` **por prop** — os dois chamadores obtêm a sessão de formas incompatíveis (contrato S-01)

- [ ] T007 Exportar `ConteudoNaoEncontrado` no barrel `src/shared/ui/index.ts` (depende de T005)

- [ ] T008 Alterar `app/(interno)/layout.tsx` para compor `<ShellAutenticado ator>{children}</ShellAutenticado>`, mantendo `exigirSessao()` e `export const instant = false` neste nível (depende de T006)

- [ ] T009 Verificar que a refatoração não mudou comportamento: `npx tsc --noEmit`, `npm run lint`, `npm test`, e conferir no navegador que `/dashboard` e `/` renderizam idênticos ao estado anterior (depende de T004, T007, T008)

**Checkpoint**: peças prontas, comportamento inalterado. As histórias podem começar.

---

## Phase 3: User Story 1 - Endereço inexistente com sessão ativa (Priority: P1) 🎯 MVP

**Goal**: quem está autenticado e acessa um endereço inexistente vê a página da aplicação **com** barra superior e menu do seu perfil, e um botão que leva à home.

**Independent Test**: autenticar com cada um dos 5 perfis, acessar um endereço inventado e confirmar shell completo, menu correspondente ao perfil e botão funcional.

- [ ] T010 [US1] Criar `app/not-found.tsx` como Server Component `async` conforme o contrato R-01…R-04: `obterSessao()` (**nunca** `exigirSessao()` — uma página de erro que redireciona é defeito), e com sessão renderizar `<ShellAutenticado ator>` envolvendo `<ConteudoNaoEncontrado destino={destinoDeRetorno(true)} …/>`

- [ ] T011 [US1] Definir `metadata` com título em pt-BR em `app/not-found.tsx`; o `noindex` é injetado pelo próprio Next para respostas 404 e **não** deve ser duplicado à mão

- [ ] T012 [US1] Rodar `npm run build` e tratar o risco de Cache Components identificado em [research.md](./research.md) D3 — `app/not-found.tsx` lê cookies, e o segmento vira dinâmico. Se o build reclamar de dado não cacheado sem fronteira, aplicar o contorno: isolar a leitura de sessão sob `<Suspense>`, mantendo texto e botão imediatos (depende de T010)

- [ ] T013 [US1] Verificar `npx tsc --noEmit`, `npm run lint`, `npm test` (depende de T012)

- [ ] T014 [US1] Executar o Nível 2 do [quickstart.md](./quickstart.md) nos 5 perfis: shell presente, menu conferido contra a matriz de `specs/002-role-based-app-shell/data-model.md`, botão levando a `/` em um clique, endereço solicitado **não** ecoado na tela (depende de T013)

**Checkpoint**: US1 completa. O caso majoritário — tráfego autenticado — deixa de ser beco sem saída. **MVP entregável.**

---

## Phase 4: User Story 2 - Endereço inexistente sem sessão (Priority: P1)

**Goal**: sem sessão válida, a mesma página é exibida **sem** barra superior e **sem** menu, sem revelar nada da estrutura interna, com saída adequada a quem não está autenticado.

**Independent Test**: deslogado, alcançar a página e confirmar ausência de shell, ausência de qualquer nome de área interna no HTML e botão levando a `/login`.

**Nota honesta sobre independência**: US1 e US2 são os dois ramos do **mesmo arquivo** (`app/not-found.tsx`), então não são incrementos deploináveis separadamente no sentido estrito — ao fim da T010 o ramo anônimo já renderiza. O que esta fase entrega é o que esse ramo exige para estar **correto**: rótulo e destino próprios, ausência total de I/O, e a verificação de não-vazamento. Sem ela, o ramo existe mas não está garantido.

- [ ] T015 [US2] Em `app/not-found.tsx`, garantir que o caminho sem sessão renderiza `<ConteudoNaoEncontrado>` **direto**, sem `ShellAutenticado`, com `destinoDeRetorno(false)` e rótulo de botão próprio em pt-BR — apontar para `/login` em vez de `/` evita depender do `proxy.ts` para corrigir o destino em um salto extra (contrato R-02)

- [ ] T016 [US2] Confirmar por leitura do código que o caminho sem sessão **não** dispara consulta alguma: nem `listarNotificacoes`, nem `contarNaoLidas`, nem `itensDeNavegacao` (contrato R-02)

- [ ] T017 [US2] Executar o Nível 3 do [quickstart.md](./quickstart.md) usando um caminho fora do matcher do `proxy.ts` (ex.: `/arquivo-inexistente.png`), e inspecionar o HTML servido buscando por "Painel", "Estoque", "Convocação", "Relatórios" — **nenhum** pode aparecer (SC-002, FR-009)

**Checkpoint**: as duas variantes corretas e verificadas.

---

## Phase 5: User Story 3 - Recurso inexistente na área autenticada (Priority: P2)

**Goal**: `notFound()` lançado dentro da área autenticada exibe a mesma página, preservando o shell que já estava na tela.

**Independent Test**: autenticado como perfil interno, acessar `/atividades/<id-inexistente>` e confirmar a página com shell, com "Atividades" ainda destacado no menu.

- [ ] T018 [US3] Criar `app/(interno)/not-found.tsx` renderizando apenas `<ConteudoNaoEncontrado destino={destinoDeRetorno(true)} …/>` — **sem** montar o shell, que já vem de `(interno)/layout.tsx` e continua na árvore (contrato I-01…I-03)

- [ ] T019 [US3] Executar o Nível 4 do [quickstart.md](./quickstart.md): página com shell, item "Atividades" ainda ativo no menu, e a mensagem não informando se o registro já existiu. Confirmar a presença de `<meta name="robots" content="noindex">` — aqui o status é `200`, não `404`, por o `notFound()` acontecer após o início do streaming (decisão consciente em [research.md](./research.md) D4) (depende de T018)

**Checkpoint**: as três histórias completas.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T020 Executar o Nível 5 do [quickstart.md](./quickstart.md) — o teste que separa esta feature de um defeito de segurança: `usuario`→`/dashboard`, `voluntario`→`/estoque`, `coordenador`→`/relatorios`, `membro_defesa_civil`→`/convocacao` devem **todos** continuar produzindo `/sem-permissao`, e nunca a página de não encontrado (FR-016, SC-006)

- [ ] T021 [P] Executar o Nível 6 do [quickstart.md](./quickstart.md): confirmar status `404` real para URL desconhecida autenticada, `307` para `/login` quando deslogado, e a meta `noindex` no HTML

- [ ] T022 [P] Executar o Nível 7 do [quickstart.md](./quickstart.md): operável por teclado com foco visível, legível em 360px sem rolagem horizontal, alvo de toque ≥44px, tema claro/escuro aplicado nas duas variantes

- [ ] T023 [P] Registrar em `spec/DESIGN.md`, junto à seção §6.5, as duas fronteiras de `not-found` e por que `global-not-found` foi rejeitado — a constituição (Princípio VI) exige decisão arquitetural registrada, não implícita no código

- [ ] T024 Executar o [quickstart.md](./quickstart.md) completo (Níveis 1 a 7) e rodar `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (depende de todas as anteriores)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências
- **Foundational (Phase 2)**: depende do Setup — **BLOQUEIA** todas as histórias
- **US1 (Phase 3)**: depende da Phase 2
- **US2 (Phase 4)**: depende da T010 (mesmo arquivo) — ver a nota de independência na fase
- **US3 (Phase 5)**: depende da Phase 2 apenas; **independente de US1 e US2** (arquivo próprio)
- **Polish (Phase 6)**: depende das histórias desejadas

### User Story Dependencies

- **US1 (P1)**: independente após a fundação. Entregável sozinho como MVP.
- **US2 (P1)**: **não** é independente de US1 — compartilham `app/not-found.tsx`. Honestamente sequencial.
- **US3 (P2)**: genuinamente independente — `app/(interno)/not-found.tsx` é arquivo próprio e pode ser feito em paralelo a US1/US2.

### Ordem sequencial recomendada

`T001–T002 → T003–T009 → T010–T014 (MVP) → T015–T017 → T018–T019 → T020–T024`

### Parallel Opportunities

- **Setup**: T002 é [P]
- **Phase 2**: T005 e T006 em paralelo (arquivos distintos); T007 depende de T005, T008 de T006
- **Entre histórias**: US3 (T018) pode correr em paralelo a US1/US2 — toca `app/(interno)/not-found.tsx`, que ninguém mais toca
- **Polish**: T021, T022 e T023 em paralelo

---

## Parallel Example: Phase 2

```bash
# Arquivos distintos, sem dependência entre si:
Task: "Criar src/shared/ui/nao-encontrado/nao-encontrado.tsx"
Task: "Criar app/_shell/shell-autenticado.tsx extraindo de (interno)/layout.tsx"
```

```bash
# Depois da fundação, duas frentes independentes:
Dev A: US1 + US2 — app/not-found.tsx
Dev B: US3 — app/(interno)/not-found.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Setup (T001–T002)
2. Phase 2: Foundational (T003–T009) — **crítico**, bloqueia tudo
3. Phase 3: US1 (T010–T014)
4. **PARAR e VALIDAR**: Nível 2 do quickstart nos 5 perfis
5. Entregável: o caso majoritário — tráfego autenticado — deixa de terminar em beco sem saída

### Entrega incremental

1. Setup + Foundational → peças prontas, comportamento inalterado
2. + US1 → 404 com shell para quem está autenticado (**MVP**)
3. + US2 → variante anônima correta e verificada contra vazamento
4. + US3 → recurso inexistente dentro da área autenticada
5. + Polish → 404 ÷ 403, status HTTP, acessibilidade, documentação

---

## Notes

- **A T009 é o portão da refatoração.** Se o comportamento mudou ali, a extração do `ShellAutenticado` saiu errada e o erro se propaga por todas as histórias.
- **A T012 é onde o risco técnico da feature aparece.** Cache Components + leitura de cookies na raiz. Rodar o build cedo é o que evita descobrir isso no fim.
- **A T020 é o teste que mais importa no conjunto.** Confundir "não existe" com "você não pode" é o defeito de segurança que esta feature poderia introduzir: diria a alguém que uma área não existe quando ela existe.
- **Nenhuma tarefa altera `REGRAS_DE_ROTA`, `ROTA_PUBLICA` ou `proxy.ts`.** Se uma tarefa parecer exigir isso, pare — a variante anônima é pouco observável por decisão de segurança registrada na spec, não por defeito a corrigir.
- **Não habilitar `experimental.globalNotFound`** (research.md D2): exigiria duplicar o root layout inteiro, tema incluído.
- Commitar por tarefa ou grupo lógico, seguindo Conventional Commits (Princípio II).
