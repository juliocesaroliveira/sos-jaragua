# Tasks: Criptografia, Mascaramento e Exclusão de Dados Sensíveis (LGPD)

**Input**: Design documents from `/specs/024-criptografia-dados-sensiveis/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: **Obrigatórios, não opcionais.** O Princípio III da Constituição determina que "TDD é
obrigatório para `domain/` e `application/`" e que "nenhuma mudança em regra de negócio é aceita sem
teste que a exercite". Máscara, matriz de visibilidade e os casos de uso de revelar/anonimizar são
exatamente essas camadas.

**Organization**: tarefas agrupadas por história de usuário, para permitir implementação e validação
independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos distintos, sem dependência pendente)
- **[Story]**: a qual história a tarefa pertence (US1–US4)
- Todo caminho de arquivo é relativo à raiz do repositório

## Path Conventions

Monolito modular Next.js: `src/shared/` (infra transversal), `src/modules/<modulo>/{domain,application,infrastructure,presentation}/`, `app/` (rotas), `db/` (schema e migrations), `scripts/`.

---

## Phase 1: Setup

**Purpose**: configuração de ambiente e estrutura, sem lógica ainda

- [ ] T001 [P] Documentar `DADOS_SENSIVEIS_CHAVE` em `.env.example`, na seção de segurança, com o comando `openssl rand -base64 32` e sem valor real
- [ ] T002 [P] Definir `DADOS_SENSIVEIS_CHAVE` em `.env.local` para o ambiente de desenvolvimento
- [ ] T003 [P] Criar os diretórios `src/shared/cripto/` e `src/shared/mascara/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: cripto, máscara e a fonte única de classificação de campos. Tudo depende disto.

**⚠️ CRÍTICO**: nenhuma história pode começar antes desta fase terminar.

### Testes da fundação (escrever ANTES, confirmar que falham)

- [ ] T004 [P] Testes de `validarChave` em `src/shared/cripto/chave.test.ts`: chave ausente, base64 inválido, tamanho diferente de 32 bytes — todos lançam com mensagem em pt-BR nomeando a variável
- [ ] T005 [P] Testes de envelope em `src/shared/cripto/envelope.test.ts`: formato `v1.<iv>.<ct>.<tag>`, versão desconhecida rejeitada, envelope malformado rejeitado
- [ ] T006 [P] Testes de `cifrar`/`decifrar` em `src/shared/cripto/index.test.ts`: round-trip preserva o valor; duas cifragens do mesmo valor produzem saídas **diferentes** (IV aleatório); tag adulterada lança `ValorIlegivelError`
- [ ] T007 [P] Testes de `indiceCego` em `src/shared/cripto/indice.test.ts`: determinístico para o mesmo valor; `123.456.789-01` e `12345678901` produzem o **mesmo** índice; valores distintos produzem índices distintos
- [ ] T008 [P] Testes de máscara em `src/shared/mascara/index.test.ts`: `12345678901` → `12•••••••01`; `89250000` → `89••••00`; `1990-03-15` → `••/••/1990`; valor com ≤5 caracteres mascarado por inteiro; vazio → estado `ausente`
- [ ] T009 [P] Testes de `campoVisivelPara` em `src/shared/mascara/campos-sensiveis.test.ts`: as 6 colunas da Matriz de Visibilidade × 3 campos, incluindo o caso titular — `membro_defesa_civil` vê `cep` e **não** vê `cpf`

### Implementação da fundação

