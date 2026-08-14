---
description: 'Task list — Migração do Toast para react-toastify'
---

# Tasks: Migração do Toast para react-toastify

**Input**: documentos de design em `/specs/010-toast-react-toastify/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/avisar.contract.md`, `quickstart.md`

**Tests**: **não há tarefas de teste automatizado.** Isso é decisão registrada (D7 em `research.md`), não omissão: o projeto não tem stack de teste de componente (`vitest.config.ts` usa `environment: 'node'`, sem jsdom nem Testing Library) e introduzir uma só para este arquivo contraria o Princípio VI. A verificação automática desta feature é o **compilador** — `avisar` é tipado e consumido em 26 pontos, então build verde prova que o contrato não quebrou. O resto é o roteiro manual de `quickstart.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: a qual história de usuário a tarefa pertence (US1, US2, US3)

---

## ⚠️ Nota sobre paralelismo — leia antes de planejar a execução

Esta feature reescreve **um único arquivo** (`src/shared/ui/toast/toast.tsx`). Consequência direta: **quase nada aqui é paralelizável**, e marcar `[P]` em tarefas que disputam o mesmo arquivo criaria conflito garantido em vez de ganho.

Só 3 das 22 tarefas recebem `[P]`, e todas por tocarem arquivos genuinamente distintos (`globals.css`, `DESIGN_SYSTEM.md`). Isto não é uma feature para dividir entre pessoas — é uma feature para uma pessoa executar em sequência, em poucas horas.

A decomposição em histórias abaixo **é** real e útil, mas serve como ordem de refinamento e pontos de verificação, não como frentes concorrentes.

---

## Phase 1: Setup

**Purpose**: preparar a dependência e — crucialmente — capturar a linha de base visual **antes** de trocar o motor.

- [x] T001 Instalar `react-toastify@^11.1.0` como dependência de produção em `package.json` (peer deps declaram `react: ^18 || ^19`, compatível com o React 19 do projeto). Não instalar `@types/*` — o pacote embarca os próprios tipos.
- [x] T002 Acrescentar em `app/(interno)/design-system/galeria.tsx`, na seção "Sobreposições", dois botões disparando `avisar.atencao(...)` e `avisar.info(...)`, ao lado dos de sucesso e erro já existentes. **Executar esta tarefa ainda sobre o motor Ark atual** — é o que torna possível capturar a linha de base dos quatro tons.
- [x] T003 Com a aplicação rodando no motor **atual** (`npm run dev`), abrir a rota `/design-system` (renderizada por `app/(interno)/design-system/galeria.tsx`) e capturar screenshots dos 4 tons × 2 temas — 8 imagens — guardando-as fora do repositório (diretório de trabalho local ou anexo do PR). Esta é a referência de comparação de SC-003 e de T017; sem ela, "paridade visual" vira opinião.

**Checkpoint**: dependência instalada, galeria demonstra os 4 tons, linha de base visual capturada.

> **Por que T002/T003 vêm antes da migração**: capturar a referência depois da troca é inútil — compararia o resultado consigo mesmo. Adicionar os dois botões primeiro, ainda no Ark, é o que permite fotografar `atenção` e `informação`, que hoje não têm superfície de disparo em lugar nenhum (`avisar.atencao` tem **zero** chamadas na aplicação).

---

## Phase 2: Foundational (Blocking)

**Purpose**: infraestrutura que as três histórias consomem.

**⚠️ Nenhuma história pode começar antes desta fase.**

- [x] T004 [P] Declarar em `app/globals.css` dois `@keyframes` para o aviso — entrada (opacidade 0→1 + translação de baixo para cima) e saída (o inverso) — mais um bloco `@media (prefers-reduced-motion: reduce)` que anula a translação e mantém apenas a transição de opacidade. O build `unstyled` não traz animação alguma (os 22 keyframes da biblioteca vivem no CSS que D1 decidiu não importar).
- [x] T005 Reescrever o esqueleto de `src/shared/ui/toast/toast.tsx`: importar `ToastContainer`, `toast` e `cssTransition` de **`react-toastify/unstyled`** (nunca de `react-toastify`, nunca importar `react-toastify/ReactToastify.css`); exportar `Toaster` (sem props) e `avisar` com os 4 métodos de assinatura `(titulo: string, descricao?: string) => void`; conteúdo do aviso ainda cru (só o título em texto simples). Remover todo o código do Ark deste arquivo.

**Checkpoint**: `npm run build` passa e os avisos disparam a partir das telas, ainda sem estilo. As 12 telas chamadoras continuam intocadas.

---

## Phase 3: User Story 1 — Continuar recebendo confirmação das ações (Priority: P1)

**Goal**: o aviso volta a se comportar como antes — aparece, respeita a duração do seu tom, pausa sob o cursor, fecha ao comando e enfileira além de 4.

**Independent Test**: verificável **sem nenhum estilo aplicado**. Com o cartão ainda cru da Fase 2, dá para cronometrar durações, contar quantos aparecem simultaneamente e confirmar a pausa em hover. É esta a razão de comportamento e aparência serem histórias separadas: o comportamento é observável antes de o visual existir.

### Implementation for User Story 1

- [x] T006 [US1] Configurar o `<ToastContainer>` em `src/shared/ui/toast/toast.tsx`: `position="bottom-right"`, `limit={4}`, `newestOnTop={false}`, e `className` com as classes de posicionamento (`fixed`, cantos inferior/direito com respiro, `flex flex-col gap-2`) e camada `z-100` — reutilizando `CAMADA.toast` de `src/shared/ui/cn.ts`, nunca um valor inventado.
- [x] T007 [US1] Mapear em `src/shared/ui/toast/toast.tsx` a duração por tom conforme a tabela de `data-model.md`: sucesso 5000ms, erro 8000ms, atenção 6000ms, informação 5000ms. A duração é derivada do método chamado — **não** é parâmetro exposto ao chamador (contrato negativo em `contracts/avisar.contract.md`).
- [x] T008 [US1] Definir em `src/shared/ui/toast/toast.tsx` as opções de comportamento: `pauseOnHover: true`, `pauseOnFocusLoss: true`, `closeOnClick: false`, `hideProgressBar: true`. O `hideProgressBar` é paridade, não gosto — o toast do Ark não tem barra de progresso e exibi-la seria mudança visual não pedida.
- [x] T009 [US1] Confirmar via DevTools que o elemento do aviso carrega `role="alert"` e que nenhuma opção `role` foi passada ao `<ToastContainer>` nem ao `toast()` em `src/shared/ui/toast/toast.tsx` (o padrão da biblioteca já entrega `role="alert"`, confirmado em `dist/unstyled.mjs`). Nada a implementar — mas **verificar**, porque uma configuração futura que sobrescreva `role` quebraria FR-015 em silêncio.
- [x] T010 [US1] Executar os Cenários 3, 4, 6 e 10 de `quickstart.md` (durações, pausa em hover/foco, limite de 4 com enfileiramento, `role="alert"`) e registrar os resultados.

**Checkpoint**: o comportamento está correto. A aparência ainda não — e isso é esperado neste ponto.

---

## Phase 4: User Story 2 — Enxergar avisos coerentes com a interface (Priority: P1)

**Goal**: o cartão volta a ser visualmente indistinguível do toast anterior, nos dois temas.

**Independent Test**: comparação lado a lado contra os 8 screenshots de linha de base capturados em T003, tom a tom, tema a tema.

### Implementation for User Story 2

- [x] T011 [US2] Criar em `src/shared/ui/toast/toast.tsx` o componente interno do cartão, com a superfície comum de `data-model.md`: `flex w-[min(92vw,24rem)] items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-lg`; título em `text-base font-semibold text-foreground`; descrição em `text-sm text-neutral-600 dark:text-neutral-300`, renderizada **apenas quando fornecida** (sem espaço reservado quando ausente).
- [x] T012 [US2] Mapear em `src/shared/ui/toast/toast.tsx` os 4 tons para ícone e cor conforme a tabela de `data-model.md`: `CheckCircle2`/success, `XCircle`/danger, `AlertTriangle`/warning, `Info`/info — todos `lucide-react`, `size-5`, `aria-hidden`, com variantes `dark:*-400`, e a borda lateral `border-l-4`. **Preservar a assimetria intencional do tom atenção** (borda `warning-500`, ícone `warning-600`) — ela é deliberada e "corrigi-la" seria mudança visual não pedida.
- [x] T013 [US2] Implementar o botão de fechar dentro do cartão em `src/shared/ui/toast/toast.tsx`, usando o `closeToast` que a biblioteca entrega via `ToastContentProps`: `size-11` (alvo de toque de 44px, §1.3), `rounded-lg text-neutral-500 hover:bg-surface-muted`, mais `ANEL_FOCO` de `src/shared/ui/cn.ts`, e `aria-label="Fechar aviso"` em pt-BR.
- [x] T014 [US2] Desligar em `src/shared/ui/toast/toast.tsx` os slots visuais da biblioteca — `icon: false` e `closeButton: false` — já que o cartão inteiro é renderizado por nós (D4). Isso evita o estado híbrido em que parte do visual vem de props da lib e parte do nosso conteúdo, que é onde divergências nascem.
- [x] T015 [US2] Ligar a animação em `src/shared/ui/toast/toast.tsx` via `cssTransition`, apontando para as classes de keyframe declaradas em T004, e passar a transição resultante ao `<ToastContainer>`.
- [x] T016 [US2] Garantir que **nenhum** tema é passado à biblioteca: não usar a prop `theme` em lugar nenhum de `src/shared/ui/toast/toast.tsx`. Todo o tema sai das variantes `dark:` do Tailwind (D2) — é o que faz um aviso já aberto acompanhar a troca de tema, em CSS puro.
- [x] T017 [US2] Executar os Cenários 1, 2, 7 e 8 de `quickstart.md` (4 tons no tema claro, tema escuro + troca com aviso aberto, posicionamento a 360px, aviso sobre diálogo) e comparar contra a linha de base de T003.

**Checkpoint**: paridade visual atingida. Este é o ponto de MVP — ver estratégia abaixo.

---

## Phase 5: User Story 3 — Disparar avisos pelo mesmo vocabulário (Priority: P2)

**Goal**: fechar a fronteira do módulo — um único mecanismo de aviso no projeto, sem vazamento do motor para fora.

**Independent Test**: build verde + busca por `createToaster` retornando zero + lista de arquivos alterados sem nenhuma tela.

### Implementation for User Story 3

- [x] T018 [US3] Remover `toaster` da linha de export de `src/shared/ui/index.ts`, mantendo `Toaster` e `avisar`. A remoção é segura por verificação, não por presunção: busca por `toaster.` em `app/` e `src/` fora do próprio módulo retorna **zero ocorrências** — era detalhe do `createToaster` do Ark que vazou para o barrel público.
- [x] T019 [US3] Confirmar que busca por `createToaster` e por `@ark-ui/react/toast` em todo o projeto retorna zero ocorrências (FR-013, SC-005). O `@ark-ui/react` **permanece** em `package.json` — Dialog, Menu, Table e outros continuam usando; só o primitivo de toast sai de uso.
- [x] T020 [US3] Executar o Cenário 0 de `quickstart.md`: `npm run build` verde e `git diff --name-only` contra o commit anterior ao início da migração contendo **apenas** `src/shared/ui/toast/toast.tsx`, `src/shared/ui/index.ts`, `app/globals.css`, `app/(interno)/design-system/galeria.tsx`, `spec/DESIGN_SYSTEM.md`, `package.json`, `package-lock.json` e `specs/010-toast-react-toastify/**`. Qualquer arquivo em `app/(interno)/(staff)/`, `app/(publico)/` ou `app/layout.tsx` na lista significa que o contrato não foi preservado — corrigir o módulo, nunca a tela.

**Checkpoint**: um único mecanismo de aviso, fronteira do módulo fechada, zero telas tocadas.

---

## Phase 6: Polish & Cross-Cutting

- [x] T021 [P] Atualizar `spec/DESIGN_SYSTEM.md` §4.8: substituir "Ark UI `Toast` (via `createToaster`)" pelo novo motor, mantendo a descrição de variantes e auto-dismiss. Registrar que a aparência é 100% dos tokens do projeto (entry point sem estilos).
- [ ] T022 ⚠️ **PARCIAL** — percorrido apenas `/estoque/entrada` (erro de validação → `avisar.erro`, cor de borda conferida contra a linha de base). Faltam os outros 6 fluxos da amostra. Executar o Cenário 9 de `quickstart.md` — amostra de regressão nas telas reais: cadastrar conta em `/admin` (sucesso e erro por e-mail duplicado), registrar entrada em `/estoque/entrada`, saída com saldo insuficiente em `/estoque/saida`, aprovar e rejeitar em `/cadastros-pendentes`, criar atividade em `/atividades`. Confirmar os 8 critérios de aprovação ao final de `quickstart.md`.

---

## Dependencies & Execution Order

### Ordem entre fases

```
Setup (T001–T003)          ← T003 DEPENDE de T002; ambas antes de qualquer migração
        ↓
Foundational (T004–T005)   ← T004 [P] com T005 (arquivos diferentes)
        ↓
US1 (T006–T010)            ← comportamento; verificável sem estilo
        ↓
US2 (T011–T017)            ← aparência; mesmo arquivo que US1, então sequencial
        ↓
US3 (T018–T020)            ← fronteira do módulo
        ↓
Polish (T021–T022)         ← T021 [P] com T022
```

### Dependências entre histórias — sejamos precisos

As três histórias **não** são frentes independentes, e afirmar o contrário seria falso:

- **US1 e US2 editam o mesmo arquivo** (`toast.tsx`). São etapas de refinamento sequenciais, não trilhas paralelas.
- **US1 é verificável sem US2** (comportamento sem estilo) — esta independência é real e é a razão da separação.
- **US2 não é verificável sem US1**: sem o container configurado, não há o que estilizar.
- **US3 depende de US1+US2 estarem estáveis**: remover o motor antigo antes de o novo funcionar deixaria a aplicação sem avisos.

### Oportunidades reais de paralelismo

Apenas 3 tarefas, todas por tocarem arquivos distintos:

| Tarefa | Arquivo                 | Paralela com       |
| ------ | ----------------------- | ------------------ |
| T004   | `app/globals.css`       | T005 (`toast.tsx`) |
| T021   | `spec/DESIGN_SYSTEM.md` | T022 (validação)   |

Todas as demais disputam `src/shared/ui/toast/toast.tsx` e devem ser sequenciais.

---

## Implementation Strategy

### O MVP é US1 + US2 juntas — e isso é proposital

O padrão usual seria "entregue US1 e pare para validar". **Aqui não funciona**, e vale ser explícito sobre o porquê: US1 e US2 são ambas P1 porque, no instante em que o motor é trocado, comportamento e aparência mudam juntos. Parar depois de US1 deixaria a aplicação com avisos funcionalmente corretos e visualmente crus — uma regressão percebida por qualquer usuário, não um incremento entregável.

Portanto:

1. Fases 1 → 2 → 3 → 4 (T001–T017) são **um único incremento entregável**
2. Validar contra a linha de base visual de T003
3. Só então Fase 5 (fronteira do módulo) e Fase 6 (documentação e regressão)

US3, apesar de P2, são três tarefas pequenas e é o que satisfaz FR-013 ("um único mecanismo"). Não há razão prática para adiá-la — deixar `toaster` exportado e o Ark toast em uso seria justamente o estado de dois sistemas concorrentes que a spec proíbe.

### Execução por uma pessoa (recomendado)

T001 → T022 em ordem. A feature é pequena: 1 arquivo reescrito, 1 barrel ajustado, 1 bloco de CSS, 1 seção de documentação.

### Se houver duas pessoas

O ganho é marginal e concentrado nas pontas: uma pessoa pega T004 (CSS) e T021 (documentação) enquanto a outra conduz o arquivo principal. Não vale coordenar mais do que isso — o gargalo é `toast.tsx`, que não se divide.

---

## Critérios de conclusão

- [ ] Build verde (T020) — a prova automática de que o contrato de `avisar` sobreviveu aos 26 pontos de disparo
- [ ] Nenhuma das 12 telas chamadoras alterada, nem `app/layout.tsx` (T020)
- [ ] Paridade visual nos 4 tons × 2 temas contra a linha de base (T017)
- [ ] Aviso já aberto acompanha a troca de tema (T017, Cenário 2 passo 3)
- [ ] Durações, pausa, limite de 4 e enfileiramento preservados (T010)
- [ ] `createToaster` com zero ocorrências no projeto (T019)
- [ ] `spec/DESIGN_SYSTEM.md` §4.8 atualizado (T021)
- [ ] Amostra de telas reais sem regressão (T022)

---

## Notas

- **Nenhuma tarefa de teste automatizado** — decisão D7, justificada pelos Princípios III e VI da constituição. Ver o cabeçalho deste documento.
- Se a paridade visual **não** for atingível sem importar o CSS padrão da biblioteca, a premissa central de D1 estava errada: parar e reavaliar em vez de importar o CSS e sair sobrescrevendo. Os critérios de reversão estão em `quickstart.md`.
- Commit em Conventional Commits. `refactor:` descreve melhor esta mudança que `feat:` — não há capacidade nova para o usuário, e é exatamente esse o ponto da feature.
