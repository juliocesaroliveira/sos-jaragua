# Implementation Plan: Inscrição Voluntária em Atividades

**Branch**: `018-inscricao-atividades` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/018-inscricao-atividades/spec.md`

## Summary

Nova tela `/voluntariado/atividades-abertas` para voluntário, membro da Defesa Civil, coordenador e
administrador. Ela mostra em cartões as atividades `aberta` com turnos futuros, as vagas e um estado textual por
turno. Pela tela, a própria pessoa se inscreve em um turno com um clique e confirmação, e pode desistir até 30
minutos antes do início. A alocação manual da gestão continua como está e passa a valer também para o membro da
Defesa Civil. O painel de escala ganha ícone de papel para a equipe interna e um selo para inscrições próprias.

Três decisões tornam a spec verdadeira e não apenas plausível:

1. **O participante da alocação passa a ser o `user`, não o `voluntario_perfil`** (research D1). Sem essa troca,
   não há como colocar na escala um coordenador sem cadastro de voluntário (Clarificação 3). A troca é feita com
   uma coluna nova `participante_user_id` (com backfill), o `voluntario_perfil_id` passa a ser anulável e o
   índice único passa a ser por pessoa.
2. **A vaga é garantida por `SELECT … FOR UPDATE` no turno, dentro de uma transação, precedido de um lock
   consultivo por usuário** (research D3). Sem isso, duas pessoas disputando a última vaga entram as duas (SC-003
   falha) e a mesma pessoa em duas abas entra em turnos sobrepostos (FR-014 falha).
3. **As regras de tempo e de estado ficam em funções puras no `domain/`** com `agora` injetado (research D4):
   prazo de 30 minutos, sobreposição, "últimas vagas" e precedência de estados. A mesma função alimenta a UI e
   valida a escrita.

O resto aplica a arquitetura já existente: casos de uso auditados, Server Actions finas, query cacheada para o
dado comum e query sem cache para o dado da sessão.

## Technical Context

**Language/Version**: TypeScript 5.9 (estrito), React 19.1, Next.js 16.3 (App Router, Turbopack, Cache Components).

**Primary Dependencies**:

- drizzle-orm 0.45 sobre Neon (`neon-serverless` Pool, com transações interativas)
- @tanstack/react-query 5.101
- @ark-ui/react 5.38 (Dialog, Select, Switch, Tooltip, Progress já existem em `src/shared/ui`)
- Tailwind CSS v4
- lucide-react
- zod 4 (`zod-ptbr`)

**Nenhuma dependência nova.**

**Storage**: Neon Postgres. Uma migração:

- `alocacao` ganha `participante_user_id` (com backfill) e `origem`.
- `voluntario_perfil_id` passa a ser anulável.
- O índice único é trocado de `(turno, perfil)` para `(turno, participante)`.
- Novo enum `origem_alocacao`.
- O enum `tipo_notificacao` ganha o valor `inscricao_turno`.

Ver [data-model.md](data-model.md). A auditoria continua no MongoDB via `withAudit`.

**Testing**: Vitest 4.1.

- `npm test`: `domain/inscricao.test.ts` e os casos de uso com repositórios falsos.
- `npm run test:integracao`: concorrência na última vaga, reinscrição e backfill.
- `navegacao.test.ts`: consistência entre menu e rotas.
- UI: roteiro manual em [quickstart.md](quickstart.md).

**Target Platform**: web responsivo mobile-first, claro/escuro, pt-BR.

**Project Type**: monolito modular Next.js. Telas em `app/`, domínio em `src/modules/voluntariado/`,
compartilhado em `src/shared/`.

**Performance Goals**:

- Lista pronta em ≤ 2s em rede móvel (SC-004).
- Leitura principal cacheada e compartilhada entre usuários (`'use cache'` + `cacheTag(atividades)`), sem N+1:
  são 2 queries, uma de atividades com turnos e contagens e outra dos turnos do usuário.
- Inscrição em ≤ 1 round-trip de transação.

**Constraints**:

- Vagas nunca são excedidas por inscrição própria (SC-003). A gestão pode exceder (FR-019).
- O participante sempre vem da sessão, nunca do cliente.
- Autorização é revalidada em cada action (Princípio IV).
- Toda escrita passa por `withAudit` (Princípio V).
- Nenhum nome de participante aparece na tela "Atividades abertas" (FR-010a).

**Scale/Scope**: dezenas de atividades abertas e centenas de turnos futuros no pico de uma crise.

- 1 rota nova, 1 migração, ~8 arquivos novos.
- ~10 arquivos alterados: schema, repositório, queries, actions, painel, cron de lembrete, rotas, navegação,
  ícones e notificações.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio | Situação | Como o plano atende |
| --- | --- | --- |
| I. Clean Architecture por Módulo | ⚠️ Passa com exceção | Tudo fica no módulo `voluntariado`, dono de `alocacao`/`turno`. As regras são puras em `domain/inscricao.ts`, sem Drizzle nem Next. Os casos de uso usam os ports `AtividadeRepository` e `VoluntarioRepository`. As notificações passam pelo port `NotificacaoService` de `notificacoes`. As actions fazem parse, sessão, um caso de uso e invalidação de cache. O acesso a `user` (dono: Identidade) é **somente leitura** e fica restrito a `presentation/queries` e ao repositório Drizzle de `voluntariado`, apenas para colunas de exibição (`name`, `role`). Escrita em `user` nunca acontece fora de Identidade. Ver Complexity Tracking. |
| II. Tipagem Estrita e Qualidade | ✅ Passa | Não há `any`. Os códigos de erro formam uma união discriminada. A UI é toda em pt-BR. A linguagem ubíqua é preservada e explicitada: "Candidatura" continua sendo a triagem, e a ação nova se chama **inscrição em turno** (spec, Terminologia). |
| III. Testes Focados em Regras de Negócio | ✅ Passa | TDD em `domain/inscricao.ts` e nos dois casos de uso novos. A integração cobre só o que exige banco real: o lock de vaga, o upsert de reativação e o backfill. |
| IV. Segurança e Defesa em Profundidade | ✅ Passa | Rota nova em `REGRAS_DE_ROTA` → `proxy.ts` → `exigirRoles` na página → checagem em cada action. O participante é derivado da sessão. A desistência verifica a posse da alocação e não revela se a alocação existe. A rota fica fora de `(staff)`, como `/voluntariado/minhas-atividades`, porque o voluntário acessa. |
| V. Auditoria Não Bloqueante | ✅ Passa | Inscrição, desistência e as actions de escala usam `withAudit` com o ator via `comAtorDaSessao`. A degradação graciosa é herdada. Falha de notificação não desfaz a inscrição. |
| VI. Simplicidade Operacional | ✅ Passa, com uma justificativa | Não há dependência nem serviço novo. Concorrência resolvida com lock consultivo por participante + `FOR UPDATE` no turno, sem `SERIALIZABLE` nem laço de retry (D3). Os filtros rodam no cliente. **Desvio:** a tela não usa TanStack Table com paginação server-side. Ver Complexity Tracking. |

**Re-check pós-design (Phase 1)**: nenhuma violação nova. O data-model mantém `voluntario_perfil_id`, evitando
reescrever a convocação e a seleção do painel. Os contratos mantêm a regra de negócio fora das actions.

## Project Structure

### Documentation (this feature)

```text
specs/018-inscricao-atividades/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── acoes-inscricao.md
│   └── ui-atividades-abertas.md
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks
```

### Source Code (repository root)

```text
db/
├── schema/voluntariado.ts            # ALTERADO: alocacao (+participante_user_id, +origem, perfil anulável, índices), enum origem_alocacao
├── schema/notificacoes.ts            # ALTERADO: tipo_notificacao += 'inscricao_turno'
└── migrations/0004_*.sql             # NOVO (gerado + backfill manual)

