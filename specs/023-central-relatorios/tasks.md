---
description: 'Task list for 023-central-relatorios'
---

# Tasks: Central de relatórios

**Input**: Design documents from `specs/023-central-relatorios/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Incluídos. A constituição (Princípio III) exige TDD em `domain/` e `application/` e
testes de integração para fluxos que tocam o banco real. Testes unitários: `*.test.ts`
(`npm test`, sem rede). Integração: `*.integracao.test.ts` (`npm run test:integracao`, Neon e
Mongo reais). Escreva cada teste antes da implementação correspondente e confirme que falha.

**Organization**: Tarefas agrupadas por user story da spec (US1–US5) para entrega incremental.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência de tarefa incompleta)
- **[Story]**: user story atendida (US1…US5)

## Convenções para quem implementa

- Ler `AGENTS.md`: Next.js 16 tem APIs diferentes — consultar `node_modules/next/dist/docs/`
  antes de usar `connection()`, `searchParams` assíncrono, Route Handlers e Server Actions.
- Textos de interface em pt-BR; comentários no estilo do código vizinho (explicam o *porquê*).
- Consultas de relatório: `import 'server-only'`, **sem** `'use cache'` (research D5).
- Contingência importa só `<modulo>/presentation/queries/*` de outros módulos — nunca
  `db/schema` nem repositórios alheios (research D4).
- Mapa slug → relatório: data-model.md §1. Colunas: data-model.md §4. Filtros: §2.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Índices e migration que os relatórios por período usam.

- [X] T001 Adicionar `index('entrada_criado_idx').on(t.criadoEm)` à tabela `entrada` e `index('descarte_criado_idx').on(t.criadoEm)` à tabela `descarte` em `db/schema/estoque.ts` (manter os índices existentes; comentário citando research D12)
- [X] T002 [P] Adicionar `index('notificacao_criado_idx').on(t.criadoEm)` à tabela `notificacao` em `db/schema/notificacoes.ts`
- [X] T003 Gerar a migration com `npm run db:generate` (deve sair como `db/migrations/0008_*.sql` só com os três `CREATE INDEX`), revisar o SQL e aplicar com `npm run db:migrate`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Catálogo, período, autorização por relatório, planilha com cabeçalho, use case
genérico, Server Action, endpoint de exportação e as duas telas genéricas. Nenhum relatório
concreto ainda — cada story registra os seus.

**⚠️ CRITICAL**: Nenhuma user story começa antes desta fase terminar.

### Testes primeiro

- [X] T004 [P] Escrever `src/modules/contingencia/domain/periodo.test.ts`: padrão sem parâmetros = últimos 30 dias incluindo hoje (BRT); `intervaloUtc({de:'2026-10-05', ate:'2026-10-05'})` = `[2026-10-05T03:00Z, 2026-10-06T03:00Z)`; registro às 23h30 BRT de 05/10 cai em 05/10; `de > ate` → erro "A data inicial deve ser anterior ou igual à final."; `de` futura → erro; data malformada → erro; atalhos `hoje`, `7dias`, `30dias`
- [X] T005 [P] Escrever `src/modules/contingencia/domain/catalogo.test.ts` cobrindo INV-R1..R4 de data-model.md §1 (slugs/nomes únicos, `rota === '/relatorios/' + slug`, acesso de `membro_defesa_civil` a todos menos `auditoria`, `administrador` a todos, negado a `coordenador`/`voluntario`/`usuario` via `podeAcessar` de `src/shared/auth/rotas.ts`) e `gruposVisiveisRelatorios(role)` omitindo o grupo `auditoria` para `membro_defesa_civil`
- [X] T006 [P] Acrescentar casos a `src/shared/auth/rotas.test.ts`: `/relatorios/auditoria` só `administrador`; `/relatorios/saidas` para `membro_defesa_civil` e `administrador`; `/relatorios` continua negado a `coordenador`
- [X] T007 [P] Acrescentar casos a `src/modules/contingencia/infrastructure/planilha.test.ts`: `cabecalhoDocumento` e `resumo` saem antes da tabela no CSV (`rotulo;valor`, linha em branco, cabeçalho) e no XLSX (linhas no topo, painel congelado em `ySplit` = linha do cabeçalho da tabela); textos iniciados por `=`, `+`, `-`, `@`, `\t`, `\r` recebem prefixo `'` no CSV; no XLSX a célula `=1+1` é `string` (sem `formula`); `Aba` sem os campos novos gera exatamente a saída atual (regressão do pacote de contingência); teste de regressão: o pacote de contingência gerado tem exatamente as 4 abas e os cabeçalhos atuais (FR-004)
- [X] T008 [P] Escrever `src/modules/contingencia/application/gerar-relatorio.test.ts` com uma `DefinicaoRelatorio` falsa em memória: `pagina()` formata células com as colunas, aplica clamp de página e devolve `totalCount`, `resumo`, `excedeLimiteExportacao` (>50.000); `completo()` recusa com erro `limite_exportacao` quando `contar` > 50.000 e, abaixo disso, devolve `Aba` com `cabecalhoDocumento` na ordem de data-model.md §3 (Relatório, Período, filtros, Gerado em, Gerado por, Total de linhas); filtros inválidos → erro `validacao`; `completo()` devolve um iterador assíncrono de lotes (`AsyncIterable<L[]>`) — 5.001 linhas em lotes de 2.000 → 3 lotes; com 0 linhas a exportação é permitida e gera só cabeçalho do documento + cabeçalho da tabela (caso de borda "período sem dados")
- [X] T009 [P] Escrever `src/modules/contingencia/presentation/autorizacao-relatorios.test.ts` (action + handler; o `vitest` só enxerga `src/**`) com `obterSessao` simulado (`vi.mock` de `@/src/shared/auth/sessao`) e definições falsas registradas como `auditoria` e `saidas`: sem sessão → `nao_autorizado`/403; `coordenador` em `saidas` → negado; `membro_defesa_civil` em `auditoria` → negado (403 no endpoint); `administrador` em `auditoria` → permitido; papel trocado entre duas chamadas → a segunda segue o papel novo (caso de borda "mudança de papel durante a sessão"). Cobre FR-002, FR-020 e SC-005

### Implementação

- [X] T010 [P] Implementar `src/modules/contingencia/domain/periodo.ts` (tipo `Periodo`, `periodoPadrao(agora)`, `atalhoPeriodo`, `validarPeriodo`, `intervaloUtc` com deslocamento via `Intl.DateTimeFormat(..., { timeZone: 'America/Sao_Paulo', timeZoneName: 'longOffset' })`, `hojeEmSaoPaulo`) até T004 passar — research D6
- [X] T011 Adicionar `{ prefixo: '/relatorios/auditoria', roles: ['administrador'] }` **antes** da regra `/relatorios` em `src/shared/auth/rotas.ts`, com comentário (Clarification Q2); confirmar T006 e `src/shared/auth/navegacao.test.ts` verdes
- [X] T012 Implementar `src/modules/contingencia/domain/catalogo.ts`: `SLUGS_RELATORIO` (17, data-model.md §1), `GRUPOS_RELATORIO` (rótulo/ordem), tipo `CampoFiltro` (`{ nome, rotulo, tipo: 'select' | 'texto' | 'numero' | 'booleano', opcoes?: {valor, rotulo}[] }`), tipo `DescricaoRelatorio` (slug, nome, grupo, pergunta, rota, usaPeriodo, contemDadosSensiveis, avisos, camposFiltro), `DESCRICOES_RELATORIO` com os 17 (nomes e perguntas da tabela "Catálogo" de spec.md), `ehSlugRelatorio`, `relatoriosVisiveis(role)` e `gruposVisiveisRelatorios(role)` usando `podeAcessar`; até T005 passar (depende de T011)
- [X] T013 [P] Estender `src/modules/contingencia/infrastructure/planilha.ts`: `Aba` ganha `cabecalhoDocumento?` e `resumo?`; `gerarCsv`/`gerarXlsx` escrevem o bloco de identificação, o resumo e uma linha em branco antes da tabela; função `neutralizarFormula` aplicada a strings no CSV; ajustar `views` do XLSX; até T007 passar — research D7; funções `streamCsv(aba, lotes)` e `streamXlsx(aba, lotes)` que devolvem `ReadableStream<Uint8Array>` (XLSX via `ExcelJS.stream.xlsx.WorkbookWriter` num `PassThrough` + `Readable.toWeb`); o `gerarXlsx` com buffer continua existindo só para o pacote de contingência — research D8
- [X] T014 Criar `src/modules/contingencia/application/definicao-relatorio.ts` com o tipo `DefinicaoRelatorio<F, L>` (data-model.md §1: `DescricaoRelatorio` + `esquemaFiltros`, `colunas: Coluna<L>[]`, `contar`, `carregar(f, pagina?)`, `resumo?`, `detalhe?`, `descreverFiltros`, `opcoesFiltros?: () => Promise<Record<string, {valor, rotulo}[]>>`), `ItemResumo`, `AlteracaoCampo`, `Celula`, `PaginaRelatorio` e o helper `definirRelatorio` que preserva a inferência de `F`/`L` sem `any`
- [X] T015 Criar `src/modules/contingencia/application/definicoes/index.ts` com o registro `DEFINICOES` (mapa parcial slug → definição, inicialmente vazio, tipado sem `any` — ex.: definição com `F`/`L` apagados por `DefinicaoRelatorio<unknown, unknown>` via `definirRelatorio`), `obterDefinicao(slug)` e `slugsDisponiveis()`; o catálogo só mostra slugs registrados
- [X] T016 Implementar `src/modules/contingencia/application/gerar-relatorio.ts` (`GerarRelatorioUseCase` com `pagina(slug, entrada, ator)` e `completo(slug, entrada, ator, agora)`; formatação de células com `Intl` pt-BR/BRT; `LIMITE_EXPORTACAO = 50_000`) até T008 passar (depende de T010, T014, T015)
- [X] T017 [P] Criar `src/modules/identidade/presentation/queries/relatorios.ts` com `nomesPorIds(ids: string[]): Promise<Map<string, string>>` (uma consulta `inArray`, sem cache) e `opcoesUsuarios(): Promise<{valor, rotulo}[]>` (nome + e-mail, ordenado por nome) — usados por "Registrado por" e pelo filtro de autor — **regra da feature:** todo nome de usuário exibido em relatório é resolvido por `nomesPorIds`; as consultas dos módulos devolvem só ids; id ausente → "usuário não encontrado"
- [X] T018 [P] Adicionar `chaveRelatorio(slug, params)` → `['relatorios', slug, params]` em `src/shared/query/chaves.ts` e exportar em `src/shared/query/index.ts`
- [X] T019 Criar `src/modules/contingencia/presentation/actions/relatorios.ts` (`'use server'`) com `consultarRelatorioAction(entrada: unknown)`: valida `relatorio` (`relatorio_invalido`), `obterSessao` + `podeAcessar(definicao.rota, role)` (`nao_autorizado`), chama `GerarRelatorioUseCase.pagina`; mapeia erros para `ResultadoAction` conforme contracts/consulta-e-rotas.md; até T009 passar
- [X] T020 Implementar o handler em `src/modules/contingencia/presentation/http/exportar-relatorio.ts` (padrão de `notificacoes/presentation/http/`) e reduzir `app/api/relatorios/export/route.ts` a um reexport, conforme contracts/exportacao-http.md: `tipo` = qualquer slug registrado; filtros lidos dos `searchParams`; gate `podeAcessar(definicao.rota, ator.role)` além de `ROLES_PERMITIDAS`; respostas 400/403/422/503; `Content-Disposition` com `nomeDeArquivo(slug, ext)`; `Cache-Control: no-store`; nome do ator em "Gerado por"; responder com `new Response(stream, { headers })` usando `streamCsv`/`streamXlsx` e `completo()` em lotes de 2.000, sem `Content-Length` (o limite de 4,5 MB não vale para streaming, research D8); até T009 passar
- [X] T021 Reescrever `app/(interno)/(staff)/relatorios/page.tsx` como catálogo e criar `app/(interno)/(staff)/relatorios/catalogo-relatorios.tsx` conforme contracts/ui-central.md (cards por grupo visível, só slugs registrados, ícones lucide por grupo, grade responsiva; bloco do pacote de contingência movido de `painel-relatorios.tsx` sem mudar texto, cor nem link, exibido só com `podeAcessar('/api/contingencia/export', role)`)
- [X] T022 Criar `app/(interno)/(staff)/relatorios/[relatorio]/page.tsx`: `connection()`; slug desconhecido ou não registrado → `notFound()`; `exigirAcessoA(definicao.rota)`; lê `searchParams` (Promise), carrega `opcoesFiltros`, busca a primeira página via use case e hidrata com `estadoHidratado`/`chaveRelatorio`; período inválido renderiza o formulário com o erro sem consultar; `metadata` com o nome do relatório
- [X] T023 Criar `app/(interno)/(staff)/relatorios/[relatorio]/filtros-relatorio.tsx` (client): período com `DatePicker` "De"/"Até" + atalhos Hoje/7 dias/30 dias quando `usaPeriodo`; um controle por `CampoFiltro` (`Select`, `Input`, `NumberInput`, `Switch`); "Aplicar" reescreve a URL (sem `page`, volta à página 1) e "Limpar filtros"; empilhado no celular
- [X] T024 Criar `app/(interno)/(staff)/relatorios/[relatorio]/painel-relatorio.tsx` (client): breadcrumb "Relatórios / <nome>", avisos (`Alert tom="info"`), resumo (`StatCard`s), contagem de linhas, links `<a download>` XLSX/CSV montados com os filtros atuais, aviso LGPD (`Alert tom="warning"`, texto de contracts/ui-central.md) quando `contemDadosSensiveis`, botões desabilitados + aviso quando `excedeLimiteExportacao`, `Table` genérica com `useListagemPaginada` + `consultarRelatorioAction`, estado vazio "Nenhum registro no período selecionado." e erro com "Tentar novamente"; tabela com rolagem horizontal só dentro do contêiner; com 0 linhas os botões de exportação continuam habilitados

**Checkpoint**: `npm test` verde; `/relatorios` abre (catálogo vazio + pacote de contingência);
qualquer `/relatorios/<slug>` dá 404 até a story registrar o relatório.

---

## Phase 3: User Story 1 - Prestar contas das doações por período (Priority: P1) 🎯 MVP

**Goal**: R-01 Inventário atual, R-02 Histórico de saídas, R-03 Doações recebidas e
R-04 Descartes no catálogo, com filtros, prévia e exportação.

**Independent Test**: com entradas, saídas e descartes em datas diferentes, abrir R-01…R-04,
aplicar um período e conferir que prévia e arquivo trazem exatamente os registros do período;
descarte só aparece em R-04 (quickstart passos 1–6, 13–14).

### Tests for User Story 1

- [X] T025 [P] [US1] Escrever `src/modules/estoque/presentation/queries/relatorios.integracao.test.ts` (Neon real, dados próprios com prefixo e limpeza): `saidasNoPeriodo` inclui registro às 23h30 BRT do último dia e exclui 00h00 BRT do dia seguinte; filtros `tipo`, `categoria`, `destino` (sem acento/caixa); descarte nunca aparece em saídas; `entradasNoPeriodo` filtra `categoria`/`condicao`; `descartesNoPeriodo` traz `motivo`; `inventarioRelatorio` calcula situação com mínimo próprio, padrão global e `0` (sem alerta); `contar*` bate com o tamanho do carregamento completo
- [X] T026 [P] [US1] Escrever `src/modules/contingencia/application/definicoes/estoque-prestacao.test.ts` com consultas falsas: colunas e rótulos de R-01…R-04 iguais a data-model.md §4; `descreverFiltros` em pt-BR; aviso "Descartes não entram neste relatório" em R-02

### Implementation for User Story 1

- [X] T027 [US1] Criar `src/modules/estoque/presentation/queries/relatorios.ts` com `inventarioRelatorio`/`contarInventarioRelatorio` (item + saldo + mínimo aplicado/origem via `limiarDoItem` e `limiarEstoqueMinimoGlobal`, filtros `categoria`, `situacao`), `saidasNoPeriodo`/`contarSaidasNoPeriodo` (achatado por `saida_item`, filtros `tipo`, `destino` via `f_unaccent ilike` + `escaparLike`, `categoria`), `entradasNoPeriodo`/`contarEntradasNoPeriodo` (com nome do kit de destino) e `descartesNoPeriodo`/`contarDescartesNoPeriodo`; todas recebem `{ inicio, fimExclusivo }`, devolvem `registradoPorId` (nome resolvido na definição) e paginação opcional; até T025 passar
- [X] T028 [US1] Criar `src/modules/contingencia/application/definicoes/estoque-prestacao.ts` com as definições `inventario`, `saidas`, `entradas`, `descartes` (esquemas Zod de filtros, `camposFiltro` com opções de `CATEGORIAS_ITEM`/`ROTULO_CATEGORIA_ITEM`, condições e tipos de saída; colunas de data-model.md §4; "Registrado por" via `nomesPorIds`); até T026 passar
- [X] T029 [US1] Registrar as quatro definições em `src/modules/contingencia/application/definicoes/index.ts`
- [X] T030 [US1] Mover `COLUNAS_INVENTARIO` (as 5 colunas atuais: Item, Categoria, Unidade, Saldo atual, Estoque mínimo) de `src/modules/contingencia/application/relatorios.ts` para `src/modules/contingencia/application/pacote-contingencia.ts`, sem alterar cabeçalhos, valores nem larguras (FR-004); depois, excluir `src/modules/contingencia/application/relatorios.ts`. A definição `inventario` (R-01) tem colunas próprias e não é usada pelo pacote
- [X] T031 [US1] Excluir `app/(interno)/(staff)/relatorios/painel-relatorios.tsx` e remover de `src/modules/estoque/presentation/actions/listagens.ts` a `listarSaidasAction` (e de `src/modules/estoque/presentation/queries/estoque.ts` `listarSaidas`/`saidasParaExportacao`, e `chaveSaidas`/`RAIZ_SAIDAS` de `src/shared/query/chaves.ts`) **somente** se `grep` confirmar que não restam usos; manter `inventarioParaExportacao`

**Checkpoint**: MVP — catálogo com 4 relatórios de estoque, filtros por período, exportação
com cabeçalho; coordenador barrado; pacote de contingência igual ao anterior.

---

## Phase 4: User Story 2 - Antecipar falta e perda de estoque (Priority: P2)

**Goal**: R-05 Estoque crítico e R-06 Validades.

**Independent Test**: itens acima/abaixo do mínimo e entradas perecíveis com validades
variadas; R-05 e R-06 mostram só o esperado, na ordem certa, com aviso de validade
(quickstart passo 7).

### Tests for User Story 2

- [X] T032 [P] [US2] Escrever `src/modules/contingencia/domain/calculos-estoque.test.ts`: `faltaProporcional(saldo, limiar)`; ordenação de críticos da maior para a menor falta proporcional; `situacaoValidade(validade, hoje)` → `vencida` (< hoje) / `a_vencer` (≤ hoje + horizonte) / fora; `diasAteVencer` negativo para vencidas; horizonte fora de 1–365 rejeitado
- [X] T033 [P] [US2] Acrescentar a `src/modules/estoque/presentation/queries/relatorios.integracao.test.ts` casos de `itensCriticosRelatorio` (mínimo próprio, padrão, `0`, item aguardando primeira entrada fora) e `validadesRelatorio` (vencida, 10 dias, 60 dias com horizonte 30; não perecível nunca aparece)

### Implementation for User Story 2

- [X] T034 [P] [US2] Implementar `src/modules/contingencia/domain/calculos-estoque.ts` (`faltaProporcional`, `ordenarCriticos`, `situacaoValidade`, `diasAteVencer`, `validarHorizonte`) até T032 passar
- [X] T035 [US2] Adicionar `itensCriticosRelatorio` (reusa `itensCriticos` de `src/modules/estoque/domain/estoque-minimo.ts`, filtro `categoria`) e `validadesRelatorio`/`contarValidadesRelatorio` (`perecivel = true AND data_validade <= hoje + horizonte`, filtro `categoria`, ordenado por validade asc) em `src/modules/estoque/presentation/queries/relatorios.ts` até T033 passar
- [X] T036 [US2] Criar `src/modules/contingencia/application/definicoes/estoque-alertas.ts` com `estoque-critico` e `validades` (campo `horizonte` numérico padrão 30; aviso "A validade é da doação recebida e não garante que essa quantidade ainda esteja no estoque.") e registrá-las em `src/modules/contingencia/application/definicoes/index.ts`

**Checkpoint**: US1 e US2 funcionam de forma independente.

---

## Phase 5: User Story 3 - Conhecer e acompanhar a força voluntária (Priority: P2)

**Goal**: R-09 Voluntários cadastrados, R-10 Triagem, R-11 Capacidade por habilidade,
R-12 Ocupação de turnos, R-13 Participação por pessoa.

**Independent Test**: voluntários em status/habilidades/bairros diferentes e turnos com
ocupações variadas; contagens e listas conferem com os cadastros (quickstart passo 9).

### Tests for User Story 3

- [X] T037 [P] [US3] Escrever `src/modules/contingencia/domain/calculos-voluntariado.test.ts`: `ocupacaoPercentual(confirmados, vagas)` (arredondamento, vagas 0 impossível); `horasEscaladas(turnos)` somando `fim − inicio` em horas com uma casa; `resumoTriagem` (contagem por situação, tempo médio em dias com uma casa ignorando pendentes, dias de espera dos pendentes a partir de `atualizadoEm`)
- [X] T038 [P] [US3] Escrever `src/modules/voluntariado/presentation/queries/relatorios.integracao.test.ts`: `voluntariosRelatorio` com filtros `status`, `bairro`, `habilidadeId`, `tipoVeiculo`, `disponibilidade` e CPF/restrições completos; `triagemRelatorio` usa `atualizadoEm` para pendentes e `criadoEm` para decididos; `capacidadeRelatorio` conta só aprovados, por habilidade/veículo/disponibilidade, com filtro `bairro`; `ocupacaoTurnosRelatorio` ignora alocações canceladas e filtra por `turno.inicio`; `participacaoRelatorio` agrega 3 turnos de 4 h com 1 cancelado em 2 turnos / 8 h

### Implementation for User Story 3

- [X] T039 [P] [US3] Implementar `src/modules/contingencia/domain/calculos-voluntariado.ts` até T037 passar
- [X] T040 [US3] Criar `src/modules/voluntariado/presentation/queries/relatorios.ts` com `voluntariosRelatorio`/`contar…`, `triagemRelatorio`/`contar…`, `capacidadeRelatorio`, `ocupacaoTurnosRelatorio`/`contar…` (filtros `atividadeId`, `categoriaAtividadeId`, `statusAtividade`, `apenasComVagas`), `participacaoRelatorio`/`contar…` (devolve `participanteUserId`; o nome vem de `nomesPorIds` na definição; CPF e telefone vêm de `voluntario_perfil` quando o participante tem perfil) e `opcoesFiltrosVoluntariado()` (habilidades, atividades, categorias de atividade, bairros distintos de aprovados) até T038 passar
- [X] T041 [US3] Criar `src/modules/contingencia/application/definicoes/voluntariado.ts` com `voluntarios` e `participacao` (`contemDadosSensiveis: true`), `triagem` (resumo + aviso "Reenvio substitui a candidatura anterior; o histórico está na trilha de auditoria."), `capacidade-habilidades` e `ocupacao-turnos` (resumo: turnos com vaga, ocupação média); aviso de R-13 "Horas escaladas não confirmam presença."; rótulos de enums do domínio de voluntariado; registrar as cinco em `src/modules/contingencia/application/definicoes/index.ts`

**Checkpoint**: US1, US2 e US3 funcionam de forma independente.

---

## Phase 6: User Story 4 - Consultar quem alterou o quê (Priority: P2)

**Goal**: R-17 Trilha de auditoria, só para administrador, com detalhe antes/depois e
degradação isolada quando o Mongo cai.

**Independent Test**: fazer uma entrada, editar um kit e aprovar um voluntário; como
administrador, filtrar a trilha pelo período e ver os três registros com autor e diferença;
como membro, não ver nem acessar (quickstart passos 2, 11, 12).

### Tests for User Story 4

- [X] T042 [P] [US4] Escrever `src/modules/contingencia/domain/diff-auditoria.test.ts`: `create` → todos `incluido`; `delete` → todos `removido`; `update` → só campos alterados, inclusive aninhados (serializados como JSON curto) e datas; campos iguais omitidos; `resumoAlteracoes` em texto único para a coluna "Alterações" (`campo: antes → depois; …`)
- [X] T043 [P] [US4] Escrever `src/modules/auditoria/infrastructure/audit-reader.integracao.test.ts` usando a coleção **`audit_logs_teste`** (criada, populada e removida pelo próprio teste — nunca a `audit_logs` real, que não tem permissão de delete, DB_SCHEMA.md §9): filtro por período/entidade/ação/autor, ordem `timestamp` desc, paginação e contagem; com um cliente apontando para host inválido, a leitura rejeita com `AuditoriaIndisponivelError` dentro do timeout configurado
- [X] T044 [P] [US4] Acrescentar a `src/modules/contingencia/application/gerar-relatorio.test.ts` o caso em que `carregar` lança `AuditoriaIndisponivelError` → erro `auditoria_indisponivel` (não genérico) e o caso de definição com `detalhe` preenchendo `rows[].detalhe`

### Implementation for User Story 4

- [X] T045 [P] [US4] Implementar `src/modules/contingencia/domain/diff-auditoria.ts` (`diferencaAuditoria(acao, antes, depois): AlteracaoCampo[]`, `resumoAlteracoes`) até T042 passar
- [X] T046 [US4] Criar `src/modules/auditoria/infrastructure/audit-reader.ts` (`server-only`; só `find`/`countDocuments` em `colecaoAuditoria()`; `maxTimeMS` curto; erros de conexão/timeout viram `AuditoriaIndisponivelError` exportada) e ajustar `serverSelectionTimeoutMS` do cliente em `src/shared/db/mongo/client.ts` se necessário, sem afetar o `audit-writer` (manter a política de degradação do Princípio V) até T043 passar; o leitor recebe a coleção por parâmetro (`criarLeitorAuditoria(colecao = colecaoAuditoria())`) para o teste injetar `audit_logs_teste` ou um cliente com URI inválida
- [X] T047 [US4] Criar `src/modules/auditoria/presentation/queries/trilha.ts` (`trilhaAuditoria(filtros, pagina?)`, `contarTrilhaAuditoria(filtros)`, `ENTIDADES_AUDITADAS` com rótulos pt-BR, rótulos de ação Criação/Alteração/Exclusão)
- [X] T048 [US4] Tratar `auditoria_indisponivel` em `src/modules/contingencia/application/gerar-relatorio.ts` (T044), em `src/modules/contingencia/presentation/actions/relatorios.ts` (mensagem de contracts/consulta-e-rotas.md) e com `503` em `app/api/relatorios/export/route.ts`
- [X] T049 [US4] Criar `src/modules/contingencia/application/definicoes/auditoria.ts` com a definição `auditoria` (filtros `entidade`, `acao`, `autorId` com opções de `opcoesUsuarios`; autor via `nomesPorIds`, ausente → "usuário não encontrado"; coluna "Alterações" com `resumoAlteracoes`; `detalhe` com `diferencaAuditoria`; `contemDadosSensiveis: true`) e registrá-la em `src/modules/contingencia/application/definicoes/index.ts`
- [X] T050 [US4] Em `app/(interno)/(staff)/relatorios/[relatorio]/painel-relatorio.tsx`, quando a linha tem `detalhe`, adicionar a ação "Ver alterações" (botão com ícone + tooltip, padrão da feature 015) que abre `Dialog` (ou `Drawer` no celular) com a tabela Campo | Antes | Depois

**Checkpoint**: trilha visível só para administrador; queda do Mongo afeta só R-17.

---

## Phase 7: User Story 5 - Consolidados para o comando da operação (Priority: P3)

**Goal**: R-07 Movimentação por item, R-08 Entregas por destino, R-14 Evolução da crise,
R-15 Demanda × capacidade de kits, R-16 Envio de notificações.

**Independent Test**: movimentações conhecidas num período fecham a conta por item e o saldo
final bate com o inventário; R-15 igual ao Painel (quickstart passos 8, 10).

### Tests for User Story 5

- [X] T051 [P] [US5] Escrever `src/modules/contingencia/domain/calculos-consolidados.test.ts`: `balancoItem(saldoAtual, noPeriodo, aposPeriodo)` reproduz o exemplo 100/50/30/5/115 da spec e fecha `inicial + E − S − D = final`; `chaveDestino` (`" Abrigo  Central "` ≡ `"abrigo central"`) e escolha da grafia mais frequente; `variacoes` da evolução da crise usando a atualização anterior ao período para a primeira linha
- [X] T052 [P] [US5] Acrescentar a `src/modules/estoque/presentation/queries/relatorios.integracao.test.ts`: `movimentacaoRelatorio` fecha a conta para todo item e, com período terminando hoje, `saldoFinal` = `saldo_estoque.quantidade_atual` (SC-003); `entregasPorDestinoRelatorio` agrupa destinos que diferem só em caixa/espaços e exclui descartes

### Implementation for User Story 5

- [X] T053 [P] [US5] Implementar `src/modules/contingencia/domain/calculos-consolidados.ts` até T051 passar
- [X] T054 [US5] Adicionar `movimentacaoRelatorio` (somas por item com `FILTER` no período e após o período, saldo atual de `saldo_estoque`, filtro `categoria`) e `entregasPorDestinoRelatorio` (agrupado por destino normalizado × categoria × unidade, contagem de saídas) a `src/modules/estoque/presentation/queries/relatorios.ts` até T052 passar
- [X] T055 [P] [US5] Criar `src/modules/logistica/presentation/queries/relatorios.ts` com `evolucaoCriseRelatorio(intervalo, pagina?)` (inclui a atualização imediatamente anterior ao período para calcular a primeira variação) e `contarEvolucaoCrise`; devolve `atualizadoPorId` — o nome é resolvido na definição por `nomesPorIds`
- [X] T056 [P] [US5] Criar `src/modules/notificacoes/presentation/queries/relatorios.ts` com `envioNotificacoesResumo(intervalo, filtros)` (totais por tipo × canal × status) e `falhasNotificacoesRelatorio`/`contar…` (data, tipo, canal, destinatário, erro; filtros `tipo`, `canal`, `status`); devolve `destinatarioUserId` — o nome é resolvido na definição por `nomesPorIds`
- [X] T057 [US5] Criar `src/modules/contingencia/application/definicoes/consolidados.ts` com `movimentacao` (resumo de totais), `entregas-por-destino`, `evolucao-crise`, `demanda-kits` (chama `projecaoAtual()` de `src/modules/logistica/presentation/queries/dashboard.ts`, paginação em memória, colunas com `ROTULO_BASE_DEMANDA` e `percentualAtendido`) e `notificacoes` (resumo por canal × situação); registrar as cinco em `src/modules/contingencia/application/definicoes/index.ts`

**Checkpoint**: os 17 relatórios disponíveis.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T058 [P] Atualizar a descrição do atalho de `/relatorios` em `src/shared/auth/navegacao.ts` para "Exporte dados de estoque, voluntariado, crise e notificações." e conferir `src/shared/auth/navegacao.test.ts`
- [X] T059 [P] Reescrever `spec/DESIGN.md` §14 (catálogo, definição única, rotas `/relatorios/[relatorio]`, endpoint com filtros, limite de 50.000, `exceljs`, sem cache) e corrigir §6.2 (relatórios = `membro_defesa_civil` + `administrador`; `/relatorios/auditoria` só `administrador`)
- [X] T060 [P] Acrescentar os três índices novos à tabela de §12 de `spec/DB_SCHEMA.md` e registrar em §9 que a trilha é lida pela central (R-17), somente leitura
- [X] T061 [P] Atualizar `spec/REQUISITOS_NEGOCIO.md` BR-REL-01 com nota de que a central amplia a exportação para os relatórios de `specs/023-central-relatorios`
- [X] T062 Criar `db/seed-volume-relatorios.ts` (e script `db:seed:volume` em `package.json`) que insere ~60.000 linhas de saída no Neon de desenvolvimento com prefixo identificável e opção de limpeza, para validar SC-002/SC-004
- [ ] T063 Medir num deploy de preview da Vercel a exportação de 50.000 linhas em CSV e XLSX com o seed de T062 (download completo, sem `413 FUNCTION_PAYLOAD_TOO_LARGE`, ≤ 30 s — SC-004) e registrar o resultado em `specs/023-central-relatorios/quickstart.md` §3
- [X] T064 Executar `npm run lint`, `npm test` e `npm run test:integracao` e corrigir o que falhar
- [ ] T065 Executar o roteiro de `specs/023-central-relatorios/quickstart.md` (passos 1–15 e desempenho) e registrar o resultado no fim do próprio quickstart

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende de T001–T003 só para os testes de integração das stories;
  bloqueia todas as stories.
- **US1 (Phase 3)**: depende da Phase 2. MVP.
- **US2, US3, US4 (Phases 4–6)**: dependem só da Phase 2; independentes entre si e de US1.
- **US5 (Phase 7)**: depende só da Phase 2.
- **Polish (Phase 8)**: depois das stories desejadas.

### Dentro da Phase 2

T004–T009 (testes, paralelos) → T010, T011 → T012 (usa T011) → T013 [P] → T014 → T015 →
T016 → T017/T018 [P] → T019 → T020 → T021 → T022 → T023 → T024.

### Arquivos compartilhados entre stories (editar em sequência, não em paralelo)

- `src/modules/contingencia/application/definicoes/index.ts` — T029, T036, T041, T049, T057
- `src/modules/estoque/presentation/queries/relatorios.ts` — T027, T035, T054
- `src/modules/estoque/presentation/queries/relatorios.integracao.test.ts` — T025, T033, T052
- `src/modules/contingencia/application/gerar-relatorio.ts` — T016, T048
- `app/(interno)/(staff)/relatorios/[relatorio]/painel-relatorio.tsx` — T024, T050

### Within Each User Story

Testes (falhando) → domínio → consultas do módulo dono → definição + registro → ajustes de UI.

---

## Parallel Example: User Story 1

```bash
# Testes juntos:
Task: "T025 integração das consultas de estoque em src/modules/estoque/presentation/queries/relatorios.integracao.test.ts"
Task: "T026 definições R-01…R-04 em src/modules/contingencia/application/definicoes/estoque-prestacao.test.ts"
```

## Parallel Example: depois da Phase 2

```bash
# Stories em paralelo (arquivos distintos, exceto definicoes/index.ts — registrar por último):
Task: "US3 — T037/T038/T039/T040 (voluntariado)"
Task: "US4 — T042/T043/T045/T046/T047 (auditoria)"
Task: "US5 — T051/T053/T055/T056 (domínio, logística, notificações)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (índices) → Phase 2 (fundação genérica).
2. Phase 3 (US1): R-01…R-04 — substitui a tela atual sem regressão e adiciona período.
3. **STOP and VALIDATE**: quickstart passos 1–6 e 13–14.

### Incremental Delivery

1. Setup + Foundational → fundação pronta.
2. US1 → MVP (prestação de contas de doações).
3. US2 → alertas de estoque.
4. US3 → voluntariado. US4 → trilha (só administrador). Ordem entre US3/US4 livre.
5. US5 → consolidados.
6. Polish → documentação, carga, quickstart completo.

---

## Notes

- [P] = arquivos diferentes, sem dependência pendente.
- Commits em Conventional Commits (`feat(relatorios): …`, `test(relatorios): …`,
  `docs: …`), um por tarefa ou grupo lógico.
- Nenhuma tarefa adiciona dependência npm, cache ou escrita na auditoria.
