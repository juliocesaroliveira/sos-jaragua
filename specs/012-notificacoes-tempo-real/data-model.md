# Data Model — Notificações que chegam sozinhas à tela

**Feature**: `012-notificacoes-tempo-real` | **Data**: 2026-08-16

## Alteração de esquema

**Nenhuma.** Esta feature não cria, altera nem remove tabela, coluna, índice ou enum. Não há
migração a gerar nem a aplicar.

O motivo é estrutural: a atualização automática é uma **releitura da mesma tela**, não um envio
novo. Nada é registrado por ciclo de atualização — nem em `notificacao`, nem em
`notificacao_envio`. O canal de entrega continua sendo o que já era (`plataforma`), gravado no
momento em que a notificação foi criada pelo fluxo de negócio.

### Tabelas lidas (inalteradas)

| Tabela | Uso nesta feature |
| --- | --- |
| `notificacao` | Lida a cada ciclo: as 30 mais recentes do destinatário, e a contagem de não-lidas |
| `notificacao_envio` | **Não tocada** — a releitura não é um envio |
| `user` | Somente via sessão, para identificar o destinatário |

### Índices que sustentam a carga periódica

Ambos já existem em `db/schema/notificacoes.ts` e passam a ser exercitados com frequência muito
maior do que antes:

- `notificacao_destinatario_lida_idx` em `(destinatarioUserId, lida)` — serve o contador de
  não-lidas.
- A listagem filtra por `destinatarioUserId` e ordena por `criadoEm desc` com `limit 30`.

Se a carga periódica revelar pressão na listagem, o próximo passo é um índice composto
`(destinatarioUserId, criadoEm desc)` — **não** trocar de arquitetura. Registrado aqui como
resposta antecipada, não como trabalho desta feature.

## Formas de dado

### Resposta da leitura periódica

Uma única resposta carrega os dois valores, para que nunca divirjam entre si (research.md D4):

```
{
  notificacoes: NotificacaoInApp[]   // até 30, mais recentes primeiro
  naoLidas: number                   // conta TODAS as não-lidas, não só as 30
}
```

`NotificacaoInApp` já existe em
`src/modules/notificacoes/presentation/queries/notificacoes.ts:7-14` e **não muda**:
`{ id, tipo, titulo, mensagem, lida, criadoEm }`. `criadoEm` é ISO string gerada no servidor —
a ordenação nunca depende do relógio do cliente (edge case da spec).

**Nada além disso trafega** (FR-021). Em particular, a resposta não inclui `contexto` bruto além
do que a tela já exibe hoje, nem qualquer dado de outros usuários.

### Estado no cliente

| Elemento | Valor |
| --- | --- |
| Chave de cache | `chaveNotificacoes()` — fixa, **sem** `userId` (research.md D12) |
| Semente | `initialData` vindo do Server Component, com `initialDataUpdatedAt` |
| Intervalo | 30 000 ms com a aba visível; suspenso quando oculta (padrão da lib) |
| Ao recuperar foco | reconsulta imediata, mesmo com dado fresco |

A chave não carrega o `userId` de propósito: o destinatário é decidido no servidor pela sessão.
Colocá-lo na chave sugeriria que o cliente escolhe de quem são as notificações, o que é
exatamente o que FR-005 proíbe.

## Regras de estado

### R1 — Substituição, nunca acumulação

Cada ciclo devolve a lista completa das 30 mais recentes e **substitui** o conteúdo do cache. Não
há concatenação, não há merge incremental.

É o que torna FR-014 e SC-007 (nenhuma duplicata) verdadeiros por construção, sem código de
deduplicação (research.md D9).

### R2 — Marcar como lida é otimista, com cancelamento

Sequência obrigatória ao marcar uma ou todas como lidas:

1. **Cancelar** consultas em voo para a chave do sino
2. **Snapshot** do estado atual do cache
3. **Aplicar** localmente: item(ns) marcado(s) como lido(s), contador decrementado
4. Executar a Server Action existente
5. **Em erro**: restaurar o snapshot
6. **Ao final** (sucesso ou erro): invalidar a chave para reconciliar com o banco

O passo 1 é o que implementa FR-016. Sem ele, um `refetch` periódico disparado **antes** da
marcação pode retornar **depois** dela e regravar o estado antigo — o item volta a aparecer como
não-lido sob o dedo do usuário. Com intervalo de 30s e ações a qualquer instante, essa janela de
sobreposição existe permanentemente.

O passo 6 é o que garante FR-017: o banco continua sendo a fonte de verdade, e o otimismo é
sempre reconciliado.

### R3 — Fim de sessão encerra o ciclo

Resposta `401` do endpoint → sem retry, sem novo agendamento. A query para em definitivo naquela
aba (FR-010).

Cobre logout, expiração por inatividade (regra já existente para `coordenador` e
`membro_defesa_civil`) e desativação da conta — os três chegam ao cliente pelo mesmo `401`,
porque `obterSessao()` já trata os três como "sem sessão"
(`src/shared/auth/sessao.ts:44-54`).

### R4 — Falhas espaçam, não param

Falhas de rede (diferente de `401`) aumentam o intervalo progressivamente até um teto, e o
intervalo volta ao normal na primeira consulta bem-sucedida (FR-009).

Distinção importante: `401` **para**; falha de rede **espaça**. Tratar os dois igual deixaria o
usuário sem atualização depois de um túnel, ou martelando um endpoint que já o rejeitou.

### R5 — Coerência entre abas

Não há canal entre abas. Cada aba visível reconsulta no seu próprio ciclo, e converge em até 30
segundos (FR-006, SC-006). Abas ocultas não consultam e se corrigem ao voltarem a ficar visíveis
(FR-004, SC-002).

Um canal de mensagens entre abas resolveria isso instantaneamente, e foi descartado: acrescenta
mecanismo para ganhar segundos num limite que a spec já aceita (Princípio VI).

## Impacto em tipos existentes

| Tipo / símbolo | Arquivo | Mudança |
| --- | --- | --- |
| `NotificacaoInApp` | `notificacoes/presentation/queries/notificacoes.ts` | **inalterado** |
| `chaveNotificacoes` | `src/shared/query/chaves.ts` | **novo** |
| `SinoNotificacoes` props | `app/(interno)/sino-notificacoes.tsx` | passam a ser semente (`initialData`), mesma forma |
| `marcarComoLida` / `marcarTodasComoLidas` | `notificacoes/presentation/actions/notificacoes.ts` | **inalteradas** — muda só quem as chama e como reage |
| Esquema Drizzle | `db/schema/notificacoes.ts` | **inalterado** |
