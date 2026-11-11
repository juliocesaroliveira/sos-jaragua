---
description: 'Task list for 026-danger-zone-admin'
---

# Tasks: Danger Zone — manutenção irrestrita de dados pelo administrador

**Input**: Design documents from `specs/026-danger-zone-admin/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: incluídos.
- A constituição (Princípio III) exige TDD em `domain/` e `application/`.
- Unitários: `*.test.ts`, rodados por `npm test`, sem rede.
- Integração: `*.integracao.test.ts`, rodados por `npm run test:integracao` contra o Neon de
  desenvolvimento **compartilhado**. Por isso, nenhum teste automatizado reseta tabela inteira: só
  `excluir_selecionados` sobre linhas criadas pelo próprio teste (quickstart).
- Escreva cada teste antes da implementação correspondente e confirme que ele falha.

**Organization**: tarefas agrupadas pelas user stories da spec (US1 a US3), para entrega
incremental.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência de tarefa incompleta)
- **[Story]**: user story atendida (US1…US3)

## Convenções para quem implementa

- **Next.js 16:** ler `AGENTS.md`. A versão tem APIs diferentes; consultar
  `node_modules/next/dist/docs/` antes de usar Server Actions, `updateTag` e `revalidateTag`.
- **Textos e comentários:** interface em pt-BR. Comentários no estilo do código vizinho, explicando
  o *porquê* e citando `research Dn` / `FR-nnn`.
- **Domínio puro:** `src/modules/manutencao/domain/` não importa Next, Drizzle nem Mongo
  (Princípio I).
- **Auditoria bloqueante:** a Danger Zone **não** usa `withAudit`. Ela usa a porta bloqueante
  `RegistroExecucaoManutencao` do módulo Auditoria (contracts/auditoria-manutencao.md). O
  `withAudit` e a política de degradação ficam intactos.
- **Dados que não podem vazar:** nenhum valor sensível em texto plano nem coluna de credencial em
  resposta de action, `console.*` ou snapshot (research D9).
- **Onde está cada referência:**
  - catálogo e classificação: research D3 e data-model §1;
  - algoritmo: research D6 e D7;
  - ordem da execução e auditoria: research D8;
  - actions: contracts/acoes-danger-zone.md;
  - telas: contracts/ui-danger-zone.md.

---

## Phase 1: Setup (Esquema, constantes e documentação)

**Purpose**: estrutura do módulo novo, registros padrão e ajuste de índice — nada disso tem
comportamento visível ainda.

- [X] T001 Criar a árvore do módulo `src/modules/manutencao/` com `domain/`, `application/ports/`, `application/use-cases/`, `infrastructure/drizzle/`, `presentation/actions/` e um `index.ts` vazio que reexporte só o que `app/` vai consumir (plan.md → Source Code)
- [X] T002 [P] Criar `src/shared/kernel/registros-sistema.ts` com `REGISTROS_SISTEMA` = `{ usuario: 'sistema-usuario-removido', item: '00000000-0000-4000-8000-000000000001', categoriaAtividade: '00000000-0000-4000-8000-000000000002' }`, os rótulos ("Usuário removido", "Item removido", "Categoria removida") e um helper `ehRegistroSistema(tabela, chave)`; reexportar em `src/shared/kernel/index.ts` (research D4)
- [X] T003 Em `db/schema/voluntariado.ts`, tornar `alocacao_turno_participante_idx` parcial com `.where(sql\`${t.participanteUserId} <> 'sistema-usuario-removido'\`)` e comentar o motivo (research D5)
- [X] T004 Gerar a migração com `npm run db:generate` e acrescentar ao SQL gerado em `db/migrations/00NN_*.sql` os três `INSERT … ON CONFLICT DO NOTHING` dos registros padrão (`user` com `ativo = false`, `role = 'usuario'`, e-mail `usuario-removido@sistema.invalid`; `item` categoria `outros` / unidade `unidade`; `atividade_categoria`), conforme data-model §2. Os ids são literais no SQL, iguais aos de T002
- [X] T005 [P] Em `src/shared/db/mongo/audit-logs.ts`: acrescentar `'ManutencaoDados'` a `ENTIDADES_AUDITADAS`; acrescentar o campo opcional `manutencao?: { id: string; fase: 'iniciada' | 'snapshot' | 'concluida' | 'falhou' | 'recusada' | 'cancelada'; resumo?: Record<string, unknown> }` a `RegistroAuditoria`; e acrescentar o índice parcial `manutencao_execucao_timestamp` em `garantirIndicesAuditoria` (data-model §3)
- [X] T006 [P] Acrescentar o rótulo `ManutencaoDados: 'Manutenção de dados'` em `ROTULO_ENTIDADE_AUDITADA` de `src/modules/auditoria/presentation/queries/trilha.ts`. Sem isso o `tsc` quebra, porque o `Record` é exaustivo

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: catálogo, grafo, conferência com o banco, porta de auditoria, sessão recente e
filtros de registros padrão. Todas as histórias dependem disso.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

### Testes primeiro

- [X] T007 [P] Escrever `src/modules/manutencao/domain/catalogo.test.ts`. Ele verifica que:
  - o catálogo tem as 26 tabelas e os 30 vínculos de research D3;
  - todo vínculo `historico` + `obrigatorio` aponta para `user`, `item` ou `atividade_categoria`;
  - nenhuma tabela expõe coluna de `colunasCredencial` em `colunasExibidas`;
  - toda tabela tem `rotulo`, `area` e `colunaRotulo`.
- [X] T008 [P] Escrever `src/modules/manutencao/domain/conferir-catalogo.test.ts`. Com FKs físicas fabricadas, ele verifica que:
  - catálogo e banco iguais não geram divergência;
  - uma FK física ausente do catálogo bloqueia as duas tabelas ligadas;
  - um vínculo do catálogo sem FK física bloqueia;
  - `obrigatorio` ou `regraBanco` diferentes do banco bloqueiam.
  Ver research D2 e FR-013a.
- [X] T009 [P] Escrever `src/modules/manutencao/domain/grafo.test.ts`. Ele verifica:
  - a ordem topológica de exclusão (filhos antes dos pais);
  - a expansão até o ponto fixo num grafo com ciclo artificial, sem loop e com cada tabela uma vez;
  - a regra "exclusão prevalece sobre redirecionamento" (uma linha alcançada por vínculo inseparável e por vínculo histórico é apagada);
  - que, no modo cascata, todo vínculo propaga exclusão;
  - que, no modo preservação, só os inseparáveis propagam.
  Ver research D6.
- [X] T010 [P] Escrever `src/modules/manutencao/domain/previa.test.ts`. Ele verifica:
  - o texto de confirmação: `RESETAR item` e `EXCLUIR 3 DE item`;
  - a igualdade estrutural de `ImpressaoDigital`, independente da ordem das chaves;
  - que `temDependentes` é falso quando todos os dependentes têm zero linhas;
  - o truncamento da amostra em 5 itens com "e mais N registros".
- [X] T011 [P] Escrever `src/modules/auditoria/registro-manutencao.test.ts`, com a coleção mockada. Ele verifica que:
  - os snapshots saem com cpf, cep e data de nascimento redigidos;
  - as colunas de credencial saem **removidas**;
  - um `insertMany` que falha propaga o erro e não engole;
  - nenhum snapshot vai para `console.*`.
  Ver AM-01 a AM-04.

### Implementação

- [X] T012 [P] Implementar `src/modules/manutencao/domain/catalogo.ts`, que faz T007 passar:
  - tipos `TabelaGerenciavel` e `Vinculo` (data-model §1);
  - as 26 tabelas, com `chavePrimaria`, `colunaRotulo` (para tabelas sem coluna textual natural, como `saldo_estoque`, `verification`, `notificacao_envio` e `turno`, um rótulo composto declarado no catálogo: rótulo do pai + coluna distintiva, por exemplo "Arroz 5 kg · saldo" ou "Notificação X · whatsapp"), `colunasExibidas`, `colunasSensiveis` e `colunasCredencial` (`account.password`, `access_token`, `refresh_token`, `id_token`, `session.token`, `verification.value`);
  - os 30 vínculos com a classificação de research D3;
  - um comentário curto por vínculo `historico` ou `inseparavel` que contrarie a regra física, explicando o motivo.
- [X] T013 [P] Implementar `src/modules/manutencao/domain/conferir-catalogo.ts` (`conferirCatalogo(catalogo, fksFisicas) → { tabelasBloqueadas: Map<string, string[]> }`) para T008 passar
- [X] T014 [P] Implementar `src/modules/manutencao/domain/grafo.ts`, que faz T009 passar:
  - `ordemDeExclusao(catalogo)`;
  - `propaga(vinculo, modo) → 'apagar' | 'redirecionar'`;
  - `expandirAtePontoFixo(estado, passo)`, genérico sobre uma função de passo injetada, para o domínio não conhecer SQL.
- [X] T015 [P] Implementar `src/modules/manutencao/domain/previa.ts`, que faz T010 passar:
  - os tipos `PedidoAcao`, `Previa`, `NoImpacto`, `ImpressaoDigital` e `ResultadoExecucao` (data-model §4);
  - `textoConfirmacao(pedido, total)`;
  - `mesmasContagens(a, b)`.
- [X] T016 Definir os ports em `src/modules/manutencao/application/ports/`:
  - `leitor-esquema.ts`: `fksFisicas()` e `contagens(tabelas)`;
  - `executor-conjuntos.ts`: `emTransacao(fn)`, `travar(tabelas)`, `semear(pedido, protegidos)`, `expandir(vinculos, modo)`, `contar()`, `amostrar(tabela, limite)`, `saldos()`, `linhasAfetadas()` (AsyncIterable para os snapshots), `aplicar()` e `recalcularSaldos()`;
  - `registro-execucao.ts`: reexporta a porta de Auditoria;
  - `ambiente.ts`.
- [X] T017 Implementar `src/modules/auditoria/infrastructure/registro-manutencao.ts`, que faz T011 passar:
  - `verificarDisponibilidade()` com ping;
  - `registrarInicio()`, que grava o evento e depois os snapshots em lotes de 500 com `insertMany`, aplicando `redigirCamposSensiveis` e removendo as credenciais recebidas;
  - `registrarDesfecho()`;
  - todos propagam falha como `AuditoriaIndisponivelError` (reaproveitar a classe de `audit-reader.ts`).
  Exportar a porta e os tipos `EventoExecucao` e `SnapshotLinha` em `src/modules/auditoria/index.ts`.
- [X] T018 Implementar `src/modules/manutencao/infrastructure/drizzle/leitor-esquema.ts`:
  - `fksFisicas()` lendo `pg_constraint` / `pg_attribute`: tabela, coluna, destino, `confdeltype` mapeado para `cascade` / `set null` / `restrict` / `no action`, e `attnotnull`;
  - `contagens()` com `COUNT(*)` por tabela, descontando os `REGISTROS_SISTEMA`.
- [X] T019 Escrever `src/modules/manutencao/infrastructure/drizzle/catalogo.integracao.test.ts`, que roda `conferirCatalogo(CATALOGO, await fksFisicas())` contra o Neon e exige zero tabelas bloqueadas. É o teste que quebra o CI quando uma migração nova traz FK não classificada (research D2).
- [X] T020 [P] Em `src/shared/auth/sessao.ts`:
  - acrescentar `sessaoCriadaEm: Date` a `SessaoAtor`, lido de `sessao.session.createdAt` e normalizado para `Date`, porque o cookie cache pode reidratar como string;
  - criar o helper `sessaoRecente(ator, agora, limiteMs = 15 * 60_000)`;
  - cobrir o helper em `src/shared/auth/sessao-recente.test.ts`.
  Ver research D11.
- [X] T021 [P] Excluir os registros padrão das listas de escolha (research D15). Em cada consulta, acrescentar `ne(<tabela>.id, REGISTROS_SISTEMA.<chave>)` ao `where` existente:
  - `listarEstoque`, `sugerirItens` e `listarItensLookup` em `src/modules/estoque/presentation/queries/estoque.ts` (as actions de `lookups.ts` e `listagens.ts` só delegam a essas funções e não mudam);
  - `listarCategoriasAtividade` em `src/modules/voluntariado/presentation/queries/lookups.ts`;
  - `listarUsuarios` em `src/modules/identidade/presentation/queries/usuarios.ts`.
  Relatórios **não** mudam.

**Checkpoint**: domínio e portas prontos. `npm test` e `npm run test:integracao` (T019) passam.

---

## Phase 3: User Story 1 - Resetar uma tabela vendo o impacto completo (Priority: P1) 🎯 MVP

**Goal**: o administrador abre `/admin/danger-zone`, vê o inventário, escolhe "Resetar", escolhe
cascata ou preservação quando há dependentes, revisa a árvore de impacto, digita a confirmação e
executa. A execução é atômica, auditada de forma bloqueante e com saldo recalculado.

**Independent Test**: num branch Neon descartável, resetar `kit` em preservação e em cascata
(quickstart, passos 4 a 9 e 13 a 14). A prévia lista `kit_receita_item` e `metrica_kit` com as
contagens corretas; na cascata eles somem; na preservação as entradas ficam com `kit_destino_id`
vazio. A trilha mostra `iniciada`, os snapshots e `concluida`.

### Testes primeiro

- [X] T022 [P] [US1] Escrever `src/modules/manutencao/application/use-cases/gerar-previa.test.ts`, com ports fake. Ele verifica:
  - tabela fora do catálogo → `tabela_desconhecida`;
  - tabela bloqueada → `catalogo_divergente` com `detalhes.vinculos`;
  - sem `modo` e com dependentes **de histórico** → `temDependentes: true`, sem árvore final;
  - só dependentes inseparáveis (ex.: reset de `saida`, que só arrasta `saida_item`) → `temDependentes: false`, modo `sem_dependentes` e prévia completa listando os inseparáveis (FR-011);
  - sem dependentes → modo `sem_dependentes`;
  - registros protegidos (conta e sessão do executor, registros padrão) sempre em `preservados` e fora do conjunto (FR-018);
  - a lista de consequências inclui o `alertaAcesso` das tabelas de autenticação.
- [X] T023 [P] [US1] Escrever `src/modules/manutencao/application/use-cases/executar-acao.test.ts`, com ports fake que registram a ordem das chamadas. Ele verifica:
  - sessão com mais de 15 min → `reautenticacao_necessaria`, nenhuma chamada ao executor e evento `recusada`;
  - confirmação errada → `confirmacao_invalida`;
  - ping falha → `auditoria_indisponivel`, sem `emTransacao`;
  - impressão digital diferente → `dados_mudaram` com a prévia nova e rollback;
  - `registrarInicio` falha → rollback, `auditoria_indisponivel` e sem `aplicar`;
  - a ordem do caminho feliz é exatamente `verificarDisponibilidade → travar → recálculo → registrarInicio → aplicar → recalcularSaldos → commit → registrarDesfecho('concluida')`;
  - `aplicar` falha → rollback e `registrarDesfecho('falhou')`;
  - `registrarDesfecho` falha após o commit → sucesso devolvido com `console.error` (o histórico mostra "desfecho não confirmado").
  Ver research D7 e D8.
- [X] T024 [P] [US1] Escrever `src/modules/manutencao/infrastructure/drizzle/saldo.integracao.test.ts`, que cria itens com entradas, saídas e descartes **pelos casos de uso do Estoque** e confirma que `recalcularSaldos()` sobre esses itens não muda nenhum saldo. É a premissa de research D10; se falhar, a fórmula está errada.

### Implementação

- [X] T050 [P] [US1] Escrever `src/modules/manutencao/presentation/actions/danger-zone.test.ts`, com `obterSessao` mockado: para cada uma das seis actions (C-01 a C-06), sessão ausente e sessão de `coordenador` devolvem `nao_autorizado`, sem chamar nenhum caso de uso e sem revelar tabela nem contagem na mensagem (SC-002, A-00.1). As actions ainda não existem; o teste nasce falhando e passa conforme T030, T039 e T043 forem feitas. *(Acrescentada pela análise; ID fora da ordem numérica.)*
- [X] T051 [P] [US1] Escrever `src/modules/manutencao/infrastructure/drizzle/registros-sistema.integracao.test.ts`, que verifica, com a migração aplicada, que:
  - os três registros padrão existem com os ids de `REGISTROS_SISTEMA`;
  - `sistema-usuario-removido` tem `ativo = false` e nenhuma linha em `account`;
  - `resolverSessao` não devolve ator para ele (não autentica);
  - a elegibilidade de notificação do módulo Notificações o recusa com o motivo `usuario_inativo` (FR-012a).
  *(Acrescentada pela análise; ID fora da ordem numérica.)*
- [X] T025 [US1] Implementar `src/modules/manutencao/infrastructure/drizzle/executor-conjuntos.ts`:
  - `emTransacao` sobre `db.transaction`;
  - `travar` com `LOCK TABLE … IN SHARE ROW EXCLUSIVE MODE` na ordem alfabética, para evitar deadlock entre duas execuções;
  - `semear` cria `dz_apagar_<tabela>` com `CREATE TEMP TABLE … ON COMMIT DROP AS SELECT <pk>`, com a tabela inteira ou as chaves dadas, menos os protegidos;
  - `expandir` faz um passo por vínculo com `INSERT … SELECT … WHERE fk IN (SELECT pk FROM dz_apagar_pai) ON CONFLICT DO NOTHING`, para apagar ou redirecionar, e devolve se algo cresceu;
  - `contar` e `amostrar` aplicam a máscara de `src/shared/mascara` nas `colunasSensiveis` e omitem as credenciais;
  - `saldos` calcula atual × resultante;
  - `linhasAfetadas` faz a leitura em páginas das linhas completas, para os snapshots;
  - `aplicar` roda os `UPDATE` de redirecionamento, depois os `DELETE` em `ordemDeExclusao`, e recria os registros padrão ausentes antes dos `UPDATE`;
  - `recalcularSaldos` faz `INSERT … ON CONFLICT (item_id) DO UPDATE` com `Σ entrada − Σ saida_item − Σ descarte`.
  Usar SQL cru com `sql.identifier` para os nomes do catálogo. Nunca interpolar texto vindo do cliente.
- [X] T026 [US1] Implementar `src/modules/manutencao/application/use-cases/inventario.ts`:
  - lê as contagens;
  - roda `conferirCatalogo`;
  - monta as linhas de C-01, com `disponivel` e `motivoIndisponivel` ("sem registros" ou "vínculo não classificado").
- [X] T027 [US1] Implementar `src/modules/manutencao/application/use-cases/gerar-previa.ts`, que faz T022 passar:
  - conferência do catálogo;
  - `semear` com os protegidos (conta, sessão e contas de login do executor, mais `REGISTROS_SISTEMA`);
  - `expandirAtePontoFixo`;
  - montagem da `Previa`: árvore, inseparáveis, redirecionamentos com valor padrão ("vazio" ou o rótulo do registro padrão), saldos, amostras, consequências, ambiente, texto de confirmação e impressão digital.
  Tudo dentro de `emTransacao`, encerrando com rollback, para que as tabelas temporárias sumam.
- [X] T028 [US1] Implementar `src/modules/manutencao/application/use-cases/executar-acao.ts`, que faz T023 passar. Registrar ao final `console.info('[manutencao] duracao', { execucaoId, tabela, totalMs, travasMs })`, só com tempos, sem dados (insumo de T049). Segue a sequência de research D8 e gera um `execucaoId` com `crypto.randomUUID()`. Recusas geram o evento `recusada` com motivo. A checagem do último administrador é um invariante verificado depois da expansão (research D14).
- [X] T029 [P] [US1] Criar `src/modules/manutencao/presentation/consequencias.ts` com as frases pt-BR de FR-010 por tabela, como "Voluntários perdem o histórico de turnos" e "As pessoas serão desconectadas em até 5 minutos" (research D12), e os alertas de acesso de `user`, `session`, `account` e `verification`. Incluir o aviso de que, para um pedido de exclusão do titular, o caminho é a anonimização (spec, Assumptions).
- [X] T030 [US1] Implementar em `src/modules/manutencao/presentation/actions/danger-zone.ts` (`'use server'`):
  - `inventarioAction`, `gerarPreviaAction`, `executarAcaoAction` e `cancelarAcaoAction`, conforme C-01, C-03, C-04, C-05 e A-00;
  - Zod de contrato, `obterSessao` + `role === 'administrador'` e `comAtorDaSessao`;
  - depois da execução, `updateTag` + `revalidateTag(…, PERFIL_REVALIDACAO)` para todas as `CACHE_TAGS`, `tagAtividade` das atividades atingidas e `tagNotificacoesUsuario` dos usuários atingidos (research D12);
  - sem sessão válida, devolver `nao_autorizado` e gravar só `console.warn('[manutencao] tentativa sem sessão válida', { acao, tabela, ip, timestamp })`, sem chaves nem conteúdo de linhas (contracts C-04, spec edge case "sessão expira").
- [X] T031 [P] [US1] Acrescentar o item `{ href: '/admin/danger-zone', rotulo: 'Danger Zone', icone: 'TriangleAlert', grupo: 'administracao', roles: ['administrador'], perigo: true }` e o campo opcional `perigo?: true` em `ItemNavegacao`, em `src/shared/auth/navegacao.ts`. Renderizar `perigo` com o token de cor de alerta em `src/shared/ui/shell/sidebar-nav.tsx` e `gaveta-navegacao.tsx`. Confirmar que `navegacao.test.ts` (INV-01) continua passando (U-07, FR-002).
- [X] T032 [US1] Criar `app/(interno)/(staff)/admin/danger-zone/page.tsx`:
  - `exigirAcessoA('/admin/danger-zone')`;
  - faixa de ambiente a partir de `VERCEL_ENV`, com fallback em `NODE_ENV` (U-01, research D17);
  - abas `Tabelas` / `Histórico` via `?aba=` (U-02);
  - `export const instant = false`, como nos segmentos que leem sessão.
- [X] T033 [US1] Criar `app/(interno)/(staff)/admin/danger-zone/inventario.tsx` (client, TanStack Query sobre `inventarioAction`). É a tabela agrupada por área, com contagens, dependências e os botões "Resetar" e "Ver registros"; indisponível fica desabilitado com tooltip do motivo (U-03).
- [X] T034 [US1] Criar `app/(interno)/(staff)/admin/danger-zone/fluxo-confirmacao.tsx`, um dialog Ark UI em passos (U-05):
  - Resumo;
  - Modo, só com dependentes, sem opção pré-selecionada;
  - Impacto: árvore, "apagados em qualquer modo", redirecionamentos, preservados, saldos com negativo em destaque e amostras;
  - Confirmação: input com `textoConfirmacao`, botão desabilitado até conferir exatamente, ambiente repetido e "Entrar novamente" quando chegar `reautenticacao_necessaria`;
  - Resultado.
  Em `dados_mudaram`, volta ao passo Impacto com a prévia nova. "Cancelar" a partir do passo Impacto chama `cancelarAcaoAction`. "Entrar novamente" faz sign-out e vai para `/login?redirecionar=/admin/danger-zone`. Layout responsivo até 360 px.

**Checkpoint**: US1 completa. Validar o roteiro do quickstart (passos 1–11 e 13–14) num branch
descartável.

---

## Phase 4: User Story 2 - Apagar registros específicos de uma tabela (Priority: P2)

**Goal**: navegar pelos registros de uma tabela, selecionar alguns e apagá-los pelo mesmo fluxo de
prévia e confirmação, com o impacto restrito à seleção.

**Independent Test**: apagar um único `item` que tem entradas e verificar que a prévia mostra só os
dependentes desse item (quickstart, passos 16 e 17); CPF, CEP e data de nascimento aparecem
mascarados; `account` aparece sem senha nem tokens.

### Testes primeiro

- [X] T035 [P] [US2] Escrever `src/modules/manutencao/application/use-cases/listar-registros.test.ts`, com port fake. Ele verifica:
  - registro padrão vem com `sistema: true`;
  - colunas de credencial nunca aparecem;
  - `colunasSensiveis` vêm mascaradas.
- [X] T036 [P] [US2] Escrever `src/modules/manutencao/infrastructure/drizzle/excluir-selecionados.integracao.test.ts`. O teste cria as próprias linhas (1 usuário de teste, 1 atividade com turno e alocação, 1 item com entrada) e verifica:
  - preservação: o usuário é apagado; `alocacao.participante_user_id` e `entrada.registrado_por` passam a apontar para `sistema-usuario-removido`; a sessão do executor fake permanece;
  - cascata: as alocações e entradas do usuário somem;
  - um selecionado contendo registro padrão é recusado com `registro_protegido`;
  - a contagem prévia é igual à contagem aplicada (SC-001);
  - auditoria mockada para falhar no `registrarInicio` → nenhuma linha muda (SC-007).
  Limpa tudo no `afterAll`.

### Implementação

- [X] T037 [US2] Implementar `src/modules/manutencao/application/use-cases/listar-registros.ts` e o método correspondente no executor ou leitor. Paginação server-side com `normalizarPaginacao`; busca `ILIKE` em `colunaRotulo` com `escaparLike` (`src/shared/busca`); ordenação com `ordemAlfabetica`; marcação `sistema` via `ehRegistroSistema`. Faz T035 passar.
- [X] T038 [US2] Em `gerar-previa.ts` e `executor-conjuntos.ts`, garantir o caminho `excluir_selecionados`:
  - `semear` com as chaves dadas, 1 a 500, recusando registro padrão e a própria conta com `registro_protegido`;
  - texto `EXCLUIR <n> DE <tabela>`;
  - chave composta serializada como `'a|b'`.
  Faz T036 passar.
- [X] T039 [US2] Acrescentar `listarRegistrosAction` (C-02) em `src/modules/manutencao/presentation/actions/danger-zone.ts`
- [X] T040 [US2] Criar `app/(interno)/(staff)/admin/danger-zone/registros-drawer.tsx`, um drawer Ark UI com tabela paginada (`use-listagem-paginada`), busca, seleção múltipla limitada a 500, registros padrão rotulados "registro do sistema" e não selecionáveis, e o botão "Excluir selecionados", que abre o `fluxo-confirmacao.tsx` com `acao: 'excluir_selecionados'` (U-04). Ligar o botão "Ver registros" de `inventario.tsx`.

**Checkpoint**: US1 e US2 funcionam de forma independente.

---

## Phase 5: User Story 3 - Histórico das ações executadas (Priority: P3)

**Goal**: listar, na própria Danger Zone, as execuções concluídas, recusadas, com falha e
canceladas, com ator, data, tabela, modo e contagens por tabela.

**Independent Test**: executar um reset e um cancelamento e verificar que os dois aparecem na aba
Histórico; o resumo do reset é idêntico à tela de resultado (quickstart, passo 15).

### Testes primeiro

- [ ] T041 [P] [US3] Escrever `src/modules/auditoria/infrastructure/execucoes-manutencao.integracao.test.ts`. Com eventos inseridos sob um `execucaoId` de teste, ele verifica que o agrupamento devolve a situação pelo último evento: `concluida`, `falhou`, `recusada`, `cancelada`, e `desfecho_nao_confirmado` para `iniciada` sem desfecho. Também verifica que os snapshots não entram na listagem. Limpa no `afterAll`.

### Implementação

- [X] T042 [US3] Implementar `listarExecucoesManutencao({ limite, deslocamento })` em `src/modules/auditoria/infrastructure/registro-manutencao.ts`. É uma agregação por `manutencao.execucaoId` sobre `entidade: 'ManutencaoDados'`, excluindo `fase: 'snapshot'` e ordenada pelo início, mais recente primeiro. Exportar em `src/modules/auditoria/index.ts` (AM-05) e traduzir indisponibilidade para `auditoria_indisponivel`. Faz T041 passar.
- [X] T043 [US3] Acrescentar `nomesDeUsuarios(ids: string[]): Promise<Map<string, string>>` em `src/modules/identidade/presentation/queries/usuarios.ts` (leitura de `id` e `name` com `inArray`; id ausente, de usuário já apagado, cai em "Administrador removido"). Em seguida, implementar `src/modules/manutencao/application/use-cases/historico.ts`, que recebe essa função como port `NomesDeAtores`, declarado em `src/modules/manutencao/application/ports/nomes-de-atores.ts` e ligado na action para respeitar o Princípio I. Por fim, acrescentar `historicoAction` (C-06) em `src/modules/manutencao/presentation/actions/danger-zone.ts`
- [X] T044 [US3] Criar `app/(interno)/(staff)/admin/danger-zone/historico.tsx`, uma lista paginada com badge de situação e expansão com as contagens por tabela (U-06). Mostrar "A trilha de auditoria está indisponível" sem quebrar a aba Tabelas.

**Checkpoint**: as três histórias funcionam de forma independente.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T045 [P] Registrar em `spec/DESIGN.md`:
  - uma seção nova "Manutenção de Dados (Danger Zone)" com research D1, D3, D6, D8 e a exceção ao Princípio V;
  - o módulo `manutencao` na lista de bounded contexts (§3) e na árvore de pastas (§5);
  - a linha da Danger Zone na tabela de cache (§7);
  - a entrada em Decisões Consolidadas (§19).
  Ver research D18.
- [X] T046 [P] Em `spec/DB_SCHEMA.md`, documentar os registros padrão e o índice parcial de `alocacao` (research D4 e D5) e os campos `manutencao.*` do `audit_logs` (data-model §3)
- [ ] T047 [P] Revisar com o skill `ui-design` a acessibilidade do `fluxo-confirmacao.tsx`: foco preso no dialog, `aria-describedby` no resumo, o botão Executar anunciando o motivo de estar desabilitado, contraste do vermelho de alerta em dark e light
- [X] T048 Rodar `npm run lint`, `npx tsc --noEmit`, `npm test` e `npm run test:integracao`, e corrigir o que quebrar
- [ ] T049 Executar o roteiro manual completo de `specs/026-danger-zone-admin/quickstart.md` num branch Neon descartável **criado a partir de produção**. Medir:
  - o tempo da prévia de `user` em cascata (SC-005 ≤ 5 s);
  - o tempo total da execução desse mesmo reset e a duração das travas, do `LOCK` ao `COMMIT`, registrados por `console.info('[manutencao] duracao', …)` em T028.

  Se a execução passar de 120 s (40% do teto de 300 s da Vercel), registrar o risco em `research.md` (Riscos residuais) antes do merge. Apagar o branch ao final.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências. T004 depende de T002 (ids) e T003 (índice).
- **Foundational (Phase 2)**: depende do Setup. Bloqueia todas as histórias.
  - T012 a T015 dependem de T007 a T010 (testes primeiro).
  - T016 depende de T015.
  - T017 depende de T005 e T011.
  - T018 depende de T016.
  - T019 depende de T012, T013 e T018, e da migração aplicada (T004).
- **US1 (Phase 3)**: depende da Phase 2.
- **US2 (Phase 4)**: depende da Phase 2. Reusa `fluxo-confirmacao.tsx` (T034) e o executor (T025), então na prática vem depois da US1.
- **US3 (Phase 5)**: depende da Phase 2 (T017). Para ter conteúdo a exibir, precisa de US1, mas é testável sozinha com eventos inseridos (T041).
- **Polish (Phase 6)**: depois das histórias desejadas.

### Within Each User Story

- Testes antes da implementação, e falhando.
- Ordem: domínio → use case → infraestrutura → action → tela.
- Commit por tarefa ou grupo lógico (Conventional Commits).

### Parallel Opportunities

- Setup: T002, T005 e T006 em paralelo. T003 → T004 em sequência.
- Foundational: T007 a T011 em paralelo; depois T012 a T015 em paralelo; T020 e T021 a qualquer momento da fase.
- US1: T022, T023, T024, T050 e T051 em paralelo; T029 e T031 em paralelo com T025 a T028.
- US2: T035 e T036 em paralelo.
- Polish: T045, T046 e T047 em paralelo.

---

## Parallel Example: Foundational (testes de domínio)

```text
Task: "T007 catalogo.test.ts — 26 tabelas, 30 vínculos, invariantes"
Task: "T008 conferir-catalogo.test.ts — divergências bloqueiam"
Task: "T009 grafo.test.ts — ordem, ponto fixo, prevalência da exclusão"
Task: "T010 previa.test.ts — confirmação, impressão digital, amostra"
Task: "T011 registro-manutencao.test.ts — redação e propagação de falha"
```

## Parallel Example: User Story 1

```text
Task: "T022 gerar-previa.test.ts"
Task: "T023 executar-acao.test.ts — ordem das chamadas e recusas"
Task: "T024 saldo.integracao.test.ts — recálculo invariante"
# depois, em paralelo com o núcleo:
Task: "T029 consequencias.ts"
Task: "T031 item de navegação com perigo"
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1, Setup: migração aplicada no Neon de desenvolvimento e no branch descartável.
2. Phase 2, Foundational: catálogo conferido (T019 verde).
3. Phase 3, US1: reset com prévia, confirmação e auditoria bloqueante.
4. **Parar e validar** no branch descartável (quickstart, passos 1–14).
5. Deploy: a Danger Zone já é útil só com o reset.

### Incremental Delivery

1. Setup + Foundational → base pronta, sem mudança visível (exceto os filtros de T021).
2. US1 → reset (MVP).
3. US2 → exclusão pontual.
4. US3 → histórico.
5. Polish → documentação e roteiro completo.

### Antes de usar em produção (fora do código)

- Aplicar a migração em produção (`npm run db:migrate`) **antes** do deploy do código. Sem o índice parcial de `alocacao`, uma preservação de `user` que redirecione duas alocações do mesmo turno falha. O catálogo também é conferido contra o banco (T018), e um schema defasado bloquearia as ações.
- Rodar `npm run mongo:setup` em produção (índice `manutencao_execucao_timestamp`).
- Confirmar que a restauração pontual do Neon (point-in-time restore) está habilitada no plano de produção. É o único "desfazer" (spec, Assumptions).