- [ ] T010 Implementar `src/shared/cripto/chave.ts`: leitura de `DADOS_SENSIVEIS_CHAVE`, validação, e derivação HKDF-SHA256 de duas subchaves com `info` distinto para cifra e para índice (research D3)
- [ ] T011 Implementar `src/shared/cripto/envelope.ts`: serialização e parse de `v1.<iv>.<ct>.<tag>` em base64url
- [ ] T012 Implementar `src/shared/cripto/index.ts`: `cifrar` (AES-256-GCM, IV de 12 bytes aleatório), `decifrar` (lança `ValorIlegivelError`) e `indiceCego` (HMAC-SHA256 sobre os dígitos) — usando apenas `node:crypto`, sem dependência nova (depende de T010, T011)
- [ ] T013 [P] Implementar `src/shared/mascara/index.ts`: `mascararCpf`, `mascararCep`, `mascararData` e a regra de exposição mínima para valores com ≤5 caracteres
- [ ] T014 [P] Implementar `src/shared/mascara/campos-sensiveis.ts`: classificação dos 3 campos e a Matriz de Visibilidade como **dado declarado**, mais `campoVisivelPara` — fonte única consumida por apresentação, exportação e redação de auditoria
- [ ] T015 Criar `instrumentation.ts` na raiz exportando `register()`, que chama `validarChave()` e falha o boot — a doc do Next 16 garante que roda uma vez, antes de atender requisições (depende de T010)
- [ ] T016 Estender `AcaoAuditada` em `src/shared/db/mongo/audit-logs.ts` com `'read'` e `'anonimizar'`, e atualizar `ACOES_AUDITADAS` e `ROTULO_ACAO_AUDITADA` em `src/modules/auditoria/presentation/queries/trilha.ts` com rótulos pt-BR e opções de filtro
- [ ] T017 Definir o tipo da forma de apresentação (`mascarado` | `ausente` | `ilegivel`) em `src/shared/mascara/index.ts`, conforme o contrato em `contracts/cripto-mascara.md`

**Checkpoint**: cripto e máscara testados e isolados. As histórias podem começar.

---

## Phase 3: User Story 1 — Dados protegidos no armazenamento (P1) 🎯 MVP

**Goal**: CPF, data de nascimento e CEP deixam de existir em texto plano em qualquer armazenamento — Postgres e trilha de auditoria —, com os cadastros existentes migrados.

**Independent Test**: cadastrar um voluntário, inspecionar o banco e confirmar que os três campos estão no formato `v1.…`; abrir o cadastro pelo sistema e confirmar que os valores voltam idênticos.

### Testes da US1 (escrever ANTES)

- [ ] T018 [P] [US1] Teste de integração em `src/modules/voluntariado/infrastructure/drizzle/voluntario-repository.integracao.test.ts`: gravar e reler um perfil devolve os três campos idênticos aos originais
- [ ] T019 [P] [US1] Teste de integração de unicidade em `src/modules/voluntariado/infrastructure/drizzle/voluntario-repository.integracao.test.ts`: dois perfis com o mesmo CPF violam o índice único de `cpf_indice`; `buscarPorCpf` encontra pelo valor completo
- [ ] T020 [P] [US1] Teste de integração em `scripts/proteger-dados-existentes.integracao.test.ts`: idempotência — rodar duas vezes não re-cifra o que já tem prefixo `v1.` nem corrompe linha migrada
- [ ] T021 [P] [US1] Teste em `src/modules/auditoria/redacao.test.ts`: o snapshot entregue a `registrarAuditoria` não contém CPF, data de nascimento nem CEP em claro
- [ ] T022 [P] [US1] Teste em `src/modules/voluntariado/application/use-cases/submeter-candidatura.test.ts`: a recusa por maioridade continua ocorrendo com o campo protegido (regressão de FR-006)

### Implementação da US1

