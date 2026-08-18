---
description: 'Task list for 017-gestao-habilidades'
---

# Tasks: Gestão de Habilidades

**Input**: Design documents from `/specs/017-gestao-habilidades/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/)

**Tests**: **Incluídos e obrigatórios.** O Princípio III da constituição exige TDD para `domain/` e
`application/` — não é opcional nesta base. `infrastructure/` e `presentation/` são finos por design e
recebem só os testes de contrato/integração listados (research D9).

**Organization**: Tarefas agrupadas por user story, na ordem de prioridade da spec.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: user story a que a tarefa pertence (US1..US4)
- Todo caminho de arquivo é relativo à raiz do repositório

## Path Conventions

Monolito modular Next.js (plan.md §Project Structure): domínio em `src/modules/voluntariado/`, telas em
`app/(interno)/(staff)/`, registros compartilhados em `src/shared/`, esquema em `db/`.

---

## Phase 1: Setup (registros compartilhados)

**Purpose**: abrir os quatro pontos de extensão compartilhados que a tela consome. São arquivos
pequenos, independentes do restante, e destravam tanto o backend quanto a UI.

- [ ] T001 [P] Adicionar `habilidadesListagem: 'habilidades:listagem'` ao catálogo `CACHE_TAGS` em `src/shared/cache/tags.ts`, com comentário apontando que a lookup `lookups` também é invalidada por escritas de habilidade (research D6)
- [ ] T002 [P] Adicionar a regra `{ prefixo: '/habilidades', roles: STAFF }` a `REGRAS_DE_ROTA` em `src/shared/auth/rotas.ts`, junto das demais rotas de triagem/operação (contracts/ui-habilidades.md R-01.2)
- [ ] T003 Adicionar o item `{ href: '/habilidades', rotulo: 'Habilidades', icone: 'Wrench', grupo: 'operacao', roles: STAFF }` a `NAVEGACAO` em `src/shared/auth/navegacao.ts`, sem `atalho` (contracts/ui-habilidades.md R-01.5) — depende de T002 porque `navegacao.test.ts` (INV-01) valida a consistência entre os dois arquivos
- [ ] T004 Derivar `RAIZ_HABILIDADES` de `CACHE_TAGS.habilidadesListagem` e adicionar `chaveHabilidades(params: ParametrosPaginacao)` em `src/shared/query/chaves.ts` (depende de T001)
- [ ] T005 Registrar o ícone `Wrench` no mapa de ícones da shell em `src/shared/ui/shell/icones.ts`, se ainda não estiver presente (o registro de navegação usa identificador, não componente)

**Checkpoint**: `npm run lint` e `npm test` verdes — `navegacao.test.ts` confirma rota e menu em sincronia.

---

## Phase 2: Foundational (pré-requisitos bloqueantes)

**Purpose**: as duas mudanças de banco que tornam a spec verdadeira, mais o domínio e o contrato de
repositório que todas as stories consomem.

**⚠️ CRÍTICO**: nenhuma user story pode começar antes desta fase.

### Banco de dados

- [ ] T006 Verificar a pré-condição da migração contra o branch Neon de desenvolvimento: `SELECT lower(nome), count(*) FROM habilidade GROUP BY 1 HAVING count(*) > 1;` deve retornar zero linhas; havendo colisão, renomear/remover as duplicatas antes de seguir (quickstart.md §Pré-condição)
- [ ] T007 Em `db/schema/voluntariado.ts`, trocar o `unique()` de `habilidade.nome` por um índice único funcional sobre `lower(nome)` (`uniqueIndex('habilidade_nome_lower_idx').on(sql\`lower(\${t.nome})\`)`), documentando no comentário que é o que garante INV-01 sob concorrência (research D3)
- [ ] T008 Em `db/schema/voluntariado.ts`, trocar `voluntarioHabilidade.habilidadeId` de `onDelete: 'cascade'` para `onDelete: 'restrict'`, com comentário registrando que a cascata apagava declarações de voluntários em silêncio (research D4, INV-04) — mesmo arquivo de T007, não paralelizável
- [ ] T009 Gerar a migração com `npm run db:generate` e revisar o SQL produzido em `db/migrations/`: deve conter apenas o drop do unique antigo, a criação do índice funcional e a recriação da FK com `RESTRICT` — nenhuma alteração de dado
- [ ] T010 Aplicar com `npm run db:migrate` e confirmar as duas mudanças pelas consultas de verificação do quickstart (`pg_indexes` e `pg_constraint.confdeltype = 'r'`)

