# Research: Inscrição Voluntária em Atividades

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-09-30

Cada decisão abaixo resolve um ponto que a spec deixou para o design ou que o código atual torna não óbvio.
Formato: Decisão / Racional / Alternativas consideradas.

---

## D1 — Identidade do participante na alocação

**Contexto**: `alocacao.voluntario_perfil_id` é `NOT NULL` e o índice único é `(turno_id, voluntario_perfil_id)`.
A Clarificação 3 permite que membro da Defesa Civil, coordenador e administrador se inscrevam **sem** perfil de
voluntário — hoje não há como representá-los na escala.

**Decisão**: adicionar `alocacao.participante_user_id text NOT NULL → user.id` como identidade do participante;
tornar `voluntario_perfil_id` **anulável** (preenchido quando a pessoa tem perfil, para manter o vínculo com
habilidades/triagem); trocar o índice único para `(turno_id, participante_user_id)`.

Migração em um único arquivo, na ordem: adicionar coluna anulável → backfill
`UPDATE alocacao a SET participante_user_id = vp.user_id FROM voluntario_perfil vp WHERE vp.id = a.voluntario_perfil_id`
→ `SET NOT NULL` → drop `alocacao_turno_voluntario_idx` → create `alocacao_turno_participante_idx` →
`voluntario_perfil_id DROP NOT NULL` → índice `alocacao_participante_idx`.

**Racional**:

- `user.id` é a identidade comum a **todos** os papéis; notificações, sessão e auditoria já falam `userId`.
  Usá-la elimina o join `alocacao → voluntario_perfil → user` que hoje existe só para chegar ao `userId`
  (cron de lembrete, destinatários, "Minhas atividades").
- Uma pessoa interna que **também** tem perfil aprovado continua sendo uma única linha por turno (edge case
  "tratado como uma única pessoa") — a unicidade é por usuário, não por perfil.
- Backfill é determinístico (1:1 `voluntario_perfil.user_id`), sem dado ambíguo.

**Alternativas consideradas**:

- *Criar um perfil de voluntário "técnico" para a equipe interna*: rejeitado — `voluntario_perfil` exige `cpf`,
  `telefone`, `data_nascimento` etc. (`NOT NULL`); inventar dados viola a natureza do cadastro e polui triagem e
  relatórios.
- *Duas colunas anuláveis (`perfil_id` OU `user_id`) com `CHECK` de exclusividade*: rejeitado — toda leitura
  precisaria de `coalesce`/dois joins e a unicidade por pessoa ficaria impossível de expressar em um índice.
- *Trocar `voluntario_perfil_id` por `user_id` (remover a coluna)*: rejeitado por ora — o painel e a convocação
  continuam selecionando por perfil; manter a coluna anulável custa nada e evita reescrever esses fluxos.

---

## D2 — Origem da alocação

**Decisão**: novo enum `origem_alocacao` (`'gestao' | 'inscricao_propria'`) e coluna `alocacao.origem NOT NULL
DEFAULT 'gestao'` (linhas existentes ficam corretamente como `gestao`). O upsert que reativa uma alocação
cancelada também atualiza `origem`.

**Racional**: FR-020 exige identificar a origem no painel. Derivar de `alocado_por = participante_user_id` falharia
no caso de um coordenador com perfil que se aloca pelo painel, e é frágil diante do upsert que reescreve
`alocado_por`. Um enum explícito é a forma mais barata de tornar o dado verdadeiro.

**Alternativas**: booleano `inscricao_propria` — equivalente, mas o enum deixa espaço para uma terceira origem
(ex.: convocação) sem nova migração de tipo de coluna.

---

## D3 — Garantia de vagas sob concorrência (FR-015, SC-003)

**Decisão**: a inscrição própria roda em **uma transação interativa** (`db.transaction`, driver
`neon-serverless` com `Pool` já usado em `estoque-repository.ts`) que:

1. `SELECT pg_advisory_xact_lock(hashtext($participanteUserId))` — serializa as inscrições **da mesma pessoa**
   (duas abas em turnos diferentes e sobrepostos); liberado no fim da transação;
2. `SELECT … FROM turno WHERE id = $1 FOR UPDATE` — serializa as inscrições **no mesmo turno** (última vaga);
3. lê o status da atividade, conta confirmados do turno e verifica sobreposição de horário do participante;
4. faz o upsert da alocação (`ON CONFLICT (turno_id, participante_user_id) DO UPDATE … WHERE status = 'cancelado'`).

As regras (lotado, sobreposição, prazo) são avaliadas por funções puras do `domain/` sobre os dados lidos
dentro da transação; o repositório devolve um resultado discriminado (`ok | nao_encontrado | atividade_fechada |
turno_iniciado | lotado | ja_inscrito | conflito_horario`, como no contrato I-01.4).