src/modules/voluntariado/
├── domain/
│   ├── inscricao.ts                  # NOVO: elegibilidade, validarInscricao, validarDesistencia, turnosSobrepoem, estadoDoTurno
│   └── inscricao.test.ts             # NOVO (TDD)
├── application/
│   ├── ports/atividade-repository.ts # ALTERADO: Atividade.criadoPor; inscreverComTrava(); buscarAlocacaoDoParticipante(); alocar() com participante/origem
│   ├── ports/voluntario-repository.ts# ALTERADO: buscarPorUserId()
│   └── use-cases/
│       ├── inscricao-turno.ts        # NOVO: InscreverEmTurnoUseCase, DesistirDeTurnoUseCase
│       ├── inscricao-turno.test.ts   # NOVO
│       ├── inscricao-turno.integracao.test.ts # NOVO: concorrência, reinscrição
│       └── alocar-voluntario.ts      # ALTERADO: participanteUserId + origem 'gestao'; destinatário por participante
├── infrastructure/drizzle/
│   ├── atividade-repository.ts       # ALTERADO: transação FOR UPDATE, upsert por (turno, participante), destinatários via user
│   └── voluntario-repository.ts      # ALTERADO: buscarPorUserId
└── presentation/
    ├── actions/inscricao-turno.ts    # NOVO: inscreverEmTurno, desistirDeTurno
    ├── actions/atividades.ts         # ALTERADO: ROLES_GESTAO_ATIVIDADE × ROLES_ESCALA
    └── queries/atividades.ts         # ALTERADO: listarAtividadesAbertas (cache), listarMeusTurnosConfirmados, AlocadoNoTurno (+role, origem, nome coalesce), listarMinhasAtividades por participante

