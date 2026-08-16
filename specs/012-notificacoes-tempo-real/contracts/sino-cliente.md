# Contrato — Sino no cliente

**Feature**: `012-notificacoes-tempo-real` | Cobre FR-001 a FR-004, FR-006 a FR-009, FR-012 a FR-016

## C-10 — Hook `useNotificacoes`

Em `src/modules/notificacoes/presentation/client/use-notificacoes.ts`.

**Entrada** (a semente vinda do Server Component):

```
{ notificacoes: NotificacaoInApp[], naoLidas: number }
```

**Saída**:

```
{
  notificacoes: NotificacaoInApp[]
  naoLidas: number
  marcarUma(id: string): void
  marcarTodas(): void
  processando: boolean
}
```

O componente do sino MUST NOT conter política de intervalo, backoff ou otimismo — tudo isso vive
no hook, para que o componente permaneça apresentação.

## C-11 — Configuração da query

| Opção | Valor | Requisito |
| --- | --- | --- |
| `queryKey` | `chaveNotificacoes()` do factory compartilhado | research.md D12 |
| `initialData` | a semente recebida por prop | FR-012 (sem waterfall na abertura) |
| `initialDataUpdatedAt` | instante do render do servidor | D5 — sem isso o primeiro refetch atrasa um ciclo inteiro |
| `refetchInterval` | função — ver C-12 | FR-001, FR-009 |
| `refetchIntervalInBackground` | **não definir** (padrão `false`) | FR-007 |
| `refetchOnWindowFocus` | `'always'` | FR-004, SC-002 |
| `staleTime` | menor que o intervalo | evita que o ciclo devolva dado do cache sem ir ao servidor |

**`refetchIntervalInBackground` fica de fora deliberadamente.** O padrão é `false`
(`@tanstack/query-core/build/modern/_tsup-dts-rollup.d.ts:1676-1680`) e o runtime gateia o ciclo
em `focusManager.isFocused()` (`queryObserver.js:215`), que por sua vez observa
`visibilitychange` e considera visível quando `document.visibilityState !== 'hidden'`
(`focusManager.js:12,59`) — exatamente a semântica de FR-007. **Não adicionar listener próprio de
visibilidade**: seria código redundante que dá a impressão de que a lib não cobre o caso.

**`refetchOnWindowFocus: 'always'` e não `true`**: o provider global define `false`
(`src/shared/query/query-provider.tsx:33`) com justificativa registrada para listagens; o sino
inverte essa premissa. `true` só refaz se o dado estiver stale, e o usuário voltando à aba dentro
do `staleTime` veria o contador velho — falhando SC-002.

## C-12 — Política de intervalo

Função pura, testável isoladamente, aplicada em `refetchInterval`:

| Situação | Retorno |
| --- | --- |
| Última resposta foi `401` | `false` — para em definitivo (FR-010) |
| Sem falhas | `30_000` (FR-001, SC-001) |
| N falhas consecutivas | intervalo crescente até um teto (FR-009) |
| Após uma resposta bem-sucedida | volta a `30_000` |

A distinção entre `401` e falha de rede é obrigatória: `401` **para**, falha de rede **espaça**.
Tratar os dois igual deixa o usuário sem atualização depois de um túnel, ou martelando um endpoint
que já o rejeitou (data-model.md R4).

`retry` MUST ser `false` para `401`, sobrescrevendo o `retry: 1` global do provider — repetir um
401 é garantidamente inútil.

## C-13 — Mutações de leitura

`marcarUma` e `marcarTodas` chamam as Server Actions **existentes** (`marcarComoLida`,
`marcarTodasComoLidas`), que não mudam. O que muda é a reação da interface.

**Sequência obrigatória** (data-model.md R2):

1. `cancelQueries` na chave do sino
2. snapshot do cache
3. `setQueryData` aplicando a leitura e ajustando o contador
4. executar a Server Action
5. em erro: restaurar o snapshot
6. em `onSettled`: `invalidateQueries` na chave

**O passo 1 é o requisito, não uma otimização.** Sem `cancelQueries`, um ciclo periódico
disparado antes da marcação retorna depois dela e regrava o estado antigo — o item volta a
aparecer como não-lido (FR-016).

**`router.refresh()` MUST ser removido** do fluxo de leitura
(`app/(interno)/sino-notificacoes.tsx:45-49`): re-renderizar a rota inteira no servidor para
atualizar um contador é desproporcional, e agora é redundante com a invalidação do passo 6.

## C-14 — Componente do sino

**Props**: continua recebendo `{ notificacoes, naoLidas }` do Server Component — mesma forma de
hoje. A diferença é o papel: agora são semente, não a única fonte.

**Invariantes de interface**:

- Itens novos entram no topo sem fechar o `Drawer` nem alterar a posição de rolagem (FR-003).
- Nenhum erro técnico é exibido quando um ciclo falha (FR-013) — a lista simplesmente continua
  mostrando o último estado bom.
- Nenhum indicador de carregamento pisca a cada ciclo: atualização de fundo é silenciosa. Só a
  ação do usuário (marcar como lida) mostra estado de processamento.
- Textos, cores por evento e rótulos permanecem exatamente os atuais (FR-018).

## C-15 — Semente no servidor

`app/_shell/shell-autenticado.tsx` continua resolvendo lista e contador com `Promise.all` e
passando ao sino. **Não muda** de forma; muda só o significado documentado das props.

O shell vive no layout da área autenticada, dentro do `QueryProvider`
(`app/(interno)/layout.tsx`) — nenhuma remontagem de provider é necessária.
