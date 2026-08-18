# Data Model: Gestão de Habilidades

**Feature**: 017-gestao-habilidades | **Fonte**: [spec.md](spec.md) §Key Entities, FR-008..FR-014

## Entidades

### Habilidade

Item da lista de referência de competências dos voluntários. Tabela `habilidade` — **já existe**
(`db/schema/voluntariado.ts`); esta feature não cria a tabela, só ajusta constraints.

| Campo | Tipo | Regras |
| --- | --- | --- |
| `id` | `uuid` PK, default random | Imutável. Nunca exibido na tela; usado nas ações de editar/excluir. |
| `nome` | `text` NOT NULL | Único de forma insensível a caixa (INV-01). 2–80 caracteres após normalização (INV-02). Persistido **normalizado** (INV-03). |
| `criadoEm` | `timestamptz` NOT NULL default now | Exibido na listagem (FR-004). Nunca alterado pela edição. |

**Nenhum campo novo.** Descrição, categoria e situação ativo/inativo estão fora de escopo (spec,
Assumptions).

### Vínculo Voluntário–Habilidade

Tabela `voluntario_habilidade` — já existe, **não é escrita** por esta feature. Entra no modelo por dois
motivos: é a origem da contagem exibida na listagem (FR-013) e é o que bloqueia a exclusão (FR-012).

| Campo | Tipo | Observação |
| --- | --- | --- |
| `voluntarioPerfilId` | `uuid` FK → `voluntario_perfil` | `ON DELETE CASCADE` — inalterado. Excluir um voluntário remove as declarações dele; é o comportamento correto. |
| `habilidadeId` | `uuid` FK → `habilidade` | **ALTERADO**: `ON DELETE CASCADE` → `ON DELETE RESTRICT` (research D4). |

## Invariantes

| ID | Invariante | Onde é garantida |
| --- | --- | --- |
| **INV-01** | Não existem duas habilidades cujos nomes difiram apenas por caixa ou espaços nas pontas. | Índice único `lower(nome)` no banco (garantia real, inclusive sob concorrência) + checagem prévia no caso de uso (mensagem amigável). |
| **INV-02** | `nome` tem entre 2 e 80 caracteres depois de normalizado. | `validarNomeHabilidade` no `domain/`; espelhada no esquema do formulário e no da Server Action. |
| **INV-03** | O `nome` persistido está normalizado: sem espaços nas pontas, sem espaços internos repetidos. | `normalizarNomeHabilidade` no `domain/`, aplicada pelo caso de uso antes de chamar o repositório. |
| **INV-04** | Nenhuma linha de `voluntario_habilidade` é removida como efeito de excluir uma habilidade. | FK `RESTRICT` no banco + recusa explícita no caso de uso. |
| **INV-05** | Editar o nome preserva todos os vínculos existentes. | Consequência de a edição ser `UPDATE` de `nome` — o `id` (chave do vínculo) não muda. Coberta por teste. |
| **INV-06** | `criadoEm` nunca muda após a criação. | O `UPDATE` da edição toca apenas `nome`. |

## Normalização do nome (domain)

```text
normalizarNomeHabilidade(entrada):
    trim → colapsar sequências de espaços internos em um único espaço
```

Exemplos que os testes unitários fixam:

| Entrada | Saída |
| --- | --- |
| `"  Motosserra  "` | `"Motosserra"` |
| `"Primeiros    Socorros"` | `"Primeiros Socorros"` |
| `"   "` | `""` → recusado por INV-02 |

A comparação de duplicidade é feita sobre `lower(normalizado)`. **A normalização não altera caixa** — o
nome é exibido como quem cadastrou digitou; só a comparação ignora caixa (FR-009/FR-010).

## Migração

Uma migração, gerada por `npm run db:generate` a partir da alteração em `db/schema/voluntariado.ts`, com
duas mudanças de constraint e nenhum dado migrado:

1. **Índice único funcional**: remove `UNIQUE(nome)`, cria `habilidade_nome_lower_idx` sobre
   `lower(nome)`.
2. **FK restritiva**: recria `voluntario_habilidade.habilidade_id` com `ON DELETE RESTRICT`.

**Pré-condição da migração (1)**: se a base já contiver nomes que colidem ignorando caixa, a criação do
índice falha. A verificação e a limpeza são um passo explícito do roteiro — ver
[quickstart.md](quickstart.md) §Pré-condições. Na base de referência (seed: "Motosserra", "CNH D/E",
"Embarcação", "Primeiros Socorros") não há colisão.

**Reversibilidade**: ambas as mudanças são de constraint; reverter é recriar o `UNIQUE(nome)` e a FK em
`CASCADE`. Nenhum dado é perdido em nenhuma das direções.

## Leituras

### `listarHabilidades(filtros)` — listagem paginada da tela

Entrada: `ParametrosPaginacao` (`page`, `pageSize`), saneada por `normalizarPaginacao`.

Saída: `PaginaDe<LinhaHabilidade>` — via `paginarComClamp`, que corrige a página quando ela ficou além
do fim (cobre a exclusão do último item de uma página, spec §Edge Cases).

```text
LinhaHabilidade = { id, nome, criadoEm, voluntariosVinculados }
```

`voluntariosVinculados` vem de `LEFT JOIN voluntario_habilidade` com `count` agrupado — uma consulta,
sem N+1 (research D5). O `LEFT JOIN` preserva as habilidades com zero vínculos, que são exatamente as
excluíveis.

Ordenação: `nome` ascendente (FR-004). Cache: `'use cache'` + `cacheTag(CACHE_TAGS.habilidadesListagem)`
+ `cacheLife(CACHE_LIFE.medio)`, mesmo contrato de `listarUsuarios`.

### `listarHabilidades()` (lookup existente) — inalterada

`presentation/queries/lookups.ts` continua como está, cacheada sob `CACHE_TAGS.lookups`. Toda escrita
desta feature invalida **as duas** tags, senão uma habilidade recém-criada não apareceria no formulário
de candidatura (FR-016, research D6).

## Escritas

| Operação | Efeito | Recusa quando |
| --- | --- | --- |
| Criar | `INSERT` com nome normalizado | nome inválido (INV-02) ou duplicado ignorando caixa (INV-01) |
| Editar | `UPDATE nome` | nome inválido, duplicado em **outra** habilidade, ou habilidade inexistente |
| Excluir | `DELETE` | habilidade inexistente, ou com ≥1 voluntário vinculado (INV-04) |

Renomear uma habilidade para o próprio nome atual (diferindo só em caixa/espaços) **não** é duplicata —
a checagem de unicidade exclui a própria linha pelo `id`.

Todas as três passam por `withAudit` (`entidade: 'Habilidade'`, tabela `habilidade`), com
`dadosAnteriores` na edição e na exclusão (FR-017).