### Domínio (TDD — teste antes da implementação)

- [ ] T011 [P] Escrever `src/modules/voluntariado/domain/habilidade.test.ts` cobrindo `normalizarNomeHabilidade` (trim, colapso de espaços internos, string só de espaços → vazio) e `validarNomeHabilidade` (limites 2 e 80 após normalização, mensagens pt-BR), usando os exemplos fixados em data-model.md — os testes devem FALHAR antes de T012
- [ ] T012 Implementar `src/modules/voluntariado/domain/habilidade.ts` com `normalizarNomeHabilidade` e `validarNomeHabilidade` (puros, sem Drizzle/Next — Princípio I), fazendo T011 passar. A normalização **não** altera caixa; só a comparação de duplicidade ignora caixa (INV-03)
- [ ] T013 Reexportar `habilidade` em `src/modules/voluntariado/domain/index.ts`

### Contrato de repositório

- [ ] T014 Criar `src/modules/voluntariado/application/ports/habilidade-repository.ts` com os tipos `Habilidade`, `LinhaHabilidade` (`{ id, nome, criadoEm, voluntariosVinculados }`) e a interface `HabilidadeRepository` com os sete métodos de contracts/gestao-habilidades.md §Contrato do repositório
- [ ] T015 Criar os erros de domínio `DuplicadoError` (código `duplicado`) e `VinculoExistenteError` (código `vinculo_existente`) — estendendo `DomainError` de `src/shared/kernel`, junto do port ou em `domain/habilidade.ts`, com `detalhes.campos.nome` preenchido no caso do duplicado (contracts §Códigos de erro)
- [ ] T016 Criar `src/modules/voluntariado/infrastructure/drizzle/habilidade-repository.ts` com a fábrica `criarHabilidadeRepository()` e os métodos de **leitura** (`listar`, `buscarPorId`, `buscarPorNomeNormalizado`, `contarVinculos`), incluindo o helper que traduz códigos de erro do Postgres (`23505` → `DuplicadoError`, `23503` → `VinculoExistenteError`) para uso pelos métodos de escrita das fases seguintes. `listar` usa `LEFT JOIN voluntario_habilidade` com `count` agrupado, ordenado por `nome` ascendente, sem N+1 (research D5)

**Checkpoint**: banco migrado, domínio testado e verde, port disponível. As user stories podem começar.

---

## Phase 3: User Story 1 - Consultar a lista de habilidades (Priority: P1) 🎯 MVP

**Goal**: listagem paginada server-side com nome, contagem de voluntários vinculados e data de cadastro,
acessível aos três papéis autorizados.

**Independent Test**: autenticar como `coordenador`, abrir `/habilidades` e confirmar que as habilidades
reais aparecem paginadas, com contagem de vínculos correta, sem carregar tudo de uma vez — e que
`voluntario` recebe acesso negado.

### Implementação

