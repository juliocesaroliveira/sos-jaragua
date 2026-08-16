---
description: 'Task list for feature 012 — notificações que chegam sozinhas à tela'
---

# Tasks: Notificações que chegam sozinhas à tela

**Input**: Design documents from `/specs/012-notificacoes-tempo-real/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: incluídos, mas **com escopo reduzido em relação à feature anterior**. O Princípio III
exige TDD em `domain/` e `application/` — e esta feature **não toca nenhuma das duas**: não há
regra de negócio nova, só um caminho de leitura e comportamento de cliente. A mesma constituição
diz que `infrastructure/` e `presentation/` "são finas por design e não exigem a mesma cobertura
exaustiva — validação de contrato e dos casos de erro mais prováveis basta". As duas tarefas de
teste (T005 e T012) cobrem exatamente isso: o contrato do endpoint e a política de intervalo,
que é a única lógica pura da feature.

**Organization**: agrupado por user story, para que cada uma seja implementável e testável de
forma independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependências pendentes)
- **[Story]**: user story à qual a tarefa pertence (US1, US2)
- Caminho de arquivo exato em toda descrição

## Path Conventions

Monolito modular Next.js. Caminhos reais deste repositório:

- Route Handlers: `app/api/`
- Shell e telas: `app/_shell/`, `app/(interno)/`
- Infra de dados no cliente: `src/shared/query/`
- Bounded context: `src/modules/notificacoes/presentation/`
- Testes unitários convivem com o código (`*.test.ts`)

**Sem migração, sem dependência nova, sem variável de ambiente nova.**

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: garantir ponto de partida verde e ambiente pronto para observar o comportamento.

- [X] T001 Registrar baseline executando `npm test`, `npm run test:integracao` e `npm run lint`, anotando que o erro de lint pré-existente em `app/(interno)/(staff)/crise/gestao-crise.tsx` (import `MoreVertical` não usado) já existia antes desta feature
- [X] T002 [P] Confirmar que `npm run dev` sobe e que o sino já renderiza com dados do servidor em `app/_shell/shell-autenticado.tsx`, para ter o comportamento atual como referência de comparação

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: o endpoint de leitura e a chave de cache. Sem os dois, nenhuma das stories existe.

**⚠️ CRITICAL**: nenhuma user story pode começar antes desta fase terminar.

- [X] T003 Criar o Route Handler `GET` em `app/api/notificacoes/route.ts` que obtém a sessão com `obterSessao()`, devolve `401` sem corpo quando não há sessão, e devolve `{ notificacoes, naoLidas }` resolvendo `listarNotificacoes(userId)` e `contarNaoLidas(userId)` de `src/modules/notificacoes/presentation/queries/notificacoes.ts` em `Promise.all` — **sem reimplementar as consultas** e **sem aceitar nenhum parâmetro do cliente** (contracts/leitura-notificacoes.md C-01 a C-06)
- [X] T004 Garantir em `app/api/notificacoes/route.ts` que a resposta não é cacheada por navegador, CDN ou pelo cache de dados do framework — é dado por-usuário derivado de sessão, que `DESIGN.md §7` proíbe cachear (contracts/leitura-notificacoes.md C-04)
- [X] T005 Criar `app/api/notificacoes/route.test.ts` cobrindo o contrato: sem sessão devolve `401` **sem corpo**; com sessão devolve apenas as notificações daquele usuário; `naoLidas` reflete o total de não-lidas e **não** o tamanho da lista truncada em 30 (contracts/leitura-notificacoes.md C-02 e C-03)
- [X] T006 [P] Acrescentar `chaveNotificacoes()` a `src/shared/query/chaves.ts` e exportá-la em `src/shared/query/index.ts`, documentando no arquivo que — ao contrário de `chaveUsuarios`/`chaveVoluntarios`/`chaveEstoque`/`chaveSaidas` — esta chave **não deriva de `CACHE_TAGS`**, porque notificações nunca são cacheadas no servidor; e que ela **não inclui `userId`**, já que o destinatário vem da sessão no servidor (research.md D12)

**Checkpoint**: endpoint autorizado e chave compartilhada disponíveis. As duas stories podem
começar.

---

## Phase 3: User Story 1 - Receber um aviso sem sair da tela (Priority: P1) 🎯 MVP

**Goal**: o sino se atualiza sozinho a cada 30 segundos com a aba visível, e imediatamente quando
o usuário volta para a aba, sem piscar nem gerar requisição extra na abertura.

**Independent Test**: deixar a tela de um usuário aberta e parada, gerar uma notificação para ele
a partir de outra sessão, e verificar que contador e lista mudam sem nenhuma interação.

### Implementation for User Story 1

- [X] T007 [US1] Criar `src/modules/notificacoes/presentation/client/use-notificacoes.ts` com um `useQuery` usando `chaveNotificacoes()`, `queryFn` consumindo `GET /api/notificacoes` e lançando em resposta não-ok para que o TanStack trate como erro (contracts/sino-cliente.md C-10)
- [X] T008 [US1] Configurar no mesmo hook `refetchInterval: 30_000`, `refetchOnWindowFocus: 'always'` e `staleTime` menor que o intervalo; **não definir `refetchIntervalInBackground`** — o padrão `false` é o que suspende o ciclo com a aba oculta, e **nenhum listener próprio de `visibilitychange` deve ser adicionado** (research.md D2 e D10, contracts/sino-cliente.md C-11)
- [X] T009 [US1] Aceitar no hook a semente vinda do servidor e aplicá-la como `initialData` **com `initialDataUpdatedAt`** — sem o segundo, o primeiro ciclo só dispara um intervalo inteiro após o render do cliente (research.md D5)
- [X] T010 [US1] Ajustar `app/_shell/shell-autenticado.tsx` para documentar que lista e contador resolvidos ali passam a ser **semente** do cache do cliente, mantendo o `Promise.all` e a forma das props inalterados (contracts/sino-cliente.md C-15)
- [X] T011 [US1] Alterar `app/(interno)/sino-notificacoes.tsx` para consumir `useNotificacoes` em vez de renderizar diretamente as props, mantendo textos, cores por evento, rótulos e o `Drawer` exatamente como estão, e garantindo que itens novos entrem no topo sem fechar o painel nem alterar a posição de rolagem (FR-003, FR-018, contracts/sino-cliente.md C-14)

**Checkpoint**: User Story 1 completa e verificável sozinha (quickstart V1, V2, V3, V5).

---

## Phase 4: User Story 2 - Manter o contador correto e não pesar no aparelho (Priority: P1)

**Goal**: consistência entre abas, suspensão total com a aba oculta, recuo progressivo em falha,
parada definitiva ao fim da sessão, e marcação de leitura que não é desfeita por um ciclo em voo.

**Independent Test**: marcar como lida em uma aba e conferir a outra; observar na aba Rede que
nenhuma requisição sai com a aba oculta; simular offline e confirmar que as tentativas se
espaçam; fazer logout e confirmar que a query para.

### Tests for User Story 2 ⚠️

> Escrever primeiro e confirmar que falha antes de implementar.

- [X] T012 [P] [US2] Criar `src/modules/notificacoes/presentation/client/politica-intervalo.test.ts` cobrindo a função pura de intervalo: sem falhas devolve `30_000`; falhas consecutivas devolvem intervalos crescentes até um teto; após resposta `401` devolve `false`; após uma consulta bem-sucedida volta a `30_000` (contracts/sino-cliente.md C-12, data-model.md R4)

### Implementation for User Story 2

- [X] T013 [US2] Implementar a função pura de política de intervalo em `src/modules/notificacoes/presentation/client/politica-intervalo.ts`, distinguindo **`401` (para em definitivo)** de **falha de rede (espaça progressivamente)** — tratar os dois igual deixaria o usuário sem atualização depois de um túnel, ou martelando um endpoint que já o rejeitou (FR-009, FR-010)
- [X] T014 [US2] Ligar a política ao hook em `src/modules/notificacoes/presentation/client/use-notificacoes.ts`, passando-a como função em `refetchInterval` e definindo `retry: false` para `401`, sobrescrevendo o `retry: 1` global de `src/shared/query/query-provider.tsx` (research.md D7 e D8)
- [X] T015 [US2] Adicionar ao hook as mutações `marcarUma` e `marcarTodas` chamando as Server Actions **existentes** `marcarComoLida` e `marcarTodasComoLidas` de `src/modules/notificacoes/presentation/actions/notificacoes.ts`, com a sequência obrigatória: `cancelQueries` → snapshot → `setQueryData` otimista → ação → rollback em erro → `invalidateQueries` em `onSettled` (data-model.md R2, contracts/sino-cliente.md C-13)
- [X] T016 [US2] Remover `router.refresh()` e o `useTransition` do fluxo de leitura em `app/(interno)/sino-notificacoes.tsx`, passando a usar `marcarUma`/`marcarTodas` e `processando` do hook — a re-renderização da rota inteira no servidor para atualizar um contador vira redundante com a invalidação do passo final (contracts/sino-cliente.md C-13)
- [X] T017 [US2] Garantir em `app/(interno)/sino-notificacoes.tsx` que nenhum erro técnico aparece quando um ciclo falha e que nenhum indicador de carregamento pisca a cada atualização de fundo — só a ação do usuário mostra estado de processamento (FR-013, contracts/sino-cliente.md C-14)

**Checkpoint**: User Stories 1 e 2 funcionam de forma independente (quickstart V4, V6 a V9).

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T018 [P] Confirmar pela aba Rede das ferramentas de desenvolvedor que **nenhuma** requisição a `/api/notificacoes` sai enquanto a aba permanece oculta, e que exatamente uma sai ao voltar — quickstart V4 e V5 (SC-004, SC-002)
- [X] T019 [P] Verificar que `package.json` não ganhou dependência nova e que `db/migrations/` não ganhou arquivo novo, conforme o escopo declarado no plano (Princípio VI)
- [X] T020 [P] Revisar o diff procurando código redundante que o design pede para **não** existir: listener próprio de `visibilitychange`, deduplicação manual de notificações e `refetchIntervalInBackground: true` (research.md D2 e D9)
- [ ] T021 Executar o roteiro completo V1–V11 de [quickstart.md](./quickstart.md), com atenção especial a V6 (marcação de leitura durante um ciclo em voo) e V10 (uma hora sem duplicatas), e registrar o resultado
- [X] T022 [P] Rodar `npm run test:tudo`, `npm run lint` e `npm run format`, confirmando que o conjunto unitário permanece rápido e sem rede (Princípio III)
- [X] T023 Revisar o diff contra os Princípios I, IV e VI antes do merge — endpoint novo é superfície nova, e a Governance da constituição exige verificação explícita para mudanças que tocam autorização

### Resultado do polish

**Achado durante a implementação — `proxy.ts` (registrado como research.md D13)**: a rota
precisou ser excluída do matcher, ao lado de `api/auth`. Sem isso, o proxy *deny-by-default*
redirecionaria para `/login` em vez de responder `401` (o `fetch` seguiria o 302 e o cliente
nunca pararia de consultar), e — mais grave — renovaria `lastActivityAt` a cada consulta
automática, **anulando o timeout de inatividade** de `coordenador` e `membro_defesa_civil`, que o
Princípio IV declara não contornável. Atividade de fundo não é atividade do usuário.

**Ajuste de estrutura**: o handler ficou em
`src/modules/notificacoes/presentation/http/leitura-notificacoes.ts`, com `app/api/notificacoes/route.ts`
apenas reexportando. Dois motivos: é `presentation` do módulo dono do dado (Princípio I), e o
`vitest.config.ts` só inclui `src/**/*.test.ts` — um handler escrito direto em `app/` ficaria sem
teste de contrato.

**T019 — escopo (verificado)**: `package.json` e `db/migrations/` intocados. Nenhuma dependência,
nenhuma migração, nenhuma variável de ambiente nova.

**T020 — código redundante (verificado)**: nenhum listener próprio de `visibilitychange`, nenhuma
deduplicação manual, nenhum `refetchIntervalInBackground: true`. As únicas ocorrências desses
termos no diff são comentários explicando por que não existem.

**T022 — suíte (verde)**: `npx tsc --noEmit` limpo; `npm test` 196/196 (era 181);
`npm run test:integracao` 16/16; `npm run lint` **limpo** — o erro pré-existente citado em T001 já
havia sido corrigido no merge da feature 011. `npm run build` conclui e lista `/api/notificacoes`
como `ƒ` (dinâmica, não cacheada), confirmando C-04 no build real.

**T023 — revisão constitucional (aprovada)**:

- *Princípio I*: handler e hook vivem em `presentation/` do módulo `notificacoes`; `app/` só
  reexporta e renderiza. Nenhuma regra de negócio nova.
- *Princípio IV*: `obterSessao()` é a autoridade; a exclusão do matcher **preserva** o timeout de
  inatividade em vez de enfraquecê-lo; o endpoint não aceita nenhum parâmetro do cliente.
- *Princípio VI*: zero dependência, zero infraestrutura, zero migração.

**Pendências reais**: T018 e T021 exigem navegador com duas sessões autenticadas e observação da
aba Rede ao longo do tempo. Não foram executadas.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências
- **Foundational (Phase 2)**: depende do Setup — **bloqueia as duas stories**
- **User Story 1 (Phase 3)**: depende da Phase 2
- **User Story 2 (Phase 4)**: depende da Phase 2 — independente da US1
- **Polish (Phase 5)**: depende das stories entregues

### User Story Dependencies

As duas dependem apenas da Phase 2 e **não dependem uma da outra**. US1 entrega a atualização
automática; US2 entrega as garantias de consistência, economia e robustez. Cada uma é observável
sozinha.

**Nota de integração**: as duas stories editam
`src/modules/notificacoes/presentation/client/use-notificacoes.ts` e
`app/(interno)/sino-notificacoes.tsx`. Se forem trabalhadas em paralelo por duas pessoas, esses
dois arquivos são pontos de conflito — vale combinar quem encosta neles primeiro.

### Cadeias sequenciais dentro das fases

- T003 → T004 → T005 (handler → cache → teste de contrato do mesmo arquivo)
- T007 → T008 → T009 (mesmo hook, configuração incremental)
- T010 → T011 (o sino consome a semente que o shell documenta)
- T012 → T013 (teste antes da implementação da função pura)
- T013 → T014 (a política precisa existir antes de ser ligada)
- T015 → T016 → T017 (mutações no hook → sino as consome → refino de estados visuais)

### Parallel Opportunities

- T002 durante o Setup
- T006 em paralelo com T003–T005 (`chaves.ts` e o Route Handler não se tocam)
- T012 (teste da US2) pode ser escrito em paralelo com toda a Phase 3
- T018, T019, T020 e T022 em paralelo no Polish

---

## Parallel Example: após a Phase 2

```bash
# Dois desenvolvedores, uma story cada — combinando quem edita o hook primeiro:
Dev A: T007 → T008 → T009 → T010 → T011          # US1: atualização automática
Dev B: T012 → T013 (política pura, arquivo próprio) → aguarda o hook → T014 → T015 → T016 → T017