- [ ] T023 [US1] Migration Drizzle (estrutura) em `db/migrations/`: adicionar `cpf_indice` e `anonimizado_em` a `voluntario_perfil`; relaxar `notNull` em `cpf`, `data_nascimento`, `cep`, `nome_completo`, `telefone`, `bairro`, `profissao`; **manter** os valores atuais em claro nesta etapa
- [ ] T024 [US1] Atualizar `db/schema/voluntariado.ts`: `cpf` e `cep` para `text` nulável, `data_nascimento` de `date` para `text` nulável, nova coluna `cpf_indice`, nova `anonimizado_em`
- [ ] T025 [US1] Atualizar `db/schema/identidade.ts`: `user.dataNascimento` de `date` para `text` nulável — é a cópia que FR-008 exige proteger
- [ ] T026 [US1] Ajustar os consumidores de `dataNascimentoDaConta` em `src/modules/voluntariado/application/use-cases/submeter-candidatura.ts` e `src/modules/identidade/infrastructure/drizzle/usuario-repository.ts` para o novo tipo string cifrada (depende de T025)
- [ ] T027 [US1] Cifrar na escrita e decifrar na leitura em `src/modules/voluntariado/infrastructure/drizzle/voluntario-repository.ts`, e reescrever `buscarPorCpf` para consultar por `cpf_indice` (depende de T012, T024)
- [ ] T028 [US1] Implementar `scripts/proteger-dados-existentes.ts`: para cada linha, cifra os três campos, calcula `cpf_indice` e grava; **idempotente**, reconhecendo o prefixo `v1.` para saltar o que já está protegido (FR-007)
- [ ] T029 [US1] Migration Drizzle (índices) em `db/migrations/`: criar `voluntario_perfil_cpf_indice_idx` único em `cpf_indice` e remover `voluntario_perfil_cpf_idx` — **só depois** de T028, para que uma colisão real de CPF duplicado apareça no script em vez de ficar escondida (depende de T028)
- [ ] T030 [US1] Implementar a redação dos campos sensíveis em `src/modules/auditoria/index.ts`, dentro de `withAudit`, imediatamente antes de `registrarAuditoria`, usando a classificação de `campos-sensiveis.ts` (FR-026, depende de T014)
- [ ] T031 [US1] Implementar `scripts/remediar-auditoria.ts`: varrer `audit_logs` e redigir os campos sensíveis nos snapshots de `voluntario_perfil` e `user` gravados antes da feature; idempotente; registrar evento próprio da remediação (FR-027)
- [ ] T032 [US1] Garantir que nenhum campo sensível apareça em log, mensagem de erro ou payload de notificação — varrer `console.error`/`console.log` nos caminhos tocados e os templates de notificação (FR-009)

**Checkpoint**: nada sensível em texto plano no Postgres nem no Mongo. A US1 entrega valor sozinha.

---

## Phase 4: User Story 2 — Exibição mascarada por padrão (P1)

**Goal**: toda superfície de apresentação mostra os campos sensíveis mascarados por padrão, conforme a Matriz de Visibilidade, inclusive nos arquivos exportados.

**Independent Test**: percorrer fila de triagem, listagens, painéis de relatório e exportações com uma conta de cada role e conferir a tabela de máscaras do `quickstart.md`, cenário E.

**Depends on**: US1 — as queries decifram antes de mascarar (research D5).

### Testes da US2 (escrever ANTES)

- [ ] T033 [P] [US2] Teste em `src/modules/voluntariado/presentation/queries/candidaturas.test.ts`: a função `'use cache'` devolve **apenas** a forma de apresentação, nunca o valor completo (INV-04)
- [ ] T034 [P] [US2] Teste em `src/modules/voluntariado/presentation/queries/relatorios.test.ts`: idem para as linhas de relatório que carregam CPF

### Implementação da US2

- [ ] T035 [US2] Alterar `src/modules/voluntariado/presentation/queries/candidaturas.ts` para devolver a forma de apresentação dos campos sensíveis em `listarCandidaturasPendentes` e nas demais funções `'use cache'` — sem ler sessão dentro do escopo de cache (research D4)
- [ ] T036 [US2] Alterar `src/modules/voluntariado/presentation/queries/relatorios.ts` da mesma forma, incluindo as consultas que agregam CPF e telefone
- [ ] T037 [P] [US2] Atualizar `app/(interno)/(staff)/cadastros-pendentes/fila-triagem.tsx` para renderizar a forma de apresentação, com os três estados visualmente distintos (`mascarado`, `ausente`, `ilegivel`) — FR-010, FR-013, FR-014
- [ ] T038 [P] [US2] Atualizar `app/(interno)/(staff)/relatorios/[relatorio]/painel-relatorio.tsx` para o mesmo contrato de apresentação
- [ ] T039 [US2] Atualizar as colunas de CPF em `src/modules/contingencia/application/definicoes/voluntariado.ts` (linhas ~121 e ~326) para que a exportação herde a regra da tela (FR-018)
- [ ] T040 [US2] Aplicar a regra de permissão ao conteúdo gerado em `app/api/relatorios/export` e `app/api/contingencia/export`, lendo a sessão fora de escopo de cache (FR-015, FR-018)
- [ ] T041 [US2] Aplicar o mesmo contrato de apresentação às superfícies restantes: `app/(interno)/(staff)/voluntarios/`, `app/(interno)/(staff)/atividades/[id]/` e `app/(interno)/(staff)/convocacao/` — confirmar a cobertura com `grep -rn 'cpf\|cep\|dataNascimento' app/ src/modules/*/presentation/` (SC-002)