- [ ] T017 [US1] Criar `src/modules/voluntariado/presentation/queries/habilidades.ts` com `listarHabilidades(filtros: ParametrosPaginacao): Promise<PaginaDe<LinhaHabilidade>>` usando `'use cache'` + `cacheTag(CACHE_TAGS.habilidadesListagem)` + `cacheLife(CACHE_LIFE.medio)` e `paginarComClamp` sobre `repositorio.listar` (data-model.md §Leituras). **Não renomear** a `listarHabilidades` existente em `queries/lookups.ts` — resolver a colisão de nome no import da action
- [ ] T018 [US1] Criar `src/modules/voluntariado/presentation/actions/habilidades.ts` com `listarHabilidadesAction`, aplicando `obterSessao()` + checagem de role STAFF (A-01/A-02) e `normalizarPaginacao` sobre a entrada — entrada saneada, nunca rejeitada (L-01.1)
- [ ] T019 [US1] Criar `app/(interno)/(staff)/habilidades/page.tsx` com `exigirAcessoA('/habilidades')`, `export const instant = false`, `metadata.title`, cabeçalho e `Suspense` com `SkeletonLista`; o subcomponente resolve a primeira página com os `searchParams` da URL e a entrega via `estadoHidratado` + `HydrationBoundary` na chave `chaveHabilidades(params)` (R-01.3/R-01.4, T-01.1)
- [ ] T020 [US1] Criar `app/(interno)/(staff)/habilidades/tabela-habilidades.tsx` (`'use client'`) com `useListagemPaginada({ chave: chaveHabilidades, buscar: listarHabilidadesAction })` e colunas Nome, Voluntários, Cadastrada em (data pt-BR) e Ações; estados de carregando/atualizando/vazio/erro com `Alert` + "Tentar novamente" via `refetch` (T-01.3/T-01.4)
- [ ] T021 [US1] Validar manualmente as seções 1 e 5 do roteiro em [quickstart.md](quickstart.md): paginação, tamanho de página, URL compartilhável, contagem de vínculos e o teste negativo de acesso com `voluntario` e sem sessão

**Checkpoint**: a tela existe, lista e pagina corretamente, e está corretamente barrada para quem não deve vê-la. Entregável isolado.

---

## Phase 4: User Story 2 - Cadastrar uma nova habilidade (Priority: P1)

**Goal**: incluir habilidade nova pelo diálogo, com validação de forma no cliente e unicidade garantida
no servidor.

**Independent Test**: cadastrar "Operação de drone" pela tela e confirmar que aparece na listagem e no
formulário de candidatura; tentar cadastrar "motosserra" e receber a recusa no campo.

### Testes (escrever primeiro — devem FALHAR)

- [ ] T022 [P] [US2] Escrever `src/modules/voluntariado/application/use-cases/gerir-habilidade.test.ts` com repositório falso, cobrindo `CriarHabilidadeUseCase`: nome normalizado antes de persistir, recusa por tamanho (INV-02) com erro no campo `nome`, e recusa por duplicata ignorando caixa (C-01.4)
- [ ] T023 [P] [US2] Escrever `src/modules/voluntariado/infrastructure/drizzle/habilidade-repository.integracao.test.ts` cobrindo SC-004: duas inserções concorrentes do mesmo nome com caixas diferentes — exatamente uma vence, a outra chega como `DuplicadoError` (não como erro bruto do driver)

### Implementação

