---
description: 'Lista de tarefas — Inscrição Voluntária em Atividades'
---

# Tasks: Inscrição Voluntária em Atividades

**Input**: Design documents from `/specs/018-inscricao-atividades/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/acoes-inscricao.md](contracts/acoes-inscricao.md), [contracts/ui-atividades-abertas.md](contracts/ui-atividades-abertas.md),
[quickstart.md](quickstart.md)

**Tests**: incluídos. A constituição (Princípio III) torna TDD obrigatório para `domain/` e `application/`.
Testes de integração cobrem só o que exige o Neon real (research D11). Testes unitários MUST ser escritos antes e
falhar antes da implementação correspondente.

**Organization**: tarefas agrupadas por user story (spec.md). US1 e US2 são ambas P1 e formam juntas o MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência pendente)
- **[Story]**: US1..US5 conforme spec.md
- Caminhos relativos à raiz do repositório

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: ambiente pronto. Não há dependência nova (plan.md).

- [X] T001 Confirmar que `.env.local` aponta para uma **branch Neon de desenvolvimento** (não produção) e que `npm test` e `npm run test:integracao` passam na `develop` antes de qualquer mudança (linha de base) — `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: migrar `alocacao` para identidade por participante (research D1/D2), criar as regras puras de inscrição e
ajustar **todos** os consumidores atuais de `alocacao`. Ao fim desta fase, o sistema se comporta exatamente como antes,
mas sobre o novo modelo.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase terminar.

### Schema e migração

- [X] T002 Em `db/schema/voluntariado.ts`:
  - criar o enum `origemAlocacaoEnum = pgEnum('origem_alocacao', ['gestao', 'inscricao_propria'])`;
  - em `alocacao`, adicionar `participanteUserId: text().notNull().references(() => user.id, { onDelete: 'cascade' })` e `origem: origemAlocacaoEnum().notNull().default('gestao')`;
  - tornar `voluntarioPerfilId` anulável (remover `.notNull()`);
  - trocar o índice `alocacao_turno_voluntario_idx` por `uniqueIndex('alocacao_turno_participante_idx').on(t.turnoId, t.participanteUserId)`;
  - adicionar `index('alocacao_participante_idx').on(t.participanteUserId)` e manter `alocacao_voluntario_idx`;
  - em `alocacaoRelations`, adicionar `participante: one(user, …)`.