**Checkpoint**: nenhuma tela ou exportação mostra dado sensível completo a quem não pode vê-lo.

---

## Phase 5: User Story 3 — Revelação restrita e auditada (P2)

**Goal**: quem tem o campo na Matriz revela o valor completo sob demanda, e cada revelação vira registro de auditoria.

**Independent Test**: como `coordenador`, revelar o CPF na fila de triagem e confirmar o registro `read` na trilha; como `membro_defesa_civil`, ter o CPF recusado e o CEP concedido na mesma tela.

### Testes da US3 (escrever ANTES)

- [ ] T042 [P] [US3] Testes do caso de uso em `src/modules/voluntariado/application/use-cases/revelar-dado-sensivel.test.ts`: concede conforme a Matriz; recusa fora dela; devolve `ilegivel` quando a decifragem falha; **não** registra leitura quando recusa
- [ ] T043 [P] [US3] Teste em `src/modules/voluntariado/application/use-cases/revelar-dado-sensivel.test.ts`: falha ao gravar auditoria **não** impede a revelação, e é registrada em log estruturado (Princípio V, US3 cenário 4)
- [ ] T044 [P] [US3] Teste em `src/modules/voluntariado/application/use-cases/revelar-dado-sensivel.test.ts`: a trilha registra o **nome do campo**, nunca o valor revelado (FR-026)

### Implementação da US3

- [ ] T045 [US3] Implementar `src/modules/voluntariado/application/use-cases/revelar-dado-sensivel.ts`: confere `campoVisivelPara`, decifra e audita com ação `'read'`, conforme `contracts/revelar-dado-sensivel.md` (depende de T014, T016)
- [ ] T046 [US3] Implementar a Server Action em `src/modules/voluntariado/presentation/actions/dados-sensiveis.ts`: parse Zod, checagem de sessão, chamada a **um** caso de uso — nunca cacheada (Princípio I)
- [ ] T047 [US3] Adicionar o controle de revelar em `app/(interno)/(staff)/cadastros-pendentes/fila-triagem.tsx`, exibido apenas para quem tem o campo na Matriz, com a autorização revalidada no servidor (defesa em profundidade)
- [ ] T048 [P] [US3] Adicionar o mesmo controle em `app/(interno)/(staff)/relatorios/[relatorio]/painel-relatorio.tsx`

**Checkpoint**: o acesso privilegiado existe, é restrito por campo e deixa rastro.

---

## Phase 6: User Story 4 — Titular acessa e exclui os próprios dados (P2)

**Goal**: área de conta onde o titular vê os próprios dados completos e solicita a eliminação, que anonimiza preservando o histórico operacional.

**Independent Test**: autenticar como voluntário, abrir `/conta`, ver os dados completos, excluir, confirmar, e verificar que os dados pessoais sumiram enquanto o total de turnos do período permaneceu igual.

### Testes da US4 (escrever ANTES)

- [ ] T049 [P] [US4] Testes do caso de uso em `src/modules/voluntariado/application/use-cases/anonimizar-titular.test.ts`: idempotência (segunda chamada não erra nem tem efeito); recusa por `ator_insubstituivel`
- [ ] T050 [P] [US4] Teste de integração em `src/modules/voluntariado/application/use-cases/anonimizar-titular.integracao.test.ts`: após anonimizar, a linha de `voluntario_perfil` **existe** com `anonimizado_em` preenchido e `cpf`/`cpf_indice` nulos; as linhas de `alocacao` **permanecem** (INV-07)
- [ ] T051 [P] [US4] Teste em `src/modules/voluntariado/application/use-cases/anonimizar-titular.integracao.test.ts`: turnos futuros confirmados passam a `cancelado` e as vagas voltam a ficar disponíveis (FR-025); turnos passados ficam intactos (FR-024)
- [ ] T052 [P] [US4] Teste em `src/modules/voluntariado/application/use-cases/anonimizar-titular.integracao.test.ts`: `session` e `account` do titular são removidas, `user.ativo` vai a `false` e `user.email` recebe valor neutro irrepetível (FR-028)