- [ ] T024 [US2] Implementar `CriarHabilidadeUseCase` em `src/modules/voluntariado/application/use-cases/gerir-habilidade.ts`: normaliza pelo domínio, valida tamanho, consulta `buscarPorNomeNormalizado`, persiste dentro de `withAudit` (`entidade: 'Habilidade'`, `acao: 'create'`) e devolve `Result` (C-01.2/C-01.3/C-01.7), fazendo T022 passar
- [ ] T025 [US2] Implementar `criar({ nome })` no repositório Drizzle em `src/modules/voluntariado/infrastructure/drizzle/habilidade-repository.ts`, traduzindo `23505` para `DuplicadoError` com o helper de T016 (C-01.5), fazendo T023 passar
- [ ] T026 [US2] Adicionar `criarHabilidade(entrada: unknown)` a `src/modules/voluntariado/presentation/actions/habilidades.ts`: parse Zod (`{ nome }`), sessão/role, `comAtorDaSessao` sobre o caso de uso e, no sucesso, `updateTag` + `revalidateTag` de **`habilidadesListagem` e `lookups`** (C-01.6)
- [ ] T027 [US2] Criar `app/(interno)/(staff)/habilidades/habilidade-form-dialog.tsx` (`'use client'`) — componente único para cadastro e edição, com `useFormulario` + esquema Zod (`textoObrigatorio`, min 2, max 80), `Formulario`, `reset` ao abrir/trocar de registro, `aplicarErrosDoServidor` com `camposConhecidos: ['nome']`, toasts de resultado e rodapé Cancelar/Cadastrar (D-01.1..D-01.8). Nesta fase só o modo cadastro é exercido
- [ ] T028 [US2] Ligar o botão "Nova habilidade" em `tabela-habilidades.tsx`: abre o diálogo em modo cadastro (disponível inclusive com a lista vazia, T-01.5) e, no sucesso, invalida `RAIZ_HABILIDADES` via `queryClient.invalidateQueries`
- [ ] T029 [US2] Validar manualmente as seções 2 e 6 do roteiro em [quickstart.md](quickstart.md): campo vazio, tamanho mínimo, espaços normalizados, duplicata com caixa diferente recusada **no campo**, cancelamento sem efeito, e a habilidade nova aparecendo na tela de candidatura

**Checkpoint**: consultar + cadastrar funcionam. A tela já substitui o acesso ao banco para o caso mais frequente.

---

## Phase 5: User Story 3 - Editar o nome de uma habilidade (Priority: P2)

**Goal**: corrigir o nome de uma habilidade existente preservando todos os vínculos com voluntários.

**Independent Test**: renomear uma habilidade vinculada a pelo menos um voluntário e confirmar que o
novo nome aparece na listagem e no perfil do voluntário, com a contagem de vínculos inalterada.

### Testes (escrever primeiro — devem FALHAR)

- [ ] T030 [US3] Estender `src/modules/voluntariado/application/use-cases/gerir-habilidade.test.ts` com `EditarHabilidadeUseCase`: renomear para o próprio nome com caixa diferente é permitido (E-01.2), colidir com outra habilidade é recusado, `id` inexistente devolve `NaoEncontradoError` (E-01.3), e a edição toca apenas `nome` (INV-05/INV-06)

### Implementação

- [ ] T031 [US3] Implementar `EditarHabilidadeUseCase` em `src/modules/voluntariado/application/use-cases/gerir-habilidade.ts`, com a checagem de duplicidade **excluindo a própria linha pelo `id`** e `withAudit` (`acao: 'update'`, com `dadosAnteriores`), fazendo T030 passar
- [ ] T032 [US3] Implementar `atualizar({ id, nome })` no repositório Drizzle (`null` quando não existe; `23505` → `DuplicadoError`) em `src/modules/voluntariado/infrastructure/drizzle/habilidade-repository.ts`
- [ ] T033 [US3] Adicionar `editarHabilidade(entrada: unknown)` a `src/modules/voluntariado/presentation/actions/habilidades.ts`, com parse Zod (`{ id, nome }`), autorização, `comAtorDaSessao` e a mesma dupla invalidação de cache (E-01.5)
- [ ] T034 [US3] Habilitar o modo edição em `habilidade-form-dialog.tsx`: título "Editar habilidade", campo pré-preenchido, botão "Salvar" e chamada a `editarHabilidade` (D-01.1)
- [ ] T035 [US3] Adicionar a ação de editar por linha em `tabela-habilidades.tsx`: `IconButton` com `Pencil` dentro de `Tooltip`, `aria-label` nomeando o registro (`Editar Motosserra`), abrindo o diálogo pré-preenchido (T-02.1/T-02.2)
- [ ] T036 [US3] Validar manualmente a seção 3 do roteiro em [quickstart.md](quickstart.md), incluindo a verificação de que a contagem de vínculos e a data de cadastro não mudam após renomear

