---
description: 'Task list for 021-componente-lookup'
---

# Tasks: Componente Lookup para campos de referência

**Input**: Design documents from `/specs/021-componente-lookup/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R8), data-model.md, contracts/
(`lookup-componente.md` C-01..C-14, `leituras-lookup.md` L-01..L-08), quickstart.md (Q1–Q18)

**Tests**: A spec não pede TDD, e a feature não altera `domain/` nem `application/`
(Princípio III). O único teste unitário é o do helper puro `escaparLike` (L-04), em
`src/**/*.test.ts` (`npm test`). A UI é validada manualmente pelo quickstart, porque o projeto
não tem testes de componente.

**Organization**: Tarefas agrupadas por user story da spec (US1 digitação, US2 diálogo,
US3 aplicação nos formulários).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1–US3 da spec

## Convenções que toda task deve seguir

- **Next.js 16 tem mudanças incompatíveis** (`AGENTS.md`). Antes de mexer em Server Function,
  `'use cache'` ou `page.tsx`, ler o guia correspondente em `node_modules/next/dist/docs/`.
- Leituras seguem o padrão de `src/modules/estoque/presentation/actions/listagens.ts`: gate de
  role na action e `'use cache'` + `cacheTag` na query. A query nunca lê cookies.
- Textos de interface em pt-BR. Sem `any`. Prettier do `package.json` (4 espaços, sem `;`,
  aspas simples, 120 colunas). Comentários no estilo do arquivo vizinho.
- Os payloads das Server Actions de escrita (`registrarEntrada`, `registrarSaida`,
  `registrarDescarte`, `salvarKit`) **não mudam** (FR-024).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: busca sem acento no banco e o helper de escape (research R5).

- [X] T001 Criar a migration `db/migrations/0006_lookup_unaccent.sql` (gerar com
  `npm run db:generate` depois do T002 e prefixar os statements manuais). Ela precisa de
  `CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint` e de
  `CREATE OR REPLACE FUNCTION public.f_unaccent(text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$ select public.unaccent('public.unaccent', $1) $$;--> statement-breakpoint`,
  ambos antes do `CREATE INDEX "item_nome_unaccent_trgm_idx" ON "item" USING gin (f_unaccent("nome") gin_trgm_ops)`.
  Seguir o padrão do `pg_trgm` em `db/migrations/0000_classy_leopardon.sql`.
- [X] T002 Declarar o índice `item_nome_unaccent_trgm_idx` em `db/schema/estoque.ts`, ao lado de
  `item_nome_trgm_idx`, com ``index('item_nome_unaccent_trgm_idx').using('gin', sql`f_unaccent(${t.nome}) gin_trgm_ops`)``.
  Incluir um comentário dizendo que a extensão e a função vêm de statement manual na migration 0006.
- [X] T003 [P] Criar `src/shared/busca/escapar-like.ts`, exportando `escaparLike(termo: string): string`.
  A função escapa `\` → `\\`, `%` → `\%` e `_` → `\_`, nessa ordem (L-04).
- [X] T004 [P] Criar `src/shared/busca/escapar-like.test.ts` (Vitest). Casos: texto comum
  inalterado, `%`, `_`, `\`, combinação `a%_\b`, string vazia.

**Checkpoint**: `npm run db:migrate` aplica a migration no branch Neon de dev e `npm test` passa.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: leituras do servidor e extensões dos componentes compartilhados das quais as três
stories dependem.

**⚠️ CRITICAL**: nenhuma story começa antes desta fase.

### Leituras (contracts/leituras-lookup.md)

- [X] T005 Em `src/modules/estoque/presentation/queries/estoque.ts`, criar estas leituras:
  - o tipo `FiltrosLookup = ParametrosPaginacao & { termo?: string }`;
  - `sugerirItens(termo: string): Promise<ItemComSaldo[]>`, com `'use cache'`, tags
    `CACHE_TAGS.estoqueItens` e `CACHE_TAGS.estoqueSaldo` e `cacheLife(CACHE_LIFE.curto)`.
    `limit 5` fixo (L-02);
  - `listarItensLookup(filtros: FiltrosLookup): Promise<PaginaDe<ItemComSaldo>>`, com o mesmo
    cache e implementada via `paginarComClamp`, que roda `select` + `count` em paralelo como
    `buscarEstoque`.

  Para o filtro com termo, montar um helper local
  `condicaoNome(coluna, termo)` = ``sql`f_unaccent(${coluna}) % f_unaccent(${termo}) or f_unaccent(${coluna}) ilike '%' || f_unaccent(${escaparLike(termo)}) || '%' escape '\'` ``.
  Ordenar por ``desc(sql`similarity(f_unaccent(${item.nome}), f_unaccent(${termo}))`)`` e depois
  `asc(item.nome)`. Sem termo, só `asc(item.nome)` (L-03).
  Reusar `comNumeros` e o `leftJoin(saldoEstoque)` de `buscarEstoque`.
- [X] T006 No mesmo arquivo `src/modules/estoque/presentation/queries/estoque.ts`, criar estes
  tipos e leituras:
  - o tipo `KitLookup = { id: string; nome: string; ativo: boolean; totalComponentes: number }`;
  - `sugerirKits(termo)`, com limit 5;
  - `listarKitsLookup(filtros: FiltrosLookup)`, via `paginarComClamp`.

  Ambas usam `'use cache'` e a tag `CACHE_TAGS.estoqueKits`, e trazem só kits com
  `kit.ativo = true`. `totalComponentes` vem de `count(kitReceitaItem.itemId)` com
  `leftJoin(kitReceitaItem)` + `groupBy(kit.id)` (L-06). O filtro de termo e a ordenação são
  os mesmos do T005, sobre `kit.nome`.
- [X] T007 Criar `src/modules/estoque/presentation/actions/lookups.ts` (`'use server'`) com
  `sugerirItensAction`, `listarItensLookupAction`, `sugerirKitsAction` e `listarKitsLookupAction`
  (todas `entrada: unknown`). Cada uma:
  - faz o gate `podeAcessar('/estoque', (await obterSessao())?.role)` e, se falhar, devolve
    `erroAction('nao_autorizado', 'Você não tem permissão para consultar o estoque.')`;
  - lê o termo com `z.string().trim().max(100).catch('')`, de `@/src/shared/validacao/zod-ptbr`;
  - nas páginas, combina `normalizarPaginacao(entrada)` com o termo;
  - nas sugestões, devolve `{ ok: true, valor: [] }` sem consultar quando `termo.length < 2` (L-01);
  - retorna `ResultadoAction<…>`.

  Docblock no estilo de `listagens.ts`, explicando por que as leituras ficam separadas das escritas.

### Componentes e hooks compartilhados

- [X] T008 [P] Estender `src/shared/ui/combobox/combobox.tsx` (contracts/lookup-componente.md,
  "Extensões"). Mudanças:
  - adicionar `disabled?: boolean` a `OpcaoCombobox` e passar
    `itemToDisabled: (i) => Boolean(i.disabled)` ao `createListCollection`;
  - nova prop `acaoFim?: ReactNode`, renderizada dentro do `Ark.Control` depois do spinner e do
    `ClearTrigger`;
  - nova prop opcional `inputValueExterno?: { texto: string; versao: number }`. Um efeito que
    depende **só de `versao`** sobrescreve `termo` com `texto` e marca numa ref que esse valor
    veio de fora. O efeito de debounce consulta a ref e pula `onBuscar` apenas para esse valor.
    Qualquer digitação posterior limpa a marca e volta a buscar normalmente. **Nunca**
    sincronizar `termo` a cada render a partir de uma prop: isso apagaria o texto em digitação
    e suprimiria a busca no modo valor livre (contracts C-05/C-06);
  - nova prop `rodapeLista?: ReactNode`, renderizada no fim do `Ark.Content`, para a dica
    "Digite ao menos 2 caracteres" e para o erro com "Tentar de novo";
  - opções `disabled` ganham classe atenuada (`data-disabled:opacity-50 data-disabled:cursor-not-allowed`).

  A Entrada (uso atual) precisa continuar idêntica.
- [X] T009 [P] Estender `src/shared/ui/table/table.tsx` (research R4). Com `onLinhaClick`, o `<tr>`
  recebe:
  - `tabIndex={0}`;
  - `onKeyDown` que trata Enter e Espaço com `preventDefault` e chama `onLinhaClick`;
  - anel de foco (`ANEL_FOCO` de `../cn`, aplicado ao `tr`).

  Nova prop `linhaDesabilitada?: (linha: TData) => boolean`. Quando ela devolve true, a linha
  ganha `aria-disabled="true"`, `opacity-60 cursor-not-allowed`, `tabIndex={-1}` e ignora
  clique e tecla.
- [X] T010 [P] Criar `src/shared/query/use-listagem-local.ts` (`'use client'`), com
  `useListagemLocal<T, F>({ chave, buscar, filtros, pageSizeInicial = TAMANHO_PAGINA_PADRAO, habilitado = true })`.
  - Estado local (`useState`) para `page` e `pageSize`. Quando `filtros` muda (comparar por
    `JSON.stringify`), voltar `page` para 1.
  - `useQuery` com `queryKey: chave({ page, pageSize, ...filtros })`, `enabled: habilitado` e
    `placeholderData: keepPreviousData`. O `queryFn` lança se `!resultado.ok`, como em
    `use-listagem-paginada.ts`.
  - Retorno igual ao de `useListagemPaginada` (`rows`, `totalCount`, `carregando`,
    `atualizando`, `erro`, `refetch`, `paginacao` com `onPageChange` e `onPageSizeChange`
    locais), sem `navegar`.

  Exportar em `src/shared/query/index.ts`.
- [X] T011 [P] Criar `src/shared/ui/lookup/tipos.ts` com `FonteLookup<T>` exatamente como em
  contracts/lookup-componente.md (`chave`, `sugerir`, `listar`, `idDe`, `descricaoDe`,
  `detalheDe?`, `colunas: ColunaTabela<T>[]`, `tituloPesquisa`). Também a função
  `chaveLookup(chave, tipo: 'sugestoes' | 'pagina', params)` →
  `['lookup', chave, tipo, params] as const` e a constante `RAIZ_LOOKUP = ['lookup']`.

**Checkpoint**: `npx tsc --noEmit` e `npm run lint` passam, e a Entrada continua funcionando
como antes.

---

## Phase 3: User Story 1 - Selecionar um item digitando parte do nome (Priority: P1) 🎯 MVP

**Goal**: o campo de item aceita digitação, mostra até 5 sugestões vindas do servidor e grava
o id do item escolhido. Validado no formulário de Descarte.

**Independent Test**: quickstart Q1–Q4. No Descarte, digitar "agua", escolher a sugestão e
enviar. O descarte é registrado para o item escolhido. Texto sem seleção bloqueia o envio.

- [X] T012 [US1] Criar `src/shared/ui/lookup/lookup.tsx` (`'use client'`), `Lookup<T>`, com as
  props de `LookupProps<T>` do contrato. Comportamento (C-02..C-06, C-11..C-14):
  - estado `termoBusca` alimentado pelo `onBuscar` (com debounce) do `Combobox`;
  - `useQuery({ queryKey: chaveLookup(fonte.chave, 'sugestoes', { termo }), queryFn: sugerir → lança se !ok → slice(0, 5), enabled: termo.trim().length >= 2, staleTime: 30_000 })`;
  - mapear os registros para `OpcaoCombobox`: `value: idDe`, `label: descricaoDe`,
    `descricao` = `detalheDe` + ` · ${motivo}` quando houver `motivoIndisponivel`, e
    `disabled: Boolean(motivo)`;
  - sincronização prop → input (C-05): manter `versao` em `useState`, incrementada num efeito
    que depende **só de `value`**, e passar `inputValueExterno={{ texto: descricao, versao }}`
    ao `Combobox`. Na montagem, o texto inicial é `descricao`. Mudanças em `descricao` sem
    mudança de `value` (ex.: no modo valor livre, `descricao={field.value}` a cada tecla) **não**
    reescrevem o input;
  - em `onInputValueChange`, se havia `value`, marcar a ref `desfeitoPorDigitacao = true` e
    chamar `onSelecionar(null)`. O efeito de `value`, ao ver a ref marcada, só a desmarca e
    **não** incrementa `versao`. Assim o texto que está sendo digitado permanece em tela. Com
    `permitirValorLivre`, chamar também `onTextoLivre(texto)` a cada alteração (FR-010, FR-025);
  - `onValueChange` acha o registro pelo id nos dados da query e chama `onSelecionar(registro)`;
  - `rodapeLista` mostra "Digite ao menos 2 caracteres" quando há texto mas `< 2` caracteres.
    Em erro, mostra a mensagem "Não foi possível buscar." e um botão "Tentar de novo" que chama
    `refetch` (C-04);
  - repassa `carregando = isFetching`, `obrigatorio`, `apoio`, `erro`, `disabled`, `ref`,
    `placeholder` e `mensagemVazia` (padrão "Nenhum registro encontrado.") ao `Combobox`.

  Sem `permitirValorLivre`, o `Combobox` descarta sozinho o texto não selecionado ao perder o
  foco. Conferir que, nesse caso, `onSelecionar(null)` foi chamado.
- [X] T013 [US1] Exportar `Lookup`, `type LookupProps` e `type FonteLookup` em `src/shared/ui/index.ts`.
- [X] T014 [US1] Criar `src/modules/estoque/presentation/lookups/fontes.ts` (`'use client'`) com
  `fonteItens: FonteLookup<ItemComSaldo>`:
  - `chave: 'estoque-itens'`, `sugerir: sugerirItensAction`, `listar: listarItensLookupAction`;
  - `idDe: (i) => i.id`, `descricaoDe: (i) => i.nome`;
  - `detalheDe` = `${ROTULO_CATEGORIA_ITEM[i.categoria]} · ${formatarQuantidade(i.saldo)} ${ABREVIACAO_UNIDADE[i.unidadeMedida]} em estoque`;
  - `tituloPesquisa: 'Pesquisar item'`;
  - colunas: Item (`nome`), Categoria, Unidade e Saldo, com o mesmo formato de
    `app/(interno)/(staff)/estoque/tabela-estoque.tsx`.

  Exportar também a regra `semSaldo = (i: ItemComSaldo) => (i.saldo <= 0 ? 'Sem saldo' : null)`.
- [X] T015 [US1] Migrar `app/(interno)/(staff)/estoque/descarte/descarte-form.tsx`:
  - trocar o `Select` de `itemId` por `Lookup` com `fonte={fonteItens}`, `obrigatorio`,
    `motivoIndisponivel={semSaldo}`, `value={field.value}` e `ref={field.ref}`. O
    `motivoIndisponivel` preserva o `disabled: i.saldo <= 0` atual do select (FR-024);
  - guardar o registro escolhido em `useState<ItemComSaldo | null>`;
  - `descricao` vem de `selecionado?.nome ?? ''`;
  - `onSelecionar` faz `setSelecionado(r)` e `field.onChange(r?.id ?? '')`;
  - substituir `itens.find(...)` (validação de saldo no resolver e exibição do saldo) pelo
    `selecionado`. A validação do resolver passa a ler o registro de uma ref atualizada no
    `onSelecionar`;
  - remover a prop `itens`;
  - no `reset` após sucesso, limpar `selecionado`.
- [X] T016 [US1] Atualizar `app/(interno)/(staff)/estoque/descarte/page.tsx`: remover
  `listarItens()` e renderizar `<DescarteForm />`. Manter `exigirAcessoA('/estoque/descarte')`.

**Checkpoint**: quickstart Q1–Q4 passam no Descarte. US1 entregável como MVP.

---

## Phase 4: User Story 2 - Pesquisar e escolher o item em uma tabela paginada (Priority: P2)

**Goal**: o botão de pesquisa abre um diálogo com filtro e uma tabela paginada no servidor. O
clique ou Enter numa linha seleciona o registro.

**Independent Test**: quickstart Q5–Q7. No Descarte, abrir a pesquisa, ir à página 2, clicar
num item e enviar. Fechar o diálogo sem escolher mantém o valor.

- [X] T017 [US2] Criar `src/shared/ui/lookup/lookup-dialog.tsx` (`'use client'`),
  `LookupDialog<T>`, com props `{ aberto, onAbertoChange, fonte, motivoIndisponivel?, onEscolher(registro: T) }`
  (C-07..C-10). Comportamento:
  - usar `Dialog` com `tamanho="lg"` e `titulo={fonte.tituloPesquisa}`;
  - no topo, um `Input` de filtro com label "Filtrar" e `autoFocus`. O termo passa por debounce
    de 250 ms (`useEffect` + `setTimeout`);
  - `useListagemLocal({ chave: (p) => chaveLookup(fonte.chave, 'pagina', p), buscar: fonte.listar, filtros: { termo }, habilitado: aberto })`;
  - `Table` com `titulo={fonte.tituloPesquisa}`, `colunas={fonte.colunas}`, `paginacao`,
    `carregando`, `atualizando`, `vazio="Nenhum registro encontrado."`,
    `linhaDesabilitada={(r) => Boolean(motivoIndisponivel?.(r))}` e
    `onLinhaClick={(r) => { onEscolher(r); onAbertoChange(false) }}`;
  - quando há `motivoIndisponivel`, acrescentar ao fim de `fonte.colunas` uma coluna "Situação"
    que mostra o motivo como `Badge`;
  - em erro, mostrar `Alert` `tom="danger"` com o botão "Tentar de novo" (`refetch`).
- [X] T018 [US2] Integrar o diálogo em `src/shared/ui/lookup/lookup.tsx`:
  - estado `dialogoAberto`;
  - em `acaoFim`, um `IconButton` com ícone `Search` (lucide), `aria-label={`Pesquisar ${label}`}`,
    tooltip igual, `disabled={disabled}` e `type="button"` (C-01, C-12);
  - `onEscolher` chama `onSelecionar(registro)` e devolve o foco ao input (guardar ref interna
    do input e mesclar com a `ref` recebida).

  Conferir no `IconButton` (`src/shared/ui/icon-button/icon-button.tsx`) se a altura cabe dentro
  do `Ark.Control` `h-11`. Ajustar com classe se precisar, sem mudar o componente.
- [ ] T019 [US2] Conferir o diálogo em 375 px de largura (folha inferior do `Dialog`, tabela
  rolando dentro do próprio contêiner). Ajustar só classes de layout em
  `src/shared/ui/lookup/lookup-dialog.tsx` se houver rolagem horizontal da página (quickstart Q16).
  _Pendente (2026-10-05): o redimensionamento da janela pela automação não teve efeito; conferir
  manualmente no DevTools (modo dispositivo, 375 px)._

**Checkpoint**: quickstart Q5–Q7 e Q16 passam no Descarte, e US1 continua funcionando.

---

## Phase 5: User Story 3 - Lookup aplicado a todos os campos de item de estoque (Priority: P3)

**Goal**: Saída (itens e kits), Kits e Entrada (item em modo valor livre e destinação de kit)
usam o Lookup, e as regras de cada formulário continuam valendo.

**Independent Test**: quickstart Q8–Q14 e Q18.

- [X] T020 [US3] Em `src/modules/estoque/presentation/lookups/fontes.ts`, adicionar
  `fonteKits: FonteLookup<KitLookup>`:
  - `chave: 'estoque-kits'`, com `sugerirKitsAction` e `listarKitsLookupAction`;
  - `descricaoDe: (k) => k.nome`;
  - `detalheDe` = `${k.totalComponentes} componente(s)`;
  - `tituloPesquisa: 'Pesquisar kit'`;
  - colunas: Kit e Componentes.

  Adicionar também `semReceita = (k: KitLookup) => (k.totalComponentes === 0 ? 'Sem receita' : null)`.
- [X] T021 [US3] Migrar `app/(interno)/(staff)/estoque/saida/saida-form.tsx`:
  - em cada linha, trocar o `Select` de `linhas.${indice}.refId` por `Lookup`. Com
    `tipo === 'avulso'`, usar `fonte={fonteItens}` e `motivoIndisponivel={semSaldo}`; com kit,
    usar `fonte={fonteKits}` e `motivoIndisponivel={semReceita}`;
  - a descrição de cada linha fica num `useState<Record<string, string>>`, indexado por
    `campo.id` do `useFieldArray`. Atualizar no `onSelecionar` e limpar ao remover a linha,
    ao `trocarTipo` e no `reset`;
  - `key` do Lookup = `${tipo}-${campo.id}`, para remontar ao trocar o tipo;
  - remover a constante `opcoes`, as props `itens` e `kits` e os imports que ficarem sem uso.

  O payload enviado a `registrarSaida` continua igual.
- [X] T022 [US3] Atualizar `app/(interno)/(staff)/estoque/saida/page.tsx`: remover
  `listarItens()` e `listarKitsComReceita(true)` e renderizar `<SaidaForm />`. Se `Formulario`
  ficar sem `await`, manter o `Suspense` só se ainda houver conteúdo assíncrono. Caso
  contrário, renderizar o form direto (ler `node_modules/next/dist/docs/` sobre prerender ou
  Cache Components antes).
- [X] T023 [US3] Migrar `app/(interno)/(staff)/estoque/kits/gestao-kits.tsx`:
  - trocar o `Select` de `componentes.${indice}.itemId` por `Lookup` com `fonte={fonteItens}`;
  - guardar as descrições por `campo.id` num estado. Ao abrir a edição de um kit existente,
    preencher a partir de `kit.componentes[].nome` (FR-012, US3-AS5);
  - manter o `superRefine` de item duplicado;
  - trocar `saldos = new Map(itens.map(...))` por um mapa derivado de
    `kits.flatMap((k) => k.componentes.map((c) => [c.itemId, c.saldo]))`;
  - remover a prop `itens`.
- [X] T024 [US3] Atualizar `app/(interno)/(staff)/estoque/kits/page.tsx`: remover `listarItens()`
  do `Promise.all` e renderizar `<GestaoKits kits={kits} />`.
- [X] T025 [US3] Migrar o campo "Nome do item" de `app/(interno)/(staff)/estoque/entrada/entrada-form.tsx`
  (FR-022, FR-025):
  - trocar o `Combobox` + `buscar`/`sugestoes`/`buscando` por
    `Lookup fonte={fonteItens} permitirValorLivre`;
  - usar `value={itemSelecionado?.id ?? null}`, `descricao={field.value}` (o texto do campo
    `item`) e `onTextoLivre={field.onChange}`;
  - `onSelecionar(r)`: com `r`, faz `setItemSelecionado(r)`, `field.onChange(r.nome)`,
    `setValue('categoria')`, `setValue('unidadeMedida')`, limpa `estoqueMinimo` e
    `clearErrors`, exatamente como o `onValueChange` atual. Com `null`, faz `setItemSelecionado(null)`;
  - manter `apoio` e `mensagemVazia` atuais. O tipo `ItemEncontrado` vira `ItemComSaldo`;
  - remover `buscarItens` do import;
  - conferir em Q12/Q13 que as sugestões continuam aparecendo enquanto se digita. Como o
    `value` não muda durante a digitação, não há sincronização que suprima a busca (C-06).
- [X] T026 [US3] Migrar "Destinação (kit)" (`kitDestinoId`) no mesmo
  `app/(interno)/(staff)/estoque/entrada/entrada-form.tsx` para
  `Lookup fonte={fonteKits}`, opcional (sem `obrigatorio`, com limpar) e **sem**
  `motivoIndisponivel`: hoje todo kit ativo é selecionável como destinação, que é informativa
  (FR-024). Manter `apoio` e `placeholder` atuais. A descrição fica em estado local, limpo no
  `limpar` e no `reset`. Remover a prop `kits` do `EntradaForm`.
- [X] T027 [US3] Atualizar `app/(interno)/(staff)/estoque/entrada/page.tsx`: remover
  `listarKitsComReceita(true)` e passar só `limiarGlobal`. Avaliar o `Suspense` como no T022.
- [X] T028 [US3] Invalidar as sugestões e páginas do Lookup depois das escritas (L-07). Em
  `entrada-form.tsx`, `saida-form.tsx`, `descarte-form.tsx` e `gestao-kits.tsx` (salvar kit),
  depois de `resultado.ok`, chamar `queryClient.invalidateQueries({ queryKey: RAIZ_LOOKUP })`
  com `useQueryClient()` de `@tanstack/react-query`.
- [X] T029 [US3] Remover código sem uso:
  - `buscarItens` em `src/modules/estoque/presentation/actions/estoque.ts`;
  - `buscarPorNome` em `src/modules/estoque/application/ports/estoque-repository.ts` e em
    `src/modules/estoque/infrastructure/drizzle/estoque-repository.ts`, depois de confirmar
    com `grep -r "buscarPorNome\|buscarItens" src app` que não sobrou uso. Atualizar dublês de
    teste que implementem a porta (`grep -rl "buscarPorNome" src`);
  - manter `item_nome_trgm_idx`. A remoção do índice fica fora desta feature, para não exigir
    migration destrutiva.
- [X] T030 [US3] Conferir que `listarItens()` (`presentation/queries/estoque.ts`) ainda tem
  consumidores (`grep -r "listarItens(" src app`). Se não tiver, remover a função e a tag só
  dela. Se tiver, manter.

**Checkpoint**: quickstart Q8–Q14 e Q18 passam, e US1/US2 continuam funcionando no Descarte.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T031 [P] Documentar o `Lookup` em `spec/DESIGN_SYSTEM.md`:
  - nova §4.4.1, com anatomia, os dois caminhos, o modo valor livre, os indisponíveis e a
    acessibilidade;
  - em §4.4, as notas das extensões do `Combobox` (`acaoFim`, opção `disabled`, `rodapeLista`);
  - em §4.13, a nota do `Table` (linha focável, `linhaDesabilitada`).
- [X] T032 [P] Registrar em `spec/DESIGN.md` §19 a decisão "Busca sem acento: extensão
  `unaccent` + `f_unaccent` IMMUTABLE + índice GIN de expressão em `item.nome`", com rationale e
  alternativas (research R5).
- [X] T033 Rodar `npm test`, `npm run lint`, `npx tsc --noEmit` e `npm run build`, e corrigir
  o que falhar.
- [ ] T034 Executar o roteiro manual completo de `specs/021-componente-lookup/quickstart.md`
  (Q1–Q19), incluindo o `explain analyze` do índice, o cenário offline Q15 e a recusa do
  servidor Q19. Registrar divergências como novas tasks.
  _Parcial (2026-10-05), no navegador com sessão de administrador:_
  - _Passaram: Q1–Q7, Q10–Q14._
  - _Divergência encontrada e corrigida: o foco inicial do diálogo ia para "Fechar". O `Dialog`
    ganhou `focoInicial`._
  - _Q8/Q9 só no caminho feliz: o banco de dev não tem item sem saldo nem kit ativo sem
    receita._
  - _Faltam Q15 (offline), Q16 (= T019), Q17 (voluntário), Q18 e Q19, porque registram
    movimentações reais no banco._
  - _O `explain analyze` foi feito na T035._
- [X] T035 Medir o desempenho das leituras com catálogo grande (SC-002, SC-003; constituição,
  meta < 300 ms):
  - popular o branch Neon **de dev** com cerca de 2.000 itens, via script temporário no
    scratchpad (fora do repositório) que insere em `item` e `saldo_estoque`;
  - medir o tempo de servidor de `sugerirItens` e de `listarItensLookup` (com e sem termo, nas
    páginas 1 e 20). Usar `console.time` provisório ou `explain analyze` das consultas geradas,
    sem cache (primeira chamada);
  - registrar os números numa seção "Medições" no fim de
    `specs/021-componente-lookup/quickstart.md` e remover o script e os logs provisórios;
  - acima de 300 ms vira defeito, a ser corrigido antes do merge.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências. T001 depende de T002 (o drizzle-kit gera o índice a
  partir do schema).
- **Foundational (Phase 2)**: depende do Setup. T005 e T006 usam `escaparLike` (T003); T007
  depende de T005 e T006.
- **US1 (Phase 3)**: depende de toda a Phase 2.
- **US2 (Phase 4)**: depende de T012 (o Lookup existe) e de T009/T010.
- **US3 (Phase 5)**: depende de US1. Os campos funcionam só com digitação, e o botão de
  pesquisa aparece em todos assim que US2 estiver pronta. O ideal é fazer depois de US2.
- **Polish (Phase 6)**: depois das stories.

### User Story Dependencies

- **US1 (P1)**: independente depois da Phase 2. É o MVP.
- **US2 (P2)**: estende o componente de US1. Testável só no Descarte.
- **US3 (P3)**: aplica o componente a mais formulários. Cada formulário (T021–T022, T023–T024,
  T025–T027) é independente dos outros.

### Within Each User Story

- Fonte (`fontes.ts`) antes do formulário; formulário antes da `page.tsx` correspondente.
- `entrada-form.tsx`: T025 antes de T026 (mesmo arquivo).

### Parallel Opportunities

- Phase 1: T003 ∥ T004 ∥ T002.
- Phase 2: T008 ∥ T009 ∥ T010 ∥ T011 (arquivos diferentes), em paralelo com T005 → T006 → T007.
- US3: T021–T022 (Saída) ∥ T023–T024 (Kits) ∥ T025–T027 (Entrada), depois de T020.
- Polish: T031 ∥ T032. T035 roda depois de T034, porque a carga de 2.000 itens poluiria as telas usadas no roteiro manual.

---

## Parallel Example: Phase 2

```text
Task: "T008 Estender Combobox (acaoFim, disabled, inputValueExterno, rodapeLista) em src/shared/ui/combobox/combobox.tsx"
Task: "T009 Linha focável e linhaDesabilitada em src/shared/ui/table/table.tsx"
Task: "T010 useListagemLocal em src/shared/query/use-listagem-local.ts"
Task: "T011 FonteLookup e chaveLookup em src/shared/ui/lookup/tipos.ts"
```

## Parallel Example: User Story 3

```text
Task: "T021+T022 Saída (itens e kits) em app/(interno)/(staff)/estoque/saida/"
Task: "T023+T024 Composição de Kits em app/(interno)/(staff)/estoque/kits/"
Task: "T025–T027 Entrada (item valor livre + destinação de kit) em app/(interno)/(staff)/estoque/entrada/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2.
2. Phase 3 (US1): Lookup por digitação no Descarte.
3. **Parar e validar**: quickstart Q1–Q4.

### Incremental Delivery

1. Setup + Foundational → base pronta (Entrada inalterada).
2. US1 → Descarte com digitação (MVP).
3. US2 → botão de pesquisa e tabela paginada (vale para todo Lookup).
4. US3 → Saída, Kits e Entrada migrados, em commits separados por formulário.
5. Polish → documentação e roteiro completo.

## Notes

- Commits sugeridos: `feat(db): unaccent search index` (Phase 1), `feat(ui): Lookup component`
  (US1+US2), um `refactor(estoque): use Lookup in <form>` por formulário e `docs:` (Polish).
- Nenhuma mudança em `domain/` ou `application/` além da remoção de `buscarPorNome` da porta
  (T029).
