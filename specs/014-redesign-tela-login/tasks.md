---
description: 'Task list para o redesign da tela de login'
---

# Tasks: Redesign da Tela de Login

**Input**: Documentos de design em `/specs/014-redesign-tela-login/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **Sem tarefas de teste automatizado.** O repositório não tem harness de UI —
`vitest.config.ts` roda em `environment: 'node'` com `include: ['src/**/*.test.ts']`, sem jsdom
nem Testing Library (D10 em `research.md`). A verificação desta feature é o roteiro manual de
`quickstart.md`, referenciado nas tarefas de verificação de cada fase. O Princípio III da
constituição reserva a cobertura obrigatória para `domain`/`application`, que esta feature não
toca.

**Organization**: tarefas agrupadas por user story, para permitir implementação e verificação
independentes.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: a qual user story a tarefa pertence (US1…US6)
- Todo caminho de arquivo é explícito

## Path Conventions

Aplicação web monolítica Next.js App Router (plan.md § Project Structure):

- Componentes de design system: `src/shared/ui/<componente>/<componente>.tsx`
- Componentes da rota: `app/(publico)/login/`
- Ativos estáticos: `public/login/`
- Documentação de design: `spec/DESIGN_SYSTEM.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: capturar o que não é recuperável depois e disparar o insumo de maior prazo.

- [ ] T001 Medir e registrar a linha de base de carregamento da tela atual (bytes transferidos
      e tempo até operável em "Slow 3G", em 360px e em 1280px) em
      `specs/014-redesign-tela-login/linha-base.md` — **antes** de qualquer alteração de código,
      porque a SC-006a compara contra a versão atual e o número deixa de ser obtível depois de
      o redesign entrar
- [ ] T002 [P] Solicitar a fotografia de fundo ao acervo da Defesa Civil de Jaraguá do Sul
      usando a tabela de requisitos do D2 em `research.md` (assunto, ≥2560px, enquadramento com
      a faixa central-direita livre, tonalidade média a escura, licença institucional) e criar
      `public/login/PROCEDENCIA.md` com o registro em aberto — é a dependência externa de maior
      prazo e a única que não depende de código

**Checkpoint**: linha de base registrada; pedido da fotografia em andamento e sem bloquear nada.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: a estrutura de camadas e a composição base que **todas** as user stories habitam.

**⚠️ CRITICAL**: nenhuma user story da composição (US1, US2, US3, US4, US6) pode começar antes
desta fase. **A US5 (componente `Password`) é a exceção — não depende de nada aqui e pode
começar em paralelo já na Phase 1.**

- [ ] T003 [P] Criar `app/(publico)/login/fundo-login.tsx` como Server Component com o gradiente
      de marca derivado de tokens (`primary`, `neutral`, `surface`), `aria-hidden`, posição fixa
      cobrindo a viewport, fora do fluxo do documento — **sem** a fotografia por enquanto; é este
      gradiente que garante o contraste, conforme FR-006d e D3
- [ ] T004 [P] Criar `app/(publico)/login/painel-marca.tsx` como Server Component com o `Logo`
      compartilhado, o nome do sistema no único `<h1>` da página e a mensagem de propósito
      (FR-001, FR-002, FR-016)
- [ ] T005 Recompor `app/(publico)/login/page.tsx` com a estrutura de três camadas de
      `contracts/tela-login.md`: `min-h-dvh`, `isolate` no contêiner, camada de fundo abaixo,
      conteúdo no fluxo, contêiner do cartão de acesso envolvendo o `<Suspense>` com
      `<LoginForm />`, em coluna única mobile-first — preservando `obterSessao()`, o
      `redirect(AREA_PADRAO)`, `instant = false` e o limite de `Suspense` (depende de T003, T004)

**Checkpoint**: a tela renderiza na nova estrutura, em coluna única, com fundo em gradiente e
login funcionando. Base pronta para as stories de composição.

---

## Phase 3: User Story 1 - Primeira impressão que transmite credibilidade (Priority: P1) 🎯 MVP

**Goal**: composição imersiva no desktop — fotografia em tela cheia, scrim de contraste e
cartão de acesso translúcido, com marca e mensagem institucional em peso visual próprio.

**Independent Test**: abrir `/login` sem sessão em 1280×800 e confirmar marca, mensagem de
contexto e cartão hierarquizados, sem rolagem vertical, com todas as opções de entrada
funcionando (Bloco 1 do `quickstart.md`).