### Implementação da US4

- [ ] T053 [US4] Implementar a consulta de impacto em `src/modules/voluntariado/presentation/queries/conta.ts`: `turnosFuturosConfirmados`, `turnosPassados` e `temPerfilVoluntario` — nunca cacheada, por ler a sessão
- [ ] T054 [US4] Implementar `src/modules/voluntariado/application/use-cases/anonimizar-titular.ts` na ordem transacional de `contracts/excluir-meus-dados.md`, com `UPDATE` no lugar e **nunca** `DELETE FROM user` (research D7)
- [ ] T055 [US4] Auditar a anonimização com ação `'anonimizar'`, sem reproduzir na trilha os dados recém-eliminados (FR-029, depende de T016)
- [ ] T056 [US4] Invalidar `voluntariado:pendentes`, `voluntariado:listagem` e as tags de atividade afetadas após o commit, para que nenhuma tela sirva de entrada velha (FR-022)
- [ ] T057 [US4] Acrescentar a Server Action de exclusão em `src/modules/voluntariado/presentation/actions/dados-sensiveis.ts`, tomando o titular da sessão e nunca do payload
- [ ] T058 [US4] Criar `app/(interno)/conta/page.tsx`: apresenta os próprios dados **completos**, sem máscara e sem ação de revelar (FR-019) — fora de `(staff)`, pois basta sessão válida (research D12)
- [ ] T059 [US4] Criar `app/(interno)/conta/excluir-dados.tsx`: botão e confirmação explícita em pt-BR, informando que a ação é irreversível e **quantos turnos futuros** serão cancelados (FR-021)
- [ ] T060 [US4] Renderizar "titular anônimo" nas superfícies que referenciam um perfil com `anonimizado_em` preenchido, para que o histórico continue legível sem identificar a pessoa (INV-06)

**Checkpoint**: todas as quatro histórias funcionam de forma independente.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T061 Emendar a Constituição via `/speckit-constitution` (bump MINOR): Princípio IV (criptografia a nível de campo passa a ser a postura adotada) e Princípio V (exceção única e documentada à imutabilidade da trilha, por FR-027) — **pré-requisito do merge**, conforme o Constitution Check do `plan.md`
- [ ] T062 [P] Registrar as decisões técnicas em `spec/DESIGN.md`: a seção de cache (§7) ganha a regra de que dado sensível só trafega mascarado dentro de `'use cache'`, e uma seção nova descreve cripto, máscara e anonimização (Princípio VI exige registro antes do código)
- [ ] T063 [P] Atualizar `spec/DB_SCHEMA.md` com as colunas novas e as mudanças de tipo e nulabilidade
- [ ] T064 Rodar o roteiro completo de `quickstart.md` — os 15 cenários, com uma conta de cada role
- [ ] T065 Medir o tempo de resposta de `listarCandidaturasPendentes` (`src/modules/voluntariado/presentation/queries/candidaturas.ts`) e da listagem paginada de voluntários contra a meta de 300ms (SC-006), confirmando que a decifragem não introduziu regressão
- [ ] T066 Rodar `npm test`, `npm run test:integracao`, lint e type-check com a árvore limpa
- [ ] T067 Avaliar, em decisão à parte desta feature, o advisory **crítico** do `next@16.3.8` (RCE não autenticado, inclusive em funções `'use cache'` que retornam typed arrays) e os advisories altos de `zod`, `vite`, `js-yaml` e `source-map-js` — cifrar campo a campo sobre um runtime com RCE conhecido não entrega a postura de segurança que motivou a 024

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sem dependências
- **Foundational (Fase 2)**: depende da Fase 1 — **bloqueia todas as histórias**
- **US1 (Fase 3)**: depende da Fase 2
- **US2 (Fase 4)**: depende da Fase 2 **e da US1** — ver abaixo
- **US3 (Fase 5)**: depende da Fase 2; usa a US2 na tela, mas o caso de uso é testável sozinho
- **US4 (Fase 6)**: depende da Fase 2; independente das demais
- **Polish (Fase 7)**: depende das histórias desejadas

