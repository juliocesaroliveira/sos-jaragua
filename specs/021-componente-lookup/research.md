# Research: Componente Lookup (021)

Decisões técnicas que resolvem as incógnitas do Technical Context do [plan.md](./plan.md).

## R1 — Base do componente: estender o `Combobox` existente, não um primitivo novo

- **Decision**: o `Lookup` (`src/shared/ui/lookup/`) é uma composição de `Combobox` +
  botão de pesquisa + `LookupDialog`. O `Combobox` (`src/shared/ui/combobox/combobox.tsx`)
  ganha três extensões retrocompatíveis: (a) slot `acaoFim?: ReactNode` renderizado dentro do
  `Ark.Control`, à direita do spinner/limpar; (b) `OpcaoCombobox.disabled?: boolean` repassado
  ao `Ark.Item` (o primitivo já respeita `itemToDisabled` da collection); (c) `inputValueExterno`
  opcional (`{ texto, versao }`), para que o Lookup consiga escrever a descrição no input após
  uma seleção feita pelo diálogo. É versionado, e não um `inputValue` controlado a cada render,
  porque um controle contínuo apagaria o texto em digitação quando a seleção é desfeita
  (`descricao` vira `''`) e, no modo valor livre, faria cada tecla parecer uma sincronização
  externa e suprimir a busca. O texto só é sobrescrito quando o id selecionado muda.
- **Rationale**: o `Combobox` já resolve debounce, `ref` para foco de erro (016), integração com
  `Campo` (rótulo/apoio/erro/`aria-describedby`), clear trigger e `permitirValorLivre` — tudo
  que o Lookup precisa. Um segundo combobox duplicaria esse comportamento e o DESIGN_SYSTEM §4.4.
- **Alternatives considered**: (1) componente novo sobre `Ark.Combobox` direto — duplica ~150
  linhas e as correções já acumuladas (laço de `onBuscar`, clique-fora do limpar); (2) Lookup
  sem combobox (input + popover manual) — perde a semântica `role=combobox`/listbox exigida
  pelo FR-017.

## R2 — Busca de sugestões: TanStack Query com chave por termo

- **Decision**: o termo com debounce (já emitido por `onBuscar`) vira estado do Lookup e
  alimenta um `useQuery({ queryKey: ['lookup', fonte.chave, 'sugestoes', termo], enabled:
  termo.trim().length >= 2, staleTime: 30s })`. Abaixo de 2 caracteres a lista mostra a dica
  "Digite ao menos 2 caracteres".
- **Rationale**: a chave por termo elimina a condição de corrida da spec (resposta de busca
  antiga sobrescrevendo a nova) sem `AbortController` manual — o TanStack Query só entrega os
  dados da chave corrente. Também dá estado de erro + `refetch` para o edge case de
  conectividade instável. Stack já adotada (constituição: TanStack Query + Server Actions).
- **Alternatives considered**: `useState` + chamada direta à action (padrão atual da Entrada) —
  sujeito à corrida e sem retry; `useTransition` — não resolve ordem de respostas.

## R3 — Tabela do diálogo: paginação local, não na URL

- **Decision**: novo hook `useListagemLocal` em `src/shared/query/` com a mesma semântica de
  `useListagemPaginada` (envelope `ResultadoAction` → exceção, `keepPreviousData`, objeto
  `paginacao` pronto para o `TableFooter`), mas com `page`/`pageSize`/`termo` em `useState`.
  Tamanho padrão: `TAMANHO_PAGINA_PADRAO` (5) e opções `TAMANHOS_PAGINA`.
- **Rationale**: `useListagemPaginada` lê e escreve `searchParams`; um diálogo dentro de um
  formulário não pode alterar a URL da tela (recarregar a página reabriria a paginação de um
  diálogo fechado, e dois Lookups na mesma tela disputariam os mesmos parâmetros). Mantém o
  contrato de leitura paginada da 007 (`PaginaDe<T>`, `normalizarPaginacao`, clamp) intacto.
- **Alternatives considered**: parametrizar `useListagemPaginada` com um "adaptador de
  estado" — muda a assinatura de um hook usado por 4+ telas por um ganho pequeno; `prefixo` de
  URL por Lookup — vaza estado efêmero na URL.

## R4 — Seleção por linha acessível por teclado no `Table`

- **Decision**: quando `onLinhaClick` está presente, o `<tr>` recebe `tabIndex={0}`, ativa com
  Enter/Espaço e ganha anel de foco; nova prop opcional `linhaDesabilitada?: (linha) => boolean`
  aplica `aria-disabled`, estilo atenuado e ignora clique/tecla. O diálogo foca o filtro ao abrir;
  Tab leva às linhas.
- **Rationale**: hoje o `<tr>` clicável não é focável — o FR-006/FR-017 (seleção por teclado)
  não seria atendível. Nenhuma tela usa `onLinhaClick` atualmente, então a mudança não altera
  comportamento existente.
- **Alternatives considered**: botão "Selecionar" em cada linha — dobra os alvos de toque e o
  pedido explícito é "clicar na linha"; grid ARIA com roving tabindex — complexidade
  desproporcional para tabelas de 5–50 linhas.

## R5 — Busca sem acento: extensão `unaccent` + índice trigram de expressão

