# Research — Notificações que chegam sozinhas à tela

**Feature**: `012-notificacoes-tempo-real` | **Data**: 2026-08-16

Investigações feitas contra o código e os pacotes **instalados** neste repositório
(`@tanstack/react-query@5.101`, `next@16.3.0`), não contra documentação genérica. Cada decisão
cita o arquivo verificado.

---

## D1 — Reconsulta periódica, não conexão persistente

**Decision**: `useQuery` com `refetchInterval` no componente do sino. Nenhum WebSocket, nenhum
SSE, nenhum serviço externo.

**Rationale**: decisão da spec (Q1 → opção A), fundamentada no Princípio VI. Confirmação de que
não custa dependência nova: `@tanstack/react-query` já está no `package.json` e o
`QueryProvider` já envolve o sino — `app/(interno)/layout.tsx` monta
`<QueryProvider><ShellAutenticado …>`, e o sino é renderizado por dentro
(`app/_shell/shell-autenticado.tsx:39`). O provider foi introduzido pela feature 007 e hoje só
serve listagens paginadas; esta feature é o segundo consumidor.

**Alternatives considered**: SSE por Route Handler (mantém a função aberta, mesmo problema de
custo por tempo ativo que motivou a decisão); WebSocket em Fluid Compute; serviço gerenciado.
Todos rejeitados na spec.

---

## D2 — Suspensão em segundo plano sai de graça

**Decision**: **não** escrever código de `visibilitychange`. O comportamento exigido por FR-007 e
SC-004 já é o padrão do TanStack Query.

**Achado** — `node_modules/@tanstack/query-core/build/modern/_tsup-dts-rollup.d.ts:1676-1680`:

> `refetchIntervalInBackground` — "If set to `true`, the query will continue to refetch while
> their tab/window is in the background. **Defaults to `false`**."

E o gate em tempo de execução, `queryObserver.js:215`:

```js
if (this.options.refetchIntervalInBackground || focusManager.isFocused()) { … }
```

O `focusManager` observa **`visibilitychange`** e considera focado quando
`document.visibilityState !== 'hidden'` (`focusManager.js:12,59`) — exatamente a semântica de
"aba visível" que a spec usa, e não a de "janela com foco de teclado".

**Consequência**: FR-007 é atendido por omissão deliberada. O plano deve registrar isso, senão
alguém adiciona um listener redundante achando que faltava.

---

## D3 — A leitura periódica vai por Route Handler, não por Server Action

**Decision**: expor a leitura do sino como **Route Handler `GET`** em
`app/api/notificacoes/route.ts`. As escritas (marcar como lida) continuam Server Actions.

**Rationale**: este é o achado mais importante da pesquisa. A documentação do Next instalado é
explícita — `node_modules/next/dist/docs/01-app/02-guides/server-actions.md:26-32`:

> "Next.js dispatches Server Actions **one at a time per client**. If a user triggers three
> actions in quick succession, the second waits for the first to finish… A consequence: do not
> rely on `Promise.all` to parallelize Server Actions from the client. If you need parallel work,
> … **use a Route Handler for non-mutation requests**."

Uma reconsulta a cada 30 segundos é exatamente "non-mutation request" recorrente. Se ela fosse
uma Server Action, entraria na mesma fila serializada das ações do usuário: um polling disparado
no instante errado atrasaria o "marcar como lida", o envio de uma candidatura ou o registro de
uma saída de estoque. O próprio repositório já reconheceu esse risco em outra feature —
`src/shared/query/use-listagem-paginada.ts:17-19` documenta que o prefetch de páginas vizinhas
foi descartado porque "Server Actions são POST e o Next as serializa, então um prefetch
especulativo competiria com a navegação real do usuário".

Um `GET` também é semanticamente correto e permite `AbortSignal` do próprio TanStack Query.

