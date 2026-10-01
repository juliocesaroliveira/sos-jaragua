# Data Model: Resolução das Pendências Abertas

**Feature**: `020-resolver-pendencias` | **Data**: 2026-10-01

Só uma mudança de schema: o mínimo de segurança por item (Q3, research D4). As demais
entidades da spec (Pendência, Decisão consolidada, Passo operacional) são documentos
Markdown, não dados persistidos.

---

## `item` (alterada)

| Coluna           | Tipo            | Nulo | Default | Mudança  |
| ---------------- | --------------- | ---- | ------- | -------- |
| `id`             | `uuid`          | não  | random  | —        |
| `nome`           | `text`          | não  | —       | —        |
| `categoria`      | enum            | não  | —       | —        |
| `unidade_medida` | enum            | não  | —       | —        |
| `criado_em`      | `timestamptz`   | não  | `now()` | —        |
| `estoque_minimo` | `numeric(14,3)` | sim  | `NULL`  | **nova** |

- Migration `0005_*`, gerada por `npm run db:generate`. Adiciona a coluna anulável e
  **não faz backfill**: todos os itens existentes ficam `NULL` e herdam o limiar global,
  o que mantém o comportamento atual.
- Mesmo tipo `quantidade()` (`numeric(14,3)`) de `saldo_estoque.quantidade_atual`, na
  mesma unidade de medida do item.
- `CHECK (estoque_minimo IS NULL OR estoque_minimo >= 0)`, adicionado na migration, para
  o banco recusar mínimo negativo mesmo fora da Server Action.

### Semântica do valor

| `estoque_minimo` | Limiar efetivo                                                                                | Alerta dispara quando |
| ---------------- | --------------------------------------------------------------------------------------------- | --------------------- |
| `NULL`           | `ALERTA_ESTOQUE_MINIMO` (global, default `5`, lido em `src/shared/config/limiares-alerta.ts`) | `saldo <= global`     |
| `0`              | nenhum: alerta **desligado** para o item                                                      | nunca                 |
| `n > 0`          | `n`                                                                                           | `saldo <= n`          |

A regra vive em `src/modules/estoque/domain/estoque-minimo.ts` (função pura, com teste
unitário) e é a única fonte dessa tabela.

### Validação (domínio, usada pela Entrada e pela edição)

- Vazio → `NULL` ("usar o padrão").
- Número `>= 0`, com até 3 casas decimais e no máximo `99_999_999_999.999` (limite de
  `numeric(14,3)`).
- Item inexistente → erro "Item não encontrado".
- Podem escrever `membro_defesa_civil`, `coordenador` e `administrador` (`ROLES_OPERACAO`): na Entrada, ao criar item novo, e pela tabela de `/estoque`.
- A regra fica num lugar só: `validarEstoqueMinimo` em `src/modules/estoque/domain/estoque-minimo.ts`, usada por `validarEntrada` e por `DefinirEstoqueMinimoUseCase`.

### Leitura

`ItemComSaldo` (`src/modules/estoque/presentation/queries/estoque.ts`) ganha
`estoqueMinimo: number | null`. Ele é consumido por:

- `TabelaEstoque`: coluna "Mínimo", com "Padrão (N)" quando `NULL`, "Sem alerta" quando
  `0`, e destaque visual quando `saldo <= limiar efetivo`.
- `avaliarEstoqueCritico` (alerta de coordenador).
- Exportação de inventário: coluna "Estoque mínimo" na planilha, vazia quando `NULL`.

### Auditoria

`definirEstoqueMinimo` passa por `withAudit`, seguindo o padrão de `salvarKit`:
`entidade: 'Doacao'` (estoque, DB_SCHEMA.md §10), `acao: 'update'`, `tabela: 'item'`,
`dadosAnteriores: { estoqueMinimo }` (valor lido antes da escrita) e
`extrair → { entidadeId: itemId, dadosNovos: { estoqueMinimo } }`.

---

## Sem mudança de schema

- **Rota de cadastro por senha (Q2)**: configuração do better-auth, sem tabela nova.
- **Provedores sociais (item 7)**: derivados do ambiente em tempo de execução.
- **Planilhas (Q1)**: troca de biblioteca, mesmo contrato de dados (`Aba<T>`, `Coluna<T>`).
