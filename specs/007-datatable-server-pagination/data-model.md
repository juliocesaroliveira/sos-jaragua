# Data Model: Rodapé de paginação server-side no DataTable

**Feature**: 007-datatable-server-pagination | **Data**: 2026-08-13

Esta feature **não cria nem altera tabelas**. O modelo abaixo descreve os tipos transversais que atravessam a fronteira servidor ↔ cliente.

---

## Constantes

```
TAMANHOS_PAGINA        = [5, 10, 20, 50]   (readonly, ordem de exibição no seletor)
TAMANHO_PAGINA_PADRAO  = 20
```

Origem: FR-004 (opções exatas) e FR-018 (padrão). Substituem os `const TAMANHO_PAGINA = 20` locais hoje repetidos em `admin/page.tsx`, `voluntarios/page.tsx` e `estoque/page.tsx`.

---

## `ParametrosPaginacao`

Entrada de qualquer leitura paginada.

| Campo      | Tipo    | Regras                                                                                             |
| ---------- | ------- | -------------------------------------------------------------------------------------------------- |
| `page`     | inteiro | ≥ 1. Valor ausente, não numérico, 0 ou negativo → `1` (FR-012)                                     |
| `pageSize` | inteiro | deve pertencer a `TAMANHOS_PAGINA`; qualquer outro valor → `TAMANHO_PAGINA_PADRAO` (FR-012/FR-018) |

**Saneamento**: `esquemaPaginacao` (Zod com `.catch()`), aplicado nos **dois** lados — no Server Component ao ler `searchParams` e dentro da server function ao receber a entrada do cliente. Nunca lança; sempre produz um par válido.

**Invariante de clamp** (edge case "página além do fim"): resolvido no servidor. Se `totalCount > 0` e `(page - 1) * pageSize >= totalCount`, a leitura é refeita na última página válida `ceil(totalCount / pageSize)` e o valor efetivo volta no resultado.

---

## `PaginaDe<T>`

Saída de qualquer leitura paginada.

| Campo        | Tipo        | Significado                                                                |
| ------------ | ----------- | -------------------------------------------------------------------------- |
| `rows`       | `T[]`       | registros **apenas** da página solicitada; nunca a lista completa (FR-008) |
| `totalCount` | inteiro ≥ 0 | total no servidor para os filtros vigentes (FR-002/FR-010)                 |
| `page`       | inteiro ≥ 1 | página efetivamente servida, após clamp                                    |
| `pageSize`   | inteiro     | tamanho efetivamente aplicado, após saneamento                             |

`rows` + `totalCount` já é o formato devolvido por `UsuarioRepository.listar`, `listarVoluntarios` e `listarEstoque`. Os campos `page`/`pageSize` são **novos** e existem para que o cliente saiba o que o servidor de fato aplicou quando a entrada foi corrigida.

**Derivados calculados no cliente** (não trafegam):

```
totalPaginas   = totalCount === 0 ? 1 : ceil(totalCount / pageSize)
primeiroDaFaixa = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
ultimoDaFaixa   = min(page * pageSize, totalCount)
```

FR-003 usa os três; com `totalCount === 0` o rodapé exibe "0 registros" e "Página 1 de 1" com controles desabilitados.

---

## `ParametrosListagem` (por tela)

Composição de `ParametrosPaginacao` com os filtros já existentes de cada tela. Nenhum filtro novo é introduzido por esta feature — apenas precisam ser preservados na navegação (FR-019).

| Tela                       | Filtros existentes     | Chave de cache/query                                                                        |
| -------------------------- | ---------------------- | ------------------------------------------------------------------------------------------- |
| `/admin`                   | —                      | `identidade:listagem` → `['identidade','listagem',{page,pageSize}]`                         |
| `/voluntarios`             | `status`, `habilidade` | `voluntariado:listagem` → `['voluntariado','listagem',{page,pageSize,status,habilidadeId}]` |
| `/estoque`                 | `categoria`            | `estoque:listagem` → `['estoque','listagem',{page,pageSize,categoria}]`                     |
| `/relatorios` (inventário) | —                      | `estoque:listagem`                                                                          |
| `/relatorios` (saídas)     | —                      | `estoque:saidas` (**tag nova** em `CACHE_TAGS`)                                             |

A correspondência `queryKey` ↔ `cacheTag` segue a convenção já documentada em `src/shared/cache/tags.ts`.

---

## Estado de UI do rodapé

Não persistido em banco. Vive na URL (`?page=&pageSize=`), o que satisfaz FR-011 e a assumption de que a escolha **não** é persistida no perfil entre sessões.

Transições:

| Ação                        | Efeito                                                     |
| --------------------------- | ---------------------------------------------------------- |
| escolher página _N_         | `page = N`; `pageSize` e filtros preservados (FR-019)      |
| trocar `pageSize`           | `pageSize = novo`, `page = 1` (FR-005)                     |
| trocar filtro (existente)   | `page = 1`; `pageSize` preservado                          |
| recarregar/compartilhar URL | estado reconstruído por `esquemaPaginacao` (FR-011/SC-006) |

Toda mudança usa `router.replace(..., { scroll: false })` — o histórico do navegador não acumula um passo por clique de página (D9).