**Segurança**: o Route Handler deriva o destinatário de `obterSessao()` no servidor e **nunca**
de parâmetro de query (FR-005). Sem sessão → `401`, sem corpo. É o mesmo padrão de autorização
das Server Actions atuais (`notificacoes.ts:18-19`).

**Alternatives considered**: Server Action de leitura (rejeitada pelo acima); `router.refresh()`
em intervalo (rejeitada — re-renderiza a rota inteira no servidor a cada 30s por usuário, um
custo desproporcional para atualizar um contador, e faria a tela inteira piscar em telas com
Suspense).

---

## D4 — Uma requisição por ciclo, não duas

**Decision**: o Route Handler devolve lista **e** contador na mesma resposta, resolvidos com
`Promise.all` no servidor.

**Rationale**: `listarNotificacoes` e `contarNaoLidas`
(`src/modules/notificacoes/presentation/queries/notificacoes.ts`) são duas consultas distintas, e
o shell já as executa em paralelo hoje (`shell-autenticado.tsx:31`). Mantê-las como dois
endpoints dobraria o número de requisições periódicas por usuário sem ganho algum. Atende FR-011
(consulta leve o bastante para repetir) e mantém contador e lista sempre **coerentes entre si** —
duas chamadas separadas poderiam devolver estados de instantes diferentes, e o contador é
justamente o que a spec exige que não divirja (SC-006).

O contador **não** pode ser derivado do tamanho da lista: a lista é limitada a 30 itens
(`listarNotificacoes(userId, limite = 30)`) e o contador conta todas as não-lidas.

---

## D5 — Semente do servidor via `initialData`

**Decision**: o sino continua recebendo lista e contador por prop do Server Component, e usa
esses valores como `initialData` do `useQuery`, com `initialDataUpdatedAt`.

**Rationale**: sem semente, o cliente abriria o sino vazio e dispararia um `GET` no primeiro
render — um waterfall visível em toda navegação, exatamente o que a feature 007 evitou com
hidratação (`src/shared/query/hidratacao.ts:8-13`).

Preferido a `HydrationBoundary` (o precedente do projeto para listagens) porque aqui a chave é
fixa por usuário e o componente **já recebe os dados por prop**; um `HydrationBoundary` no layout
adicionaria indireção sem resolver nada a mais. É `initialData` e não `placeholderData` porque o
dado é real, veio do banco, e deve ir para o cache.

`initialDataUpdatedAt` é obrigatório: sem ele o TanStack considera a semente recém-obtida e
posterga o primeiro `refetch` por um ciclo inteiro a partir do render do cliente.

---

## D6 — Marcar como lida vira mutação otimista

**Decision**: substituir o par `await marcarComoLida(...)` + `router.refresh()` por `useMutation`
com `onMutate` → `cancelQueries` + `setQueryData` + snapshot, `onError` → rollback, `onSettled` →
`invalidateQueries`.