### Implementation for User Story 1

- [ ] T006 [US1] Adicionar em `app/(publico)/login/fundo-login.tsx` a camada de fotografia a
      partir de `md`, com import estático opcional, `sizes` que impeça o celular de baixar a
      variante de desktop, sem `priority`, e o scrim de contraste com opacidade **mínima
      garantida** na região de texto, definido separadamente para claro e escuro — a tela precisa
      continuar completa e correta enquanto o arquivo de imagem não existir (FR-006a, FR-006c,
      FR-006e, FR-006f, D2, D3)
- [ ] T007 [US1] Aplicar em `app/(publico)/login/page.tsx` o tratamento translúcido do cartão a
      partir de `md`: opacidade alta o bastante para o fundo efetivo do texto ser praticamente o
      token de superfície, desfoque de fundo, borda, `rounded-xl` e sombra conforme
      DESIGN_SYSTEM.md §1.5 (borda em vez de sombra no escuro) — nenhum valor visual fora dos
      tokens (FR-003, FR-005, D3)
- [ ] T008 [US1] Implementar em `app/(publico)/login/page.tsx` o layout de duas zonas a partir de
      `lg` (painel institucional e cartão de acesso) e a largura máxima do conteúdo, para que em
      2560px nada se estique nem se perca no canto (FR-009)
- [ ] T009 [US1] Ajustar a hierarquia visual em `app/(publico)/login/page.tsx` e
      `app/(publico)/login/painel-marca.tsx` para que a ação de acesso primária se destaque das
      secundárias e do texto informativo, e a marca tenha peso superior ao texto de apoio
      (FR-001, FR-004)
- [ ] T010 [US1] Executar os Blocos 1 e 2 do `quickstart.md` (composição; fundo com imagem
      bloqueada, em Slow 3G e sem a variante de desktop no celular) e registrar os resultados —
      os passos 2.3, 2.4 e 2.7 ficam pendentes até a fotografia existir e **não** bloqueiam esta
      story

**Checkpoint**: a tela de desktop está composta e verificada, com gradiente de marca no lugar da
fotografia. É o MVP demonstrável.

---

## Phase 4: User Story 2 - Entrar pelo celular em campo (Priority: P1)

**Goal**: entrada pelo polegar, em 360px, sem zoom, sem errar alvo e sem pagar bytes de
fotografia.

**Independent Test**: abrir `/login` a 360×640 e concluir a entrada por e-mail e senha usando
apenas o polegar, sem ampliar a tela (Bloco 3 do `quickstart.md`).

### Implementation for User Story 2

- [ ] T011 [US2] Garantir em `app/(publico)/login/page.tsx` que a composição base (< `md`) usa
      superfície sólida sem translucidez e **sem** `backdrop-filter`, com a ordem marca compacta
      → cartão → convite, e que a primeira opção de acesso é alcançável sem rolar em 360×640px
      (FR-006e, FR-008, D1 — `backdrop-filter` é caro em Android de baixo custo e não há foto
      atrás no mobile)
- [ ] T012 [US2] Conferir e corrigir em `app/(publico)/login/page.tsx` e
      `app/(publico)/login/login-form.tsx` que todo botão, campo e link tem área acionável de no
      mínimo 44×44px, e que o campo de e-mail mantém `inputMode`/`autoComplete` abrindo o teclado
      correto (FR-010, DESIGN_SYSTEM.md §1.3)
- [ ] T013 [US2] Ajustar em `app/(publico)/login/page.tsx` o comportamento em altura reduzida
      (celular em paisagem, ~360×400px), degradando para rolagem vertical sem corte nem
      sobreposição, e verificar reflow com zoom de 200% (FR-011, edge case de tela baixa)
- [ ] T014 [US2] Executar o Bloco 3 do `quickstart.md`, incluindo a varredura de larguras 320,
      360, 768, 1280 e 2560px e a comparação de bytes contra `linha-base.md` (FR-007, SC-006a,
      SC-007)

**Checkpoint**: a tela funciona em campo. US1 e US2 juntas entregam o pedido original.

---

## Phase 5: User Story 3 - Entrar em condições adversas de leitura (Priority: P2)

