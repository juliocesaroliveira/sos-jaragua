# Contrato UI: `Lookup` (021)

Componente de cliente em `src/shared/ui/lookup/lookup.tsx`, exportado pelo barrel
`src/shared/ui/index.ts`. Documentado em `spec/DESIGN_SYSTEM.md` (nova §4.4.1).

## API

```ts
export interface FonteLookup<T> {
    /** Segmento da queryKey: ['lookup', chave, 'sugestoes' | 'pagina', …]. */
    chave: string
    sugerir: (entrada: { termo: string }) => Promise<ResultadoAction<T[]>>
    listar: (entrada: ParametrosPaginacao & { termo?: string }) => Promise<ResultadoAction<PaginaDe<T>>>
    idDe: (registro: T) => string
    descricaoDe: (registro: T) => string
    detalheDe?: (registro: T) => string
    colunas: ColunaTabela<T>[]
    /** Título do diálogo e rótulo acessível da tabela, ex.: "Pesquisar item". */
    tituloPesquisa: string
}

export interface LookupProps<T> {
    id: string
    label: string
    fonte: FonteLookup<T>
    /** Identificador selecionado ('' / null / undefined = vazio). */
    value: string | null | undefined
    /** Texto exibido no input para `value` (seleção ou dado carregado em edição — FR-012). */
    descricao: string
    /** Seleção (sugestão ou diálogo) ou `null` ao desfazer/limpar. */
    onSelecionar: (registro: T | null) => void
    /** Só com `permitirValorLivre`: texto digitado sem seleção (FR-025). */
    onTextoLivre?: (texto: string) => void
    permitirValorLivre?: boolean
    /** Regra do uso (FR-013): motivo ⇒ registro exibido mas não selecionável. */
    motivoIndisponivel?: (registro: T) => string | null
    obrigatorio?: boolean
    apoio?: string
    erro?: string
    disabled?: boolean
    placeholder?: string
    mensagemVazia?: string
    /** `field.ref` do Controller — foco no erro (016, FR-011). */
    ref?: Ref<HTMLInputElement>
}
```

## Comportamento

| # | Regra | Requisito |
| - | ----- | --------- |
| C-01 | Renderiza `Combobox` com botão de pesquisa (`IconButton`, ícone `Search`, nome acessível "Pesquisar {label}", tooltip) no slot `acaoFim`, dentro da borda do campo. | FR-002, FR-017 |
| C-02 | Digitação: debounce 250 ms (do `Combobox`); termo < 2 caracteres ⇒ lista mostra "Digite ao menos 2 caracteres" e não consulta. ≥ 2 ⇒ `useQuery(['lookup', chave, 'sugestoes', termo])`, `staleTime` 30 s. | FR-003, edge "digitação rápida" |
| C-03 | Sugestões: até 5 (`slice(0, 5)` defensivo além do limite do servidor); cada uma com `descricaoDe` + `detalheDe`; indisponíveis aparecem com o motivo (texto, não só cor) e `disabled`. | FR-003, FR-013 |
| C-04 | Estados: carregando (spinner no campo), vazio (`mensagemVazia`), erro ("Não foi possível buscar. Tentar de novo" — item acionável que chama `refetch`). Texto digitado e seleção anterior não se perdem em erro. | FR-016 |
| C-05 | Escolher sugestão ⇒ `onSelecionar(registro)`; input passa a mostrar `descricaoDe(registro)`. **Sincronização prop → input**: o texto do input só é sobrescrito pela prop `descricao` na montagem e quando o **`value` (id) muda** (seleção, limpeza, carga em edição). Digitar nunca reescreve o input a partir da prop, e essa sincronização nunca dispara busca. | FR-004, FR-008, FR-012 |
| C-06 | Editar o texto com algo selecionado ⇒ `onSelecionar(null)` sem alterar o texto em tela; com `permitirValorLivre`, também `onTextoLivre(texto)` a cada alteração (o id não muda, então não há sincronização e a busca com debounce continua). Sem o modo, texto não selecionado é descartado ao sair do campo e o campo fica vazio (validação de obrigatório cuida do envio). | FR-010, FR-025 |
| C-07 | Botão de pesquisa ⇒ abre `LookupDialog` (tamanho `lg`; folha inferior no mobile). Foco inicial no filtro do diálogo. | FR-005, FR-017 |
| C-08 | Diálogo: filtro (`Input`, debounce 250 ms; mudar o termo volta à página 1), `Table` com `paginacao` via `useListagemLocal` (`['lookup', chave, 'pagina', { page, pageSize, termo }]`, `keepPreviousData`). | FR-005, FR-007 |
| C-09 | Clique / Enter / Espaço numa linha disponível ⇒ `onSelecionar(registro)`, diálogo fecha, foco volta ao input. Linha indisponível: `aria-disabled`, atenuada, motivo visível na coluna, sem ação. | FR-006, FR-008, FR-013 |
| C-10 | Fechar o diálogo (X, Esc, backdrop) sem escolher ⇒ nada muda. | FR-009 |
| C-11 | Limpar: campo opcional usa o clear trigger do `Combobox` (⇒ `onSelecionar(null)`); campo obrigatório não mostra limpar (DESIGN_SYSTEM §4.3.1), mas apagar o texto desfaz a seleção. | FR-014 |
| C-12 | `disabled` desativa input e botão de pesquisa. | edge "desabilitado" |
| C-13 | Integra `Campo` (rótulo, `*` obrigatório, apoio, erro abaixo, `aria-invalid`, `aria-describedby`). | FR-011 |
| C-14 | Vários Lookups na mesma tela são independentes (ids derivados de `id`; nenhum estado em URL). | US3-AS4 |

## Extensões em componentes existentes (retrocompatíveis)

- `Combobox`: `acaoFim?: ReactNode`; `OpcaoCombobox.disabled?: boolean`; `inputValueExterno?:
  { texto: string; versao: number }` (sobrescreve o texto só quando `versao` muda, sem disparar
  busca — ver C-05); `rodapeLista?: ReactNode`; `itemToDisabled` na collection. Usos atuais sem mudança.
- `Table`: com `onLinhaClick`, `<tr tabIndex=0>` + Enter/Espaço + anel de foco;
  `linhaDesabilitada?: (linha: T) => boolean`.
- `src/shared/query/use-listagem-local.ts`: `useListagemLocal<T, F>({ chave, buscar, filtros,
  pageSizeInicial? })` → mesmo retorno de `useListagemPaginada` (`rows`, `carregando`,
  `atualizando`, `erro`, `refetch`, `paginacao`) mais `definirFiltros`, sem tocar na URL.

## Usos nesta feature

| Tela | Campo | Fonte | Modo / regra |
| ---- | ----- | ----- | ------------ |
| Entrada | Nome do item | itens | `permitirValorLivre`; seleção preenche categoria/unidade |
| Entrada | Destinação (kit) | kits ativos | opcional; nenhum indisponível (destinação é informativa) |
| Descarte | Item | itens | obrigatório; "Sem saldo" indisponível; saldo do selecionado exibido/validado |
| Saída (avulso) | Item (por linha) | itens | "Sem saldo" indisponível; saldo no detalhe |
| Saída (kit) | Kit (por linha) | kits ativos | "Sem receita" indisponível |
| Kits | Item do componente (por linha) | itens | duplicidade via `superRefine` existente; descrição inicial = `componente.nome` |