**Checkpoint**: consultar, cadastrar e editar funcionam de forma independente.

---

## Phase 6: User Story 4 - Excluir uma habilidade (Priority: P3)

**Goal**: remover habilidade que deixou de fazer sentido, com confirmação explícita e **sem jamais**
remover a declaração de nenhum voluntário.

**Independent Test**: excluir uma habilidade sem vínculos e confirmar que some da listagem e da
candidatura; tentar excluir uma vinculada e confirmar a recusa, com a contagem em
`voluntario_habilidade` idêntica antes e depois.

### Testes (escrever primeiro — devem FALHAR)

- [ ] T037 [P] [US4] Estender `src/modules/voluntariado/application/use-cases/gerir-habilidade.test.ts` com `ExcluirHabilidadeUseCase`: `id` inexistente → `NaoEncontradoError`; habilidade com N vínculos → `VinculoExistenteError` com a contagem na mensagem e plural correto (X-01.2/X-01.4); sem vínculos → exclui
- [ ] T038 [P] [US4] Estender `src/modules/voluntariado/infrastructure/drizzle/habilidade-repository.integracao.test.ts` cobrindo SC-008: `DELETE` de habilidade vinculada é recusado pelo `RESTRICT` e chega como `VinculoExistenteError`; a contagem de linhas em `voluntario_habilidade` é idêntica antes e depois (INV-04)

### Implementação

- [ ] T039 [US4] Implementar `ExcluirHabilidadeUseCase` em `src/modules/voluntariado/application/use-cases/gerir-habilidade.ts`: `buscarPorId`, `contarVinculos` para a mensagem amigável, exclusão dentro de `withAudit` (`acao: 'delete'`, com `dadosAnteriores`), fazendo T037 passar
- [ ] T040 [US4] Implementar `excluir(id)` no repositório Drizzle traduzindo `23503` para `VinculoExistenteError` — a corrida em que o vínculo nasce entre a contagem e o `DELETE` devolve o mesmo código, sem contagem na mensagem (X-01.3), fazendo T038 passar
- [ ] T041 [US4] Adicionar `excluirHabilidade(entrada: unknown)` a `src/modules/voluntariado/presentation/actions/habilidades.ts`, com parse Zod (`{ id }`), autorização, `comAtorDaSessao` e a dupla invalidação de cache no sucesso (X-01.5)
- [ ] T042 [US4] Criar `app/(interno)/(staff)/habilidades/excluir-habilidade-dialog.tsx` (`'use client'`) sobre o `Dialog` compartilhado: texto nomeando a habilidade, botão destrutivo com `loading`, modo impeditivo com confirmação desabilitada quando `voluntariosVinculados > 0`, e tratamento de `vinculo_existente` vindo do servidor com invalidação da listagem (D-02.1..D-02.6)
- [ ] T043 [US4] Adicionar a ação de excluir por linha em `tabela-habilidades.tsx`: `IconButton` com `Trash2` em `Tooltip`, `aria-label` nomeando o registro, sempre abrindo a confirmação — nunca executando direto (T-02.3)
- [ ] T044 [US4] Validar manualmente a seção 4 do roteiro em [quickstart.md](quickstart.md), incluindo a tentativa forçada por payload direto e a consulta SQL de contagem de vínculos antes e depois (SC-008), além da exclusão do último item de uma página