**Racional**: o `FOR UPDATE` serializa apenas inscrições **no mesmo turno** — exatamente o ponto de disputa da
última vaga — sem bloquear o resto do sistema. A alocação manual da gestão continua fora desse caminho e pode
exceder vagas (FR-019), como hoje.

**Alternativas consideradas**:

- *`INSERT … SELECT … WHERE (count) < vagas`* em um único statement: sob `READ COMMITTED` duas transações
  concorrentes podem ambas ver `count = vagas - 1` — não garante SC-003.
- *Isolamento `SERIALIZABLE` com retry*: correto, mas exige laço de retry e tratamento de `40001` sem ganho sobre
  o lock de linha.
- *`CHECK`/trigger no banco*: tira a regra do `domain/` (Princípio I) e perde a mensagem específica.

**Ordem dos locks**: sempre usuário → turno, então não há deadlock entre eles. O lock consultivo custa uma chamada
na mesma transação e elimina a corrida de turnos sobrepostos da mesma pessoa, mantendo FR-014 verdadeira sem exceção.

---

## D4 — Regras de tempo e estado do turno no `domain/`

**Decisão**: novo arquivo `src/modules/voluntariado/domain/inscricao.ts` com funções puras, todas recebendo
`agora: Date` por parâmetro (sem `new Date()` interno, testáveis sem fake timers):

- `PRAZO_DESISTENCIA_MINUTOS = 30`
- `podeSeInscrever({ role, statusPerfil })` — staff OU perfil `aprovado` (FR-011).
- `validarInscricao({ turno, atividadeStatus, confirmados, jaInscrito, turnosDoParticipante, agora })` →
  `Result` com o motivo específico (FR-014).
- `validarDesistencia({ turno, agora })` — recusa quando `agora > inicio - 30min` (FR-017/FR-018a).
- `turnosSobrepoem(a, b)` — intervalos semiabertos `[inicio, fim)`; turnos encostados (08–12 e 12–16) **não**
  conflitam.
- `estadoDoTurno({ vagas, preenchidas, inicio, fim, inscrito, agora })` →
  `'inscrito' | 'em_andamento' | 'lotado' | 'ultimas_vagas' | 'com_vagas'` (FR-006; "últimas vagas" =
  restantes ≤ 20% das vagas, arredondado para cima, mínimo 1).

**Racional**: as regras do FR-006/014/017 são exatamente o que o Princípio III quer sob TDD; isolá-las permite
cobrir todas as bordas (exatamente 30 min, turno encostado, vagas = 1) em milissegundos. A mesma função
`estadoDoTurno` é usada no servidor para montar a tela, garantindo que UI e regra não divirjam.

Comparações são entre instantes (`Date`), então fuso horário não interfere; formatação segue
`America/Sao_Paulo` como o restante do módulo.

---

## D5 — Casos de uso e elegibilidade

**Decisão**: `application/use-cases/inscricao-turno.ts` com `InscreverEmTurnoUseCase` e
`DesistirDeTurnoUseCase`. Entrada carrega `participanteUserId` e `role` vindos **da sessão** (nunca do cliente).
O caso de uso busca o perfil pelo `userId` (novo `VoluntarioRepository.buscarPorUserId`) para decidir
elegibilidade e preencher `voluntarioPerfilId` quando existir.

Desistência: recusa se a alocação não pertencer ao participante (`participante_user_id ≠ ator`) — vale para
alocações de origem `gestao` também (US3 cenário 3).

O `AlocarVoluntarioUseCase` existente passa a gravar `participanteUserId = perfil.userId` e `origem = 'gestao'`;
regras inalteradas (pode exceder vagas).

---

## D6 — Notificações

**Decisão**:

- Participante, ao se inscrever: `atividade_atribuida` (mesmo texto/evento da alocação manual — FR-021; e-mail
  incluído como hoje). O lembrete de turno vem do cron existente, que passa a ler `participante_user_id`.
- Criador da atividade, em inscrição e desistência: **novo evento** `inscricao_turno` (adicionado ao enum
  `tipo_notificacao` e a `EVENTOS_NOTIFICACAO`), **somente plataforma** — não entra em `EVENTOS_COM_EMAIL`
  (Assumption da spec: sem e-mail para a gestão).
- Desistência não notifica o próprio participante (ele acabou de agir e recebe o toast).
- Para isso o port `Atividade` passa a expor `criadoPor`.

**Racional**: reaproveitar `alteracao_atividade` para a gestão dispararia e-mail (está em `EVENTOS_COM_EMAIL`) e
misturaria semânticas no sino. `ALTER TYPE … ADD VALUE` é uma migração trivial.

**Borda aceita**: o lembrete vem do cron **diário** (09:00, turnos das próximas 26h). Quem se inscreve depois da
execução do dia em um turno que começa antes da próxima execução não recebe lembrete — mas acabou de receber
`atividade_atribuida`.