**Rationale**: é o que implementa FR-016 ("uma atualização que chega durante uma marcação de
leitura em andamento não pode desfazê-la visualmente"). Sem `cancelQueries`, um `refetch`
periódico já em voo — disparado antes da marcação — retorna depois dela e **regrava o estado
antigo** no cache, fazendo o item voltar a aparecer como não-lido. É uma condição de corrida
real, não hipotética: com intervalo de 30s e uma ação do usuário a qualquer instante, a janela de
sobreposição é permanente.

Ganho colateral: hoje `router.refresh()` re-renderiza a rota inteira no servidor só para atualizar
um contador (`app/(interno)/sino-notificacoes.tsx:45-49`). A mutação otimista atualiza o cache
localmente e revalida só o sino.

---

## D7 — Recuo progressivo com `refetchInterval` como função

**Decision**: `refetchInterval` recebe uma função que consulta
`query.state.fetchFailureCount` e devolve um intervalo maior a cada falha consecutiva, até um
teto; volta ao intervalo normal quando uma consulta tem sucesso.

**Rationale**: FR-009 exige espaçamento progressivo. O `retry` do TanStack já faz backoff
**dentro** de uma tentativa, mas o `refetchInterval` continuaria disparando no mesmo ritmo — um
celular sem sinal seguiria tentando a cada 30s indefinidamente, gastando bateria.

A assinatura suporta isso diretamente
(`_tsup-dts-rollup.d.ts:1675`): `refetchInterval?: number | false | ((query) => number | false | undefined)`.

---

## D8 — Fim de sessão encerra a atualização

**Decision**: resposta `401` do Route Handler desliga a query — sem retry e sem novo agendamento
(a função de `refetchInterval` devolve `false`).

**Rationale**: FR-010. Sem isso, uma aba cuja sessão expirou por inatividade (regra já existente
para coordenador e membro da Defesa Civil, `src/shared/auth/inatividade.ts`) continuaria batendo
num endpoint que só devolve 401, a cada 30 segundos, para sempre.

`retry: false` para `401` é necessário porque o padrão global do projeto é `retry: 1`
(`query-provider.tsx:34`) — repetir um 401 é garantidamente inútil.

---

## D9 — Duplicatas são impossíveis por construção

**Decision**: nenhum código de deduplicação.

**Rationale**: FR-014 e SC-007 pedem ausência de duplicatas. O endpoint devolve a **lista
completa** (as 30 mais recentes) a cada ciclo, e o TanStack **substitui** o dado no cache em vez
de concatenar. Não existe caminho pelo qual o mesmo id apareça duas vezes. Registrado aqui para
que ninguém adicione um `dedupeBy` defensivo sem necessidade (Princípio VI).

---

## D10 — Foco: sobrescrever o padrão global do projeto

**Decision**: nesta query, `refetchOnWindowFocus: 'always'`.

**Rationale**: o `QueryProvider` define `refetchOnWindowFocus: false` globalmente, com
justificativa registrada — "listagens operacionais não precisam refazer a busca a cada troca de
janela — em campo isso só gasta rede" (`query-provider.tsx:31-33`). Para o sino essa premissa se
inverte: FR-004 e SC-002 exigem estado correto em menos de 2 segundos ao voltar para a aba.

`'always'` e não `true` porque `true` só refaz se o dado estiver **stale**; voltando para a aba
dentro da janela de `staleTime`, o usuário veria o contador velho. A sobrescrita é local à query,
então não afeta as listagens.

---

## D11 — Intervalo de 30 segundos

**Decision**: 30 000 ms com a aba visível.

**Rationale**: é o teto que SC-001 e SC-006 fixam, e o valor que a própria referência da stack usa
para o caso de notificações. Com centenas de usuários simultâneos em pico (Assumptions da spec),
30s significa poucas requisições por segundo no agregado, cada uma resolvendo duas consultas
indexadas — `notificacao_destinatario_lida_idx` cobre o contador e
`notificacao(destinatarioUserId)` ordenado por `criadoEm` cobre a lista.

Descer para 10s triplicaria a carga para ganhar segundos num aviso que, no caso mais urgente
(`broadcast_urgencia`), já sai por e-mail em paralelo.

---

## D12 — Chave de query no factory existente

**Decision**: acrescentar `chaveNotificacoes()` a `src/shared/query/chaves.ts` e exportá-la pelo
barril `src/shared/query/index.ts`.

**Rationale**: o projeto já centraliza chaves ali (`chaveUsuarios`, `chaveVoluntarios`,
`chaveEstoque`, `chaveSaidas`), e a mutação de leitura precisa invalidar exatamente a mesma
chave que o sino consulta. Chave literal duplicada em dois arquivos é o defeito clássico —
invalidação que não invalida nada, silenciosamente.

A chave **não** inclui o `userId`: o cache do TanStack é por aba e o destinatário vem da sessão
no servidor. Incluir o id na chave daria a falsa impressão de que o cliente escolhe de quem são
as notificações.

---

## D13 — A rota precisa ficar fora do matcher do `proxy.ts` (achado na implementação)

**Decision**: acrescentar `api/notificacoes` à lista de exclusões do matcher em `proxy.ts`, ao
lado de `api/auth`.

**Achado**: o matcher atual exclui apenas `api/auth`, assets e metadata
(`proxy.ts:103`). Toda outra rota — inclusive `/api/*` — passa pelo proxy, que é
*deny-by-default*. Isso quebraria a feature de **duas** formas, e a segunda é uma regressão de
segurança:

1. **O cliente nunca veria o `401`.** Sem cookie de sessão, o proxy responde
   `NextResponse.redirect('/login')` (`proxy.ts:31,73-78`). Um `fetch` segue o 302 por padrão e
   recebe o HTML do login com status `200`. O `queryFn` falharia ao interpretar como JSON, a
   política classificaria como falha de rede e o ciclo **espaçaria em vez de parar** — FR-010 e
   D8 quebrados de forma silenciosa, com a aba consultando para sempre uma sessão morta.

2. **O timeout de inatividade de staff seria anulado.** O passo 5 do proxy renova
   `lastActivityAt` em toda requisição de quem está sujeito ao timeout (`proxy.ts:64-68`). Uma
   consulta automática a cada 30 segundos renovaria esse carimbo indefinidamente, e a sessão de
   um `coordenador` ou `membro_defesa_civil` **nunca expiraria por inatividade** — enquanto a
   aba estivesse aberta, o sistema acharia que a pessoa está ativa. A constituição classifica
   esse timeout como "não é opcional nem contornável por essas roles" (Princípio IV). Atividade
   de fundo não é atividade do usuário.

O segundo ponto é o que torna a exclusão obrigatória e não uma conveniência: sem ela, a feature
introduziria uma falha de segurança invisível, num sistema onde a tela de staff fica aberta
durante turnos longos.

**A autorização não fica mais fraca.** `obterSessao()` é a checagem autoritativa — a mesma usada
por todas as Server Actions — e o Princípio IV posiciona o proxy como "barreira rápida", não
como fonte de verdade. `obterSessao()` também **lê** sem renovar carimbo e já encerra sessões
expiradas por inatividade, então o próprio polling passa a **detectar** a expiração em vez de
mascará-la.

**Alternatives considered**:

- *Deixar no matcher e tratar o redirect no cliente* (`fetch` com `redirect: 'manual'`): resolve
  o problema 1 e **não** resolve o 2, que é o grave.
- *Registrar a rota em `REGRAS_DE_ROTA`*: não ajuda — o mapa decide role **depois** de o proxy já
  ter exigido cookie e renovado o carimbo.

**Observação lateral, fora do escopo**: `/api/cron/lembrete-turno` também está dentro do matcher
e autentica por segredo, sem cookie de sessão — pela leitura do proxy, ele receberia um redirect
para `/login`. Não faz parte desta feature e não foi alterado, mas vale investigação própria.

---

## Riscos residuais

| Risco | Mitigação |
| --- | --- |
| Latência de até 30s é percebida como "não é tempo real" | Explicitado na spec (SC-001) e aceito na decisão Q1. Reduzir o intervalo é uma mudança de uma constante, se necessário. |
| Carga agregada em pico de crise maior que o previsto | Consultas indexadas e uma requisição por ciclo (D4). Se surgir pressão, o próximo passo é subir o intervalo, não trocar de arquitetura. |
| Route Handler novo é superfície de ataque adicional | Deriva o destinatário da sessão, devolve 401 sem corpo, não aceita parâmetro de identificação (FR-005). Sem rota nova em `(staff)`, sem mudança na matriz de roles. |
| Abas em segundo plano num navegador que não dispara `visibilitychange` | Comportamento degrada para "consulta continua"; nenhum erro funcional. Nenhum navegador-alvo atual se comporta assim. |