**Checkpoint**: as quatro stories funcionam de forma independente. Feature completa.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T045 [P] Conferir a responsividade em viewport de celular nas quatro stories: diálogos em folha, ações alcançáveis, sem rolagem horizontal (FR-018, seção 7 do quickstart)
- [ ] T046 [P] Conferir a trilha de auditoria no MongoDB: um registro por criação, edição e exclusão, com ator, entidade `Habilidade` e dados anterior/novo (FR-017)
- [ ] T047 [P] Conferir tema claro e escuro na tabela e nos dois diálogos
- [ ] T048 Medir o tempo da primeira página com volume representativo (SC-003: <1s com até 500 habilidades) e confirmar que a contagem de vínculos sai em uma única consulta, sem N+1
- [ ] T049 Rodar `npm run lint` e `npm run test:tudo` — tudo verde é critério de aceite do roteiro
- [ ] T050 Executar o roteiro completo de [quickstart.md](quickstart.md) de ponta a ponta com os três papéis autorizados (`coordenador`, `membro_defesa_civil`, `administrador`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sem dependências — pode começar imediatamente
- **Foundational (Fase 2)**: depende da Fase 1 — **BLOQUEIA todas as user stories**
- **US1 (Fase 3)**: depende da Fase 2
- **US2 (Fase 4)**: depende da Fase 2; usa o diálogo que ela mesma cria
- **US3 (Fase 5)**: depende da Fase 2 **e** de T027 (US2), que cria o componente de diálogo compartilhado entre cadastro e edição
- **US4 (Fase 6)**: depende da Fase 2 e de T020 (US1), que cria a tabela onde a ação vive
- **Polish (Fase 7)**: depende das stories entregues

### Dependências internas relevantes

- T003 depende de T002 (INV-01 de `navegacao.test.ts`)
- T004 depende de T001 (a chave de query é derivada da tag)
- T008 depende de T007 (mesmo arquivo); T009 depende de T007+T008; T010 depende de T009
- T012 depende de T011 (teste antes); T024 de T022; T031 de T030; T039 de T037
- T017 → T018 → T019/T020 (query → action → telas)
- Toda escrita (T026, T033, T041) depende do repositório correspondente (T025, T032, T040)

### Independência entre stories

US1 é entregável sozinha (listagem funcional). US2 depende só da fundação. US3 reusa o diálogo de US2 —
dependência real e deliberada (um componente para os dois modos, D-01.1), não acidental. US4 reusa a
tabela de US1. Essa é a ordem natural de entrega incremental.

### Parallel Opportunities

- T001 e T002 em paralelo (arquivos distintos)
- T011 e T014/T015 em paralelo (domínio vs port)
- T022 e T023 em paralelo (teste unitário vs integração)
- T037 e T038 em paralelo
- T045, T046 e T047 em paralelo

---

## Parallel Example: Fase 2

```bash
# Depois de T010 (migração aplicada), em paralelo:
Task: "Escrever domain/habilidade.test.ts com os casos de normalização e limites"
Task: "Criar application/ports/habilidade-repository.ts com tipos e interface"
```

---

## Implementation Strategy

### MVP (US1 apenas)

1. Fase 1 (Setup) → 2. Fase 2 (Foundational) → 3. Fase 3 (US1)
4. **PARAR e VALIDAR**: seções 1 e 5 do quickstart
5. Entregável: a lista de habilidades deixa de exigir acesso ao banco para consulta

### Entrega incremental

1. Setup + Foundational → fundação pronta (banco migrado, domínio testado)
2. + US1 → listagem → validar → demo **(MVP)**
3. + US2 → cadastro → validar → demo (aqui a tela já cumpre o motivo principal de existir)
4. + US3 → edição → validar → demo
5. + US4 → exclusão com confirmação → validar → demo
6. Fase 7 → polimento e roteiro completo

### Nota sobre a Fase 2

As duas mudanças de constraint (T007, T008) não são detalhe de implementação: sem elas, FR-009 e FR-012
ficam apenas prováveis. Rodar a verificação de pré-condição (T006) **antes** de gerar a migração evita
descobrir colisões de nome no meio do `db:migrate`.

---

## Notes

- Tarefas `[P]` = arquivos diferentes, sem dependência pendente
- TDD é obrigatório em `domain/` e `application/` (Princípio III) — confirmar que o teste falha antes de implementar
- Commits em Conventional Commits, um por tarefa ou grupo lógico
- Parar em qualquer checkpoint para validar a story isoladamente
- Toda mensagem visível ao usuário em pt-BR (Princípio II)
