# Contrato: leituras do Lookup (021)

Server Functions de **leitura** em `src/modules/estoque/presentation/actions/lookups.ts`
(`'use server'`), separadas das escritas auditadas de `actions/estoque.ts`, no mesmo padrão de
`actions/listagens.ts` (007, L-02: gate de role na action, cache na query).

Todas devolvem `ResultadoAction<…>`; nunca lançam para o cliente.

## Autorização (comum)

- `obterSessao()` + `podeAcessar('/estoque', ator?.role)`; falha ⇒
  `erroAction('nao_autorizado', 'Você não tem permissão para consultar o estoque.')`.
- Nenhuma leitura devolve dados além dos já visíveis em `/estoque` (FR-018).

## Entrada (Zod, `zod-ptbr`)

```ts
const esquemaTermo = z.string().trim().max(100).catch('')
// sugestões
z.object({ termo: esquemaTermo }).catch({ termo: '' })
// páginas: normalizarPaginacao(entrada) + { termo: esquemaTermo }
```

Entrada inválida é saneada (padrão da 007, FR-012 de lá), não recusada.

## Funções

| Função | Retorno | Query (`presentation/queries/estoque.ts`) | Cache |
| ------ | ------- | ---------------------------------------- | ----- |
| `sugerirItensAction({ termo })` | `ResultadoAction<ItemComSaldo[]>` (≤ 5) | `sugerirItens(termo)` | nenhum no servidor (ver research R6) |
| `listarItensLookupAction({ page, pageSize, termo })` | `ResultadoAction<PaginaDe<ItemComSaldo>>` | `listarItensLookup(filtros)` via `paginarComClamp` | idem |
| `sugerirKitsAction({ termo })` | `ResultadoAction<KitLookup[]>` (≤ 5, só ativos) | `sugerirKits(termo)` | idem |
| `listarKitsLookupAction({ page, pageSize, termo })` | `ResultadoAction<PaginaDe<KitLookup>>` (só ativos) | `listarKitsLookup(filtros)` | idem |

### Regras

- L-01: termo com < 2 caracteres em `sugerir*` ⇒ `{ ok: true, valor: [] }` sem consulta.
- L-02: limite de sugestões fixo em 5 no servidor; não parametrizável pelo cliente.
- L-03: com termo, filtro `f_unaccent(nome) % f_unaccent($termo) or f_unaccent(nome) ilike
  '%' || f_unaccent($termoEscapado) || '%' escape '\'`; ordem `similarity desc, nome asc`. Sem
  termo (só páginas): `nome asc`.
- L-04: `$termoEscapado` = `escaparLike(termo)` (escapa `\`, `%`, `_`) — helper puro em
  `src/shared/busca/escapar-like.ts` com teste unitário.
- L-05: páginas usam `paginarComClamp` (página além do fim ⇒ última válida) e devolvem `page` /
  `pageSize` efetivos.
- L-06: kits retornam `totalComponentes` por `count` agregado em `kit_receita_item`
  (`left join … group by kit.id`), não a receita inteira.
- L-07: invalidação — sem cache no servidor, não há tag a invalidar. No cliente, após registrar
  entrada/saída/descarte/kit, `invalidateQueries({ queryKey: RAIZ_LOOKUP })` (`['lookup']`) para
  que saldos nas sugestões não fiquem velhos na mesma aba.
- L-08: meta de leitura < 300 ms (constituição, "listagem de itens na tela de Saída") — garantida
  pelo índice `item_nome_unaccent_trgm_idx` e pelo read-model `saldo_estoque`.

## Remoções

- `buscarItens` (`actions/estoque.ts`) deixa de ter uso após a migração da Entrada e é removida.
  Seu único consumidor de `itemRepository.buscarPorNome` era ela; o método sai da porta
  (`application/ports/estoque-repository.ts`) e do repositório Drizzle, junto com o índice
  `item_nome_trgm_idx` **somente se** nenhuma outra consulta usar `nome %` (verificar na
  implementação; na dúvida, manter o índice).
