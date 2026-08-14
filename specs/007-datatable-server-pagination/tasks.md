---
description: 'Task list for 007-datatable-server-pagination'
---

# Tasks: Rodapé de paginação server-side no DataTable

**Input**: Design documents from `/specs/007-datatable-server-pagination/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: A feature é presentation/UI — não altera `domain/` nem `application/`, então o TDD obrigatório do Princípio III não se aplica. Um único teste unitário é incluído (T005), para o saneamento de parâmetros, que é regra pura.

**Organization**: Tarefas agrupadas por user story. O rodapé como componente (Fase 2) é pré-requisito de todas.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependências pendentes)
- **[Story]**: US1, US2, US3 conforme spec.md
- Caminhos de arquivo são relativos à raiz do repositório

## Path Conventions

Monolito modular Next.js: `app/` (rotas), `src/modules/<contexto>/{domain,application,infrastructure,presentation}`, `src/shared/`. Telas importam UI **sempre** do barrel `@/src/shared/ui`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: contrato único de paginação, consumido pelos dois lados da fronteira servidor ↔ cliente

- [x] T001 [P] Criar `src/shared/paginacao/constantes.ts` com `TAMANHOS_PAGINA = [5, 10, 20, 50] as const` e `TAMANHO_PAGINA_PADRAO = 20`, com JSDoc apontando para FR-004/FR-018
- [x] T002 [P] Criar `src/shared/paginacao/esquema.ts` com `esquemaPaginacao` (Zod de `@/src/shared/validacao/zod-ptbr`, usando `.catch()` para nunca lançar), o tipo `ParametrosPaginacao`, o tipo `PaginaDe<T>` e o helper `clampPagina({ page, pageSize, totalCount })` conforme data-model.md
- [x] T003 Criar `src/shared/paginacao/index.ts` exportando constantes, esquema e tipos (depende de T001, T002)
- [x] T004 [P] Adicionar a tag `estoqueSaidas: 'estoque:saidas'` em `src/shared/cache/tags.ts`, usada pela aba de saídas de `/relatorios` (contrato L-03.4)
- [x] T005 Criar `src/shared/paginacao/esquema.test.ts` (Vitest) cobrindo: `page` ausente/`0`/negativo/`'abc'` → `1`; `pageSize` `7`/ausente/`'abc'` → `20`; `pageSize` `5|10|20|50` preservado; `clampPagina` com `page` além do fim → última página válida; `totalCount === 0` → `page 1` (depende de T002)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: TanStack Query inicializado (hoje ausente no repositório) + o rodapé no `Table` compartilhado

**⚠️ CRITICAL**: nenhuma user story pode começar antes desta fase

### TanStack Query

- [x] T006 [P] Criar `src/shared/query/chaves.ts` com os construtores de `queryKey` espelhando `CACHE_TAGS` (`chaveUsuarios`, `chaveVoluntarios`, `chaveEstoque`, `chaveSaidas`), conforme decisão D6 e a convenção já documentada em `src/shared/cache/tags.ts`
- [x] T007 Criar `src/shared/query/query-provider.tsx` (`'use client'`) com `QueryClient` por request via `useState(() => new QueryClient(...))` e defaults `staleTime: 30_000`, `gcTime: 5 * 60_000`, `refetchOnWindowFocus: false`, `retry: 1` (decisão D4)
- [x] T008 Criar `src/shared/query/index.ts` exportando `QueryProvider` e os construtores de chave (depende de T006, T007)
- [x] T009 Montar `<QueryProvider>` em `app/(interno)/layout.tsx`, envolvendo `<ShellAutenticado>` — não no `app/layout.tsx`, para manter `/login` e `/cadastro` sem o bundle (decisão D4) (depende de T008)

### Design system

- [x] T010 Ajustar `src/shared/ui/pagination/pagination.tsx`: remover o early-return `if (totalCount <= pageSize) return null` para que os triggers fiquem desabilitados e visíveis com uma única página, preservando `PaginationProps`, `size-11` e `ANEL_FOCO` (contrato U-03)
- [x] T011 Criar `src/shared/ui/table/table-footer.tsx` com a barra de rodapé: totais em `<p aria-live="polite">` (`Exibindo {primeiro}–{ultimo} de {total} registros` / `Nenhum registro`), indicador `Página {page} de {totalPaginas}`, `Select` de registros por página com rótulo acessível oculto, e o `Pagination`; layout `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between` (contratos U-02, U-04; decisão D11) (depende de T001, T010)
- [x] T012 Alterar `src/shared/ui/table/table.tsx` para aceitar as props opcionais `paginacao?: PaginacaoTabela` e `atualizando?: boolean`: renderizar `TableFooter` quando `paginacao` estiver presente (inclusive com `totalCount === 0` e com uma única página), e aplicar atenuação + `aria-busy` sem desmontar o rodapé quando `atualizando` (contrato U-01) (depende de T011)
- [x] T013 Exportar `PaginacaoTabela` e `TableProps` atualizados em `src/shared/ui/index.ts` (depende de T012)
- [x] T014 Atualizar a demo do `Table` em `app/(interno)/design-system/galeria.tsx` (linhas ~254) para usar a prop `paginacao` em vez do `<Pagination>` avulso, mantendo uma segunda tabela **sem** a prop para comprovar U-01.1 (depende de T013)

**Checkpoint**: `/design-system` mostra o rodapé completo sobre dados fixos; nenhuma tela de produção mudou ainda

---

## Phase 3: User Story 1 - Rodapé de paginação em `/admin` (Priority: P1) 🎯 MVP

**Goal**: `/admin` exibe totais, página atual e controles de navegação, com cada página buscada no servidor via TanStack Query + server function.

**Independent Test**: com 47 contas, abrir `/admin`, conferir `Exibindo 1–20 de 47 registros` e `Página 1 de 3`, avançar e verificar linhas 21–40 com a URL em `?page=2`; na aba Network, cada troca gera uma requisição cuja resposta traz no máximo `pageSize` registros.

- [x] T015 [US1] Alterar `src/modules/identidade/presentation/queries/usuarios.ts` para aplicar `clampPagina` e retornar `{ rows, totalCount, page, pageSize }` — os valores efetivos, após saneamento (contratos L-01.3, L-06) (depende de T003)
- [x] T016 [US1] Adicionar `listarUsuariosAction` em `src/modules/identidade/presentation/actions/usuarios.ts`: valida a entrada com `esquemaPaginacao`, revalida sessão e exige `administrador` **fora** do escopo `'use cache'`, delega para `listarUsuarios` e devolve `ResultadoAction<PaginaDe<LinhaUsuario>>` (contratos L-01, L-02) (depende de T015)
- [x] T017 [US1] Criar `src/shared/paginacao/use-parametros-listagem.ts`: hook que lê `page`/`pageSize` de `useSearchParams` via `esquemaPaginacao`, preserva os demais parâmetros e navega com `router.replace(url, { scroll: false })` (FR-011, FR-019; decisão D9) (depende de T003)
- [x] T018 [US1] Reescrever `app/(interno)/(staff)/admin/tabela-usuarios.tsx` para usar `useQuery` com `chaveUsuarios({ page, pageSize })`, `placeholderData: keepPreviousData`, passar `paginacao` e `atualizando={isPlaceholderData}` ao `Table` e remover a função `navegar()` local e o `<Pagination>` avulso (contratos U-01, L-04) (depende de T013, T016, T017)
- [x] T019 [US1] Alterar `app/(interno)/(staff)/admin/page.tsx` para hidratar a primeira página com `dehydrate` + `<HydrationBoundary>` usando **a mesma** `queryKey` do cliente, mantendo `exigirAcessoA('/admin')` e o `<Suspense fallback={<SkeletonLista/>}>`, e removendo o `const TAMANHO_PAGINA = 20` local (contrato L-05) (depende de T018)
- [x] T020 [US1] Tratar erro e vazio em `app/(interno)/(staff)/admin/tabela-usuarios.tsx`: `ok: false` ou falha de rede renderiza `Alert` em pt-BR com botão "Tentar novamente" chamando `refetch()`; `totalCount === 0` mostra o vazio do `Table` com o rodapé presente (FR-014, contrato L-06) (depende de T018)
- [x] T021 [US1] Substituir o `router.refresh()` de `onSucesso` em `app/(interno)/(staff)/admin/tabela-usuarios.tsx` por `queryClient.invalidateQueries({ queryKey: ['identidade','listagem'] })`, mantendo o `updateTag` já existente na Server Action de escrita (contrato L-04.5) (depende de T018)

**Checkpoint**: US1 completa e testável isoladamente — cenários 1 e 3 do quickstart passam

---

## Phase 4: User Story 2 - Escolher registros por página (Priority: P2)

**Goal**: o seletor 5/10/20/50 do rodapé altera de fato a quantidade de linhas buscadas no servidor.

**Independent Test**: em `/admin`, trocar de `20` para `5` → 5 linhas e `Página 1 de 10`; ir à página 3, trocar para `50` → volta à página 1 com `Página 1 de 1`; recarregar preserva `pageSize=50`.

- [x] T022 [US2] Ligar `onPageSizeChange` em `app/(interno)/(staff)/admin/tabela-usuarios.tsx` ao hook `useParametrosListagem`, escrevendo `pageSize` na URL e **resetando `page` para 1** (FR-005, contrato U-02.1) (depende de T018)
- [x] T023 [US2] Confirmar em `src/shared/query/chaves.ts` que `pageSize` faz parte da `queryKey` (e portanto da chave de `'use cache'` no servidor), para que 5/10/20/50 sejam entradas de cache distintas (contrato L-03.2) (depende de T006, T022)
- [x] T024 [US2] Garantir em `app/(interno)/(staff)/admin/page.tsx` que a hidratação usa o `pageSize` vindo da URL, não a constante — senão a primeira renderização com `?pageSize=5` dispararia um POST redundante (contrato L-05.2) (depende de T019, T022)

**Checkpoint**: US1 e US2 funcionam — cenário 2 do quickstart passa

---

## Phase 5: User Story 3 - Mesmo comportamento em todas as listagens (Priority: P3)

**Goal**: `/voluntarios`, `/estoque` e `/relatorios` adotam o mesmo rodapé e o mesmo modelo de carregamento por página.

**Independent Test**: percorrer as três telas e verificar rótulos idênticos aos de `/admin`, navegação por página funcionando e filtros preservados na URL ao paginar.

### `/voluntarios`

- [x] T025 [P] [US3] Alterar `src/modules/voluntariado/presentation/queries/candidaturas.ts` (`listarVoluntarios`) para aplicar `clampPagina` e retornar `page`/`pageSize` efetivos (depende de T003)
- [x] T026 [US3] Adicionar `listarVoluntariosAction` em `src/modules/voluntariado/presentation/actions/`, com validação Zod de `{ page, pageSize, status, habilidadeId }` e revalidação de role de staff (contratos L-01, L-02) (depende de T025)
- [x] T027 [US3] Reescrever `app/(interno)/(staff)/voluntarios/tabela-voluntarios.tsx` com `useQuery` + `paginacao` + `atualizando`, removendo o `navegar()` local e o `<Pagination>` avulso, e garantindo que `status`/`habilidade` entram na `queryKey` e sobrevivem à troca de página (FR-019) (depende de T026, T017, T013)
- [x] T028 [US3] Alterar `app/(interno)/(staff)/voluntarios/page.tsx` para hidratar a primeira página com a mesma `queryKey` e remover o `TAMANHO_PAGINA` local, preservando o carregamento paralelo de `listarHabilidades()` (depende de T027)

### `/estoque`

- [x] T029 [P] [US3] Alterar `src/modules/estoque/presentation/queries/estoque.ts` (`listarEstoque`) para aplicar `clampPagina` e retornar `page`/`pageSize` efetivos (depende de T003)
- [x] T030 [US3] Adicionar `listarEstoqueAction` nas actions de `src/modules/estoque/presentation/`, com validação de `{ page, pageSize, categoria }` e revalidação de role (depende de T029)
- [x] T031 [US3] Reescrever `app/(interno)/(staff)/estoque/tabela-estoque.tsx` com `useQuery` + `paginacao` + `atualizando`, removendo o `navegar()` local e preservando o filtro de categoria ao paginar (depende de T030, T017, T013)
- [x] T032 [US3] Alterar `app/(interno)/(staff)/estoque/page.tsx` para hidratar a primeira página com a mesma `queryKey` e remover o `TAMANHO_PAGINA` local (depende de T031)

### `/relatorios`

- [x] T033 [US3] Adicionar `listarSaidas({ page, pageSize })` em `src/modules/estoque/presentation/queries/estoque.ts` (`'use cache'`, `cacheTag(CACHE_TAGS.estoqueSaidas)`), **sem alterar** `inventarioParaExportacao()`/`saidasParaExportacao()`, que continuam exclusivas do Route Handler de download (contrato L-03.4) (depende de T004, T003)
- [x] T034 [US3] Adicionar `listarSaidasAction` nas actions de Estoque, com validação Zod e revalidação de role de `/relatorios` (depende de T033)
- [x] T035 [US3] Reescrever `app/(interno)/(staff)/relatorios/painel-relatorios.tsx` para que as tabelas de Inventário e Saídas usem `useQuery` paginado com `paginacao`, cada aba com seu próprio par `page`/`pageSize` na URL (ex.: `?invPage=`, `?saidasPage=`) para não colidirem (depende de T030, T034, T013)
- [x] T036 [US3] Alterar `app/(interno)/(staff)/relatorios/page.tsx` para hidratar a primeira página de cada aba e deixar de chamar `inventarioParaExportacao()`/`saidasParaExportacao()` no render da tela — corrige a violação de FR-008 identificada em research.md D10 —, mantendo `connection()`, `exigirAcessoA('/relatorios')` e o cálculo de `podeGerarContingencia` (depende de T035)
- [x] T037 [US3] Verificar que o botão de exportação de `/relatorios` continua baixando o conjunto **completo** via `<a download>` e não apenas a página visível (depende de T036)

**Checkpoint**: as quatro telas de listagem exibem o mesmo rodapé — cenário 4 do quickstart passa

---

## Phase 6: Polish & Cross-Cutting Concerns

> T038, T039, T040 e T043 exigem a aplicação rodando contra o banco e não
> puderam ser executadas nesta sessão (o Neon está inacessível a partir deste
> ambiente — `npm run build` falha no prerender de `/atividades` e
> `/cadastros-pendentes` também na árvore sem estas mudanças). Continuam
> pendentes de validação manual.

- [ ] T038 [P] Validar acessibilidade do rodapé: percorrer só com `Tab`/`Shift+Tab`, confirmar anel de foco, `aria-current` na página ativa e anúncio da nova faixa por `aria-live` (SC-005, cenário 5 do quickstart)
- [ ] T039 [P] Validar responsividade a 360px nas quatro telas: rodapé empilhado, sem rolagem horizontal da página (SC-007)
- [ ] T040 Validar o comportamento offline em `/admin`, `/voluntarios` e `/estoque`: mensagem de erro em pt-BR com "Tentar novamente", sem carregamento infinito (FR-014, cenário 6 do quickstart)
- [x] T041 Remover código morto deixado pelo rollout: funções `navegar()` duplicadas, constantes `TAMANHO_PAGINA` locais e imports de `Pagination` que ficaram sem uso nas telas
- [x] T042 Rodar `npm test`, `npm run lint` e `npx tsc --noEmit` — sem `any` novo e sem texto de interface fora de pt-BR (Princípio II)
- [ ] T043 Executar os 7 cenários de [quickstart.md](./quickstart.md) ponta a ponta com a massa mínima de 47 registros

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sem dependências
- **Foundational (Fase 2)**: depende da Fase 1 — **bloqueia todas as user stories**
- **US1 (Fase 3)**: depende da Fase 2
- **US2 (Fase 4)**: depende de US1 (o seletor vive no rodapé entregue por US1)
- **US3 (Fase 5)**: depende da Fase 2; na prática deve seguir US1, que valida o padrão a ser replicado
- **Polish (Fase 6)**: depende das stories desejadas

### User Story Dependencies

- **US1 (P1)**: independente após a Fase 2 — é o MVP
- **US2 (P2)**: acopla-se ao rodapé de US1; testável isoladamente pelo comportamento do seletor
- **US3 (P3)**: replica o padrão de US1 em outras telas; cada tela é entregável e testável de forma independente

### Parallel Opportunities

- Fase 1: T001, T002 e T004 em paralelo
- Fase 2: T006/T007 (query) em paralelo com T010 (Pagination) — arquivos disjuntos
- Fase 5: os três blocos de tela (`/voluntarios` T025–T028, `/estoque` T029–T032, `/relatorios` T033–T037) são independentes entre si e podem ser divididos entre pessoas; dentro de cada bloco a ordem é sequencial (query → action → componente → page)
- Fase 6: T038 e T039 em paralelo

---

## Parallel Example: Phase 5

```text
# Após a Fase 2 e US1, três frentes simultâneas:
Dev A: T025 → T026 → T027 → T028   (/voluntarios)
Dev B: T029 → T030 → T031 → T032   (/estoque)
Dev C: T033 → T034 → T035 → T036 → T037   (/relatorios)
```

---

## Implementation Strategy

### MVP First (US1)

1. Fase 1 (Setup) → Fase 2 (Foundational) → checkpoint em `/design-system`
2. Fase 3 (US1) em `/admin`
3. **PARAR e VALIDAR**: cenários 1 e 3 do quickstart
4. Demo — o padrão inteiro (rodapé + server function + TanStack Query + hidratação) já está provado em uma tela

### Incremental Delivery

1. Setup + Foundational → design system pronto, produção intacta
2. US1 → `/admin` completo → demo (MVP)
3. US2 → seletor de tamanho → demo
4. US3 → uma tela por vez, cada uma entregável isoladamente
5. Polish → acessibilidade, responsividade, limpeza

---

## Notes

- `'use cache'` **não pode** ler `cookies()`/`headers()` — o gate de autorização vive sempre na server function, fora do escopo cacheado (contrato L-02.4)
- Server Actions são POST e o Next as serializa: **não** adicionar prefetch especulativo de páginas adjacentes (contrato L-04.4)
- A `queryKey` hidratada no servidor precisa ser idêntica à do `useQuery` — divergência causa um POST redundante na abertura da tela (contrato L-05.2)
- Nenhuma dependência nova: `nuqs` foi explicitamente rejeitado em research.md D9 (Princípio VI)
- Commits em Conventional Commits, um por tarefa ou grupo lógico