- **Decision**: migration nova cria `unaccent` e uma função `IMMUTABLE` `public.f_unaccent(text)`
  (wrapper de `unaccent('public.unaccent', $1)`, necessária porque `unaccent()` é `STABLE` e não
  pode compor índice). Índice novo `item_nome_unaccent_trgm_idx` GIN em
  `f_unaccent(nome) gin_trgm_ops`. As buscas do Lookup comparam
  `f_unaccent(nome) % f_unaccent(:termo) or f_unaccent(nome) ilike '%' || f_unaccent(:termo) || '%'`,
  ordenadas por `similarity` e depois `nome`. O termo tem `%`, `_` e `\` escapados antes do
  `ilike` (helper puro `escaparLike`, com teste). Para kits (dezenas de linhas) a mesma
  expressão sem índice dedicado.
- **Rationale**: FR-015 exige "agua" encontrar "Água". `pg_trgm` sozinho é sensível a acento e o
  `ilike` atual também. `unaccent` é extensão nativa suportada pelo Neon — não é dependência de
  infraestrutura nova (Princípio VI), mas é registrada no DESIGN.md §19. O índice antigo
  `item_nome_trgm_idx` servia só a `buscarPorNome`, que perde o único consumidor (ver
  contracts/leituras-lookup.md, "Remoções").
- **Alternatives considered**: normalizar no cliente — não resolve o acento do lado gravado;
  coluna gerada `nome_busca` — exige backfill e mais uma coluna para manter; `unaccent` sem
  wrapper imutável — Postgres recusa no índice e a busca viraria seq scan.

## R6 — Leituras do Lookup: Server Functions finas + queries **sem** cache no servidor

- **Decision**: novo arquivo `src/modules/estoque/presentation/actions/lookups.ts`
  (`'use server'`) com quatro leituras: `sugerirItensAction`, `listarItensLookupAction`,
  `sugerirKitsAction`, `listarKitsLookupAction`. Cada uma: gate `podeAcessar('/estoque', role)`,
  parse Zod (`termo` ≤ 100 chars, paginação via `normalizarPaginacao`), chama uma query em
  `presentation/queries/estoque.ts` (`sugerirItens`, `listarItensLookup`, `sugerirKits`,
  `listarKitsLookup`). Sugestões: `limit 5` fixo no servidor (o cliente não escolhe).
- **Sem `'use cache'`** (revisto na implementação, 2026-10-05): o plano previa cachear as
  queries, mas o termo muda a cada tecla — cachear por termo encheria o cache de entradas de uso
  único, a mesma razão já registrada no antigo `buscarItens` da Entrada. A velocidade vem do
  índice de expressão (medido em quickstart.md, "Medições": < 4 ms no banco com 2.000 itens) e
  a repetição imediata é absorvida pelo TanStack Query no cliente. Consequência: a tag
  `estoque:itens`, cujo único leitor era o `listarItens` removido, saiu do catálogo.
- **Rationale**: segue o padrão de `listagens.ts` (gate na action, leitura na query) —
  leituras separadas das escritas auditadas.
- **Alternatives considered**: Route Handler GET `/api/lookup/[fonte]` genérico — cria uma
  superfície de autorização nova e um registro de "fontes" no servidor sem necessidade agora;
  reutilizar `listarEstoqueAction` — não tem filtro por termo e o filtro `categoria` não serve.

## R7 — Regras de "não selecionável" e saldo nos formulários

- **Decision**: a fonte de dados devolve o registro completo (`ItemComSaldo`, `KitLookup`); a
  regra de bloqueio é uma função da **configuração do uso** (`motivoIndisponivel?: (r) => string
  | null`), não do servidor: Saída de itens → `saldo <= 0 ? 'Sem saldo' : null`; Saída/Entrada de
  kits → `componentes === 0 ? 'Sem receita' : null`. Os formulários guardam o registro
  selecionado (callback `onSelecionar`) para exibir/validar saldo, substituindo o
  `itens.find(...)` sobre o catálogo inteiro.
- **Rationale**: a mesma fonte de itens serve a formulários com regras diferentes (Saída e
  Descarte bloqueiam item sem saldo — como o `disabled: i.saldo <= 0` atual dos dois selects;
  Kits e Entrada aceitam). Destinação de kit da Entrada não bloqueia kit sem receita: hoje todo
  kit ativo é selecionável e o campo é informativo (FR-024). O servidor continua sendo a autoridade — os casos
  de uso de saída/descarte recusam déficit independentemente da UI.
- **Consequência**: as páginas `saida`, `descarte` e `kits` deixam de carregar `listarItens()`
  inteiro para alimentar selects. A Saída também deixa de carregar `listarKitsComReceita(true)`
  (o form só usava os kits para montar as opções; o payload envia `kitId` e a dedução da receita
  é feita no servidor). A Entrada deixa de carregar kits pelo mesmo motivo. A tela Kits mantém
  `listarKitsComReceita()` — ela é a listagem dos próprios kits — e o mapa `saldos` usado em
  `kitsPossiveis` passa a ser derivado de `kit.componentes[].saldo` (que a query já devolve),
  pois só é consultado para os itens das receitas listadas.

## R8 — Valor do campo e descrição inicial

- **Decision**: o campo do RHF continua guardando só o identificador (`string`, `''` = vazio),
  como hoje (`itemId`, `refId`, `componentes.N.itemId`, `kitDestinoId`). O Lookup recebe
  `descricao` (texto exibido) como prop controlada junto ao `value`; o formulário obtém a
  descrição do registro selecionado ou, em edição, do dado já carregado (`kit.componentes[].nome`).
  No modo valor livre (Entrada), o campo `item` guarda o texto e o formulário guarda o registro
  selecionado à parte — exatamente o modelo atual de `itemSelecionado`.
- **Rationale**: preserva os esquemas Zod e os payloads das Server Actions atuais (FR-024); não
  há alteração em `domain`/`application`.
- **Alternatives considered**: valor composto `{ id, descricao }` no RHF — mudaria todos os
  esquemas e mensagens de erro já mapeadas por campo.