**Goal**: a tela permanece operável no tema escuro, por teclado, por leitor de tela e sob
movimento reduzido — sem trocar acessibilidade por estética.

**Independent Test**: percorrer a tela inteira com Tab/Enter no tema escuro e no claro,
concluindo a entrada em ambos (Bloco 4 do `quickstart.md`).

### Implementation for User Story 3

- [ ] T015 [US3] Verificar e corrigir em `app/(publico)/login/page.tsx` e
      `app/(publico)/login/painel-marca.tsx` o contraste de todos os pares texto/fundo nos dois
      temas, medindo contra o scrim e o token de superfície — nunca contra a fotografia (FR-012,
      D3)
- [ ] T016 [US3] Garantir que a ordem de foco em `app/(publico)/login/page.tsx` segue a ordem
      visual e que todo elemento interativo exibe o `ANEL_FOCO` de `src/shared/ui/cn.ts`,
      inclusive sobre o cartão translúcido, onde o `ring-offset-surface` precisa continuar
      legível (FR-013, DESIGN_SYSTEM.md §6)
- [ ] T017 [US3] Confirmar que `app/(publico)/login/fundo-login.tsx` é `aria-hidden` e sem texto
      alternativo, e que nenhum elemento decorativo da composição é anunciado por leitor de tela
      (FR-014, FR-006b)
- [ ] T018 [US3] Suprimir sob `prefers-reduced-motion` a transição de opacidade da chegada da
      fotografia em `app/(publico)/login/fundo-login.tsx`, e confirmar que a tela não tem nenhuma
      outra animação de entrada nem movimento contínuo (FR-015, D11)
- [ ] T019 [P] [US3] Adicionar em `app/(publico)/login/page.tsx` os reforços por preferência do
      usuário: `prefers-contrast: more` deixa o cartão opaco e intensifica o scrim;
      `prefers-reduced-transparency` deixa o cartão opaco e remove o desfoque (D3)
- [ ] T020 [US3] Executar o Bloco 4 do `quickstart.md` nos dois temas, incluindo auditoria
      automatizada (axe ou Lighthouse) com zero violações A e AA e uma passagem com leitor de
      tela (SC-004, SC-005)

**Checkpoint**: a tela é operável em todos os modos de leitura, nos dois temas.

---

## Phase 6: User Story 4 - Entender por que caiu no login (Priority: P2)

**Goal**: sessão expirada e recusa de provedor têm lugar previsto na composição, sem quebrar o
layout nem sair da área visível.

**Independent Test**: acessar `/login?motivo=expirado` e `/login?error=account_not_linked` e
confirmar que o aviso aparece com destaque dentro do bloco de acesso, sem empurrar os botões
para fora da tela (Bloco 5 do `quickstart.md`).

### Implementation for User Story 4

- [ ] T021 [US4] Definir em `app/(publico)/login/page.tsx` e `app/(publico)/login/login-form.tsx`
      a faixa de avisos em posição fixa e previsível, dentro do cartão e imediatamente acima das
      opções de acesso, comportando mais de um aviso simultâneo sem empurrar a primeira opção
      para fora da área visível em 360×640px (FR-017, FR-018)
- [ ] T022 [US4] Ancorar o cartão em `app/(publico)/login/page.tsx` de modo que a alternância
      entre `'opcoes'` e `'credenciais'` não o desloque — ancoragem pelo topo do cartão, não pelo
      centro da viewport; as duas alturas naturais são diferentes e o contrato não exige
      igualá-las, exige que não haja salto (FR-020, `contracts/tela-login.md`)
- [ ] T023 [US4] Executar o Bloco 5 do `quickstart.md`, incluindo o código de erro desconhecido
      (`/login?error=xpto_desconhecido`), que deve cair na mensagem genérica em pt-BR e nunca
      exibir o código cru (FR-027, edge case)

**Checkpoint**: os estados que mais geram chamado de suporte estão visíveis e estáveis.

---

## Phase 7: User Story 5 - Conferir a senha antes de enviar (Priority: P2)

**Goal**: componente `Password` compartilhado do design system, com alternância de visibilidade
por ícone, adotado pela tela de login.

**Independent Test**: preencher o campo de senha, acionar o ícone e confirmar que o texto
aparece e volta a ser mascarado, sem alterar valor nem posição do cursor (Bloco 6 do
`quickstart.md`).

