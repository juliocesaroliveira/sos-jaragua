---
description: 'Task list for feature implementation'
---

# Tasks: Tooltip em ações de ícone

**Input**: Design documents from `/specs/015-tooltip-acoes-icone/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: **Nenhuma tarefa de teste automatizado.** A spec não pediu TDD, a feature não tem regra
de negócio, e o projeto não tem biblioteca de teste de componente instalada — decisão registrada em
`research.md` D10. A verificação é o roteiro de [quickstart.md](./quickstart.md), cujos itens
aparecem abaixo como tarefas de validação.

**Organization**: agrupadas por história de usuário. Ver "Acoplamento real entre US1 e US2" antes de
planejar paralelismo entre pessoas.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: a qual história a tarefa pertence (US1..US5)

## Path Conventions

Monolito Next.js na raiz do repositório: design system em `src/shared/ui/`, telas em
`app/(interno)/`. Caminhos abaixo são relativos à raiz.

---

## Phase 1: Setup (linha de base)

**Purpose**: registrar o estado anterior, para que qualquer regressão apareça como diferença e não
como suspeita.

- [X] T001 Rodar `npx tsc --noEmit`, `npm run lint` e `npm test` e registrar que os três passam **antes** de qualquer alteração
- [X] T002 [P] Capturar o inventário atual de controles só-ícone com `grep -rn "IconButton" app/ src/ --include=*.tsx` e conferir contra `contracts/adocao-telas.md` A-02..A-07 — qualquer controle fora das duas listas é lacuna do contrato e deve ser reportada antes de seguir

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: o componente precisa distinguir os dois papéis da dica **antes** da adoção. Adotar
primeiro replicaria em oito telas o defeito de anúncio duplicado que hoje existe em duas.

**⚠️ CRITICAL**: nenhuma tarefa de história pode começar antes desta fase.

- [X] T003 Acrescentar a prop `descricao?: boolean` (padrão `false`) a `TooltipProps` em `src/shared/ui/tooltip/tooltip.tsx`, conforme `contracts/tooltip.md` C-01
- [X] T004 Em `src/shared/ui/tooltip/tooltip.tsx`, passar `aria-label={conteudo}` ao `Ark.Root` quando `descricao` for `false` — é o que faz o zag omitir `role="tooltip"` e o `id` do content, tornando a dica puramente visual (C-02.10, `research.md` D3). Com `descricao: true`, não passar nada e manter o comportamento padrão do primitivo
- [X] T005 Em `src/shared/ui/tooltip/tooltip.tsx`, limitar a largura do `Ark.Content` e permitir quebra em várias linhas, com o limite preso também à largura da janela para não estourar em celular (C-02.9, `research.md` D5)
- [X] T006 Documentar no cabeçalho de `src/shared/ui/tooltip/tooltip.tsx` os dois papéis da dica e **por que** o padrão é o não-exposto — incluindo a referência pendurada de `aria-describedby` como consequência conhecida e aceita (`research.md` D3, risco residual)
- [X] T007 Verificar que `src/shared/ui/shell/sidebar-nav.tsx` e `app/(interno)/design-system/galeria.tsx` continuam compilando sem alteração (`npx tsc --noEmit`) — a prop é aditiva e não pode quebrar os dois usos existentes (C-01.1)

**Checkpoint**: o componente distingue os papéis. A adoção pode começar.

---

## Phase 3: User Story 1 - Descobrir o que um botão de ícone faz (Priority: P1) 🎯 MVP

**Goal**: todo controle de ação só-ícone passa a exibir, ao apontar, um rótulo que descreve sua
ação — e, quando a ação se refere a um registro, nomeia o registro.

**Independent Test**: apontar cada controle listado em `contracts/adocao-telas.md` A-03/A-04 e ver a
dica correta aparecer; atravessar uma fileira sem parar e não ver nenhuma.

**Regra que vale para todas as tarefas desta fase** (C-04.3): o texto da dica e o nome acessível do
controle saem da **mesma expressão** no código. Nunca duas strings literais iguais escritas em
separado — elas divergem com o tempo.

### Implementation for User Story 1

- [X] T008 [P] [US1] Envolver o `IconButton` "Abrir navegação" com `Tooltip` em `src/shared/ui/shell/topbar.tsx:54`, extraindo o rótulo para uma expressão única compartilhada com o `aria-label`
- [X] T009 [P] [US1] Envolver o `IconButton` "Sair" com `Tooltip` em `src/shared/ui/shell/topbar.tsx:94`
- [X] T010 [P] [US1] Envolver o `<button>` de tema com `Tooltip` em `src/shared/ui/theme/theme-toggle.tsx:12`, derivando dica e `aria-label` da mesma expressão dependente de `isDark` — o texto precisa mudar junto com o estado (edge case "ação que muda de estado"). Manter o elemento como `<button>` próprio; não converter para `IconButton` (`research.md` D8)
- [X] T011 [P] [US1] Envolver o `IconButton` do sino com `Tooltip` em `app/(interno)/sino-notificacoes.tsx:61`, reaproveitando a expressão que já alterna entre `Notificações` e `Notificações (N não lidas)`
- [X] T012 [P] [US1] Envolver o `IconButton` de editar com `Tooltip` em `app/(interno)/(staff)/admin/tabela-usuarios.tsx:56`, com texto `Editar {nome}` derivado de `row.original.nome` (FR-015)
- [X] T013 [P] [US1] Envolver o `IconButton` "Alocar voluntário neste turno" com `Tooltip` em `app/(interno)/(staff)/atividades/[id]/painel-escala.tsx:147`
- [X] T014 [US1] Envolver o `IconButton` de remover alocação com `Tooltip` em `app/(interno)/(staff)/atividades/[id]/painel-escala.tsx:168`, texto `Remover {nome} do turno`. Não mexer no `loading={emAndamento}`: durante a remoção o botão fica desabilitado e a dica não aparece, e isso está correto (`research.md` D4). Mesmo arquivo de T013 — sequencial
- [X] T015 [P] [US1] Envolver o `IconButton` "Remover linha" com `Tooltip` em `app/(interno)/(staff)/estoque/saida/saida-form.tsx:161`, cobrindo por ora **apenas o estado disponível**; o `disabled` permanece intocado nesta fase (o estado indisponível é a US3)
- [X] T016 [P] [US1] Envolver o `IconButton` "Remover componente" com `Tooltip` em `app/(interno)/(staff)/estoque/kits/gestao-kits.tsx:275`, também só no estado disponível
- [ ] T017 [US1] Validar R2 do `quickstart.md` (itens 7–8): dica correta em cada tela, nenhuma dica ao atravessar uma fileira rapidamente, dica dispensada ao rolar, e reposicionamento correto na **última** linha de `/admin`

**Checkpoint**: US1 completa e demonstrável. Como o mesmo mecanismo abre por foco de teclado, a US2
já está funcionalmente presente aqui — o que falta dela é correção de acessibilidade, na próxima
fase.

---

## Phase 4: User Story 2 - Enxergar a ação navegando por teclado (Priority: P1)

**Goal**: o apoio visual vale para quem navega por teclado, e quem usa leitor de tela ouve a ação
**uma única vez**.

**Independent Test**: percorrer uma tela só com Tab vendo a dica em cada controle; Esc dispensa sem
mover o foco; leitor de tela anuncia cada ação uma vez.

**Nota**: a abertura por foco já vem pronta do primitivo (`research.md` D2) e não precisa ser
escrita. O trabalho real desta fase é **corrigir o anúncio duplicado**, que existe hoje.

### Implementation for User Story 2

- [X] T018 [US2] Corrigir o anúncio duplicado do botão recolher/expandir em `src/shared/ui/shell/sidebar-nav.tsx:116`: hoje a mesma string vai para `conteudo` e para `aria-label`. Derivar as duas de uma expressão única e confirmar que o papel é o de repetição (`descricao` ausente) — `contracts/adocao-telas.md` A-02
- [X] T019 [US2] Corrigir o mesmo defeito nos itens de navegação recolhidos em `src/shared/ui/shell/sidebar-nav.tsx:189` (`item.rotulo`). Mesmo arquivo de T018 — sequencial
- [X] T020 [US2] Revisar as dez adoções da Phase 3 e confirmar que **nenhuma** passou `descricao: true` — nesta fase toda dica é repetição visual do nome acessível (C-04.3)
- [ ] T021 [US2] Validar R3 do `quickstart.md` (itens 9–12): Tab exibe a dica; Esc dispensa e o foco **permanece** no botão; clique de mouse não traz a dica de volta; dica dentro de diálogo aparece **acima** dele
- [ ] T022 [US2] Validar R6 do `quickstart.md` (itens 21–23) com leitor de tela: "Sair", "Editar {nome}" e o item de navegação recolhido são anunciados **uma única vez** (SC-003). O item 23 é a confirmação de que o defeito pré-existente foi corrigido

**Checkpoint**: US1 + US2 completas. Este é o MVP entregável.

---

## Phase 5: User Story 3 - Entender por que uma ação está indisponível (Priority: P2)

**Goal**: os dois botões que hoje ficam esmaecidos e mudos passam a explicar o motivo.

**Independent Test**: deixar uma única linha em `/estoque/saida`, apontar o botão esmaecido e ver a
explicação; alcançá-lo por Tab; clicar e confirmar que nada acontece.

**Dependência mecânica, não preferência**: `<button disabled>` não dispara evento de ponteiro nem
recebe foco — regra do navegador. Sem T023, nenhum ajuste no tooltip fará a dica aparecer, e o
resultado pareceria um tooltip quebrado (`research.md` D4).

### Implementation for User Story 3

- [X] T023 [US3] Acrescentar a prop `inativo?: boolean` a `IconButtonProps` em `src/shared/ui/icon-button/icon-button.tsx`: aparência idêntica à de `disabled`, mas **sem** o atributo `disabled` nativo — o elemento recebe `aria-disabled`, permanece focável e sensível ao ponteiro (C-03.1, C-03.3)
- [X] T024 [US3] No mesmo arquivo, bloquear o `onClick` internamente quando `inativo` — `aria-disabled` é informação para tecnologia assistiva e não impede nada por si (C-03.2)
- [X] T025 [US3] No mesmo arquivo, fazer `disabled` prevalecer se ambos forem informados, e documentar no cabeçalho que `inativo` só se usa acompanhado de dica que explique o motivo — sem ela, produz apenas um controle focável que não faz nada (C-03.5, risco residual do `research.md`)
- [X] T026 [US3] Em `app/(interno)/(staff)/estoque/saida/saida-form.tsx:161`, trocar `disabled={linhas.length === 1}` por `inativo` na **mesma condição** e alternar o texto da dica: `Remover linha` quando disponível, `A saída precisa de ao menos uma linha` com `descricao` quando inativo. A condição de indisponibilidade não muda (A-05)
- [X] T027 [US3] Em `app/(interno)/(staff)/estoque/kits/gestao-kits.tsx:275`, aplicar o mesmo tratamento: `O kit precisa de ao menos um componente` com `descricao`
- [ ] T028 [US3] Validar R4 do `quickstart.md` (itens 13–17): dica no botão esmaecido, foco alcançável por Tab com anel visível, clique e Enter **não** removem a linha, e o texto volta ao normal quando uma segunda linha é acrescentada
- [ ] T029 [US3] Validar R6 item 24: o leitor de tela anuncia nome + motivo e informa o controle como indisponível

**Checkpoint**: US1 + US2 + US3 completas.

---

## Phase 6: User Story 4 - Usar o sistema em celular sem perder informação (Priority: P2)

**Goal**: nenhuma regressão em toque. **Esta história não tem código** — o primitivo já descarta
`pointerType === 'touch'`, então ela é preservada, não construída (`research.md` D2). As tarefas
abaixo são o portão que prova isso.

**Independent Test**: percorrer os fluxos críticos em celular, sem ver nenhuma dica, e concluir
todos.

- [ ] T030 [US4] Validar R5 itens 18 e 20 do `quickstart.md` em simulador de toque ou aparelho real: cada controle de ícone executa a ação **no primeiro toque**, sem passo intermediário; o botão `inativo` não age e não trava a interface
- [ ] T031 [US4] Validar R5 item 19: concluir de ponta a ponta, sem ver nenhuma dica, registrar uma saída de estoque, alocar um voluntário em turno e editar um usuário (SC-004)

**Checkpoint**: portão de não-regressão fechado. Falha aqui **bloqueia** a integração — significa
que a feature removeu acessibilidade em vez de acrescentar apoio visual.

---

## Phase 7: User Story 5 - Consultar o padrão na vitrine (Priority: P3)

**Goal**: quem escrever a próxima tela encontra o padrão pronto em vez de reinventá-lo.

**Independent Test**: abrir `/design-system` e ver as variações demonstradas de forma interativa.

- [X] T032 [P] [US5] Expandir o exemplo único de `app/(interno)/design-system/galeria.tsx:200` para demonstrar as quatro posições, o papel de repetição vs. `descricao`, o estado `inativo` com explicação e o uso dentro de linha de tabela (A-06)
- [X] T033 [P] [US5] Atualizar `spec/DESIGN_SYSTEM.md` §4.10 com os dois papéis da dica, a regra de uso do `inativo` e a lista de controles fora do escopo (A-07), para que a fronteira não seja reaberta a cada revisão
- [ ] T034 [US5] Validar R1 do `quickstart.md` (itens 1–6) na vitrine, nos dois temas e contra a borda da janela

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T035 Rodar `npx tsc --noEmit`, `npm run lint` e `npm test` e comparar com a linha de base de T001 — nenhum erro novo, nenhum aviso novo
- [X] T036 Validar R8 do `quickstart.md` (item 26): `grep -rn "@ark-ui/react/tooltip" app/ src/ --include=*.tsx` retorna **apenas** `src/shared/ui/tooltip/tooltip.tsx` (SC-006), e todo `IconButton` da base está coberto por A-02..A-06 ou consta de A-07 (SC-001, FR-013)
- [X] T037 [P] Validar R7 item 25: com "reduzir movimento" ativo no sistema, as dicas continuam aparecendo sem deslizar — não há animação a suprimir (`research.md` D6)
- [ ] T038 Conferir SC-007 nas dez telas adotadas: nenhum controle mudou de alinhamento, espaçamento ou alvo de toque em relação ao estado anterior (C-04.6) — a dica envolve, não substitui
- [X] T039 Revisar os textos adicionados contra `data-model.md` "Vocabulário": pt-BR, imperativos curtos, sem pontuação final, registro nomeado onde a ação se refere a um registro

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências
- **Foundational (Phase 2)**: depende do Setup — **bloqueia todas as histórias**
- **US1 (Phase 3)**: depende da Phase 2
- **US2 (Phase 4)**: depende da Phase 2; T020 depende da Phase 3
- **US3 (Phase 5)**: depende da Phase 2; T026/T027 dependem de T023–T025 e tocam os mesmos arquivos de T015/T016
- **US4 (Phase 6)**: só validação — depende de US1 e US3 estarem integradas
- **US5 (Phase 7)**: depende da Phase 2; independente de US1/US3 para escrever, mas a vitrine só fica completa depois de T023 (demonstra `inativo`)
- **Polish (Phase 8)**: depende de tudo que for entregue

### Acoplamento real entre US1 e US2 — leia antes de dividir trabalho

US1 e US2 **não são independentes**, e o plano diz isso: são o mesmo mecanismo visto por dois meios
de entrada. Ao terminar a Phase 3, a abertura por foco de teclado já funciona sem nenhuma tarefa da
Phase 4, porque vem pronta do primitivo. A Phase 4 não constrói a US2 — ela **corrige** o anúncio
duplicado e prova o comportamento.

Consequência prática: **não distribua US1 e US2 para pessoas diferentes em paralelo.** T020 audita o
resultado de toda a Phase 3, e as duas fases juntas formam o MVP. US3 e US5, sim, são separáveis.

### Same-file dependencies (não paralelizar)

| Arquivo | Tarefas |
| --- | --- |
| `src/shared/ui/tooltip/tooltip.tsx` | T003 → T004 → T005 → T006 |
| `src/shared/ui/shell/topbar.tsx` | T008, T009 |
| `src/shared/ui/shell/sidebar-nav.tsx` | T018 → T019 |
| `painel-escala.tsx` | T013 → T014 |
| `icon-button.tsx` | T023 → T024 → T025 |
| `saida-form.tsx` | T015 → T026 |
| `gestao-kits.tsx` | T016 → T027 |

T008 e T009 estão ambas marcadas [P] por serem edições independentes em pontos distantes do mesmo
arquivo; se forem executadas por processos concorrentes, faça-as sequencialmente.

### Parallel Opportunities

- Phase 3: T008–T013, T015 e T016 são sete arquivos diferentes → paralelizáveis
- Phase 7: T032 e T033 são arquivos diferentes → paralelizáveis
- Phase 2 é estritamente sequencial (arquivo único)

---

## Parallel Example: User Story 1

```text
# Depois da Phase 2, lançar juntas (arquivos distintos):
Task: "Tooltip no botão de abrir navegação em src/shared/ui/shell/topbar.tsx"
Task: "Tooltip no alternador de tema em src/shared/ui/theme/theme-toggle.tsx"
Task: "Tooltip no sino em app/(interno)/sino-notificacoes.tsx"
Task: "Tooltip em editar usuário em app/(interno)/(staff)/admin/tabela-usuarios.tsx"
Task: "Tooltip em alocar no turno em app/(interno)/(staff)/atividades/[id]/painel-escala.tsx"
Task: "Tooltip em remover linha em app/(interno)/(staff)/estoque/saida/saida-form.tsx"
Task: "Tooltip em remover componente em app/(interno)/(staff)/estoque/kits/gestao-kits.tsx"
```

---

## Implementation Strategy

### MVP (US1 + US2)

1. Phase 1 → Phase 2 → Phase 3 → Phase 4
2. **PARAR E VALIDAR**: R2, R3 e R6 do `quickstart.md`
3. Entregável: todo controle só-ícone do sistema descreve sua ação por ponteiro e por teclado, sem
   anúncio duplicado — incluindo a correção de um defeito de acessibilidade que já existia

Por que o MVP são duas histórias e não uma: entregar a Phase 3 sozinha deixaria em produção o
anúncio duplicado em dez lugares em vez de dois. A Phase 4 não é enfeite — é o conserto.

### Entrega incremental

1. MVP (Phases 1–4) → validar → entregar
2. + US3 (Phase 5) → validar → entregar
3. + US5 (Phase 7) → entregar
4. Phase 6 (US4) e Phase 8 rodam antes de **qualquer** integração, não ao final de tudo

### Portões bloqueantes

Phase 6 (toque) e T022/T029 (leitor de tela) são bloqueantes. Falha em qualquer um significa perda
de acessibilidade e impede a integração — o resto do roteiro não compensa isso.

---

## Estado da execução (2026-08-17)

**30 de 39 concluídas.** Todo o código está escrito, tipado e integrado; `tsc --noEmit`, `npm run
lint` e `npm test` (204 testes, 17 arquivos) passam iguais à linha de base de T001.

As **9 pendentes são exatamente as que exigem navegador, aparelho de toque ou leitor de tela** —
não podem ser executadas sem uma pessoa à frente da tela:

| Tarefa | O que falta verificar | Instrumento |
| --- | --- | --- |
| T017 | R2 — dica por ponteiro em cada tela, reposicionamento na última linha | navegador |
| T021 | R3 — Tab, Esc sem mover foco, dica acima de diálogo | navegador |
| T022 | R6 itens 21–23 — anúncio único | leitor de tela |
| T028 | R4 — dica no botão inativo, foco por Tab, clique sem efeito | navegador |
| T029 | R6 item 24 — nome + motivo + indisponível | leitor de tela |
| T030 | R5 itens 18/20 — ação no primeiro toque | aparelho de toque |
| T031 | R5 item 19 — fluxos críticos sem nenhuma dica | aparelho de toque |
| T034 | R1 — vitrine nos dois temas e contra a borda | navegador |
| T038 | SC-007 — nenhum deslocamento visual nas dez telas | navegador |

**T030, T031, T022 e T029 são bloqueantes** (`quickstart.md`, critério de aceite): a feature não
deve ser integrada antes de passarem.

Sobre T038, uma verificação estrutural já foi feita e reduz o risco: o `Tooltip` usa
`Ark.Trigger asChild`, que **funde** os handlers no elemento filho em vez de acrescentar um nó ao
DOM. Nenhum controle ganhou wrapper, então não há origem mecânica para deslocamento — resta a
confirmação visual.

Verificações que **puderam** ser feitas estaticamente e por isso estão marcadas:

- **T036/SC-006**: `@ark-ui/react/tooltip` é importado em um único arquivo, o próprio componente; e
  todo `<IconButton>` fora da vitrine está envolvido por `<Tooltip>`.
- **T037/FR-008**: não há nenhuma classe de animação ou transição no tooltip — não existe movimento
  a suprimir sob `prefers-reduced-motion`, que era exatamente a decisão D6.
- **T020**: nenhuma das doze adoções passa `descricao`, exceto as duas de US3, que devem passar.
- **Mecanismo de T004**: confirmado no pacote instalado que `Tooltip.Root` repassa `aria-label` ao
  `useMachine`, e que `connect` o lê como `hasAriaLabel` para omitir `role`/`id` do conteúdo. A
  supressão do anúncio duplicado não é suposição.

## Notes

- Zero dependência nova, zero arquivo novo, zero migração, zero rota
- Nenhuma condição de indisponibilidade muda; muda apenas como ela é comunicada (A-05)
- `inativo` **não** é mecanismo de autorização — é comunicação de estado de interface
- Commits em Conventional Commits, agrupados por fase
