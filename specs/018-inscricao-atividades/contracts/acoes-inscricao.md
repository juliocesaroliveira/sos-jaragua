# Contrato: Server Actions de Inscrição em Turno e Escala

**Feature**: 018-inscricao-atividades

**Arquivos**:

- novo `src/modules/voluntariado/presentation/actions/inscricao-turno.ts`
- alterado `src/modules/voluntariado/presentation/actions/atividades.ts`

Todas as ações retornam `ResultadoAction<T>` (`src/shared/kernel`) e nunca lançam para o cliente.

## Autorização

| ID | Regra |
| --- | --- |
| **A-01** | `inscreverEmTurno` e `desistirDeTurno` revalidam a sessão com `obterSessao()` e exigem role em `['voluntario', 'membro_defesa_civil', 'coordenador', 'administrador']`. Se o usuário for `usuario` ou não tiver sessão, a ação retorna `erroAction('nao_autorizado', 'Você não tem permissão para se inscrever em turnos.')`. |
| **A-02** | O participante é **sempre** o usuário da sessão (`ator.userId`). A entrada não tem campo de usuário ou perfil. |
| **A-03** | `alocarVoluntario` e `cancelarAlocacao` passam a aceitar `ROLES_ESCALA = ['membro_defesa_civil', 'coordenador', 'administrador']` (FR-019a). `criarAtividade`, `editarAtividade` e `alterarStatusAtividade` continuam com `['coordenador', 'administrador']`. |
| **A-04** | O ator é propagado para a auditoria via `comAtorDaSessao(ator, …)` (Princípio V, FR-023). |

## I-01 — `inscreverEmTurno(entrada: unknown)`

**Entrada**: `{ atividadeId: uuid, turnoId: uuid }`

**Retorno**: `ResultadoAction<{ alocacaoId: string }>`

| ID | Regra |
| --- | --- |
| I-01.1 | A entrada é validada com Zod. Se falhar, retorna `erroAction('validacao', 'Turno inválido.')`. |
| I-01.2 | **Elegibilidade (FR-011):** a pessoa precisa ter role de staff ou perfil de voluntário `aprovado`. Se não tiver, retorna o código `nao_elegivel` com a mensagem de [data-model § Regras](../data-model.md#regras-de-validação-domaininscricaots). |
| I-01.3 | As checagens e a escrita acontecem **em uma única transação**, com `pg_advisory_xact_lock` por participante seguido de `SELECT … FOR UPDATE` no turno (research D3). |
| I-01.4 | Códigos de recusa: `nao_encontrado` (turno ou atividade inexistente), `atividade_fechada`, `turno_iniciado`, `lotado`, `ja_inscrito` e `conflito_horario`. Cada código tem a mensagem pt-BR do data-model. `conflito_horario` cita a atividade e o horário do turno que conflita. |
| I-01.5 | **Sucesso:** a alocação fica `confirmado` com `origem = 'inscricao_propria'`, `alocado_por = participante_user_id = ator.userId` e `voluntario_perfil_id` preenchido se a pessoa tiver perfil. Se já existia uma alocação `cancelado` para essa pessoa no turno, a mesma linha é reativada. |
| I-01.6 | **Pós-sucesso, fora da transação:** envia `atividade_atribuida` ao participante e `inscricao_turno` ao `atividade.criado_por`, com o texto "{nome} se inscreveu no turno de {dd/MM} {hh:mm}–{hh:mm} de \"{titulo}\"." Se o envio da notificação falhar, a inscrição não é desfeita. |
| I-01.7 | Grava auditoria `withAudit({ entidade: 'Atividade', acao: 'create', tabela: 'alocacao' })`, com `dadosNovos` contendo `origem`. |
| I-01.8 | Invalida o cache: `updateTag(CACHE_TAGS.atividades)` e `updateTag(tagAtividade(atividadeId))`. |
| I-01.9 | **Idempotência:** em duplo clique, a segunda chamada retorna `ja_inscrito` e não cria uma segunda linha. |

## I-02 — `desistirDeTurno(entrada: unknown)`

**Entrada**: `{ atividadeId: uuid, alocacaoId: uuid }`

**Retorno**: `ResultadoAction<{ alocacaoId: string }>`

| ID | Regra |
| --- | --- |
| I-02.1 | A entrada é validada com Zod. Se falhar, retorna `erroAction('validacao', 'Alocação inválida.')`. |
| I-02.2 | A alocação precisa estar `confirmado` e ter `participante_user_id = ator.userId`. Caso contrário, retorna `nao_encontrado` ("Alocação não encontrada."), sem revelar se a alocação pertence a outra pessoa. |
| I-02.3 | Vale para qualquer origem (`gestao` ou `inscricao_propria`), conforme US3 cenário 3. |
| I-02.4 | Se `agora > turno.inicio − 30 min`, retorna o código `prazo_desistencia` com a mensagem que orienta falar com a coordenação (FR-018a). O prazo é verificado no servidor no momento da ação, não no carregamento da tela. |
| I-02.5 | **Sucesso:** `status = 'cancelado'`, auditoria `acao: 'update'` com `dadosAnteriores` e `dadosNovos`, e notificação `inscricao_turno` ao criador da atividade ("{nome} desistiu do turno…"). O participante não recebe notificação. |
| I-02.6 | Invalida o cache igual a I-01.8. |

## E-01 — `alocarVoluntario`, alterado

| ID | Regra |
| --- | --- |
| E-01.1 | A autorização passa a seguir A-03. |
| E-01.2 | Grava `participante_user_id = perfil.userId` e `origem = 'gestao'`. A reativação de uma linha cancelada também redefine `origem = 'gestao'`. |
| E-01.3 | **Inalterado:** a alocação **não** é bloqueada por falta de vagas (FR-019) nem pelo prazo de 30 minutos. A checagem de sobreposição de horário não é aplicada; a decisão fica com a gestão. |

## E-02 — `cancelarAlocacao`, alterado

| ID | Regra |
| --- | --- |
| E-02.1 | A autorização passa a seguir A-03. Os demais comportamentos não mudam e não há prazo, porque é a gestão quem cancela. |
| E-02.2 | O destinatário da notificação passa a ser resolvido por `participante_user_id`, o que também cobre participantes sem perfil de voluntário. |