**⚠️ Independência total**: esta story não depende das Phases 2 a 6. Pode ser desenvolvida em
paralelo desde o início por outra pessoa. A única interseção é T028, que edita
`login-form.tsx`.

### Implementation for User Story 5

- [ ] T024 [US5] Criar `src/shared/ui/password/password.tsx` conforme
      `contracts/password.md`: moldura `Campo` compartilhada por fora, `PasswordInput.Root` com
      `ids={{ input: id }}`, partes `Control` / `Input` / `VisibilityTrigger`, **sem** usar
      `PasswordInput.Label` (o `Campo` já renderiza o rótulo — sem `ids` o `htmlFor` apontaria
      para o vazio), e `aria-describedby` calculado por `idsCampo()` passado na parte `Input`,
      que o Ark não emite (FR-029 a FR-031, FR-035, D7)
- [ ] T025 [US5] Adicionar em `src/shared/ui/password/password.tsx` o
      `translations={{ visibilityTrigger: (visivel) => visivel ? 'Ocultar senha' : 'Mostrar senha' }}`
      — o rótulo descreve a **ação disponível**, não o estado atual; sem ele o `aria-label` sai
      `undefined` e o botão é anunciado apenas como "botão" (FR-032)
- [ ] T026 [US5] Corrigir a acessibilidade por teclado do gatilho em
      `src/shared/ui/password/password.tsx`: `tabIndex={0}` e `onKeyDown` acionando a alternância
      em `Enter` e `Espaço` com `preventDefault()` no `Espaço`. **Usar `onKeyDown`, nunca
      `onClick`** — o Zag chama `preventDefault()` no `pointerdown`, o que impede o foco mas não
      o `click` subsequente, e um `onClick` alternaria duas vezes no clique de mouse, devolvendo
      a senha ao estado oculto (FR-033, D6)
- [ ] T027 [US5] Estilizar `src/shared/ui/password/password.tsx` com as constantes existentes:
      `CLASSES_CONTROLE_TEXTO` + `bordaControle()` + `ALTURA_POR_TAMANHO` no `Control` como flex,
      `Input` transparente e sem borda própria, anel de foco movido para o `Control` via
      `focus-within`, e gatilho `size-11` (44×44) com ícones `Eye`/`EyeOff` de 20px e `ANEL_FOCO`
      próprio — o gatilho é **irmão** do input dentro do flex, não sobreposto, então o texto nunca
      passa por baixo dele (FR-036, D8, DESIGN_SYSTEM.md §1.3 e §1.8)
- [ ] T028 [US5] Exportar `Password` em `src/shared/ui/index.ts` e adotá-lo em
      `app/(publico)/login/login-form.tsx` no lugar de `<Input type="password">`, com
      `autoComplete="current-password"` e o mesmo `register('senha')`, mesmo nome e mesmo resolver
      Zod — sem tocar em `entrar()`, `entrarComRedeSocial()`, `voltar()` nem nas mensagens de erro
      (FR-037, FR-024, contrato de preservação)
- [ ] T029 [P] [US5] Adicionar o `Password` a `app/(interno)/design-system/galeria.tsx`, com os
      estados normal, com erro, com apoio e desabilitado, para a validação em claro/escuro exigida
      por DESIGN_SYSTEM.md §7
- [ ] T030 [P] [US5] Documentar o `Password` em `spec/DESIGN_SYSTEM.md`: entrada na §4.2 (base
      Ark, partes usadas, a correção de teclado do gatilho e por que ela existe) e na lista de
      arquivos da §5
- [ ] T031 [US5] Executar o Bloco 6 do `quickstart.md` nos dois temas — com atenção especial ao
      6.4 (o ícone recebe foco por Tab, o que só passa por causa do T026) e ao 6.12 (revelar,
      "Voltar", reabrir: o campo volta mascarado)

**Checkpoint**: o design system ganhou um campo de senha acessível, e a tela de login o usa.

---

## Phase 8: User Story 6 - Descobrir como se tornar voluntário (Priority: P3)

**Goal**: quem chega sem conta encontra o caminho para o cadastro.

**Independent Test**: abrir `/login` sem sessão e alcançar `/cadastro` em um clique, a partir
dos dois estados da tela.

### Implementation for User Story 6

