# Contrato — Leitura periódica de notificações

**Feature**: `012-notificacoes-tempo-real` | Cobre FR-005, FR-010, FR-011, FR-021

## C-01 — Endpoint

```
GET /api/notificacoes[?versao=<versao>]
```

Route Handler em `app/api/notificacoes/route.ts`.

**Por que Route Handler e não Server Action**: a documentação do Next instalado
(`node_modules/next/dist/docs/01-app/02-guides/server-actions.md:26-32`) determina que Server
Actions são despachadas **uma de cada vez por cliente** e recomenda explicitamente Route Handler
"for non-mutation requests". Uma leitura recorrente a cada 30s dentro daquela fila atrasaria as
ações reais do usuário — marcar como lida, enviar candidatura, registrar saída de estoque.

**Este endpoint é somente leitura.** Nenhuma mutação passa por aqui; as escritas continuam nas
Server Actions existentes.

## C-01a — Fora do matcher do `proxy.ts`

A rota MUST constar na lista de exclusões do matcher em `proxy.ts`, ao lado de `api/auth`.
Removê-la de lá quebra a feature de duas formas (research.md D13):

- o proxy **redireciona** quem não tem sessão, e o `fetch` seguiria o 302 recebendo o HTML do
  login com status 200 — o cliente nunca veria o `401` que o faz parar (FR-010);
- o proxy **renova `lastActivityAt`** a cada requisição de quem está sujeito ao timeout, e uma
  consulta automática a cada 30s anularia o timeout de inatividade de `coordenador` e
  `membro_defesa_civil`, que o Princípio IV declara não contornável.

A autorização não é enfraquecida: `resolverSessao()` é a checagem autoritativa, e o proxy é a
"barreira rápida" por definição da própria constituição. Como o proxy não roda aqui, é o próprio
endpoint que devolve ao navegador os `Set-Cookie` de renovação do cookie cache de sessão emitidos
por `resolverSessao()` — em toda resposta, inclusive `204` e `401`.

## C-02 — Autorização

| Situação | Resposta |
| --- | --- |
| Sessão válida, sem `versao` ou com `versao` diferente da atual | `200` com o corpo de C-03 |
| Sessão válida e `versao` igual à atual | `204`, **sem corpo** (C-03a) |
| Sem sessão, sessão expirada por inatividade, ou conta desativada | `401`, **sem corpo** |

**Invariantes**:

- O destinatário MUST ser derivado de `resolverSessao()` no servidor.
- O endpoint MUST NOT aceitar identificador de usuário por query string, header ou corpo. O único
  parâmetro lido do cliente é `versao`, que só decide entre `200` e `204` — nunca de quem é o dado.
- Os três casos de fim de sessão colapsam no mesmo `401` porque `resolverSessao()`
  (`src/shared/auth/sessao.ts:44-54`) já trata os três como ausência de sessão — o endpoint não
  reimplementa essa regra.

## C-03 — Resposta de sucesso

```json
{
  "notificacoes": [
    {
      "id": "uuid",
      "tipo": "triagem_concluida",
      "titulo": "…",
      "mensagem": "…",
      "lida": false,
      "criadoEm": "2026-08-16T14:31:00.000Z"
    }
  ],
  "naoLidas": 3,
  "versao": "12:3:1786890660000"
}
```

**Invariantes**:

- `notificacoes`: até **30**, mais recentes primeiro, todas do usuário da sessão.
- `naoLidas`: total de não-lidas do usuário — **não** é o tamanho da lista, que é truncada em 30.
- Lista, `naoLidas` e `versao` saem da **mesma consulta** (funções de janela avaliadas antes do
  `LIMIT`), para nunca representarem instantes diferentes (research.md D4).
- `versao`: impressão digital opaca do estado (`total:naoLidas:msDaMaisRecente`). Muda sempre
  que o sino mudaria — notificação nova ou marcação de leitura, inclusive em outra aba.
- `criadoEm` é ISO gerada no servidor; o cliente nunca ordena por relógio local.
- Nenhum campo além dos acima (FR-021).

## C-03a — Sem mudança

Com `?versao=` igual à versão atual do usuário, o endpoint MUST responder `204` sem corpo e MUST
NOT ler a lista: o custo do ciclo é uma única consulta agregada sobre o índice
`notificacao(destinatarioUserId, lida)`. O cliente mantém o que já exibe e trata o `204` como
ciclo bem-sucedido (sem recuo). A otimização existe porque a maioria dos ciclos não encontra
novidade.

## C-04 — Cache

A resposta MUST NOT ser cacheada por navegador, CDN ou pelo cache de dados do framework.

É dado por-usuário derivado de sessão, e o `DESIGN.md §7` do projeto já proíbe cachear dado
derivado de sessão — as queries reusadas por este endpoint carregam essa decisão desde a feature
original de notificações.

## C-05 — Reuso das consultas existentes

O handler MUST chamar `versaoNotificacoes(userId)` e `lerEstadoNotificacoes(userId)` de
`src/modules/notificacoes/presentation/queries/notificacoes.ts`, sem reimplementar as consultas.

`lerEstadoNotificacoes` é exatamente a mesma função que o Server Component do shell usa
(`app/_shell/shell-autenticado.tsx`); duplicar a consulta criaria dois lugares onde o formato
da lista pode divergir do que a semente entrega.

## C-06 — Custo

O handler MUST executar no máximo duas consultas (versão e, se ela mudou, estado) e MUST NOT
executar trabalho adicional
(nenhuma auditoria, nenhum envio, nenhuma escrita). É o caminho mais executado da aplicação depois
que a feature entra: uma vez por usuário conectado a cada 30 segundos.