### Nota de honestidade sobre a independência das histórias

A spec trata as quatro histórias como independentemente testáveis, e três delas são. **A US2 não é
totalmente independente da US1**: o módulo de máscara é puro e testável sozinho (Fase 2), mas a
apresentação mascarada decifra antes de mascarar (research D5), então o caminho de leitura da US2 só
funciona com o repositório da US1 no lugar. Entregar a US2 sem a US1 produziria máscara sobre texto
plano — cosmético, sem o ganho de segurança. **A ordem US1 → US2 é obrigatória.**

### Ordem interna obrigatória da US1

`T023` (estrutura) → `T027`/`T028` (dados) → `T029` (índices). Criar o índice único antes de migrar os
dados esconderia uma colisão real de CPF duplicado que o script precisa expor (data-model §5.1).

### Parallel Opportunities

- Fase 1: T001, T002 e T003 em paralelo
- Fase 2: os testes T004–T009 todos em paralelo; depois T013 e T014 em paralelo com a cadeia T010→T011→T012
- US1: testes T018–T022 em paralelo
- US2: T037 e T038 em paralelo (arquivos distintos)
- US3: testes T042–T044 em paralelo; T048 paralelo a T047
- US4: testes T049–T052 em paralelo
- Com equipe: depois da Fase 2 e da US1, as US2, US3 e US4 podem andar em paralelo por pessoas diferentes

---

## Parallel Example: Fase 2 (fundação)

```bash
# Os testes da fundação, todos juntos:
Task: "Testes de validarChave em src/shared/cripto/chave.test.ts"
Task: "Testes de envelope em src/shared/cripto/envelope.test.ts"
Task: "Testes de cifrar/decifrar em src/shared/cripto/index.test.ts"
Task: "Testes de indiceCego em src/shared/cripto/indice.test.ts"
Task: "Testes de máscara em src/shared/mascara/index.test.ts"
Task: "Testes de campoVisivelPara em src/shared/mascara/campos-sensiveis.test.ts"
```

---

## Implementation Strategy

### MVP (US1 apenas)

1. Fase 1: Setup
2. Fase 2: Foundational — **crítica, bloqueia tudo**
3. Fase 3: US1
4. **PARAR e VALIDAR**: cenários B, C, D e J do `quickstart.md`
5. Nesse ponto os dados já estão protegidos no armazenamento, que é o ganho central da LGPD — mesmo
   antes de qualquer mudança de tela

### Entrega incremental

1. Setup + Foundational → fundação pronta
2. US1 → dados protegidos no armazenamento → **MVP**
3. US2 → exposição de tela reduzida no dia a dia
4. US3 → a operação volta a conseguir conferir documento, agora com rastro
5. US4 → direitos do titular (acesso e eliminação)

> A ordem 3 → 4 importa na prática: a US2 mascara o CPF na fila de triagem, e é a US3 que devolve ao
> `coordenador` a capacidade de conferir o documento para aprovar. Entregar a US2 em produção sem a US3
> deixa a triagem sem conferência de CPF nesse intervalo. Ou entregue as duas juntas, ou avise a
> operação.

### Pré-requisito de merge

A emenda da Constituição (T061) não é polimento opcional: o Constitution Check do `plan.md` registra
duas violações conscientes dos Princípios IV e V, e a seção Governance exige verificação contra os
Princípios I, IV e VI antes do merge.

---

## Notes

- `[P]` = arquivos distintos, sem dependência pendente
- Confirmar que cada teste **falha** antes de implementar (Princípio III)
- Commits em Conventional Commits (Princípio II)
- Textos de interface e mensagens de erro estritamente em pt-BR
- Parar em qualquer checkpoint para validar a história isoladamente