---

## D7 — Rota, acesso e navegação

**Decisão**: rota `/voluntariado/atividades-abertas` em `app/(interno)/voluntariado/atividades-abertas/`
(fora de `(staff)`, pois voluntário acessa). Nova entrada em `REGRAS_DE_ROTA` com
`['voluntario', 'membro_defesa_civil', 'coordenador', 'administrador']`, antes de qualquer regra mais genérica;
a página revalida com `exigirRoles(...)` (Princípio IV). Item de menu "Atividades abertas", grupo
`voluntariado`, ícone `CalendarPlus` (registrado em `src/shared/ui/shell/icones.ts`), mesmos roles — travado por
`navegacao.test.ts` (INV-01). Inclui `atalho` para aparecer nos cards da home (é tela de operação de campo).

---

## D8 — Leitura da tela e cache

**Decisão**: duas leituras combinadas no Server Component:

1. `listarAtividadesAbertas()` — **cacheada** (`'use cache'`, `cacheTag(CACHE_TAGS.atividades)`,
   `cacheLife(CACHE_LIFE.curto)`): atividades `aberta` com turnos de `fim > now()`, turnos e contagem de
   confirmados. É igual para todos os usuários — sem nomes (Clarificação 4 / FR-010a).
2. `listarMeusTurnosConfirmados(userId)` — **não cacheada** (depende da sessão, DESIGN.md §7): `turnoId`s e
   `alocacaoId`s confirmados do participante.

O estado de cada turno é calculado no servidor com `estadoDoTurno(..., agora)` e o resultado vai serializado ao
cliente. Turnos terminados entre o cache e a renderização são filtrados de novo com o `agora` da requisição.
Inscrição/desistência invalidam com `updateTag(CACHE_TAGS.atividades)` + `updateTag(tagAtividade(id))`.

**Filtros (US5)** — categoria, dia, "somente com vagas" — rodam **no cliente** sobre a lista já carregada.

**Racional**: o volume é limitado por natureza (atividades abertas com turnos futuros: dezenas), cabe em uma
resposta e torna os filtros instantâneos em conexão móvel ruim. A regra "TanStack Table com paginação
server-side" da constituição mira listagens tabulares de crescimento ilimitado (usuários, estoque); ver
Complexity Tracking no plano.

---

## D9 — Permissão de escala para membro da Defesa Civil (FR-019a)

**Decisão**: em `presentation/actions/atividades.ts`, separar `ROLES_GESTAO` em:

- `ROLES_GESTAO_ATIVIDADE = ['coordenador', 'administrador']` — `criarAtividade`, `editarAtividade`,
  `alterarStatusAtividade` (inalterado);
- `ROLES_ESCALA = ['membro_defesa_civil', 'coordenador', 'administrador']` — `alocarVoluntario`,
  `cancelarAlocacao`.

A tela `/atividades` (`page.tsx` → `gestao-atividades.tsx`) recebe a flag `podeGerirAtividade` para esconder
"Nova atividade" e o menu de status de quem não pode (a autorização real continua na action). O painel de escala
não tem esses controles e não precisa da flag.

---

## D10 — Ícone de papel (FR-024/FR-025)

**Decisão**: componente compartilhado `src/shared/ui/icone-papel/icone-papel.tsx` — recebe `role`, renderiza
`null` para `usuario`/`voluntario` e, para os demais, um ícone lucide com `Tooltip` e `aria-label` igual a
`ROTULO_ROLE[role]`:

| Papel | Ícone |
| --- | --- |
| `membro_defesa_civil` | `Shield` |
| `coordenador` | `ClipboardCheck` |
| `administrador` | `ShieldCheck` |

`buscarAtividadeDetalhada` passa a trazer `role` (join `user`) e `origem` de cada alocado; o nome exibido é
`coalesce(voluntario_perfil.nome_completo, user.name)`. Ícone também aparece ao lado de um selo textual
"Inscrição própria" para FR-020.

**Racional**: componente compartilhado porque FR-024 exige o ícone em "demais listagens de participantes
existentes ou futuras" — centralizar o mapeamento evita divergência.

---

## D11 — Estratégia de testes

- **Unitário (TDD)**: `domain/inscricao.test.ts` (todas as bordas de D4) e `inscricao-turno.test.ts` com
  repositórios falsos (elegibilidade por role/perfil, posse da alocação na desistência, notificações corretas).
- **Integração** (`npm run test:integracao`, Neon real): (a) N inscrições concorrentes na última vaga → exatamente
  uma confirmada; (b) reinscrição após desistência reativa a mesma linha; (c) migração/backfill: alocações
  existentes têm `participante_user_id` = `user_id` do perfil.
- **Navegação**: `navegacao.test.ts` já cobre consistência menu × rotas.
- **Interface**: roteiro manual em [quickstart.md](quickstart.md).
