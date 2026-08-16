---
description: 'Task list for feature 013 — navegação lateral responsiva'
---

# Tasks: Navegação lateral responsiva

**Input**: Design documents from `/specs/013-navegacao-lateral-responsiva/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **uma única tarefa de teste automatizado**, e isso é deliberado. O Princípio III exige
TDD em `domain/` e `application/`; esta feature não toca nenhuma das duas — é layout, foco e
comportamento de viewport. A única lógica pura existente é a normalização da preferência de
coluna (T014). O resto **não se testa sem navegador**: barra de endereço recolhendo, foco contido
num diálogo e gesto de voltar não têm equivalente em teste unitário. Por isso, aqui o roteiro de
validação manual é o instrumento principal, não um complemento.

**Organization**: agrupado por user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependências pendentes)
- **[Story]**: user story à qual a tarefa pertence (US1, US2, US3)
- Caminho de arquivo exato em toda descrição

## Path Conventions

- Shell e navegação: `src/shared/ui/shell/`
- Primitivo de gaveta: `src/shared/ui/drawer/`
- Script de preferência: `app/layout.tsx`
- Testes unitários convivem com o código (`*.test.ts`)

**Sem migração, sem dependência nova, sem variável de ambiente nova.**

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: registrar o estado "antes", que é o que torna várias validações comparáveis.

- [X] T001 Registrar baseline executando `npm test`, `npm run lint` e `npm run build`, anotando os números para comparação ao final
- [ ] T002 [P] Com `npm run dev`, registrar o comportamento atual como referência: em aparelho real, confirmar que a barra de endereço **não** se recolhe ao rolar; e medir a largura útil de uma tela de listagem em janela de notebook, para comparar com SC-008 depois

---

## Phase 2: Foundational (Blocking Prerequisites)

**Esta feature não tem tarefas de fase foundational, e isso é uma constatação, não um descuido.**

Não existe trabalho compartilhado entre as três histórias que precise vir antes de todas elas. O
papel de pré-requisito é cumprido pela **User Story 1**, que a User Story 2 exige (ver
"Dependência real" abaixo). A User Story 3 é independente das duas.

Padronizar uma fase foundational artificial aqui só criaria tarefas sem conteúdo.

---

## Phase 3: User Story 1 - Rolar a tela sem brigar com o aplicativo (Priority: P1) 🎯 MVP

**Goal**: a rolagem passa a ser a da página. A barra de endereço volta a se recolher no celular,
some a possibilidade de duas barras verticais, e o teclado rola sem clique prévio.

**Independent Test**: abrir qualquer tela longa em um celular real e rolar — sem tocar no menu.

### Implementation for User Story 1

- [X] T003 [US1] Remover `h-dvh` e `overflow-hidden` do contêiner externo e `overflow-y-auto` do `<main>` em `src/shared/ui/shell/app-shell.tsx` (linhas 64 e 78), passando a rolagem para o documento (contracts/arquitetura-rolagem.md R-01)
- [X] T004 [US1] Tornar a barra superior aderente ao topo (`sticky top-0`) em `src/shared/ui/shell/topbar.tsx`, mantendo-a visível durante a rolagem sem reintroduzir contêiner rolante (R-02)
- [X] T005 [US1] Tornar a coluna aderente ao topo em `src/shared/ui/shell/sidebar-nav.tsx`, permitindo rolagem interna **apenas** quando os destinos excederem a altura da janela — nunca uma segunda barra para o conteúdo da página (R-02, R-03)
- [X] T006 [US1] Usar unidades de viewport dinâmicas onde altura de janela for necessária em `src/shared/ui/shell/`, para que o layout não corte conteúdo quando a barra de endereço ou o teclado virtual mudam a altura visível (R-06)
- [X] T007 [US1] Percorrer as telas autenticadas procurando conteúdo cortado ou rolagem perdida; havendo resíduo, corrigir **na própria tela**, sem reintroduzir contêiner rolante no shell (R-07 — a busca de research.md D3 não encontrou dependências, então o esperado é nenhuma correção)

**Checkpoint**: User Story 1 completa e verificável sozinha (quickstart V1, V2, V3). Já resolve a
queixa de origem, em todas as telas.

---

## Phase 4: User Story 2 - Navegar no celular por uma gaveta (Priority: P1)

**Goal**: substituir o painel de menu de ações por uma gaveta lateral esquerda, com fundo que não
rola e quatro caminhos de fechamento.

**Independent Test**: abrir e fechar a navegação em um celular, com o conteúdo atrás
propositalmente longo, verificando cada forma de fechamento.

**⚠️ Depende da User Story 1** — ver "Dependência real" abaixo.

### Implementation for User Story 2

- [X] T008 [US2] Acrescentar `'left'` ao mapa `POSICAO` e ao tipo `lado` em `src/shared/ui/drawer/drawer.tsx` (linhas 24-31), sem criar um componente de painel lateral próprio (contracts/gaveta-navegacao.md G-01)
- [X] T009 [US2] Criar `src/shared/ui/shell/gaveta-navegacao.tsx` sobre o `Drawer` com `lado="left"`, apresentando os destinos como **links** dentro de um landmark de navegação e preservando grupos, rótulos, ícones e ordem atuais; **não** usar semântica de menu de ações (G-02, G-05)
- [X] T010 [US2] Aplicar contenção de rolagem à lista de destinos em `src/shared/ui/shell/gaveta-navegacao.tsx`, para que chegar ao fim não transfira o gesto à página atrás (R-04, FR-005)
- [X] T011 [US2] Implementar em `src/shared/ui/shell/gaveta-navegacao.tsx` o fechamento pelo gesto de voltar: empilhar entrada de histórico ao abrir, ouvir `popstate` para fechar, e **desempilhar** ao fechar por destino, fundo ou Esc — o par é obrigatório, senão o histórico acumula e o usuário precisa apertar voltar duas vezes (G-04, R4)
- [X] T012 [US2] Ligar a gaveta em `src/shared/ui/shell/app-shell.tsx` e remover `useMenu`, `Ark.RootProvider` e `topbarRef` (linhas 43-52, 63, 38) — a âncora existia só para posicionar um menu suspenso na largura do `<header>`, e uma gaveta se posiciona pela borda da viewport (G-07)
- [X] T013 [US2] Substituir `Ark.Trigger` por um botão comum com `onClick` em `src/shared/ui/shell/topbar.tsx`, removendo o encaminhamento de `ref` e a prop `menuAberto` de `TopbarProps` (linhas 33-39, 47-58, G-07)
- [X] T014 [US2] Fechar a gaveta ao a janela cruzar o limiar `lg` em `src/shared/ui/shell/app-shell.tsx`, garantindo que nunca haja as duas formas de navegação visíveis ao mesmo tempo nem nenhuma (data-model.md E2)
- [X] T015 [US2] Remover `src/shared/ui/shell/menu-mobile.tsx` e conferir que não resta nenhuma referência a ele no repositório (G-07)

**Checkpoint**: User Stories 1 e 2 entregues — o MVP (quickstart V4 a V8).

---

## Phase 5: User Story 3 - Recolher a navegação em telas grandes (Priority: P2)

**Goal**: alternar entre coluna com rótulos e trilha de ícones, com a escolha lembrada e sem
salto visual.

**Independent Test**: em janela de notebook, alternar os dois estados, navegar e recarregar,
confirmando que a escolha persiste e que a coluna não pisca expandida antes de recolher.

**Independente das outras duas** — pode ser adiada sem prejuízo.

### Tests for User Story 3 ⚠️

> Escrever primeiro e confirmar que falha antes de implementar.

- [X] T016 [P] [US3] Criar `src/shared/ui/shell/preferencia-coluna.test.ts` cobrindo a normalização: `expandida` e `recolhida` são preservados; ausente, string vazia, valor corrompido e qualquer outro valor resolvem para `expandida` (contracts/coluna-recolhivel.md C-03, FR-017)

### Implementation for User Story 3

- [X] T017 [US3] Implementar em `src/shared/ui/shell/preferencia-coluna.ts` a normalização testada em T016 e o script inline de inicialização, espelhando `themeInitScript` de `src/shared/ui/theme/theme-provider.tsx` (linhas 19-30): leitura defensiva em `try/catch`, normalização, e gravação de um atributo no elemento raiz (C-02, C-03)
- [X] T018 [US3] Injetar o script em `app/layout.tsx` ao lado do `themeInitScript` (linha 49), para que a preferência esteja aplicada **antes** da hidratação — sem isso a coluna renderiza expandida e salta para recolhida a cada navegação (C-02, R2)
- [X] T019 [US3] Implementar os dois estados de apresentação em `src/shared/ui/shell/sidebar-nav.tsx`, sem ler o armazenamento no inicializador do estado do React — isso causaria divergência de hidratação; o documento já carrega a preferência e o estado sincroniza depois, como `theme-provider.tsx:39-46` documenta (C-01, R2)
- [X] T020 [US3] Adicionar em `src/shared/ui/shell/sidebar-nav.tsx` o controle de alternar, com nome acessível que diga a ação ("Recolher navegação" / "Expandir navegação"), gravando a preferência imediatamente (C-01, E4)
- [X] T021 [US3] Na coluna recolhida, adicionar dica visual com o rótulo ao apontar ou focar (via `src/shared/ui/tooltip/tooltip.tsx`) **e**, separadamente, um nome acessível textual sempre presente em cada destino — dica visual não é nome acessível e não aparece em toque (C-04, R3, FR-018/FR-019)
- [X] T022 [US3] Garantir que a indicação do destino atual e a separação entre grupos permanecem perceptíveis na trilha de ícones, onde os rótulos de grupo não cabem (C-06, FR-020/FR-021)
- [X] T023 [US3] Garantir que a identificação da aplicação permanece visível com a coluna recolhida em `src/shared/ui/shell/sidebar-nav.tsx` ou `src/shared/ui/shell/topbar.tsx` — hoje a topbar a esconde em `lg+` (linha 61) porque a coluna expandida a exibe (`sidebar-nav.tsx:36`), então recolhida **nenhuma das duas** mostraria (C-05, R5)

**Checkpoint**: as três histórias entregues (quickstart V9 a V11).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T024 [P] Confirmar que `package.json` não ganhou dependência e que `db/migrations/` não ganhou arquivo, conforme o escopo declarado no plano (Princípio VI)
- [X] T025 [P] Revisar o diff procurando o que o design proíbe: `overflow-y-auto` reintroduzido no `<main>` de `src/shared/ui/shell/app-shell.tsx`, qualquer referência remanescente a `menu-mobile`, e leitura de `localStorage` no inicializador de `useState`
- [X] T026 [P] Medir a largura útil de uma tela de listagem com a coluna recolhida e comparar com o valor anotado em T002, confirmando ganho de ao menos 200 px (C-08, SC-008)
- [ ] T027 Executar o roteiro V1–V13 de [quickstart.md](./quickstart.md), com **V1 e V5 obrigatoriamente em aparelho real** — emulação de navegador não reproduz o recolher da barra de endereço nem o gesto de voltar do sistema
- [X] T028 [P] Rodar `npm test`, `npm run lint`, `npm run build` e `npm run format`, comparando com o baseline de T001
- [X] T029 Revisar o diff contra os Princípios I, IV e VI antes do merge, confirmando que os destinos por perfil continuam idênticos (SC-010) e que nada de autorização foi tocado

### Resultado do polish

**T007 — varredura de telas (nenhuma correção necessária)**: busca por `h-full`, `h-dvh`,
`h-screen`, `overflow-y-auto` e `overflow-auto` em `app/` retornou **zero** ocorrências fora de
`(publico)`. Confirma a previsão de research.md D3: a troca para rolagem de página não exigiu
ajuste em nenhuma tela.

**T024 — escopo (verificado)**: `package.json` e `db/migrations/` intocados.

**T025 — o que o design proíbe (verificado)**: nenhum `overflow-y-auto` no `app-shell.tsx` (a
única ocorrência do termo é o comentário que manda não reintroduzi-lo); nenhuma referência a
`menu-mobile` fora de uma nota histórica em comentário; nenhum `localStorage` em inicializador de
`useState`.

**T026 — ganho de largura (medido)**: coluna expandida `lg:w-72` = **288px**; recolhida
`lg:w-16` = **64px**; ganho de **224px**. SC-008 exige ≥ 200px — **atende**.

**T028 — suíte (verde)**: `npx tsc --noEmit` limpo; `npm test` **204/204** (era 196);
`npm run lint` limpo; `npm run build` conclui.

**T029 — revisão constitucional (aprovada)**:

- *Princípio I*: mudanças confinadas a `src/shared/ui/` e ao layout raiz. `domain`, `application`
  e `infrastructure` intocados. A fonte da estrutura de navegação continua sendo
  `src/shared/auth/navegacao.ts`, consumida como antes.
- *Princípio IV*: nenhuma alteração de rota, sessão ou autorização. Os destinos seguem chegando
  já filtrados do servidor; nenhum `gruposVisiveis`/`itemAtivo` foi tocado (SC-010). A preferência
  de coluna não influencia acesso.
- *Princípio VI*: zero dependência nova. O saldo de código é **negativo** — `menu-mobile.tsx`
  removido e a fiação de âncora entre topbar e menu eliminada. A gaveta reusou o `Drawer` e a
  persistência reusou o padrão de script inline do tema, em vez de duplicar ambos.

**Pendências reais**: T002 e T027 dependem de aparelho real. Ver observação abaixo.

**Sobre o T002**: a referência "antes" em aparelho real não foi capturada e **não é mais
capturável no working tree** — o código já mudou. Para comparar, é preciso conferir o commit
anterior (`git stash` ou checkout do commit de origem da branch). A metade mensurável do T002 (a
largura da coluna, 288px) foi obtida do código e usada em T026.

---

## Dependencies & Execution Order

### Dependência real: US2 depende de US1

**Não é ordem de conveniência, é mecânica.** O travamento de rolagem de fundo vem do primitivo de
diálogo com `preventScroll: true` por padrão — verificado em
`@zag-js/dialog/dist/dialog.types.d.mts:33-56` — e age sobre o **documento**. Hoje esse
travamento **já está ativo** no menu atual e mesmo assim o fundo rola, porque quem rola é o
`<main>`, não o documento.

Construir a gaveta antes da US1 reproduziria exatamente o mesmo defeito com um componente novo, e
daria a impressão de que a gaveta é que está com problema.

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências
- **Foundational (Phase 2)**: vazia por constatação — ver a própria fase
- **User Story 1 (Phase 3)**: depende do Setup
- **User Story 2 (Phase 4)**: **depende da User Story 1**
- **User Story 3 (Phase 5)**: depende apenas do Setup — independente de US1 e US2
- **Polish (Phase 6)**: depende das histórias entregues

### Cadeias sequenciais

- T003 → T012 → T014 (mesmo arquivo `app-shell.tsx`, em fases diferentes)
- T004 → T013 (mesmo arquivo `topbar.tsx`)
- T005 → T019 → T020 → T021 → T022 (mesmo arquivo `sidebar-nav.tsx`)
- T008 → T009 → T010 → T011 (o `Drawer` precisa do lado `left` antes da gaveta existir)
- T012 → T015 (remover o arquivo só depois de nada mais o referenciar)
- T016 → T017 (teste antes da implementação)
- T017 → T018 (o script precisa existir antes de ser injetado)

### Parallel Opportunities

- T002 durante o Setup
- T016 pode ser escrito em paralelo com toda a Phase 3 e a Phase 4
- A Phase 5 inteira roda em paralelo com as Phases 3 e 4, **exceto** pela cadeia de
  `sidebar-nav.tsx` (T005 é da US1 e vem antes de T019)
- T024, T025, T026 e T028 em paralelo no Polish

---

## Parallel Example: duas pessoas

```bash
# A US3 é independente e só encosta em sidebar-nav.tsx depois de T005:
Dev A: T003 → T004 → T005 → T006 → T007        # US1 (desbloqueia a US2)
       → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015   # US2