- [X] T003 [P] Em `db/schema/notificacoes.ts`, adicionar `'inscricao_turno'` ao final de `tipoNotificacaoEnum`.
- [X] T004 Rodar `npm run db:generate` e **editar à mão** o SQL gerado em `db/migrations/0004_*.sql` para seguir a ordem de [data-model § Ordem da migração](data-model.md#ordem-da-migração):
  1. adicionar `participante_user_id` como anulável;
  2. fazer o backfill com `UPDATE "alocacao" a SET "participante_user_id" = vp."user_id" FROM "voluntario_perfil" vp WHERE vp."id" = a."voluntario_perfil_id"`;
  3. aplicar `SET NOT NULL` e a FK;
  4. aplicar a troca de índices e o `DROP NOT NULL` em `voluntario_perfil_id`.

  Depois, aplicar com `npm run db:migrate` (depende de T002 e T003).
- [X] T005 [P] Em `src/modules/notificacoes/application/ports/notificacao-service.ts`, adicionar `'inscricao_turno'` a `EVENTOS_NOTIFICACAO`. Confirmar que ele **não** entra em `EVENTOS_COM_EMAIL` em `src/modules/notificacoes/infrastructure/notificacao-email.ts`, e ajustar qualquer `Record<EventoNotificacao, …>` exaustivo que o `tsc` apontar.

### Regras de domínio (TDD)

- [X] T006 [P] Escrever os testes que falham em `src/modules/voluntariado/domain/inscricao.test.ts`, cobrindo research D4:
  - **`podeSeInscrever`**: cada role de staff sem perfil → sim; `voluntario` com perfil `aprovado` → sim; perfil `pendente`/`rejeitado`/ausente com role `voluntario` → não.
  - **`turnosSobrepoem`**: sobreposição parcial → sim; turno contido no outro → sim; turnos encostados (08–12 e 12–16) → **não**.
  - **`validarInscricao`** devolve o código e a mensagem de [data-model § Regras](data-model.md#regras-de-validação-domaininscricaots) para:
    - `atividade_fechada`;
    - `turno_iniciado` (agora = início, agora > início);
    - `lotado` (preenchidas = vagas, e preenchidas > vagas quando a gestão excedeu);
    - `ja_inscrito`;
    - `conflito_horario` (a mensagem cita a atividade e o horário);
    - e `ok` no caminho feliz.
  - **`validarDesistencia`**: exatamente 30 min antes → permitido; 29 min 59 s antes → `prazo_desistencia`; turno já iniciado → `prazo_desistencia`.
  - **`estadoDoTurno`**:
    - precedência `inscrito` > `em_andamento` > `lotado` > `ultimas_vagas` > `com_vagas`;
    - "últimas vagas" com `max(1, ceil(vagas × 0,2))`: com vagas = 1 e 0 preenchidas → `ultimas_vagas`; com vagas = 10 e restam 2 → `ultimas_vagas`; com vagas = 10 e restam 3 → `com_vagas`.
- [X] T007 Implementar `src/modules/voluntariado/domain/inscricao.ts`, só com funções puras e `agora: Date` sempre por parâmetro:
  - `PRAZO_DESISTENCIA_MINUTOS = 30`;
  - `podeSeInscrever`, `turnosSobrepoem`, `validarInscricao`, `validarDesistencia`, `estadoDoTurno`;
  - os tipos `EstadoTurno` e `MotivoRecusaInscricao`.

  Exportar em `src/modules/voluntariado/domain/index.ts`. Rodar `npm test` até T006 passar (depende de T006).

### Ports e repositórios

- [X] T008 Atualizar `src/modules/voluntariado/application/ports/atividade-repository.ts`:
  - `Atividade` ganha `criadoPor: string`;
  - `alocar(...)` passa a receber `{ turnoId, participanteUserId, voluntarioPerfilId: string | null, alocadoPor, origem }`;
  - `DestinatarioAlocacao` passa a ter `{ userId, nome }`;
  - adicionar `inscreverComTrava(entrada: { turnoId, participanteUserId, voluntarioPerfilId: string | null, agora: Date }): Promise<ResultadoInscricao>`, em que `ResultadoInscricao` é uma união discriminada `{ ok: true, alocacaoId, turno, atividade } | { ok: false, motivo: MotivoRecusaInscricao, conflito?: {...} }`;
  - adicionar `buscarAlocacaoDoParticipante(alocacaoId, participanteUserId): Promise<{ alocacaoId, turno: Turno, atividade: Atividade, status } | null>`.
- [X] T009 [P] Em `src/modules/voluntariado/application/ports/voluntario-repository.ts`, adicionar `buscarPorUserId(userId: string): Promise<PerfilVoluntario | null>` e implementar em `src/modules/voluntariado/infrastructure/drizzle/voluntario-repository.ts`. Atualizar os repositórios falsos dos testes existentes que implementam a interface.
- [X] T010 Atualizar `src/modules/voluntariado/infrastructure/drizzle/atividade-repository.ts` (depende de T002, T007 e T008):
  - **`COLUNAS_ATIVIDADE`**: incluir `criadoPor`.
  - **`alocar`**: gravar `participanteUserId`, `voluntarioPerfilId` e `origem`. O upsert passa a usar `target: [alocacao.turnoId, alocacao.participanteUserId]` e `set: { status: 'confirmado', alocadoPor, origem, voluntarioPerfilId, lembreteEnviadoEm: null }`, com `setWhere` `status = 'cancelado'`.
  - **`destinatariosDaAtividade` e `destinatarioDaAlocacao`**: fazer join com `user` por `participanteUserId` e left join com `voluntarioPerfil`. O nome vem de `coalesce(voluntario_perfil.nome_completo, user.name)`.
  - **`inscreverComTrava`**: usar `db.transaction`, nesta ordem:
    0. `await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${participanteUserId}))`)` — serializa inscrições da mesma pessoa (research D3);
    1. `SELECT … FROM turno WHERE id = $1 FOR UPDATE` com `.for('update')`;
    2. ler a atividade;
    3. contar as alocações confirmadas no turno;
    4. verificar se a pessoa já está confirmada no turno;
    5. ler os turnos confirmados do participante com `inicio < turno.fim AND fim > turno.inicio`, trazendo título, início e fim;
    6. chamar `validarInscricao(...)`;
    7. se for válido, fazer o upsert com `origem = 'inscricao_propria'` e `alocadoPor = participanteUserId`.

    Devolver um `ResultadoInscricao`.
  - **`buscarAlocacaoDoParticipante`**: implementar.
- [X] T011 Atualizar `src/modules/voluntariado/application/use-cases/alocar-voluntario.ts`:
  - `AlocarVoluntarioUseCase` passa a chamar `alocar({ turnoId, participanteUserId: perfil.userId, voluntarioPerfilId, alocadoPor, origem: 'gestao' })` e inclui `origem` e `participanteUserId` em `dadosNovos` da auditoria;
  - `CancelarAlocacaoUseCase` passa a usar `destinatario.nome`.

  As regras não mudam (a gestão pode exceder vagas). Ajustar os testes existentes que usam `alocar`/`DestinatarioAlocacao` (depende de T008).

### Consumidores de leitura de `alocacao`

- [X] T012 [P] Em `src/modules/voluntariado/presentation/queries/atividades.ts`:
  - `listarMinhasAtividades(userId)` passa a filtrar por `alocacao.participanteUserId = userId`, sem o join obrigatório com `voluntarioPerfil`, o que inclui a equipe interna sem perfil;
  - em `buscarAtividadeDetalhada`, `AlocadoNoTurno` passa a ser `{ alocacaoId, participanteUserId, voluntarioPerfilId: string | null, nome, role, origem }`, com join em `user` (para `role` e `name`) e left join em `voluntarioPerfil`, ordenado por `nome`.
- [X] T013 [P] Em `app/api/cron/lembrete-turno/route.ts`, trocar o `innerJoin(voluntarioPerfil, …)` por `innerJoin(user, eq(user.id, alocacao.participanteUserId))` com `leftJoin(voluntarioPerfil, …)`. `userId` passa a vir de `alocacao.participanteUserId` e o nome de `coalesce(nome_completo, user.name)`.
- [X] T014 Em `app/(interno)/(staff)/atividades/[id]/painel-escala.tsx`, adaptar ao novo `AlocadoNoTurno`:
  - exibir `nome` no lugar de `nomeCompleto`;
  - calcular `jaAlocados` pelos `voluntarioPerfilId` não nulos dos alocados;
  - não mudar mais nada visualmente nesta fase.

  Depende de T012.
- [X] T015 Em `db/seed.ts`, preencher `participanteUserId` (e `origem: 'gestao'`) nas alocações semeadas. Ajustar `src/modules/voluntariado/infrastructure/drizzle/habilidade-repository.integracao.test.ts` e qualquer fixture que insira em `alocacao`.
- [X] T016 Rodar `npx tsc --noEmit`, `npm test`, `npm run test:integracao` e `npm run lint`. Abrir `/atividades/{id}` e `/voluntariado/minhas-atividades` e confirmar que o comportamento é idêntico ao anterior: alocar e remover pelo painel, e lembrete sem erro.

**Checkpoint**: nova identidade de participante em produção-equivalente, sem nenhuma mudança visível ao usuário.

---

## Phase 3: User Story 1 — Ver as atividades em aberto e onde faltam pessoas (Priority: P1) 🎯 MVP

**Goal**: tela `/voluntariado/atividades-abertas` acessível a voluntário e staff, com cartões, turnos, vagas e estado
textual, sem nomes de participantes.

**Independent Test**: com V1 (voluntário aprovado), abrir pelo menu e ver só atividades `aberta` com turnos não
terminados, cada turno com horário, "X de Y vagas preenchidas" e selo de estado. U1 (usuário comum) é barrado por URL
e não vê o item (quickstart passos 1–3, 11).

### Implementation for User Story 1

- [X] T017 [P] [US1] Em `src/shared/auth/rotas.ts`, adicionar a regra `{ prefixo: '/voluntariado/atividades-abertas', roles: ['voluntario', 'membro_defesa_civil', 'coordenador', 'administrador'] }` na seção "Área do voluntário". Adicionar casos em `src/shared/auth/rotas.test.ts`: `usuario` → negado; sem sessão (`role` indefinido) → negado (SC-005); os 4 roles → permitido.
- [X] T018 [P] [US1] Em `src/shared/ui/shell/icones.ts`, registrar o ícone `CalendarPlus` (lucide).
- [X] T019 [US1] Em `src/shared/auth/navegacao.ts`, adicionar o item `{ href: '/voluntariado/atividades-abertas', rotulo: 'Atividades abertas', icone: 'CalendarPlus', grupo: 'voluntariado', roles: ['voluntario', ...STAFF], atalho: { descricao: 'Encontre turnos com vagas e inscreva-se.' } }` imediatamente antes de "Minhas atividades". Rodar `npm test` para que `src/shared/auth/navegacao.test.ts` confirme a consistência com T017 (depende de T017 e T018).
- [X] T020 [P] [US1] Em `src/modules/voluntariado/presentation/queries/atividades.ts`, adicionar `listarAtividadesAbertas(): Promise<AtividadeAberta[]>`:
  - cache com `'use cache'`, `cacheTag(CACHE_TAGS.atividades)` e `cacheLife(CACHE_LIFE.curto)`;
  - atividades com `status = 'aberta'` e turnos com `fim > now()`, em 2 queries sem N+1: cabeçalhos com categoria, depois turnos com `CONFIRMADOS_NO_TURNO`;
  - datas serializadas em ISO;
  - **sem nomes** de participantes;
  - tipo `AtividadeAberta` conforme [data-model § Read models](data-model.md#read-models-presentationqueries).
- [X] T021 [P] [US1] No mesmo arquivo `src/modules/voluntariado/presentation/queries/atividades.ts`, adicionar `listarMeusTurnosConfirmados(userId): Promise<MeuTurnoConfirmado[]>` **sem cache**: `turnoId`, `alocacaoId`, `atividadeId`, `inicio` e `fim` das alocações `confirmado` em que `participanteUserId = userId`. Também adicionar `obterElegibilidade(userId, role)`, que usa `buscarMinhaCandidatura` + `podeSeInscrever` e devolve `{ elegivel: boolean, motivo?: string }`. Esta tarefa é sequencial a T020 por ser no mesmo arquivo.
- [X] T022 [US1] Criar `app/(interno)/voluntariado/atividades-abertas/page.tsx` (Server Component):
  - `metadata.title = 'Atividades abertas — SOS Jaraguá'`, `export const instant = false`;
  - `exigirRoles([...])` com os 4 roles;
  - cabeçalho conforme U-01.5;
  - `Suspense` com `SkeletonLista`;
  - o componente interno combina `listarAtividadesAbertas()` + `listarMeusTurnosConfirmados()` + `obterElegibilidade()` e calcula `estadoDoTurno(..., agora)` por turno no servidor;
  - descarta turnos com `fim <= agora`, descarta atividades sem turnos e ordena pelo turno mais próximo (FR-007);
  - envia ao cliente uma estrutura já com `estado`, `podeDesistir` (via `validarDesistencia`) e `alocacaoId` do próprio usuário.

  Depende de T007, T020 e T021.
- [X] T023 [US1] Criar `app/(interno)/voluntariado/atividades-abertas/lista-atividades-abertas.tsx` (Client Component) conforme U-01.6–U-01.13, U-01.22 e U-01.23:
  - **topo**: `Alert` de inelegibilidade com link para `/voluntariado/candidatura`;
  - **cartão por atividade**: título, `Badge` da categoria e `MapPin` + local;
  - **turnos**: agrupados por dia ("Seg, 06/10"), cada um com horário, `Progress` com `aria-valuetext` e o texto "X de Y vagas preenchidas";
  - **selo de estado** com texto: "Vagas abertas", "Últimas vagas", "Lotado", "Em andamento" ou "Você está inscrito";
  - **estado vazio**: "Não há atividades abertas no momento.";
  - **layout**: 1 coluna no celular e 2 a partir de `lg`, com alvos de toque ≥ 44px.

  Nesta fase, os botões de ação ainda não aparecem (depende de T022).

**Checkpoint**: US1 funcional e testável sozinha (quickstart 1–3, 11).

---

## Phase 4: User Story 2 — Inscrever-se em um turno de uma atividade (Priority: P1) 🎯 MVP

**Goal**: botão "Quero participar" com confirmação, que cria uma alocação `confirmado` de origem `inscricao_propria`
sem nunca exceder as vagas, e notifica o participante (`atividade_atribuida`) e o criador da atividade
(`inscricao_turno`).

**Independent Test**: V1 se inscreve em um turno com vaga, vê "Você está inscrito", recebe a notificação, o turno
aparece em "Minhas atividades" e no painel da gestão. Concorrência na última vaga: exatamente uma inscrição entra
(quickstart 4–7, 9, 10, 16 e a seção de concorrência).

### Tests for User Story 2 ⚠️

- [X] T024 [P] [US2] Escrever os testes que falham em `src/modules/voluntariado/application/use-cases/inscricao-turno.test.ts` para `InscreverEmTurnoUseCase`, com repositórios e notificação falsos:
  - `voluntario` sem perfil aprovado → `nao_elegivel`, sem chamar `inscreverComTrava`;
  - `coordenador` sem perfil → chama `inscreverComTrava` com `voluntarioPerfilId: null`;
  - `voluntario` aprovado → passa o `voluntarioPerfilId`;
  - cada `motivo` do repositório é traduzido para o `ValidacaoError` com o código certo;
  - em caso de sucesso, envia `atividade_atribuida` ao participante e `inscricao_turno` a `atividade.criadoPor`, com o texto do contrato I-01.6;
  - a auditoria é chamada com `origem: 'inscricao_propria'`;
  - uma falha da notificação não transforma o sucesso em erro.
- [X] T025 [P] [US2] Escrever os testes em `src/modules/voluntariado/application/use-cases/inscricao-turno.integracao.test.ts` (Neon real):
  - (a) 5 usuários elegíveis distintos chamam a inscrição em paralelo (`Promise.all`) em um turno de 1 vaga → exatamente 1 `confirmado` e 4 `lotado`;
  - (b) a mesma pessoa chama 2× em paralelo → 1 linha, e a outra chamada recebe `ja_inscrito`;
  - (c) depois da migração, toda linha de `alocacao` com `voluntario_perfil_id` tem `participante_user_id` igual ao `user_id` do perfil;
  - (d) inscrição em um turno sobreposto → `conflito_horario`;
  - (e) turnos encostados → ambos aceitos.
  - (f) a mesma pessoa chama 2× em paralelo, em dois turnos **diferentes** e sobrepostos → 1 confirmada e a outra recebe `conflito_horario`.

### Implementation for User Story 2

- [X] T026 [US2] Criar `InscreverEmTurnoUseCase` em `src/modules/voluntariado/application/use-cases/inscricao-turno.ts`:
  - **entrada**: `{ turnoId, participanteUserId, role, agora }`;
  - buscar o perfil com `voluntarios.buscarPorUserId` e verificar `podeSeInscrever`;
  - chamar `inscreverComTrava` dentro de `withAudit({ entidade: 'Atividade', acao: 'create', tabela: 'alocacao', … })`;
  - mapear os motivos de recusa para `ValidacaoError`/`NaoEncontradoError`, com `codigo` igual ao motivo e a mensagem pt-BR do domínio;
  - enviar as duas notificações, isolando falhas com try/catch e log estruturado.

  Rodar T024 até passar (depende de T007, T009, T010 e T024).
- [X] T027 [US2] Criar a action `inscreverEmTurno` em `src/modules/voluntariado/presentation/actions/inscricao-turno.ts` (`'use server'`) conforme o contrato I-01:
  - `ROLES_INSCRICAO = ['voluntario', 'membro_defesa_civil', 'coordenador', 'administrador']`;
  - fazer o parse com Zod de `{ atividadeId: z.uuid(), turnoId: z.uuid() }`;
  - o participante e o role vêm de `obterSessao()`, nunca da entrada;
  - executar dentro de `comAtorDaSessao`, com `agora = new Date()`;
  - em caso de sucesso, `updateTag(CACHE_TAGS.atividades)` e `updateTag(tagAtividade(atividadeId))`;
  - retornar `serializar(resultado)`.

  Depende de T026.
- [X] T028 [US2] Em `app/(interno)/voluntariado/atividades-abertas/lista-atividades-abertas.tsx`, adicionar o botão "Quero participar" nos estados `com_vagas`/`ultimas_vagas` quando a pessoa for elegível, conforme U-01.9, U-01.14 e U-01.16–U-01.18:
  - abrir um `Dialog` com atividade, local, data e horário, e os botões "Confirmar inscrição" e "Cancelar";
  - usar `useTransition`, que desabilita os botões durante a ação;
  - **sucesso**: `avisar` de sucesso, fechar o diálogo e chamar `router.refresh()`;
  - **erro de negócio**: toast com a mensagem do servidor, fechar o diálogo e chamar `refresh`;
  - **exceção de rede**: toast "Não foi possível concluir. Verifique sua conexão e tente novamente." com o diálogo aberto.

  Depende de T027.
- [X] T029 [US2] Rodar `npm test` e `npm run test:integracao` até T024 e T025 passarem. Validar os passos 4–7, 9, 10 e 16 do quickstart.

**Checkpoint**: MVP completo (US1 + US2). Voluntários e equipe interna descobrem turnos e se inscrevem sozinhos.

---

## Phase 5: User Story 3 — Desistir de um turno em que se inscreveu (Priority: P2)

**Goal**: o participante desiste de um turno (de qualquer origem) até 30 minutos antes do início. Depois desse prazo, a
tela orienta a falar com a coordenação.

**Independent Test**: inscrito em um turno futuro, desistir e confirmar que a vaga volta e o turno some de "Minhas
atividades". Com ≤ 30 min para o início, o botão some e aparece a orientação (quickstart 8 e 12).

### Tests for User Story 3 ⚠️

- [X] T030 [P] [US3] Adicionar a `src/modules/voluntariado/application/use-cases/inscricao-turno.test.ts` os testes que falham para `DesistirDeTurnoUseCase`:
  - alocação inexistente ou de outra pessoa → `nao_encontrado` (mesma mensagem nos dois casos);
  - alocação `cancelado` → `nao_encontrado`;
  - dentro do prazo de 30 min → `prazo_desistencia`, sem chamar `cancelarAlocacao`;
  - alocação de origem `gestao` → permitida;
  - em caso de sucesso, chama `cancelarAlocacao`, a auditoria registra `acao: 'update'` com `dadosAnteriores`/`dadosNovos`, e envia `inscricao_turno` ao criador ("… desistiu do turno …") e **nada** ao participante.

### Implementation for User Story 3

- [X] T031 [US3] Implementar `DesistirDeTurnoUseCase` em `src/modules/voluntariado/application/use-cases/inscricao-turno.ts`:
  - **entrada**: `{ alocacaoId, participanteUserId, agora }`;
  - chamar `buscarAlocacaoDoParticipante`, depois `validarDesistencia` e depois `cancelarAlocacao` dentro de `withAudit`;
  - enviar a notificação ao criador da atividade.

  Depende de T030.
- [X] T032 [US3] Adicionar a action `desistirDeTurno` em `src/modules/voluntariado/presentation/actions/inscricao-turno.ts` conforme o contrato I-02:
  - fazer o parse com Zod de `{ atividadeId, alocacaoId }`;
  - mesma autorização de T027;
  - mesma invalidação de cache de T027.

  Depende de T031.
- [X] T033 [US3] Em `app/(interno)/voluntariado/atividades-abertas/lista-atividades-abertas.tsx`, no estado `inscrito`:
  - com `podeDesistir`, mostrar o botão secundário "Desistir", que abre um `Dialog` com os dados do turno, o aviso "A vaga será liberada para outra pessoa." e os botões "Confirmar desistência" e "Cancelar". O tratamento de sucesso e erro é o mesmo de T028;
  - sem `podeDesistir`, mostrar o texto "Para desistir, fale com a coordenação".

  Depende de T032.
- [X] T034 [US3] Rodar `npm test` e validar os passos 8 e 12 do quickstart.

**Checkpoint**: US1–US3 funcionando, e vagas não ficam presas.

---

## Phase 6: User Story 4 — Gestão é avisada e continua alocando, agora também pelo membro da Defesa Civil (Priority: P2)

**Goal**: o membro da Defesa Civil passa a alocar e remover voluntários pelo painel (FR-019a). O painel mostra o ícone
de papel (FR-024/025) e o selo "Inscrição própria" (FR-020). A notificação ao criador já existe desde US2/US3.

**Independent Test**: M1 aloca e remove no painel sem ver os controles de gestão da atividade. C1 continua podendo
exceder vagas. Participantes da equipe interna aparecem com ícone e dica do papel (quickstart 6, 10, 13 e 14).

### Implementation for User Story 4

- [X] T035 [P] [US4] Criar `src/shared/ui/icone-papel/icone-papel.tsx` conforme U-03:
  - `IconePapel({ role }: { role: Role })` retorna `null` para `usuario`/`voluntario`;
  - mapeamento `membro_defesa_civil` → `Shield`, `coordenador` → `ClipboardCheck`, `administrador` → `ShieldCheck`;
  - 16px, `text-primary`, `role="img"`, `aria-label={ROTULO_ROLE[role]}`, envolvido em `Tooltip` com o mesmo rótulo.

  Exportar em `src/shared/ui/index.ts`, se o padrão do arquivo for exportar componentes.
- [X] T036 [P] [US4] Em `src/modules/voluntariado/presentation/actions/atividades.ts`, substituir `ROLES_GESTAO` por:
  - `ROLES_GESTAO_ATIVIDADE = ['coordenador', 'administrador']`, usado em `criarAtividade`, `editarAtividade` e `alterarStatusAtividade`;
  - `ROLES_ESCALA = ['membro_defesa_civil', 'coordenador', 'administrador']`, usado em `alocarVoluntario` e `cancelarAlocacao`.

  Separar `exigirGestao` em duas funções e atualizar as mensagens de recusa da escala para "Você não tem permissão para alterar a escala.". Atualizar o comentário do topo, que hoje diz que o membro não cria escala.
- [X] T037 [US4] Em `app/(interno)/(staff)/atividades/page.tsx`, ler a sessão (`obterSessao`) e passar `podeGerirAtividade = role ∈ ['coordenador', 'administrador']` para o componente de gestão. Em `app/(interno)/(staff)/atividades/gestao-atividades.tsx`, quando `podeGerirAtividade = false`, ocultar o botão/formulário de criar atividade e os controles de alterar status, mantendo a listagem e o link para o painel de cada atividade.
- [X] T038 [US4] Em `app/(interno)/(staff)/atividades/[id]/painel-escala.tsx`, renderizar `<IconePapel role={a.role} />` ao lado do nome de cada alocado e o `Badge` neutro "Inscrição própria" quando `a.origem === 'inscricao_propria'`. Os botões "Alocar" e "Remover" continuam visíveis para os três papéis de staff (depende de T035).
- [ ] T039 [US4] Validar os passos 6, 10, 13, 14 e 17 do quickstart: auditoria com o ator e `origem`.

**Checkpoint**: US1–US4 funcionando, e a gestão tem visibilidade completa sobre a escala.

---

## Phase 7: User Story 5 — Filtrar a lista para achar o turno certo (Priority: P3)

**Goal**: filtros por categoria, dia e "Somente com vagas", aplicados no cliente.

**Independent Test**: com atividades de categorias e dias diferentes, cada filtro reduz a lista corretamente. "Limpar
filtros" restaura a lista (quickstart 15).

### Implementation for User Story 5

- [X] T040 [P] [US5] Criar a função pura `filtrarAtividadesAbertas(atividades, { categoriaId?, dia?, somenteComVagas })` em `src/modules/voluntariado/presentation/filtros-atividades-abertas.ts`, conforme U-01.21:
  - com "Somente com vagas", oculta os turnos `lotado` e `em_andamento`, mas mantém os turnos `inscrito`;
  - remove as atividades que ficarem sem turnos.

  Escrever os testes em `src/modules/voluntariado/presentation/filtros-atividades-abertas.test.ts`, coberto pelo `include: ['src/**/*.test.ts']` do `vitest.config.ts`.
- [X] T041 [US5] Em `app/(interno)/voluntariado/atividades-abertas/lista-atividades-abertas.tsx`, adicionar a barra de filtros conforme U-01.19, U-01.20 e U-01.12:
  - `Select` de categoria e de dia, montados a partir dos dados presentes;
  - `Switch` "Somente com vagas";
  - estado local, aplicado com `filtrarAtividadesAbertas` (importada de `@/src/modules/voluntariado/presentation/filtros-atividades-abertas`);
  - mensagem "Nenhuma atividade corresponde aos filtros." com o botão "Limpar filtros".

  Depende de T040.

**Checkpoint**: todas as user stories funcionando.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T042 [P] Atualizar `spec/REQUISITOS_NEGOCIO.md` §3.3 e `spec/DB_SCHEMA.md` §5:
  - BR-VOL-05 passa a mencionar a inscrição própria e o membro da Defesa Civil;
  - `alocacao` documenta `participante_user_id`, `origem` e a nova unicidade;
  - `spec/DESIGN.md` §12 recebe o evento `inscricao_turno`.
- [ ] T043 [P] Revisar a cópia pt-BR e o tema claro/escuro em `app/(interno)/voluntariado/atividades-abertas/lista-atividades-abertas.tsx` e `src/shared/ui/icone-papel/icone-papel.tsx`: contraste dos selos de estado e dos ícones nos dois temas.
- [ ] T044 Rodar a validação completa: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run test:integracao` e o roteiro inteiro de [quickstart.md](quickstart.md), incluindo a medição de SC-004 (lista em ≤ 2s com throttling "Fast 4G" no DevTools).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: imediato.
- **Foundational (Phase 2)**: depende do Setup e **bloqueia todas** as stories. Ordem interna:
  - T002/T003 → T004;
  - T006 → T007;
  - T008 → T010/T011;
  - T012 → T014;
  - T016 por último.
- **US1 (Phase 3)**: depende da Phase 2.
- **US2 (Phase 4)**: depende da Phase 2 e da página de US1 (T022/T023), onde o botão é colocado. Os casos de uso e a action (T024–T027) podem começar em paralelo com US1.
- **US3 (Phase 5)**: depende de US2 (mesmo arquivo de caso de uso e de action, e precisa de alguém inscrito para testar).
- **US4 (Phase 6)**: depende só da Phase 2. T035 e T036 podem começar logo após o Foundational, em paralelo com US1/US2.
- **US5 (Phase 7)**: depende de US1 (T023).
- **Polish (Phase 8)**: depois das stories desejadas.

### User Story Dependencies

```text
Foundational ──┬──▶ US1 ──▶ US2 ──▶ US3
               │      └──────────▶ US5
               └──▶ US4 (independente)
```

### Within Each User Story

- Testes (T006, T024, T025, T030, T040) escritos antes e falhando.
- domain → application (use case) → presentation (action) → UI.

### Parallel Opportunities

- **Phase 2**: T003, T005, T006 e T009 em paralelo depois de T002. T012 e T013 em paralelo depois de T010.
- **Phase 3**: T017, T018 e T020 em paralelo.
- **Phase 4**: T024 e T025 em paralelo.
- **Phase 6**: T035 e T036 em paralelo, e podem rodar enquanto US1/US2 avançam.
- **Phase 8**: T042 e T043 em paralelo.

---

## Parallel Example: User Story 2

```bash
# Testes primeiro, juntos:
Task: "T024 testes unitários de InscreverEmTurnoUseCase em src/modules/voluntariado/application/use-cases/inscricao-turno.test.ts"
Task: "T025 testes de integração (concorrência/reinscrição/backfill) em src/modules/voluntariado/application/use-cases/inscricao-turno.integracao.test.ts"

# Em paralelo com US2, outra frente pode tocar US4:
Task: "T035 IconePapel em src/shared/ui/icone-papel/icone-papel.tsx"
Task: "T036 ROLES_GESTAO_ATIVIDADE × ROLES_ESCALA em src/modules/voluntariado/presentation/actions/atividades.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 e Phase 2. Validar T016: nada muda para o usuário.
2. Phase 3 (US1): a vitrine fica visível.
3. Phase 4 (US2): a inscrição funciona.
4. **PARAR e VALIDAR** os passos 1–7, 9–11 e 16 do quickstart, além do teste de concorrência.
5. Deploy do MVP.

### Incremental Delivery

1. MVP (US1 + US2).
2. US3, a desistência, que evita vagas presas.
3. US4, com a permissão do membro da Defesa Civil, o ícone de papel e o selo de origem.
4. US5, os filtros.

Cada incremento é implantável sozinho. A Phase 2 já é implantável por si só, porque não muda nada visível.

---

## Notes

- [P] = arquivo diferente e sem dependência pendente.
- Toda listagem de participantes de atividade, existente ou futura, MUST usar `IconePapel` ao lado do nome (FR-024). Ao criar uma nova listagem, incluir o ícone no mesmo PR.
- Mensagens e códigos de erro vêm de [data-model § Regras](data-model.md#regras-de-validação-domaininscricaots). Não redigir textos novos nas actions.
- Commits em Conventional Commits, por exemplo:
  - `feat(voluntariado): inscrição própria em turno`;
  - `refactor(voluntariado): alocacao por participante_user_id`.
- A migração de T004 é a única etapa de risco operacional: revisar o SQL antes de `db:migrate` e aplicar primeiro em uma branch Neon.
