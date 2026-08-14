# Research: Rodapé de paginação server-side no DataTable

**Feature**: 007-datatable-server-pagination | **Data**: 2026-08-13

Todas as NEEDS CLARIFICATION do Technical Context foram resolvidas aqui.

---

## D1 — Onde o rodapé vive: dentro do `Table` compartilhado

**Decisão**: o rodapé é renderizado pelo próprio `src/shared/ui/table/table.tsx`, ativado por uma prop opcional `paginacao?: { page, pageSize, totalCount, onPageChange, onPageSizeChange }`. Quando ausente, o `Table` renderiza como hoje (usado pela galeria e por tabelas de apoio dentro de dialogs).

**Rationale**: FR-017 exige um componente compartilhado único e FR-016 exige o mesmo rodapé em todas as listagens. Hoje cada tela monta `<Table>` + `<Pagination>` lado a lado e repete a função `navegar()` — três cópias quase idênticas (`tabela-usuarios.tsx`, `tabela-voluntarios.tsx`, `tabela-estoque.tsx`). Acoplar o rodapé ao `Table` remove a chance de uma tela esquecer parte da barra. Prop opcional evita quebrar os call sites sem paginação.

**Alternativas rejeitadas**:

- Componente `TableFooter` separado exportado do barrel: mantém o risco de composição divergente por tela (é o problema atual).
- `Table` sempre paginado: quebraria `painel-relatorios.tsx` (tabelas em abas) e a galeria, e forçaria dados falsos de `totalCount`.

---

## D2 — `Pagination`: evoluir o componente existente, não recriar

**Decisão**: manter `src/shared/ui/pagination/pagination.tsx` sobre `@ark-ui/react/pagination` e ajustá-lo:

1. Remover o early-return `if (totalCount <= pageSize) return null` — FR-007 pede controles **desabilitados**, não ausentes (evita _layout shift_ ao trocar de página/filtro).
2. Reduzir `siblingCount` em telas estreitas via classes utilitárias, mantendo `siblingCount={1}`.
3. Continuar exportado do barrel para uso avulso, mas o consumo normal passa a ser interno ao `Table`.

**Rationale**: o pedido "criar o componente Pagination usando como base o Ark UI" já está atendido pelo componente existente — ele usa `Ark.Root/PrevTrigger/Item/Ellipsis/NextTrigger`, com `ANEL_FOCO` e alvos de 44px. Recriar violaria o Princípio VI (simplicidade) e o barrel do design system (`src/shared/ui/index.ts`) que proíbe importar `@ark-ui/react` fora de `shared/ui`.

**Alternativas rejeitadas**: novo componente `PaginationBar` paralelo — duplicaria acessibilidade e estilos já resolvidos.

---

## D3 — Fonte de dados: Server Function (`'use server'`) envolvendo a query `'use cache'`

**Decisão**: cada listagem ganha uma **server function de leitura** em `presentation/actions/`, ex.:

```
listarUsuariosAction(params) →  [checa sessão/role]  →  listarUsuarios(params)  ['use cache']
```

A server function faz o gate de autorização (lê `cookies`/sessão) e delega para a query `'use cache'` já existente, que permanece pura e cacheável.

**Rationale**:

- `'use cache'` **não pode ler `cookies()`/`headers()`** (doc `use-cache.md`: "read them outside cached scopes and pass values as arguments"). A checagem de sessão precisa acontecer fora do escopo cacheado.
- Server Actions **não herdam** o gate do Server Component (padrão já documentado em `src/modules/identidade/presentation/actions/usuarios.ts`) — Princípio IV, defesa em profundidade. Sem o wrapper, o cliente chamaria a leitura sem role.
- A query `'use cache'` continua reusável pelo RSC no primeiro render (ver D5).

**Alternativas rejeitadas**:

- Route Handlers `GET /api/...`: seriam cacheáveis pelo browser e paralelizáveis, mas a constituição fixa "TanStack Query + Server Actions" (§Stack), e criar uma segunda superfície HTTP para leitura duplicaria o gate de autorização já implementado em Server Actions.
- Chamar a query `'use cache'` direto do cliente: impossível — é `import 'server-only'` e não é uma server function.

**Trade-off aceito e registrado**: Server Actions são POST e o Next as **serializa** (uma por vez por cliente). Para paginação isso é aceitável — há no máximo uma requisição de página em voo por tela. Mitigações: `placeholderData` (D7) e **não** fazer prefetch especulativo da próxima página, que competiria pela fila.

---

## D4 — `QueryClient` provider: hoje inexistente

**Decisão**: criar `src/shared/query/query-provider.tsx` (`'use client'`) com `QueryClient` por request (`useState(() => new QueryClient(...))`) e montá-lo em `app/(interno)/layout.tsx`, não no `app/layout.tsx`.

Defaults: `staleTime: 30_000`, `gcTime: 5min`, `refetchOnWindowFocus: false`, `retry: 1`.

**Rationale**: `@tanstack/react-query@^5.101.4` está em `package.json` mas nenhum `QueryClient` existe no repositório — a implementação atual drifta da constituição (§Stack: "TanStack Query + Server Actions"). Montar em `(interno)` mantém as rotas públicas (`/login`, `/cadastro`) sem o provider e sem o bundle. `staleTime > 0` é o que faz FR-020 (voltar a uma página já visitada sem estado de carregamento vazio) funcionar de fato.

**Alternativas rejeitadas**: provider no root layout — carregaria o client no fluxo público, contra a meta de resposta do Princípio "Fluxo de Desenvolvimento" (<300ms em caminhos críticos).

---

## D5 — Primeira página vem do servidor (`HydrationBoundary`)

**Decisão**: o Server Component da página continua resolvendo a primeira página com a query `'use cache'` e a entrega ao cliente via `dehydrate` + `<HydrationBoundary>`; o componente de tabela usa `useQuery` com a mesma `queryKey`.

**Rationale**: preserva o SSR/streaming atual (`<Suspense fallback={<SkeletonLista/>}>`) e evita um _waterfall_ visível (tela em branco → POST → dados) na abertura de cada listagem. As trocas de página subsequentes vão ao cliente via server function, cumprindo FR-009.

**Alternativas rejeitadas**: `initialData` na `useQuery` — não cobre bem a variação de `queryKey` por filtros; `dehydrate` já resolve genericamente.

---

## D6 — `queryKey` espelha a `cacheTag`

**Decisão**: `queryKey = [...tag.split(':'), { page, pageSize, ...filtros }]`, ex. `['identidade', 'listagem', { page: 2, pageSize: 20 }]`.

**Rationale**: convenção já documentada em `src/shared/cache/tags.ts` ("o `queryKey` do TanStack Query espelha a tag") — esta feature é a primeira a exercê-la. Mutações que hoje chamam `updateTag(CACHE_TAGS.x)` ganham o par `queryClient.invalidateQueries({ queryKey: [...] })` no cliente.

---

## D7 — Estado de carregamento entre páginas

**Decisão**: `placeholderData: keepPreviousData` (import de `@tanstack/react-query`), com `isPlaceholderData` alimentando um estado visual "atualizando" (opacidade + `aria-busy`) em vez do skeleton completo.

**Rationale**: FR-013 exige que a barra de rodapé **não** desapareça durante o carregamento; o skeleton atual do `Table` substitui a tabela inteira e derrubaria o rodapé, causando salto de layout. FR-020 e SC-002 também dependem disso.

**Nota**: cliques rápidos e sucessivos (edge case do spec) são resolvidos pelo próprio TanStack Query — a `queryKey` mais recente é a que renderiza; respostas obsoletas não sobrescrevem.

---

## D8 — Contrato compartilhado de paginação

**Decisão**: criar `src/shared/paginacao/` com:

- `TAMANHOS_PAGINA = [5, 10, 20, 50] as const` e `TAMANHO_PAGINA_PADRAO = 20`
- `esquemaPaginacao` (Zod, via `@/src/shared/validacao/zod-ptbr`) com `catch` para page/pageSize inválidos → FR-012
- `normalizarPaginacao(searchParams)` usada **tanto** no Server Component quanto no wrapper da server function
- tipo `PaginaDe<T> = { rows: T[]; totalCount: number }` (formato que todos os repositórios já devolvem)

**Rationale**: FR-012 e FR-018 precisam do mesmo saneamento nos dois lados da fronteira; hoje cada página repete `Math.max(1, Number(params.page) || 1)` e um `const TAMANHO_PAGINA = 20` local. Zod `.catch()` implementa "aplicar o valor válido mais próximo, sem erro" sem `try/catch` espalhado.

**Clamp de página além do fim** (edge case): resolvido no servidor — se `(page-1)*pageSize >= totalCount && totalCount > 0`, a query refaz na última página válida e devolve a `page` efetiva no retorno.

---

## D9 — Sincronização com a URL

**Decisão**: manter `useRouter` + `useSearchParams` (padrão já usado nas três tabelas), extraído para um hook único `useParametrosListagem(rota)` em `src/shared/paginacao/`. Mudanças usam `router.replace(url, { scroll: false })`.

**Rationale**: FR-011 e FR-019. `replace` em vez de `push` evita encher o histórico com cada clique de página; `scroll: false` mantém o rodapé sob o cursor. Não introduzir `nuqs` — nova dependência que duplica capacidade já coberta (Princípio VI / §Stack).

---

## D10 — Escopo do rollout (FR-016)

Telas que hoje renderizam `<Table>`:

| Tela             | Arquivo                              | Situação                                                                               | Ação                                                                            |
| ---------------- | ------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `/admin`         | `admin/tabela-usuarios.tsx`          | paginada server-side, sem rodapé                                                       | rodapé + TanStack Query (P1)                                                    |
| `/voluntarios`   | `voluntarios/tabela-voluntarios.tsx` | paginada server-side, sem rodapé, com filtros                                          | rodapé + TanStack Query, preservar filtros (FR-019)                             |
| `/estoque`       | `estoque/tabela-estoque.tsx`         | idem, filtro por categoria                                                             | idem                                                                            |
| `/relatorios`    | `relatorios/painel-relatorios.tsx`   | **não paginada** — `inventarioParaExportacao()`/`saidasParaExportacao()` carregam tudo | violação de FR-008; separar leitura de tela (paginada) da leitura de exportação |
| `/design-system` | `design-system/galeria.tsx`          | vitrine                                                                                | atualizar demo do `Table` com rodapé sobre dados fixos                          |

**Decisão para `/relatorios`**: as tabelas de tela passam a consumir `listarEstoque` (já paginada) e uma nova `listarSaidas({page,pageSize})`; as funções `*ParaExportacao` permanecem intactas e exclusivas do Route Handler de download (`<a download>`, DESIGN.md §14), que precisa do conjunto completo por natureza.

**Fora do rollout**: `/atividades`, `/cadastros-pendentes`, `/estoque/kits`, `/crise`, `/dashboard` — não usam `<Table>` (cards, kanban, formulários).

---

## D11 — Acessibilidade e mobile do rodapé

**Decisão**: rodapé em `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`; texto de totais dentro de um `<p aria-live="polite">`; seletor de tamanho reusa o `Select` do barrel com `label` visualmente oculto ("Registros por página"); `Pagination` já traz `aria-label` e `data-[selected]` do Ark.

**Rationale**: FR-015, SC-005, SC-007 (sem rolagem horizontal em 360px) e o requisito de responsividade da constituição (§Fluxo de Desenvolvimento). `aria-live="polite"` anuncia "Exibindo 21–40 de 47" após a troca de página sem roubar foco.
