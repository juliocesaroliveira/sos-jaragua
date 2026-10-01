# Data Model: Inscrição Voluntária em Atividades

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Só `alocacao` e o enum de notificações mudam fisicamente. `atividade`, `turno` e `voluntario_perfil` são lidos,
não alterados.

## Alterações de schema (uma migração)

### `alocacao` (db/schema/voluntariado.ts)

| Coluna | Antes | Depois | Notas |
| --- | --- | --- | --- |
| `participante_user_id` | — | `text NOT NULL → user.id ON DELETE CASCADE` | **Nova.** Identidade do participante (D1). Backfill de `voluntario_perfil.user_id`. |
| `voluntario_perfil_id` | `uuid NOT NULL → voluntario_perfil.id` | `uuid NULL → voluntario_perfil.id` | Preenchido quando o participante tem perfil. |
| `origem` | — | `origem_alocacao NOT NULL DEFAULT 'gestao'` | **Nova** (D2). |
| `status`, `alocado_por`, `lembrete_enviado_em`, `criado_em` | — | inalteradas | `alocado_por` = o próprio participante na inscrição própria. |

Índices:

| Antes | Depois |
| --- | --- |
| `alocacao_turno_voluntario_idx` UNIQUE `(turno_id, voluntario_perfil_id)` | **removido** |
| — | `alocacao_turno_participante_idx` UNIQUE `(turno_id, participante_user_id)` |
| `alocacao_voluntario_idx` `(voluntario_perfil_id)` | mantido |
| — | `alocacao_participante_idx` `(participante_user_id)` — "Minhas atividades", sobreposição, cron |

Novo enum: `origem_alocacao = ('gestao', 'inscricao_propria')`.

Relations: `alocacaoRelations` ganha `participante: one(user, …)`; `perfil` passa a ser opcional.

### `tipo_notificacao` (db/schema/notificacoes.ts)

`ALTER TYPE tipo_notificacao ADD VALUE 'inscricao_turno'` — espelhado em `EVENTOS_NOTIFICACAO`. **Não** entra em
`EVENTOS_COM_EMAIL` (D6).

### Ordem da migração

1. `CREATE TYPE origem_alocacao …`; `ALTER TYPE tipo_notificacao ADD VALUE 'inscricao_turno'`
2. `ADD COLUMN participante_user_id text` (anulável), `ADD COLUMN origem … DEFAULT 'gestao' NOT NULL`
3. Backfill `participante_user_id` a partir de `voluntario_perfil.user_id`
4. `ALTER COLUMN participante_user_id SET NOT NULL` + FK
5. `DROP INDEX alocacao_turno_voluntario_idx`; `CREATE UNIQUE INDEX alocacao_turno_participante_idx`;
   `CREATE INDEX alocacao_participante_idx`
6. `ALTER COLUMN voluntario_perfil_id DROP NOT NULL`

Gerada com `npm run db:generate` e **revisada à mão** para inserir o passo 3 entre 2 e 4 (o Drizzle Kit não gera
backfill).

## Entidades de domínio / ports

### `Atividade` (port, `application/ports/atividade-repository.ts`)

Ganha `criadoPor: string` (destinatário da notificação `inscricao_turno`).

### `Turno` (port) — inalterado

`id, atividadeId, inicio, fim, vagas`.

### `Alocacao` (conceito)

| Campo | Regra |
| --- | --- |
| `turnoId` | turno de atividade `aberta` |
| `participanteUserId` | único por turno entre linhas (confirmadas ou canceladas — a cancelada é reativada) |
| `voluntarioPerfilId?` | presente se o participante tem perfil |
| `origem` | `gestao` \| `inscricao_propria` |
| `status` | `confirmado` \| `cancelado` |

**Transições de estado**

```text
             inscrever (própria) / alocar (gestão)
  (nenhuma) ───────────────────────────────────────▶ confirmado
                                                       │   ▲
       desistir (próprio, até 30 min antes) /          │   │ inscrever de novo (com vaga) /
       cancelar (gestão, a qualquer momento)           ▼   │ alocar de novo
                                                    cancelado
```

A reativação reaproveita a mesma linha (upsert), atualizando `origem`, `alocado_por` e zerando
`lembrete_enviado_em`.

## Regras de validação (domain/inscricao.ts)

| Regra | Origem | Mensagem (pt-BR) |
| --- | --- | --- |
| Papel staff **ou** perfil `aprovado` | FR-011 | "Para participar de turnos é preciso ter o cadastro de voluntário aprovado." |
| Atividade `aberta` | FR-014 | "Esta atividade não está mais aberta para inscrições." |
| `agora < turno.inicio` | FR-014 | "Este turno já começou." |
| `confirmados < vagas` (só inscrição própria) | FR-014/015 | "Este turno acabou de ficar lotado." |
| Sem linha confirmada do mesmo participante no turno | FR-014 | "Você já está inscrito neste turno." |
| Sem turno confirmado sobreposto (`[inicio, fim)`) | FR-014 | "Você já está escalado em outro turno neste horário: {atividade}, {hh:mm}–{hh:mm}." |
| Desistência: `agora ≤ inicio − 30 min` | FR-017/018a | "Faltam menos de 30 minutos para o turno. Para desistir, fale com a coordenação." |
| Desistência: alocação pertence ao ator | FR-017 | "Alocação não encontrada." |

## Estado do turno para a UI (`estadoDoTurno`)

Precedência (primeira que casar): `inscrito` → `em_andamento` (`inicio ≤ agora < fim`) → `lotado`
(`preenchidas ≥ vagas`) → `ultimas_vagas` (restantes ≤ `max(1, ceil(vagas × 0,2))`) → `com_vagas`.

## Read models (presentation/queries)

### `AtividadeAberta` (cacheada, igual para todos — sem nomes de participantes)

```text
{ id, titulo, categoriaId, categoria, local,
  turnos: [{ id, inicio (ISO), fim (ISO), vagas, preenchidas }] }   // só turnos com fim > agora
```

Ordenação: pelo `inicio` do primeiro turno não iniciado (ou em andamento) — FR-007.

### `MeuTurnoConfirmado` (não cacheada)

```text
{ turnoId, alocacaoId, atividadeId, inicio, fim }
```

### `AlocadoNoTurno` (painel de escala — alterado)

```text
{ alocacaoId, participanteUserId, voluntarioPerfilId | null,
  nome  // coalesce(perfil.nome_completo, user.name)
  role, origem }
```
