# Data Model: Cards de Escala na Página da Atividade

**Feature**: 019-cards-escala-atividade

**Sem mudança de dados.** Nenhuma tabela, coluna, migração, query, caso de uso ou Server Action é alterado. A feature consome o modelo de leitura que já existe em `src/modules/voluntariado/presentation/queries/atividades.ts`.

## Modelo de leitura consumido

### `AtividadeDetalhada` (retorno de `buscarAtividadeDetalhada`)

| Campo                                    | Uso na página                                              |
| ---------------------------------------- | ---------------------------------------------------------- |
| `id`                                     | Alvo das ações de alocar e remover                         |
| `titulo`, `status`, `categoria`, `local` | Cabeçalho da atividade (inalterado)                        |
| `status`                                 | `aberta` libera a ação de alocar nos cards (FR-010/FR-012) |
| `turnos: TurnoDetalhado[]`               | Um card por item, na ordem recebida                        |

### `TurnoDetalhado` → um card de escala

| Campo                        | Uso no card                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `id`                         | `key` do card e alvo da alocação                                                                           |
| `inicio`, `fim`              | Cabeçalho do card: `HH:mm – HH:mm · dd/MM` (fuso `America/Sao_Paulo`) e rótulo acessível da ação de alocar |
| `vagas`, `preenchidas`       | Ocupação "X de Y" e destaque de déficit (FR-006)                                                           |
| `alocados: AlocadoNoTurno[]` | Lista vertical de voluntários (FR-007). Vazia → mensagem de estado vazio (FR-008)                          |

### `AlocadoNoTurno` → um item da lista do card

| Campo                | Uso                                                              |
| -------------------- | ---------------------------------------------------------------- |
| `alocacaoId`         | `key` e alvo da remoção                                          |
| `nome`               | Nome (truncado visualmente) e rótulo "Remover {nome} do turno"   |
| `role`               | `IconePapel`                                                     |
| `origem`             | Selo "Inscrição própria" quando `inscricao_propria`              |
| `voluntarioPerfilId` | Exclui da lista de disponíveis no diálogo de alocar (inalterado) |

## Ordenação

- **Turnos:** a query já retorna `orderBy(asc(turno.inicio))`, a ordem cronológica de início pedida por FR-002. Não é preciso ordenar no cliente.
- **Voluntários de um turno:** ordem alfabética por nome, também já vinda da query.

## Valores derivados (apenas na apresentação)

| Valor               | Regra                                                      |
| ------------------- | ---------------------------------------------------------- |
| Contagem de escalas | `turnos.length` → `"1 escala"` ou `"N escalas"`            |
| Rótulo de alocar    | `Alocar voluntário no turno de {dd/MM}, {HH:mm} – {HH:mm}` |
