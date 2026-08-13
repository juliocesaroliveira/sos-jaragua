# Contrato de servidor: leituras paginadas

**Feature**: 007-datatable-server-pagination

Superfície: **Server Functions** (`'use server'`) em `src/modules/<modulo>/presentation/actions/`. Nenhum Route Handler novo é criado.

---

## L-01 — Forma da server function de leitura

```ts
export async function listar<X>Action(entrada: unknown): Promise<ResultadoAction<PaginaDe<Linha<X>>>>
```

- **L-01.1**: recebe `unknown` e valida com Zod (`esquemaPaginacao` + filtros da tela). Entrada inválida é **saneada**, não rejeitada (FR-012) — só dados estruturalmente impossíveis retornam `erroAction('validacao', ...)`.
- **L-01.2**: devolve `ResultadoAction` (`src/shared/kernel`), o mesmo envelope já usado pelas actions de escrita — o cliente não recebe exceções.
- **L-01.3**: retorna `{ rows, totalCount, page, pageSize }` com `page`/`pageSize` **efetivos** após saneamento e clamp (data-model).
- **L-01.4**: `rows.length <= pageSize` sempre. Nenhuma leitura de tela busca o conjunto completo (FR-008, SC-003).

## L-02 — Autorização (Princípio IV)

- **L-02.1**: cada server function revalida sessão e role por conta própria, **independentemente** do gate da página — Server Actions não herdam o gate de um Server Component.
- **L-02.2**: `listarUsuariosAction` exige `administrador` (mesma regra de `REGRAS_DE_ROTA['/admin']`); as demais exigem a role da rota correspondente.
- **L-02.3**: sem permissão → `erroAction('nao_autorizado', ...)` com mensagem pt-BR; nunca dados parciais.
- **L-02.4**: a checagem acontece **fora** do escopo `'use cache'` — funções cacheadas não podem ler `cookies()`/`headers()`. A query cacheada recebe apenas parâmetros serializáveis.

## L-03 — Relação com as queries `'use cache'`

- **L-03.1**: a server function **delega** para a query existente (`listarUsuarios`, `listarVoluntarios`, `listarEstoque`) — não duplica SQL nem acessa repositório de outro módulo (Princípio I).
- **L-03.2**: `pageSize` passa a variar (5/10/20/50) e integra a chave de cache, junto de `page` e dos filtros — entradas distintas por combinação, o que é o comportamento correto de `'use cache'`.
- **L-03.3**: as tags de invalidação permanecem as de `CACHE_TAGS`; nenhuma tag por página é criada.
- **L-03.4**: novidade em Estoque — `listarSaidas({page,pageSize})` (`'use cache'`, tag nova `estoque:saidas`) para a aba de saídas de `/relatorios`. `inventarioParaExportacao()`/`saidasParaExportacao()` **não são alteradas**: continuam servindo exclusivamente ao Route Handler de download, que precisa do conjunto completo por natureza.

## L-04 — Consumo no cliente

- **L-04.1**: `useQuery` com `queryKey` espelhando a `cacheTag` (`['identidade','listagem',{page,pageSize}]`) — convenção de `src/shared/cache/tags.ts`.
- **L-04.2**: `placeholderData: keepPreviousData`; `isPlaceholderData` alimenta a prop `atualizando` do `Table` (FR-013/FR-020).
- **L-04.3**: falha de rede ou `ok: false` → `Alert` com a mensagem pt-BR e botão "Tentar novamente" que chama `refetch()` (FR-014). A tabela nunca fica em carregamento indefinido.
- **L-04.4**: sem prefetch especulativo de páginas adjacentes — Server Actions são serializadas pelo Next e um prefetch competiria com a navegação real do usuário.
- **L-04.5**: mutações que hoje chamam `updateTag(CACHE_TAGS.x)` passam a chamar também `queryClient.invalidateQueries({ queryKey: [...] })`, para que a listagem no cliente reflita a escrita sem `router.refresh()`.

## L-05 — Primeira página (SSR)

- **L-05.1**: o Server Component da rota continua resolvendo a primeira página pela query `'use cache'` e entrega o estado via `dehydrate` + `<HydrationBoundary>`, sob o `<Suspense fallback={<SkeletonLista/>}>` já existente.
- **L-05.2**: a `queryKey` hidratada é **idêntica** à do `useQuery` do cliente — divergência causaria um POST redundante na abertura da tela.
- **L-05.3**: navegações subsequentes (página, `pageSize`, filtros) vão ao servidor pela server function, não por navegação de rota (FR-009).

## L-06 — Erros e limites

| Situação | Comportamento |
|---|---|
| `page` fora do fim após remoção de registros | servidor faz clamp para a última página válida e devolve a `page` efetiva (FR-012) |
| `pageSize` fora de `[5,10,20,50]` | servidor aplica `20` e devolve o valor efetivo (FR-018) |
| `totalCount === 0` | `rows: []`, `page: 1`; a tela mostra o vazio do `Table` e o rodapé com "Nenhum registro" |
| falha no banco | `erroAction` com mensagem pt-BR; sem vazar detalhe de infraestrutura |
| cliques rápidos sucessivos | resolvido no cliente pelo TanStack Query: só a `queryKey` corrente renderiza |
