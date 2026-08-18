# Contrato: Server Actions de Gestão de Habilidades

**Feature**: 017-gestao-habilidades | **Arquivo**:
`src/modules/voluntariado/presentation/actions/habilidades.ts`

Todas as ações retornam `ResultadoAction<T>` (`src/shared/kernel`) — nunca lançam para o cliente.

## Autorização (aplica-se a TODAS as ações)

| ID | Regra |
| --- | --- |
| **A-01** | Cada ação revalida a sessão com `obterSessao()` e exige role em `['membro_defesa_civil', 'coordenador', 'administrador']`. A checagem é feita **dentro de cada ação**, não herdada do gate da página — Server Actions não herdam gate de Server Component (Princípio IV). |
| **A-02** | Falha de autorização retorna `erroAction('nao_autorizado', <mensagem específica da ação>)`. Nunca lança, nunca redireciona. |
| **A-03** | A mensagem de recusa não revela se o registro existe (ex.: "Você não tem permissão para excluir habilidades.", não "Habilidade X não encontrada"). |
| **A-04** | O ator é propagado para a auditoria via `comAtorDaSessao(ator, ...)`; nenhum caso de uso recebe `actor` como parâmetro explícito (Princípio V). |

## L-01 — `listarHabilidadesAction(entrada: unknown)`

**Retorno**: `ResultadoAction<PaginaDe<LinhaHabilidade>>`

| ID | Regra |
| --- | --- |
| L-01.1 | Entrada é **saneada, não rejeitada**: `normalizarPaginacao` transforma `page=abc`/`pageSize=7` no valor válido mais próximo. Nunca devolve erro de validação por paginação. |
| L-01.2 | Devolve `page`/`pageSize` **efetivos** — o rodapé precisa anunciar a página que está de fato em tela. |
| L-01.3 | Cada linha traz `{ id, nome, criadoEm, voluntariosVinculados }`. `voluntariosVinculados` é `0` para habilidades sem vínculo. |
| L-01.4 | Ordenação por `nome` ascendente. |
| L-01.5 | A checagem de sessão/role acontece aqui, não dentro da query cacheada — uma função `'use cache'` não pode ler `cookies()`. |

## C-01 — `criarHabilidade(entrada: unknown)`

**Entrada**: `{ nome: string }` · **Retorno**: `ResultadoAction<{ id: string }>`

| ID | Regra |
| --- | --- |
| C-01.1 | Parse com Zod: `nome` obrigatório. Falha → `erroAction('validacao', 'Dados de cadastro inválidos.')`. |
| C-01.2 | O nome é normalizado no domínio antes de qualquer checagem ou escrita (INV-03). |
| C-01.3 | Nome com menos de 2 ou mais de 80 caracteres após normalização → `ValidacaoError` com `detalhes.campos.nome` preenchido, para que o erro caia **no campo** no formulário. |
| C-01.4 | Nome já existente ignorando caixa/espaços → erro código `duplicado`, `detalhes.campos.nome = 'Já existe uma habilidade com esse nome.'`. |
| C-01.5 | C-01.4 vale também quando a colisão só é descoberta pelo índice único (corrida): a violação `23505` do Postgres é traduzida no repositório para o **mesmo** erro. O cliente não distingue os dois caminhos. |
| C-01.6 | Sucesso invalida `CACHE_TAGS.habilidadesListagem` **e** `CACHE_TAGS.lookups` (`updateTag` + `revalidateTag`). |
| C-01.7 | Auditada: `entidade: 'Habilidade'`, `acao: 'create'`, `dadosNovos` com id e nome. |

## E-01 — `editarHabilidade(entrada: unknown)`

**Entrada**: `{ id: string; nome: string }` · **Retorno**: `ResultadoAction<{ id: string }>`