- [ ] T032 [US6] Adicionar em `app/(publico)/login/page.tsx` o convite ao cadastro com link para
      `/cadastro`, posicionado **fora** do bloco que alterna entre `'opcoes'` e `'credenciais'`,
      para permanecer acessível nos dois estados (FR-028)
- [ ] T033 [US6] Executar o Bloco 7 do `quickstart.md` — o convite (7.1, 7.2) e as oito
      verificações de preservação do comportamento existente (7.3 a 7.8), que junto com 5.2, 5.3
      e 5.5 fecham a SC-008

**Checkpoint**: todas as user stories entregues.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: fechar o ativo pendente e os portões finais.

- [ ] T034 Integrar a fotografia recebida em `public/login/fundo-login.jpg` e ligá-la ao import
      estático de `app/(publico)/login/fundo-login.tsx`, conferindo que o build gera dimensões e
      `blurDataURL` e que a chegada da imagem não desloca nada (FR-006a, SC-006) — **depende do
      T002**; se a fotografia não chegar, a tela permanece com o gradiente de marca e as FR-006a
      e FR-006g ficam em aberto, sem impedir a entrega do restante
- [ ] T035 Preencher `public/login/PROCEDENCIA.md` com origem, autoria e licença da fotografia
      (FR-006g) — depende do T034
- [ ] T036 Executar os passos 2.3, 2.4 e 2.7 do `quickstart.md` sobre a fotografia real: medir
      contraste em 5 pontos distintos da imagem, incluindo o mais claro e o mais escuro, nos dois
      temas (SC-010) — depende do T034
- [ ] T037 Executar o Bloco 8 do `quickstart.md`: inspeção de disciplina do design system —
      nenhum valor visual fora dos tokens, componentes compartilhados reutilizados sem
      equivalente local, nenhum texto de interface em inglês fixo (FR-005, FR-006, SC-009)
- [ ] T038 Rodar os portões automatizados do `quickstart.md` — `npx tsc --noEmit`,
      `npx eslint app src`, `npx prettier --check "app/**/*.{ts,tsx}" "src/**/*.{ts,tsx}"`,
      `npx next build` e `npm test` (a suíte de `domain`/`application` precisa continuar verde:
      nada aqui a toca)
- [ ] T039 Agendar e executar a verificação com usuários que as SC-001 e SC-011 exigem: mostrar a
      tela por 5 segundos a pelo menos 5 pessoas e perguntar de que organização é a ferramenta;
      e observar se quem erra a senha na primeira tentativa a corrige com a alternância de
      visibilidade, sem uma terceira tentativa

### Fora do escopo da spec — requer sua decisão

A spec escopou a adoção do `Password` apenas à tela de login (FR-037). O levantamento do D12
encontrou **cinco** campos de senha em três arquivos; deixar quatro no componente antigo é uma
migração pela metade, e migrações pela metade apodrecem. Cada item abaixo é uma troca de uma
linha. Incluir é decisão sua — se ficarem de fora, precisam virar item de acompanhamento com
dono, não uma nota solta.

- [ ] T040 [OPCIONAL] [P] Migrar os dois campos de senha de
      `app/(publico)/cadastro/cadastro-form.tsx` para o `Password` com
      `autoComplete="new-password"`
- [ ] T041 [OPCIONAL] [P] Migrar os dois campos de senha de
      `app/(interno)/(staff)/admin/usuario-form-dialog.tsx` para o `Password` com
      `autoComplete="new-password"`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências — começa imediatamente. T002 dispara o insumo de maior
  prazo e deve sair no primeiro dia.
- **Foundational (Phase 2)**: depende do Setup. **Bloqueia US1, US2, US3, US4 e US6.** Não
  bloqueia a US5.
- **US1 (Phase 3)** e **US2 (Phase 4)**: dependem da Phase 2. As duas são P1 e são a mesma tela
  em contextos diferentes — entregar uma sem a outra não é aceitável.
- **US3 (Phase 5)** e **US4 (Phase 6)**: dependem da composição das US1/US2 existir.
- **US5 (Phase 7)**: **independente de todas as outras.** Só T028 toca um arquivo compartilhado.
- **US6 (Phase 8)**: depende da Phase 2.
- **Polish (Phase 9)**: T034–T036 dependem do T002 (ativo externo); os demais dependem de todas
  as stories desejadas estarem completas.

### Dependências específicas dentro das fases

