# Data Model: Componente Lookup (021)

Nenhuma tabela nova e nenhuma coluna nova. A feature acrescenta **um índice de expressão** e
**uma função SQL** para a busca sem acento (research R5), e define os tipos de leitura e de
configuração do Lookup.

## Banco (migration nova, `db/migrations/0006_*.sql`)

| Objeto | Definição | Motivo |
| ------ | --------- | ------ |
| Extensão `unaccent` | `CREATE EXTENSION IF NOT EXISTS unaccent` | FR-015 |
| Função `public.f_unaccent(text) returns text` | `IMMUTABLE PARALLEL SAFE STRICT`, corpo `select public.unaccent('public.unaccent', $1)` | `unaccent()` é `STABLE`; índice exige `IMMUTABLE` |
| Índice `item_nome_unaccent_trgm_idx` | `GIN (f_unaccent(nome) gin_trgm_ops)` em `item` | sugestões/tabela de itens < 300 ms com catálogo grande |

- Extensão e função entram como statements manuais na migration (mesmo padrão do `pg_trgm` em
  `0000_*`); o índice é declarado em `db/schema/estoque.ts` com `sql\`f_unaccent(${t.nome})
  gin_trgm_ops\`` para o snapshot do drizzle-kit não tentar removê-lo.
- `item_nome_trgm_idx` (existente): candidato a remoção junto com `buscarPorNome` (ver
  contracts/leituras-lookup.md, "Remoções").
- `kit`: sem índice novo (volume de dezenas de linhas).

## Tipos de leitura (servidor → cliente)

### `ItemComSaldo` (existente, `presentation/queries/estoque.ts`)

`{ id, nome, categoria, unidadeMedida, saldo: number, estoqueMinimo: number | null }` — reutilizado
como registro da fonte de itens. Descrição = `nome`.

### `KitLookup` (novo, mesmo arquivo)

| Campo | Tipo | Observação |
| ----- | ---- | ---------- |
| `id` | `string` (uuid) | |
| `nome` | `string` | descrição exibida |
| `ativo` | `boolean` | Saída e Entrada consultam só ativos |
| `totalComponentes` | `number` | `0` ⇒ "Sem receita" (não selecionável) |

### Parâmetros de busca

`FiltrosLookup = ParametrosPaginacao & { termo?: string; apenasAtivos?: boolean }`

- `termo`: `trim`, máx. 100 caracteres; vazio ⇒ sem filtro (tabela lista tudo por `nome`).
- Sugestões: `termo` com ≥ 2 caracteres (abaixo disso o cliente nem consulta e o servidor
  devolve `[]`), limite fixo **5**.
- Ordenação com termo: `similarity(f_unaccent(nome), f_unaccent(termo)) desc, nome asc`; sem
  termo: `nome asc`.

## Configuração do Lookup (cliente) — `FonteLookup<T>`

Detalhada no contrato [contracts/lookup-componente.md](./contracts/lookup-componente.md). Entidade
conceitual da spec ("Configuração de Lookup"):

| Atributo | Papel |
| -------- | ----- |
| `chave` | identifica a fonte no cache do TanStack Query (`['lookup', chave, …]`) |
| `sugerir(termo)` | Server Function de sugestões (≤ 5) |
| `listar(filtros)` | Server Function paginada (`PaginaDe<T>`) |
| `idDe(r)` / `descricaoDe(r)` | identificador gravado no campo / texto exibido no input |
| `detalheDe?(r)` | linha secundária na sugestão (categoria · unidade · saldo) |
| `colunas` | colunas da tabela do diálogo (`ColunaTabela<T>[]`) |
| `motivoIndisponivel?(r)` | regra do **uso**: texto do motivo ⇒ registro não selecionável |

### Fontes desta feature

| Fonte | Registro | `motivoIndisponivel` por uso |
| ----- | -------- | ---------------------------- |
| `fonteItens` | `ItemComSaldo` | Saída (avulso) e Descarte: `saldo <= 0 ⇒ 'Sem saldo'`; Kits, Entrada: nenhum |
| `fonteKits` (apenas ativos) | `KitLookup` | Saída (kit): `totalComponentes === 0 ⇒ 'Sem receita'`; Entrada (destinação): nenhum |

## Estado do campo (por instância de Lookup)

```
vazio ──digita (<2)──▶ digitando (dica "ao menos 2 caracteres")
vazio/digitando ──digita (≥2)──▶ buscando ──▶ sugestões | sem resultados | erro (tentar de novo)
sugestões ──escolhe disponível──▶ selecionado { id, descricao }
qualquer ──diálogo: clica linha disponível──▶ selecionado
qualquer ──diálogo: fecha sem escolher──▶ estado anterior inalterado (FR-009)
selecionado ──edita texto──▶ digitando (seleção desfeita, FR-010)
          └─ modo valor livre: digitando = valor livre válido (FR-025)
selecionado ──limpar──▶ vazio (FR-014)
```

Mapeamento para o RHF (research R8):

| Formulário | Campo RHF | Valor |
| ---------- | --------- | ----- |
| Descarte | `itemId` | uuid ou `''` |
| Saída | `linhas.N.refId` | uuid do item ou do kit, conforme `tipo` |
| Kits | `componentes.N.itemId` | uuid ou `''`; duplicidade continua no `superRefine` |
| Entrada | `item` (valor livre) + `itemSelecionado` (estado local) | texto; seleção ⇒ item existente |
| Entrada | `kitDestinoId` | uuid ou `undefined` (opcional) |