# Dentro da Foundational, estes dois não competem por arquivo:
Task: "Route Handler GET em app/api/notificacoes/route.ts"
Task: "chaveNotificacoes em src/shared/query/chaves.ts"
```

---

## Implementation Strategy

### MVP (User Story 1)

1. Phase 1 → Phase 2 → Phase 3
2. **PARAR E VALIDAR**: quickstart V1 (aviso chega sozinho), V2 (painel aberto), V3 (não vaza
   para outro usuário), V5 (volta ao foco)
3. Entregável real: o problema central da spec — quem fica parado numa tela passa a ver os avisos

**Atenção**: a US1 sozinha já suspende o ciclo com a aba oculta, porque isso vem do padrão da
biblioteca (T008), não da US2. O MVP não é um consumidor de bateria à espera de conserto.

### Entrega incremental

1. Phase 1 + 2 → fundação pronta
2. + US1 → validar → demo (MVP)
3. + US2 → validar → demo
4. Polish → merge

### Observação de sequenciamento

Diferente da feature 011, aqui **não há migração** e nenhuma mudança de banco. Toda a entrega é
código de aplicação, então não existe passo que precise ir a produção antes do restante.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente
- Testes têm escopo reduzido **por decisão fundamentada**, não por descuido: a feature não toca
  `domain/` nem `application/`, e a constituição dispensa cobertura exaustiva de `presentation/`
- Confirmar que T012 falha antes de implementar T013
- Commits em Conventional Commits (`feat:`, `test:`, `docs:`) — Princípio II
- Interface e textos existentes permanecem intocados; esta feature não muda uma palavra do que o
  usuário lê
- Ponto de atenção recorrente: o `cancelQueries` de T015 é requisito (FR-016), não otimização —
  sem ele um ciclo em voo desfaz visualmente a leitura do usuário
