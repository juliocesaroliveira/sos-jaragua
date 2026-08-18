---
description: 'Task list for feature implementation'
---

# Tasks: Padrão único de validação de formulários

**Input**: Design documents from `/specs/016-formularios-rhf-zod/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: A spec não pediu TDD, e a Constituição (Princípio III) exige TDD apenas para
`domain/` e `application/` — esta feature não toca nenhuma das duas. Os testes abaixo cobrem só
o que é lógica pura e testável em ambiente `node` (research D9); o comportamento de interface é
verificado pelo roteiro de `quickstart.md`.

**Organization**: Tarefas agrupadas por user story. US1 e US2 são ambas P1 e tocam os mesmos
três arquivos de formulário — por isso são fases sequenciais, não paralelas entre si.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: user story a que a tarefa pertence (US1, US2, US3, US4)
- Caminho de arquivo exato em toda descrição

## Path Conventions

Aplicação web Next.js (monolito modular): telas em `app/`, código compartilhado em
`src/shared/`, componentes do design system em `src/shared/ui/<componente>/`. Estrutura
detalhada em [plan.md](plan.md) § Project Structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: criar o esqueleto do módulo compartilhado antes de qualquer código de formulário

- [X] T001 Criar o barril do módulo em `src/shared/formulario/index.ts`, reexportando
      `use-formulario`, `campos` e `erros-servidor` (arquivos criados na Phase 2)
- [X] T002 [P] Confirmar que `vitest.config.ts` já coleta `src/shared/formulario/*.test.ts`
      pelo glob `src/**/*.test.ts` e que nenhum ajuste de config é necessário

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: as três peças da API pública do padrão
([contracts/componentes-formulario.md](contracts/componentes-formulario.md)). Nenhuma user
story pode começar antes.

**⚠️ CRITICAL**: US1, US2 e US3 consomem estas peças diretamente.

- [X] T003 [P] Implementar os construtores Zod compartilhados em
      `src/shared/formulario/campos.ts`: `textoObrigatorio`, `email`, `senha`,
      `selecaoObrigatoria`, `listaNaoVazia` — cada um declarando a mensagem também no **tipo**
      (`z.string({ error })`), para cobrir o caso `undefined` que não chega ao `.min()`
      (data-model.md §1)
- [X] T004 [P] Implementar `aplicarErrosDoServidor` em
      `src/shared/formulario/erros-servidor.ts` como função **pura**, recebendo `definirErro`
      por parâmetro e reaproveitando `camposComErro` de `src/shared/kernel/action.ts` — sem
      alterar o contrato das Server Actions (contracts §3)
- [X] T005 [P] Implementar `useFormulario` em `src/shared/formulario/use-formulario.ts`,
      fixando `mode: 'onSubmit'`, `reValidateMode: 'onChange'`, `shouldFocusError: true` e
      `zodResolver(esquema)`, sem expor essas opções ao chamador (contracts §1, research D2)
- [X] T006 [P] Criar `src/shared/ui/formulario/formulario.tsx` com o componente `Formulario`,
      que sempre renderiza `<form noValidate>` e **omite** `noValidate` e `action` da interface
      de props (contracts §2, research D1/D3)
- [X] T007 Escrever `src/shared/formulario/erros-servidor.test.ts` cobrindo os três ramos do
      contrato: campos conhecidos aplicados; campo desconhecido agregado à mensagem geral em
      vez de descartado; erro sem `detalhes.campos` retornando só a mensagem geral (depende de
      T004)
- [X] T008 Escrever `src/shared/formulario/campos.test.ts` verificando que cada construtor
      rejeita `undefined`, string vazia e formato inválido **com mensagem em pt-BR** (depende
      de T003)
- [X] T009 Exportar `Formulario` e `FormularioProps` em `src/shared/ui/index.ts` (depende de
      T006)
- [X] T010 Fechar o barril `src/shared/formulario/index.ts` com os símbolos reais e rodar
      `npm test` para confirmar a suíte verde (depende de T003–T008)

**Checkpoint**: API do padrão disponível e testada — as user stories podem começar.

---

## Phase 3: User Story 1 - Erro no campo, logo abaixo do campo (Priority: P1) 🎯 MVP

**Goal**: todo controle da aplicação exibe mensagem de erro em pt-BR imediatamente abaixo de
si, no mesmo formato, com acessibilidade correta e foco no primeiro campo com erro.

**Independent Test**: abrir qualquer um dos três formulários, submeter vazio/inválido e
verificar que o envio é bloqueado, cada campo com problema exibe mensagem própria abaixo dele
e o foco vai ao primeiro deles ([quickstart.md](quickstart.md) §3.1–§3.3).

### Componentes de campo — lacunas do design system

- [X] T011 [P] [US1] Adicionar `erro?: string` ao `Switch` em
      `src/shared/ui/switch/switch.tsx`: parágrafo `role="alert"` abaixo da linha do controle,
      `text-sm text-danger-*`, `aria-invalid` e `aria-describedby` no input oculto (research
      D6)
- [X] T012 [P] [US1] Migrar a faixa de mensagem do `RadioGroup` em
      `src/shared/ui/radio-group/radio-group.tsx` para `idsCampo`, acrescentando `apoio`, a
      regra de exclusão apoio↔erro e `aria-invalid` no grupo — mantendo `Ark.Label` como
      rótulo do grupo (research D7)
- [X] T013 [P] [US1] Migrar a faixa de mensagem do `CheckboxGroup` em
      `src/shared/ui/checkbox-group/checkbox-group.tsx` da mesma forma que T012, mantendo
      `<legend>` como rótulo do grupo
- [X] T014 [P] [US1] Encaminhar `ref` ao gatilho focável em
      `src/shared/ui/select/select.tsx` (research D4)
- [X] T015 [P] [US1] Encaminhar `ref` ao input focável em
      `src/shared/ui/combobox/combobox.tsx`
- [X] T016 [P] [US1] Encaminhar `ref` ao input focável em
      `src/shared/ui/date-picker/date-picker.tsx`, cobrindo também o ramo de fallback estático
      do componente
- [X] T017 [P] [US1] Encaminhar `ref` ao input focável em
      `src/shared/ui/number-input/number-input.tsx`
- [X] T018 [P] [US1] Verificar em `src/shared/ui/password/password.tsx` que o `ref` vindo de
      `register()` chega ao `<input>` (hoje as props são espalhadas por uma interface
      explícita) e corrigir se não chegar
- [X] T019 [US1] Adicionar `ref` em `src/shared/ui/switch/switch.tsx`,
      `src/shared/ui/radio-group/radio-group.tsx` e
      `src/shared/ui/checkbox-group/checkbox-group.tsx` para que `field.ref` do `Controller`
      tenha alvo focável — **sem [P]**: são os mesmos três arquivos de T011–T013, então
      executar junto de cada uma delas, não como passagem separada

### Aplicação nos formulários

- [X] T020 [US1] Em `app/(interno)/voluntariado/candidatura/candidatura-form.tsx`, mover a
      obrigatoriedade condicional de `tipoVeiculo` para o esquema com `.superRefine()`/`.check()`
      e `path: ['tipoVeiculo']`, e limpar o erro com `clearErrors('tipoVeiculo')` ao desligar
      `veiculoProprio` (research D8, FR-014)
- [X] T021 [US1] No mesmo arquivo, passar `ref={field.ref}` em todos os `Controller`
      (`DatePicker`, `CheckboxGroup` ×2, `Switch`, `RadioGroup`) (depende de T011–T019)
- [X] T022 [US1] Em `app/(interno)/(staff)/admin/usuario-form-dialog.tsx`, passar
      `ref={field.ref}` no `Controller` do `Select` de papel (depende de T014)
- [X] T023 [US1] Substituir os esquemas locais pelos construtores de
      `src/shared/formulario/campos.ts` nos três formulários, unificando as mensagens que hoje
      divergem — "A senha deve ter ao menos 8 caracteres." em `login-form.tsx` e
      `usuario-form-dialog.tsx` — e removendo o helper `obrigatorio()` duplicado dentro de
      `candidatura-form.tsx` (depende de T003)

**Checkpoint**: US1 funcional e verificável isoladamente — todo campo, de qualquer tipo, exibe
erro no lugar certo e o foco vai ao primeiro.

---

## Phase 4: User Story 2 - Nenhum balão do navegador (Priority: P1)

**Goal**: a validação nativa do navegador está desligada em toda a aplicação, de forma que
esquecer `noValidate` deixe de ser possível.

**Independent Test**: submeter cada formulário incompleto em dois navegadores diferentes e
confirmar que nenhum balão nativo aparece e que as mensagens são idênticas entre eles
([quickstart.md](quickstart.md) §3, coluna FR-003).

> Toca os mesmos três arquivos da Phase 3 — executar depois dela, não em paralelo.

- [X] T024 [US2] Migrar `app/(publico)/login/login-form.tsx` para `Formulario` +
      `useFormulario`, removendo o `<form noValidate>` e o `useForm` diretos (depende de T005,
      T006, T009)
- [X] T025 [US2] Migrar `app/(interno)/voluntariado/candidatura/candidatura-form.tsx` da mesma
      forma (depende de T005, T006, T009, T020)
- [X] T026 [US2] Migrar `app/(interno)/(staff)/admin/usuario-form-dialog.tsx` da mesma forma —
      **é aqui que a lacuna real se fecha**, o `<form id="usuario-form">` deste arquivo hoje
      não tem `noValidate` (depende de T005, T006, T009)
- [X] T027 [US2] Adicionar a `eslint.config.mjs` uma regra `no-restricted-syntax` que proíbe
      `JSXOpeningElement[name.name='form']` fora de `src/shared/ui/formulario/`, com mensagem
      apontando o componente `Formulario` (research D3)
- [X] T028 [US2] Verificar a conformidade rodando
      `grep -rn "<form" app src --include=*.tsx | grep -v "shared/ui/formulario"` — deve não
      retornar nada — e `npm run lint` sem erros (depende de T024–T027)

**Checkpoint**: US1 e US2 funcionam independentemente; nenhum `<form>` cru resta na aplicação.

---

## Phase 5: User Story 3 - Erro vindo do servidor no campo certo (Priority: P2)

**Goal**: recusa do servidor atribuível a um campo aparece abaixo daquele campo, no mesmo
formato dos erros de preenchimento; o que não é atribuível vira aviso geral, sem se fixar
arbitrariamente em um campo.

**Independent Test**: submeter dados válidos no formato mas recusados pelo servidor (e-mail já
cadastrado, CPF com dígito verificador inválido) e verificar a posição da mensagem
([quickstart.md](quickstart.md) §3.2 e §3.3, linhas FR-012).

- [X] T029 [US3] Substituir o laço manual de `setError` em
      `app/(interno)/voluntariado/candidatura/candidatura-form.tsx` por
      `aplicarErrosDoServidor`, eliminando o ternário atual de `setErroGeral` que devolve o
      mesmo valor nos dois ramos (depende de T004)
- [X] T030 [US3] Substituir o laço manual de `setError` em
      `app/(interno)/(staff)/admin/usuario-form-dialog.tsx` por `aplicarErrosDoServidor`
      (depende de T004)
- [X] T031 [US3] Em `app/(publico)/login/login-form.tsx`, manter a mensagem de credencial
      inválida como erro **geral** e registrar em comentário o motivo — fixá-la no campo de
      e-mail revelaria se a conta existe (data-model.md §4)

**Checkpoint**: as três user stories de comportamento estão completas e independentes.

---

## Phase 6: User Story 4 - Formulário novo já nasce no padrão (Priority: P3)

**Goal**: o padrão está documentado a ponto de uma tela nova segui-lo sem decisão ad-hoc, e um
desvio é identificável por critério objetivo.

**Independent Test**: implementar (ou revisar) um formulário seguindo apenas a documentação e
verificar que ele passa no §3 do quickstart sem ajustes (SC-006).

- [X] T032 [P] [US4] Atualizar a "Exceção" do `spec/DESIGN_SYSTEM.md` §4.2.1, que hoje afirma
      que o `Switch` não tem estado de erro, e a §4.5 (`CheckboxGroup`/`RadioGroup`/`Switch`)
      para refletir a faixa de mensagem unificada (depende de T011–T013)
- [X] T033 [US4] Acrescentar ao `spec/DESIGN_SYSTEM.md` uma seção do padrão de formulário:
      `Formulario` + `useFormulario` + esquema Zod + `aplicarErrosDoServidor`, a regra de
      "nenhum `<form>` cru", a tabela de props comuns de campo e o exemplo mínimo de uso
      (FR-018, contracts §1–§4)

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T034 Remover código morto deixado pelas migrações — imports não usados de `useForm`,
      `zodResolver` e helpers locais em `app/(publico)/login/login-form.tsx`,
      `app/(interno)/voluntariado/candidatura/candidatura-form.tsx` e
      `app/(interno)/(staff)/admin/usuario-form-dialog.tsx`
- [X] T035 Rodar a verificação automatizada de [quickstart.md](quickstart.md) §2:
      `npm test`, `npm run lint`, `npx tsc --noEmit`
- [ ] T036 Executar o roteiro manual de [quickstart.md](quickstart.md) §3.1–§3.3 em **dois
      navegadores diferentes** e registrar o resultado (SC-001)
      - **Parcialmente feito** (Chrome, dev server local): §3.3 verificado no diálogo de conta
        — `noValidate: true` no `<form id="usuario-form">`, três mensagens exibidas de uma vez
        em pt-BR abaixo dos respectivos campos, `aria-invalid` nos três, foco em `nome`, e a
        mensagem some ao corrigir o campo sem novo envio.
      - **Falta**: §3.1 (login — a sessão ativa redireciona `/login` para a home), §3.2
        (candidatura — a conta de teste já é voluntária aprovada, então o formulário não
        renderiza) e a segunda passagem em outro navegador.
- [ ] T037 Executar a verificação de acessibilidade de [quickstart.md](quickstart.md) §3.4 com
      leitor de tela nos três formulários (SC-007)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências
- **Foundational (Phase 2)**: depende da Phase 1 — **bloqueia todas as user stories**
- **US1 (Phase 3)**: depende da Phase 2
- **US2 (Phase 4)**: depende da Phase 2 e, na prática, da Phase 3 — as duas alteram os mesmos
  três arquivos de formulário
- **US3 (Phase 5)**: depende da Phase 2 (só de T004); pode rodar em paralelo com a Phase 4 se
  os arquivos forem coordenados, mas o caminho simples é sequencial
- **US4 (Phase 6)**: depende de US1 para documentar o comportamento final dos componentes
- **Polish (Phase 7)**: depende de tudo que se pretende entregar

### User Story Dependencies

- **US1 (P1)**: independente após a Phase 2 — é o MVP
- **US2 (P1)**: independente em teste, mas compartilha arquivos com US1; sequenciar evita
  conflito de merge
- **US3 (P2)**: independente após T004; não depende de US1 nem de US2
- **US4 (P3)**: documental; depende de US1/US2 estarem decididas para não documentar algo que
  ainda vai mudar

### Parallel Opportunities

- Phase 2: T003, T004, T005 e T006 são quatro arquivos novos distintos → totalmente paralelos
- Phase 3: T011–T018 são oito componentes distintos em `src/shared/ui/` → totalmente paralelos;
  é o maior ganho de paralelismo da feature
- Phase 6: T032 e T033 tocam o mesmo arquivo (`DESIGN_SYSTEM.md`) → apenas T032 marcado [P],
  por editar seções distintas de T033; se houver conflito, sequenciar
- Os três arquivos de formulário em `app/` são gargalo: US1, US2 e US3 os tocam. Um único
  responsável por arquivo evita retrabalho.

---

## Parallel Example: Phase 3 (User Story 1)

```bash
# Oito componentes de campo, oito arquivos, zero dependência entre si:
Task: "Adicionar erro ao Switch em src/shared/ui/switch/switch.tsx"
Task: "Migrar faixa de mensagem do RadioGroup em src/shared/ui/radio-group/radio-group.tsx"
Task: "Migrar faixa de mensagem do CheckboxGroup em src/shared/ui/checkbox-group/checkbox-group.tsx"
Task: "Encaminhar ref em src/shared/ui/select/select.tsx"
Task: "Encaminhar ref em src/shared/ui/combobox/combobox.tsx"
Task: "Encaminhar ref em src/shared/ui/date-picker/date-picker.tsx"
Task: "Encaminhar ref em src/shared/ui/number-input/number-input.tsx"
Task: "Verificar encaminhamento de ref em src/shared/ui/password/password.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Setup (T001–T002)
2. Phase 2: Foundational (T003–T010) — **crítico, bloqueia tudo**
3. Phase 3: US1 (T011–T023)
4. **PARAR e VALIDAR**: quickstart §3.1–§3.3 nas linhas de FR-004/FR-005/FR-008/FR-011
5. Entregável real: todo campo, de qualquer tipo, com erro no lugar certo

### Incremental Delivery

1. Setup + Foundational → API do padrão pronta e testada
2. + US1 → erros no lugar certo em todos os controles (MVP)
3. + US2 → validação nativa eliminada e impossível de reintroduzir
4. + US3 → erro do servidor no campo certo
5. + US4 → padrão documentado, próximas telas herdam sem trabalho

### Parallel Team Strategy

Com mais de uma pessoa, o paralelismo útil está na Phase 2 (quatro arquivos novos) e na
Phase 3 (oito componentes). Nas Phases 4 e 5 o trabalho converge para três arquivos de
formulário — nesse ponto, dividir por **arquivo** (uma pessoa por formulário, levando US2 e US3
juntas naquele arquivo) rende mais que dividir por story.

---

## Notes

- [P] = arquivos diferentes, sem dependência pendente
- Nenhuma dependência nova é instalada em nenhuma tarefa (plan.md § Technical Context)
- Nenhuma tarefa toca `domain/`, `application/` ou o contrato das Server Actions
- Commits em Conventional Commits (Princípio II); commitar por tarefa ou grupo lógico
- Parar em qualquer checkpoint para validar a story isoladamente