Dev B: T016 → T017 → T018                       # preferência, arquivos próprios
       (aguarda T005) → T019 → T020 → T021 → T022 → T023          # coluna

# Ponto de coordenação: `sidebar-nav.tsx` é tocado por T005 (Dev A) e T019+ (Dev B).
```

---

## Implementation Strategy

### MVP mínimo viável: só a User Story 1

1. Phase 1 → Phase 3
2. **PARAR E VALIDAR**: quickstart V1 (barra de endereço), V2 (barra única), V3 (teclado)
3. Entregável real e independente: a queixa de origem some em **todas** as telas, sem tocar em
   nenhum componente de navegação

Esse recorte é incomum e vale considerar: é pouca mudança, risco baixo (research.md D3 mostrou
que nenhuma tela depende do contêiner rolante) e resolve sozinho a parte mais citada do pedido.

### MVP completo: US1 + US2

Adiciona a gaveta e remove o menu de ações — entrega o pedido explícito por inteiro.

### Entrega incremental

1. Setup → baseline registrado
2. + US1 → validar → demo
3. + US2 → validar → demo (MVP completo)
4. + US3 → validar → demo
5. Polish → merge

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente
- Uma única tarefa de teste automatizado, por decisão fundamentada — a feature não toca `domain`
  nem `application`, e o comportamento central não tem equivalente em teste unitário
- **V1 e V5 do quickstart exigem aparelho real**; a emulação do navegador não reproduz nem o
  recolher da barra de endereço nem o gesto de voltar do sistema
- Commits em Conventional Commits (`feat:`, `refactor:`, `test:`) — Princípio II
- O saldo de código é **negativo**: um componente removido e a fiação de âncora entre topbar e
  menu eliminada
- Três armadilhas registradas nos contratos, todas fáceis de introduzir: identificação da
  aplicação sumindo com a coluna recolhida (C-05); dica visual confundida com nome acessível
  (C-04); e entrada de histórico empilhada sem ser desempilhada (G-04)