- T005 depende de T003 e T004
- T006 estende o arquivo criado em T003
- T007, T008, T009 estendem o arquivo recomposto em T005 — **sequenciais entre si** (mesmo
  arquivo)
- T011, T013, T021, T022, T032 também editam `page.tsx` — sequenciais com T007–T009
- T025, T026, T027 estendem o arquivo criado em T024 — sequenciais entre si
- T028 depende de T024–T027
- T034 depende de T002; T035 e T036 dependem de T034

### Parallel Opportunities

- **T002** roda em paralelo com todo o resto — é um pedido externo, não código
- **T003 e T004** são arquivos novos e distintos: paralelos
- **Toda a US5 (T024–T031)** roda em paralelo com as Phases 2 a 6, por outra pessoa. É o maior
  ganho de paralelismo desta feature
- **T029 e T030** (galeria e documentação) são arquivos distintos: paralelos entre si
- **T019** toca `page.tsx` mas em um bloco isolado de media queries: marcado [P] em relação às
  demais tarefas da US3
- **T040 e T041** (opcionais) são arquivos distintos: paralelos

**Alerta de conflito**: `app/(publico)/login/page.tsx` é tocado por T005, T007, T008, T009,
T011, T013, T015, T016, T019, T021, T022 e T032. É o gargalo de serialização da feature — se
houver duas pessoas, a divisão natural é uma na composição (`page.tsx`) e outra na US5
(`password.tsx`), não duas na composição.

---

## Parallel Example: início da feature

```bash
# Dia 1 — três frentes simultâneas:
Task: "T002 Solicitar a fotografia ao acervo da Defesa Civil"          # externo, sem código
Task: "T003 Criar app/(publico)/login/fundo-login.tsx"                 # composição
Task: "T024 Criar src/shared/ui/password/password.tsx"                 # US5, independente

# Phase 2, após T001:
Task: "T003 Criar fundo-login.tsx"
Task: "T004 Criar painel-marca.tsx"
```

---

## Implementation Strategy

### MVP (US1 + US2)

1. Phase 1: Setup — **T001 antes de qualquer alteração de código**, ou a linha de base da SC-006a
   se perde
2. Phase 2: Foundational — estrutura de camadas
3. Phase 3: US1 — composição de desktop
4. Phase 4: US2 — composição de mobile
5. **PARAR E VALIDAR**: Blocos 1, 2 e 3 do `quickstart.md`
6. Demonstrável, com gradiente de marca no lugar da fotografia

As duas P1 formam o MVP juntas, não só a US1: a constituição trata responsividade mobile como
requisito de aceitação, não refinamento posterior, e a US2 é essa exigência nesta tela.

### Entrega incremental

1. Setup + Foundational → base pronta
2. US1 + US2 → **MVP**, demonstrável
3. US3 → acessibilidade verificada nos dois temas
4. US4 → estados de aviso estáveis
5. US5 → campo de senha acessível no design system (pode chegar antes, se paralelizada)
6. US6 → caminho para o cadastro
7. Polish → fotografia, procedência, portões e verificação com usuários

### Estratégia com duas pessoas

- **Pessoa A**: Phases 1, 2, 3, 4, 6, 8 — toda a composição, serializada em `page.tsx`
- **Pessoa B**: Phase 7 (US5) do início ao fim, depois Phase 5 (US3), que é majoritariamente
  verificação e correção pontual

A US5 é a única frente verdadeiramente paralela. Colocar duas pessoas na composição gera
conflito em `page.tsx` mais do que velocidade.

---

## Notes

- Nenhuma tarefa toca `domain/`, `application/` ou `infrastructure/` — a feature é inteiramente
  `presentation` + `shared/ui` (Princípio I)
- Nenhuma dependência nova: o `PasswordInput` já vem no `@ark-ui/react` instalado (Princípio VI)
- Commits em Conventional Commits (Princípio II); `feat:` para as stories, `docs:` para T030 e
  T035
- Comprometer-se com um checkpoint por vez: cada um deixa a tela em estado entregável
- **T001 é irreversível se pulado** — a linha de base da SC-006a some assim que o redesign entra
- **T026 corrige a biblioteca**, não o nosso código: sem ele o gatilho do Ark fica fora da ordem
  de tabulação e a FR-033 falha silenciosamente, porque no mouse tudo parece funcionar