| ID | Regra |
| --- | --- |
| E-01.1 | Mesmas regras de normalização e tamanho de C-01.2/C-01.3. |
| E-01.2 | A checagem de duplicidade **exclui a própria linha**: renomear "Motosserra" para "motosserra" é permitido; colidir com **outra** habilidade não é (erro `duplicado`, no campo `nome`). |
| E-01.3 | `id` inexistente → `erroAction('nao_encontrado', 'Esta habilidade não existe mais.')` — cobre o registro excluído por outra pessoa com o diálogo aberto (spec §Edge Cases). |
| E-01.4 | Só `nome` é alterado. `criadoEm` e `id` são imutáveis; nenhum vínculo é tocado (INV-05, INV-06). |
| E-01.5 | Invalidação idêntica a C-01.6. |
| E-01.6 | Auditada: `acao: 'update'`, com `dadosAnteriores` e `dadosNovos`. |

## X-01 — `excluirHabilidade(entrada: unknown)`

**Entrada**: `{ id: string }` · **Retorno**: `ResultadoAction<{ id: string }>`

| ID | Regra |
| --- | --- |
| X-01.1 | `id` inexistente → `erroAction('nao_encontrado', 'Esta habilidade não existe mais.')`. |
| X-01.2 | Habilidade com ≥1 voluntário vinculado → erro código `vinculo_existente`, mensagem citando a quantidade: `"Esta habilidade está vinculada a N voluntário(s). Renomeie-a ou remova os vínculos antes de excluir."` (FR-012). |
| X-01.3 | X-01.2 vale também quando o vínculo é criado entre a contagem e o `DELETE` (corrida): a violação de FK `23503` é traduzida para o mesmo código `vinculo_existente`, com mensagem sem contagem. **Nenhum vínculo é removido em nenhum dos caminhos** (INV-04). |
| X-01.4 | Singular/plural corretos na mensagem — "1 voluntário" e "3 voluntários". |
| X-01.5 | Sucesso invalida as duas tags (C-01.6). |
| X-01.6 | Auditada: `acao: 'delete'`, com `dadosAnteriores` (a habilidade removida). |

## Códigos de erro

| Código | Origem | Tratamento na tela |
| --- | --- | --- |
| `nao_autorizado` | A-01 | Toast de erro. Não deveria ocorrer pela interface (a tela é gated); ocorre em payload forjado. |
| `validacao` | Zod da action | Toast de erro genérico. |
| `duplicado` | C-01.4, E-01.2 | Mensagem **no campo** `nome`, via `aplicarErrosDoServidor`. |
| `nao_encontrado` | E-01.3, X-01.1 | Toast de erro + fechar diálogo + invalidar a listagem. |
| `vinculo_existente` | X-01.2 | Toast de erro; o diálogo de confirmação permanece aberto ou fecha, mas a linha continua na lista. |

## Contrato do repositório (port)

`src/modules/voluntariado/application/ports/habilidade-repository.ts`

| Método | Contrato |
| --- | --- |
| `listar(params)` | `{ rows: LinhaHabilidade[]; totalCount: number }` — com a contagem de vínculos agregada. |
| `buscarPorId(id)` | `Habilidade \| null`. |
| `buscarPorNomeNormalizado(nome)` | `Habilidade \| null` — comparação por `lower()`. Base de C-01.4/E-01.2. |
| `contarVinculos(id)` | `number` — base de X-01.2 e da coluna da listagem. |
| `criar({ nome })` | `Habilidade`. Lança `DuplicadoError` ao receber `23505` do Postgres. |
| `atualizar({ id, nome })` | `Habilidade \| null` (`null` = não existe). Lança `DuplicadoError` em `23505`. |
| `excluir(id)` | `boolean` (`false` = não existe). Lança `VinculoExistenteError` ao receber `23503`. |

A tradução de código de erro do Postgres vive no **repositório** (`infrastructure/`) — é detalhe do
driver e não pode vazar para o caso de uso, que trabalha só com erros de domínio (Princípio I).