src/modules/notificacoes/application/ports/notificacao-service.ts  # ALTERADO: EVENTOS_NOTIFICACAO += 'inscricao_turno'

src/shared/
├── auth/rotas.ts                     # ALTERADO: regra /voluntariado/atividades-abertas
├── auth/navegacao.ts                 # ALTERADO: item "Atividades abertas"
├── ui/shell/icones.ts                # ALTERADO: CalendarPlus
└── ui/icone-papel/icone-papel.tsx    # NOVO

app/
├── (interno)/voluntariado/atividades-abertas/
│   ├── page.tsx                      # NOVO (Server Component, exigirRoles, Suspense)
│   └── lista-atividades-abertas.tsx  # NOVO (Client: cartões, filtros, diálogos)
├── (interno)/(staff)/atividades/
│   ├── page.tsx                      # ALTERADO: passa podeGerirAtividade
│   ├── gestao-atividades.tsx         # ALTERADO: oculta "Nova atividade"/status sem podeGerirAtividade
│   └── [id]/painel-escala.tsx             # ALTERADO: IconePapel, selo "Inscrição própria", jaAlocados por participante
└── api/cron/lembrete-turno/route.ts  # ALTERADO: join por participante_user_id → user
```

**Structure Decision**: o monolito modular existente. Domínio e casos de uso ficam em
`src/modules/voluntariado`, a tela na área do voluntário (`app/(interno)/voluntariado/`) e o ícone de papel em
`src/shared/ui`, porque FR-024 o exige em qualquer listagem de participantes.

## Implementation Order (para /speckit-tasks)

1. **Fundação:** migração e schema; ports; `domain/inscricao.ts` com TDD.
2. **Ajuste dos consumidores de `alocacao`** para `participante_user_id`: repositório, queries, cron e
   `AlocarVoluntarioUseCase`. Ao fim deste passo o sistema funciona como antes.
3. **US1 + US2 (P1):** casos de uso e actions de inscrição, query de atividades abertas, página, rota e menu.
4. **US3 (P2):** desistência.
5. **US4 (P2):** `ROLES_ESCALA`, evento `inscricao_turno`, `IconePapel` e painel de escala.
6. **US5 (P3):** filtros no cliente.
7. **Validação:** quickstart, lint, tsc e as duas suítes.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| A tela "Atividades abertas" não usa TanStack Table com paginação server-side, regra da seção "Stack e Convenções Técnicas" | É uma vitrine de cartões agrupados por atividade e dia, não uma tabela. O volume é limitado por natureza (só atividades `aberta` com turnos futuros, na casa das dezenas). Os filtros precisam responder na hora em rede móvel instável. | Paginar no servidor dividiria turnos de uma mesma atividade entre páginas e quebraria a ordenação por turno mais próximo (FR-007). Cada filtro viraria uma requisição, justamente no cenário de conectividade ruim que a constituição manda priorizar. Se o volume crescer, a query já aceita `limit` por janela de datas sem mudar o contrato da UI. |
| Leitura direta da tabela `user` (Identidade) a partir de `voluntariado`: em `buscarAtividadeDetalhada`, nos destinatários de notificação, no cron de lembrete e em `inscreverComTrava` (Princípio I) | `alocacao.participante_user_id` referencia `user` por FK, e o painel precisa de nome e papel de todos os alocados em **uma** consulta | Passar pelo `UsuarioRepository` exigiria uma segunda consulta por lista e a junção em memória. Seria o mesmo dado, com mais latência e mais código, sem nenhum isolamento real, porque a FK já acopla as tabelas. O acesso fica restrito a leitura de `name`/`role`. |
