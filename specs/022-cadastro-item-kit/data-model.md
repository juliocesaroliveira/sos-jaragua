# Data Model: Cadastro de item novo na composição de kit

Feature: [spec.md](./spec.md) · Decisões: [research.md](./research.md)

## Mudança de schema (1 migration, `db/migrations/0007_*.sql`)

### `item` (existente) — nova coluna

| Coluna | Tipo | Regra |
|--------|------|-------|
| `aguardando_primeira_entrada` | `boolean not null default false` | `true` só para item criado pelo kit; volta a `false` na primeira entrada do item (R5). Itens existentes ficam `false`. |

Sem índice novo: a coluna só é lida junto com a linha do item (listagem e inventário), nunca
como filtro.

Nada muda em `kit`, `kit_receita_item` e `saldo_estoque`. O item criado pelo kit ganha a
linha de `saldo_estoque` com `0` na mesma transação, como faz a Entrada.

## Tipos de domínio (`src/modules/estoque/domain/receita-kit.ts`)

```text
ComponenteInformado =
  | { tipo: 'existente', itemId: string, quantidadePorKit: number }
  | { tipo: 'novo', novoItem: NovoItem, quantidadePorKit: number }

NovoItem = { nome: string, categoria: CategoriaItem, unidadeMedida: UnidadeMedida, estoqueMinimo: number | null }
```

### Regras de validação (`validarReceita`, puro, com teste)

Os erros voltam por campo, com chave pelo caminho do formulário.

| # | Regra | Chave do erro | Mensagem |
|---|-------|---------------|----------|
| V1 | ao menos 1 componente | `componentes` | O kit precisa de ao menos um componente. |
| V2 | `quantidadePorKit > 0` | `componentes.N.quantidade` | Informe a quantidade por kit. |
| V3 | item novo com nome não vazio depois do `trim` | `componentes.N.itemId` | Selecione ou digite o item. |
| V4 | `estoqueMinimo` do item novo válido (`validarEstoqueMinimo`, feature 020) | `componentes.N.estoqueMinimo` | (mensagem da 020) |
| V5 | sem repetição pela chave `itemId` ou `'novo:' + normalizarNomeItem(nome)` | `componentes.N.itemId` (a 2ª ocorrência em diante) | Este item já está na receita. |

`normalizarNomeItem(nome)`: `trim` → NFD → remove diacríticos → minúsculas (pt-BR). Ver R3.

## Resolução no repositório (`KitRepository.salvarComposicao`)

Para cada componente `novo`, em ordem de `normalizarNomeItem`, dentro da transação:

```text
lock(nomeNormalizado) → equivalentes = itens com f_unaccent(nome) ILIKE f_unaccent(nome)
  0 → cria item (aguardando_primeira_entrada = true) + saldo_estoque 0 → itensCriados
  1 → usa o id existente → vinculos
  >1 → conflito { indice, tipo: 'ambiguo' }
```

Depois da resolução, se dois componentes apontam para o mesmo id (por exemplo, um nome novo
que vinculou a um item já selecionado em outra linha), o resultado é o conflito
`{ indice, tipo: 'repetido' }`. Havendo qualquer conflito, a transação é revertida e nada é
gravado. Sem conflitos, o kit é criado ou atualizado e a receita é substituída inteira.

### Port

```text
KitRepository.salvarComposicao({
  id?, nome, descricao, ativo,
  componentes: ComponenteInformado[]
}) → Promise<
  | { kit: Kit, receita: ComponenteReceita[], itensCriados: Item[], vinculos: { indice: number, itemId: string }[] }
  | { conflitos: { indice: number, tipo: 'ambiguo' | 'repetido' }[] }
  | null            // id informado e kit inexistente
>
```

São removidos do port `criar`, `atualizar` e `definirReceita`, que ficam sem consumidor (R2).

## Leituras

`ItemComSaldo` (`presentation/queries/estoque.ts`) ganha `aguardandoPrimeiraEntrada: boolean`.
Estas consultas passam a selecionar a coluna:

- `buscarEstoque` (listagem): o selo "abaixo do mínimo" da tabela;
- `inventarioParaExportacao`: o alerta de estoque crítico (`reavaliarAlertasDeEstoque`).

`itensCriticos<T extends { saldo; estoqueMinimo; aguardandoPrimeiraEntrada?: boolean }>` ignora
os itens com `aguardandoPrimeiraEntrada === true`. O campo é opcional no genérico, para os
chamadores que não o carregam continuarem compilando com o comportamento atual.

## Transições de estado do item

```text
[criado pela Entrada] ──────────────────────────────► aguardando = false (avaliado no alerta)
[criado pelo Kit] → aguardando = true (fora do alerta) ──1ª entrada──► aguardando = false
```

Não existe transição de volta para `true`.
