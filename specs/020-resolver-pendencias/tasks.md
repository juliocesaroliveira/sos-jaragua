---
description: 'Task list for 020-resolver-pendencias'
---

# Tasks: Resolução das Pendências Abertas

**Input**: Design documents from `/specs/020-resolver-pendencias/`

**Prerequisites**: plan.md, spec.md, research.md (D1–D6), data-model.md, contracts/, quickstart.md (V0–V7)

**Tests**: Incluídos. A constituição (Princípio III) exige TDD em `domain/` e `application/`.
Os testes dessas camadas vêm **antes** da implementação e precisam falhar primeiro. Testes
unitários ficam em `src/**/*.test.ts` (`npm test`). Os de integração ficam em
`src/**/*.integracao.test.ts` (`npm run test:integracao`). Nenhum teste fora de `src/` é
coletado.

**Organization**: Tarefas agrupadas por user story (spec.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1–US6 da spec
- Commits em Conventional Commits; textos de interface em pt-BR; nenhum `any` sem justificativa.

## Convenções que toda task deve seguir

- **Next.js 16 tem mudanças incompatíveis** com o que se conhece de versões anteriores
  (`AGENTS.md`). Antes de mexer em rota, Server Component ou Server Action, ler o guia
  correspondente em `node_modules/next/dist/docs/`.
- Server Actions de estoque seguem o padrão de `registrarDescarte` em
  `src/modules/estoque/presentation/actions/estoque.ts`: `exigir(ROLES_COORDENACAO)` →
  `erroAction('nao_autorizado', …)`; `safeParse` → `erroAction('validacao', 'Revise os campos do formulário.')`;
  `comAtorDaSessao(ator, () => useCase.executar(...))`; `serializar(resultado)`.
- Casos de uso seguem `RegistrarDescarteUseCase` (`src/modules/estoque/application/use-cases/registrar-descarte.ts`):
  classe que implementa `UseCase<E, S>`, devolve `Result` (`ok`/`falha` de `@/src/shared/kernel`),
  validação com `ValidacaoError` e auditoria via `withAudit` **dentro** do caso de uso.
- Dialog/drawer de formulário segue `app/(interno)/(staff)/admin/usuario-form-dialog.tsx`
  (RHF + Zod via `useFormulario`, feature 016). Ação por ícone com tooltip segue a feature 015.

---

## Phase 1: Setup (Dependências e lockfile)

**Purpose**: Destravar `npm ci` e o CI. Hoje o lockfile está fora de sincronia (research D5).

- [ ] T001 Regenerar `package-lock.json` com `npm install` na raiz e confirmar que `npm ci` conclui sem erro (hoje falha com `Missing: esbuild@0.28.2 from lock file`). Commit `chore: sync package-lock with package.json`.
- [ ] T002 Em `package.json`, fixar `next` e `eslint-config-next` em `16.3.8` (os dois andam juntos) e atualizar `sharp` para `^0.35.5`. Rodar `npm install` e depois `npm audit fix` **sem** `--force` (corrige as moderadas de `better-auth` e `vitest` dentro da faixa). **Não** aplicar o fix de `drizzle-kit`, que exige downgrade major. Atualiza `package.json` e `package-lock.json`.
- [ ] T003 Validar T002 com `npm run lint && npx tsc --noEmit && npm test && npm run build`. Se o build quebrar por causa do Next 16.3.8, reverter só `next`/`eslint-config-next` e anotar o motivo para a T047. Conferir com `npm audit --omit=dev` que `next` e `sharp` saíram da lista.

**Checkpoint**: `npm ci` passa. Só sobram no audit `xlsx` (sai na US2) e as moderadas documentadas.

---

## Phase 2: Foundational (Decisões registradas antes do código)

**Purpose**: Princípio VI: a decisão arquitetural fica registrada **antes** de virar código. Libera todas as stories.

**⚠️ CRITICAL**: Nenhuma user story começa antes desta fase.

- [ ] T004 Em `spec/DESIGN.md` §19 (tabela "Decisões de Design Consolidadas"), trocar a linha "Biblioteca XLSX" para `exceljs` (2026-10-01, Q1 da feature 020: CVE alto no `xlsx@0.18.5` sem correção no npm) e acrescentar estas linhas: "Auto-cadastro por senha: rota pública `/sign-up/email` fechada (`disabledPaths`); contas com senha só via `/admin`" (Q2); "Estoque mínimo de segurança: por item (`item.estoque_minimo`), vazio herda `ALERTA_ESTOQUE_MINIMO`, `0` desliga o alerta" (Q3); "Campo data/hora (`datetime-local`): formato do navegador, aceito; reavaliar se houver relato de confusão em campo" (PENDENCIAS §5); "Gestão de usuários: tela `/admin` (feature 006)" (PENDENCIAS §9); "Login social: botão só aparece com credencial completa do provedor" (PENDENCIAS §7).
- [ ] T005 [P] Em `spec/DESIGN.md` §16, trocar a linha `xlsx` por `exceljs` (mesmo uso). Em §17, acrescentar `RESEND_FROM`, `ALERTA_CADASTROS_PENDENTES`, `ALERTA_ESTOQUE_MINIMO` e `ALERTA_DEFICIT_PERCENTUAL`, conferindo contra `.env.example`.
- [ ] T006 [P] Emenda PATCH da constituição via `/speckit-constitution` (ou edição direta, seguindo a Governance do próprio arquivo) em `.specify/memory/constitution.md`: na seção "Stack e Convenções Técnicas", `**Planilhas**: \`xlsx\` (SheetJS)`vira`**Planilhas**: \`exceljs\``. Versão `1.0.0 → 1.0.1`, `Last Amended: 2026-10-01`, e o Sync Impact Report no topo atualizado com a motivação (Q1 da feature 020).

**Checkpoint**: decisões registradas. As stories podem começar.

---

## Phase 3: User Story 1 - Documento de pendências fiel ao estado real (Priority: P1) 🎯 MVP

**Goal**: `PENDENCIAS.md` sem itens resolvidos e sem afirmações falsas sobre o repositório.

**Independent Test**: para cada item restante, a afirmação do "Estado atual" confere com o repositório. Os itens 5, 9, 11 e 12 não aparecem, e as decisões deles estão no §19 (quickstart V7).

- [ ] T007 [US1] Em `PENDENCIAS.md`, remover as seções 9 (gestão de usuários, resolvida pela feature 006) e 12 (degradação da auditoria, já coberta por teste). A decisão do §9 já foi registrada pela T004.
- [ ] T008 [US1] Em `PENDENCIAS.md`, remover a seção 5 (`datetime-local`). A decisão (opção a) já foi registrada pela T004.
- [ ] T009 [US1] Em `README.md`, que hoje é o boilerplate "Example app using MongoDB", acrescentar no topo a seção "## Desenvolvimento local", com o conteúdo do PENDENCIAS §11: resolvedores que recusam DNS SRV (`ECONNREFUSED`), a opção de trocar o DNS para 8.8.8.8/1.1.1.1, e a alternativa de usar em `.env.local` a connection string **não-SRV** do Atlas (mesma credencial, três hosts do shard). Depois, remover a seção 11 de `PENDENCIAS.md`. Não reescrever o resto do README (fora de escopo).
- [ ] T010 [US1] Em `PENDENCIAS.md`, corrigir as afirmações desatualizadas: §1 diz que "nenhum código de exportação foi escrito ainda", mas `src/modules/contingencia/infrastructure/planilha.ts` já existe. Registrar que a decisão foi (b) `exceljs` e apontar para `specs/020-resolver-pendencias`. §14 diz que a área `/admin` não existe, mas ela existe. Atualizar o "Estado atual" do §2, informando que o resíduo (rota pública de sign-up) está sendo fechado pela feature 020, e do §8, informando que o limiar passa a ser por item pela feature 020 e que só os valores dependem da Defesa Civil.
- [ ] T011 [US1] Em `PENDENCIAS.md`, acrescentar a seção "Vulnerabilidades de dependência" com a tabela de `specs/020-resolver-pendencias/research.md` D5 (pacote, severidade, aplicabilidade à produção: o RCE do Next só afeta servidores Windows, então não atinge a Vercel) e o estado depois das T001–T003. Se tudo de alto/crítico foi corrigido, deixar só a nota das moderadas aceitas (`drizzle-kit`, `uuid` via `exceljs`).

**Checkpoint**: o documento não induz mais a erro. A reescrita final (≤ 7 itens) fica na T046, depois das demais stories.

---

## Phase 4: User Story 2 - Planilhas exportadas sem vulnerabilidade conhecida (Priority: P1)

**Goal**: `xlsx` → `exceljs`, com saída equivalente (contracts/exportacao-planilhas.md).

**Independent Test**: quickstart V1. Os arquivos exportados antes e depois têm o mesmo conteúdo. `npm ls xlsx` vazio. `npm audit --omit=dev` sem `xlsx`.

### Tests (escrever primeiro e ver falhar)

- [ ] T012 [US2] Criar `src/modules/contingencia/infrastructure/planilha.test.ts`. `server-only` já é resolvido pelo alias de `vitest.config.ts` (`test/stubs/server-only.ts`), então não precisa de mock. Testes:
    - (a) `await gerarXlsx([...])`: reler o buffer com `new ExcelJS.Workbook().xlsx.load(buf)` e conferir os invariantes 1–7 do contrato. São eles: abas na ordem; nome com `[]:*?/\` sanitizado e cortado em 31; linha 1 = cabeçalhos; número continua número; `null` vira célula vazia; largura `largura ?? max(12, cabecalho.length + 2)`; view congelada com `ySplit: 1`; aba sem linhas só com cabeçalho; "Água / ação / ç" preservados.
    - (b) `gerarCsv`: BOM, `;`, `\r\n`, decimal com vírgula, escape de `"`, `;` e quebra de linha (regressão; deve passar já antes da troca).
    - (c) `nomeDeArquivo` com data fixa.

### Implementation

- [ ] T013 [US2] `npm uninstall xlsx && npm install exceljs@4.4.0` (atualiza `package.json` e `package-lock.json`).
- [ ] T014 [US2] Reescrever `gerarXlsx` em `src/modules/contingencia/infrastructure/planilha.ts` com `exceljs`, que passa a ser `export async function gerarXlsx<T>(abas: Aba<T>[]): Promise<Buffer>`:
    - `new ExcelJS.Workbook()`;
    - por aba, `addWorksheet(limitarNomeAba(aba.nome), { views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }] })`;
    - `worksheet.columns = aba.colunas.map(c => ({ header: c.cabecalho, width: c.largura ?? Math.max(12, c.cabecalho.length + 2) }))`;
    - `addRow` por linha com `normalizarParaCelula`;
    - `Buffer.from(await workbook.xlsx.writeBuffer())`.

    Manter `limitarNomeAba`, que agora é obrigatório porque o exceljs **lança erro** com caracteres proibidos. Atualizar o comentário do topo ("XLSX vem do exceljs") e o comentário do congelamento (agora funciona de fato). `gerarCsv` e `nomeDeArquivo` não mudam.

- [ ] T015 [P] [US2] Em `app/api/relatorios/export/route.ts`, trocar `const buffer = gerarXlsx([aba])` por `await gerarXlsx([aba])`.
- [ ] T016 [P] [US2] Em `app/api/contingencia/export/route.ts`, acrescentar `await` na chamada de `gerarXlsx`.
- [ ] T017 [US2] Rodar `npm test -- planilha` (verde), `npx tsc --noEmit`, `npm ls xlsx` (vazio) e `npm audit --omit=dev` (sem `xlsx`). Executar quickstart V1, comparando os arquivos exportados antes e depois.

**Checkpoint**: exportações iguais, CVE do `xlsx` eliminado. Desbloqueia REL-01/REL-02/CON-01.

---

## Phase 5: User Story 3 - Entrada pública sem botões quebrados e sem porta lateral (Priority: P1)

**Goal**: rota pública de sign-up por senha fechada; botões sociais só com credencial completa (contracts/entrada-publica.md).

**Independent Test**: quickstart V2 (`POST /api/auth/sign-up/email` → 404; `/admin` ainda cria conta) e V3 (botões por combinação de env).

### Tests (escrever primeiro e ver falhar)

- [ ] T018 [P] [US3] Criar `src/shared/auth/provedores-sociais.test.ts` para `provedoresSociaisConfigurados(env)`. Casos: os dois completos → `['google','facebook']`; só Google → `['google']`; `GOOGLE_CLIENT_ID` preenchido com segredo vazio ou só com espaços → sem google; nenhum → `[]`; a ordem é sempre google antes de facebook.
- [ ] T019 [P] [US3] Criar `src/shared/auth/cadastro-publico.integracao.test.ts`, seguindo o padrão de `src/modules/identidade/application/use-cases/criar-usuario.integracao.test.ts`:
    - (a) `auth.handler(new Request(\`${BETTER_AUTH_URL}/api/auth/sign-up/email\`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BETTER_AUTH_URL }, body: JSON.stringify({ name, email: '<único>@teste.local', password }) }))`responde`404`, e não existe linha em `user` com esse e-mail;
    - (b) `auth.api.signUpEmail({ body: {...} })` no servidor **continua** criando a conta (limpar no `afterAll`).

### Implementation

- [ ] T020 [US3] Criar `src/shared/auth/provedores-sociais.ts` com `export type ProvedorSocial = 'google' | 'facebook'` e `export function provedoresSociaisConfigurados(env: Record<string, string | undefined> = process.env): ProvedorSocial[]`. Um provedor entra só com `<P>_CLIENT_ID` e `<P>_CLIENT_SECRET` não vazios depois de `trim()`. O módulo **não** importa `server-only`, porque o teste é unitário e não há segredo exposto: só nomes de provedores saem dele.
- [ ] T021 [US3] Em `src/shared/auth/opcoes.ts`:
    - (a) acrescentar `disabledPaths: ['/sign-up/email']`, com comentário explicando por que **não** `emailAndPassword.disableSignUp` (research D2: o `disableSignUp` é checado dentro do handler e quebraria `auth.api.signUpEmail` do `/admin`; o `disabledPaths` só barra o router HTTP);
    - (b) montar `socialProviders` só com os provedores de `provedoresSociaisConfigurados()`;
    - (c) atualizar o JSDoc do topo (o "fallback independente de provedor social" agora vale só para **login**, porque a criação de conta por senha é exclusiva do `/admin`).
- [ ] T022 [US3] Em `app/(publico)/login/page.tsx` (Server Component), chamar `provedoresSociaisConfigurados()` e passar `<LoginForm provedores={...} />`.
- [ ] T023 [US3] Em `app/(publico)/login/login-form.tsx`, receber `{ provedores }: { provedores: ProvedorSocial[] }`:
    - renderizar o botão "Acessar com Google" só se `provedores.includes('google')`, e o mesmo para Facebook;
    - o divisor "ou" e o aviso de privacidade só com `provedores.length > 0`;
    - o aviso cita só os provedores presentes ("Ao entrar com Google…", "Ao entrar com Google ou Facebook…");
    - com `[]`, o estado inicial é `'credenciais'` e o botão "Voltar" fica oculto.

    O tratamento de `?error=` e `?motivo=expirado` não muda. Atualizar o comentário de `ModoLogin`.

- [ ] T024 [US3] Rodar `npm test -- provedores-sociais`, `npm run test:integracao -- cadastro-publico criar-usuario`, `npm run lint` e `npx tsc --noEmit`. Executar quickstart V2 e V3, as quatro combinações de `.env.local`.

**Checkpoint**: nenhum botão quebrado em nenhum ambiente; zero contas com senha fora do `/admin`.

---

## Phase 6: User Story 5 - Alerta de estoque crítico coerente com cada item (Priority: P2)

> Vem antes da US4 porque a verificação end-to-end da US4 (DEPLOY-06) deve rodar com todo o código da feature já entregue.

**Goal**: mínimo de segurança por item, com fallback global (data-model.md; contracts/estoque-minimo.md).

**Independent Test**: quickstart V4 (Arroz = 20 alerta em 19; Cobertor = 0 nunca alerta; item sem mínimo usa o global; `membro_defesa_civil` não edita; `-1` é recusado; auditoria gravada).

### Schema

- [ ] T025 [US5] Em `db/schema/estoque.ts`, acrescentar `estoqueMinimo: quantidade()` (anulável, sem default) na tabela `item`, mais o `check('item_estoque_minimo_nao_negativo', sql\`${t.estoqueMinimo} IS NULL OR ${t.estoqueMinimo} >= 0\`)`no array de extras (importar`check`de`drizzle-orm/pg-core`). Rodar `npm run db:generate`para gerar`db/migrations/0005_*.sql`e conferir o SQL:`ADD COLUMN "estoque_minimo" numeric(14, 3)`+`ADD CONSTRAINT … CHECK`, sem backfill. Aplicar com `npm run db:migrate` no banco de desenvolvimento.

### Tests (escrever primeiro e ver falhar)

- [ ] T026 [P] [US5] Criar `src/modules/estoque/domain/estoque-minimo.test.ts`:
    - `limiarDoItem(null, 5) === 5`; `limiarDoItem(0, 5) === null`; `limiarDoItem(20, 5) === 20`;
    - `itensCriticos` com saldo igual ao limiar → crítico (`<=`); saldo acima → fora; mínimo 0 e saldo 0 → fora; `null` com saldo 4 e global 5 → crítico, com `limiar: 5`;
    - preserva os campos extras do item.
- [ ] T027 [P] [US5] Criar `src/modules/estoque/application/use-cases/definir-estoque-minimo.test.ts`, com repositório em memória implementando `ItemRepository` e `withAudit` mockado como passthrough, igual a `registrar-saida.test.ts` (`vi.mock('@/src/modules/auditoria', () => ({ withAudit: (_o, fn) => fn() }))`):
    - item inexistente → `falha` com código `item_nao_encontrado`;
    - negativo, `NaN`/`Infinity` ou mais de 3 casas decimais → `ValidacaoError` com `campos.estoqueMinimo` em pt-BR;
    - `null` → grava `null`; `20` → grava `20`; devolve `{ itemId, estoqueMinimo }`.

### Implementation

- [ ] T028 [P] [US5] Criar `src/modules/estoque/domain/estoque-minimo.ts` com `limiarDoItem(estoqueMinimo: number | null, limiarGlobal: number): number | null` e `itensCriticos<T extends { saldo: number; estoqueMinimo: number | null }>(itens: T[], limiarGlobal: number): (T & { limiar: number })[]`, seguindo a tabela de semântica do data-model. Exportar pelo `src/modules/estoque/domain/index.ts`.
- [ ] T029 [P] [US5] Criar `src/modules/estoque/infrastructure/limiar-estoque-global.ts` com `export function limiarEstoqueMinimoGlobal(): number`. Mover para lá a função `limiarEstoqueMinimo()` de `src/modules/notificacoes/application/use-cases/alertas-coordenador.ts`, com a mesma leitura de `ALERTA_ESTOQUE_MINIMO`: finito e `>= 0`, senão `5`. É fonte única para o alerta e para a tela.
- [ ] T030 [US5] Em `src/modules/estoque/application/ports/estoque-repository.ts`: `Item` ganha `estoqueMinimo: number | null`, e `ItemRepository` ganha `definirEstoqueMinimo(id: string, estoqueMinimo: number | null): Promise<void>`. Em `src/modules/estoque/infrastructure/drizzle/estoque-repository.ts`: `COLUNAS_ITEM` inclui `estoqueMinimo` (convertendo `numeric` → `number | null` com `paraNumero`, como já se faz com saldo), e `itemRepository.definirEstoqueMinimo` faz `update(item).set({ estoqueMinimo: valor === null ? null : String(valor) })`. Ajustar os chamadores de `Item` que quebrarem no `tsc`.
- [ ] T031 [US5] Criar `src/modules/estoque/application/use-cases/definir-estoque-minimo.ts` com `DefinirEstoqueMinimoUseCase implements UseCase<{ itemId: string; estoqueMinimo: number | null }, { itemId: string; estoqueMinimo: number | null }>`, no padrão de `RegistrarDescarteUseCase`:
    - validação → `ValidacaoError` em pt-BR ("Informe um número maior ou igual a zero.", "Use no máximo 3 casas decimais.");
    - `buscarPorId` → `DomainError('item_nao_encontrado', 'Item não encontrado.')`;
    - `withAudit({ entidade: 'Doacao', acao: 'update', tabela: 'item', dadosAnteriores: async () => ({ estoqueMinimo: anterior.estoqueMinimo }), extrair: () => ({ entidadeId: itemId, dadosNovos: { estoqueMinimo } }) }, () => repo.definirEstoqueMinimo(...))`.

    T027 deve ficar verde.

- [ ] T032 [US5] Em `src/modules/estoque/presentation/actions/estoque.ts`, acrescentar a Server Action `definirEstoqueMinimo(entrada: { itemId: string; estoqueMinimo: number | null })`:
    - esquema Zod `{ itemId: z.uuid(), estoqueMinimo: z.number().min(0).nullable() }`;
    - `exigir(ROLES_COORDENACAO)` → `erroAction('nao_autorizado', 'Somente coordenação pode definir o estoque mínimo.')`;
    - `comAtorDaSessao` + use case;
    - em sucesso, `updateTag(CACHE_TAGS.estoqueListagem)` e `agendarAlertasDeEstoque({ estoqueCritico: true })`;
    - `serializar`.
- [ ] T033 [US5] Em `src/modules/estoque/presentation/queries/estoque.ts`, `ItemComSaldo` ganha `estoqueMinimo: number | null`. Selecionar `item.estoqueMinimo` em `listarEstoque` **e** em `inventarioParaExportacao`, convertendo com `paraNumero` quando não nulo.
- [ ] T034 [US5] Em `src/modules/notificacoes/application/use-cases/alertas-coordenador.ts`, reescrever `avaliarEstoqueCritico(itens: { nome: string; saldo: number; estoqueMinimo: number | null; unidadeMedida: UnidadeMedida }[], destinatarios?)`:
    - usar `itensCriticos(itens, limiarEstoqueMinimoGlobal())`;
    - mensagem por item, conforme contracts/estoque-minimo.md: `"Arroz (mín. 20 kg) atingiu…"`, usando `formatarQuantidade` + `ABREVIACAO_UNIDADE`, até 5 nomes + "e mais N itens", com a concordância atual;
    - `contexto: { itens: [{ nome, saldo, limiar }] }`;
    - remover `limiarEstoqueMinimo()` local (movida na T029) e atualizar o JSDoc, que não é mais "limiar global… decisão aberta".

    `src/modules/notificacoes/presentation/alertas.ts` já passa o resultado de `inventarioParaExportacao()` e continua compatível.

- [ ] T035 [P] [US5] Em `src/modules/contingencia/application/relatorios.ts`, acrescentar à aba de inventário a coluna `{ cabecalho: 'Estoque mínimo', valor: (i) => i.estoqueMinimo, largura: 16 }` depois de "Saldo atual". `null` sai como célula vazia.
- [ ] T036 [US5] Criar `app/(interno)/(staff)/estoque/estoque-minimo-dialog.tsx` ('use client'), no padrão de `app/(interno)/(staff)/admin/usuario-form-dialog.tsx`: dialog no desktop, drawer no mobile, RHF + Zod com o mesmo esquema da action.
    - Campo numérico opcional "Estoque mínimo ({unidade})", com ajuda "Deixe em branco para usar o padrão ({global}). Use 0 para não receber alerta deste item.". Vazio envia `null`.
    - Submete com `definirEstoqueMinimo`. Em sucesso, toast (feature 010) e invalidação de `chaveEstoque` via TanStack Query; em erro, mostra a mensagem do `ResultadoAction`.
- [ ] T037 [US5] Em `app/(interno)/(staff)/estoque/page.tsx`, obter a sessão (`obterSessao`) e passar para `<TabelaEstoque>` as props `podeDefinirMinimo` (role `coordenador` ou `administrador`) e `limiarGlobal={limiarEstoqueMinimoGlobal()}`.
- [ ] T038 [US5] Em `app/(interno)/(staff)/estoque/tabela-estoque.tsx`:
    - coluna "Mínimo": `Padrão ({global} {unid})` quando `null`, `Sem alerta` quando `0`, senão `{formatarQuantidade(n)} {unid}`;
    - na coluna "Saldo", destaque de estado crítico quando `limiarDoItem(...) !== null && saldo <= limiar`, com o mesmo `text-danger-*` já usado, mais um texto/ícone acessível "Abaixo do mínimo" (não só cor);
    - coluna de ação com ícone + tooltip "Definir estoque mínimo", só se `podeDefinirMinimo`, abrindo o `EstoqueMinimoDialog` da T036.

    Atualizar as dependências do `useMemo`.

- [ ] T039 [US5] Rodar `npm test -- estoque-minimo definir-estoque-minimo`, `npm run lint`, `npx tsc --noEmit` e `npm run build`. Executar quickstart V4 (passos 1–9), com o mobile em 375px incluso.

**Checkpoint**: alerta por item funcionando, com o fallback global preservando o comportamento dos itens existentes.

---

## Phase 7: User Story 4 - Verificação de papéis e do timeout concluída (Priority: P2)

**Goal**: evidência registrada que fecha ID-06 e DEPLOY-06 (FR-015, FR-016).

**Independent Test**: quickstart V5 e V6 executados, com o resultado anotado em `spec/TASKS.md`.

- [ ] T040 [US4] Executar quickstart V5 com `STAFF_INACTIVITY_TIMEOUT_MINUTES="1"` em `.env.local`:
    - `coordenador1@teste.local` expira depois de mais de 1 minuto parado → `/login?motivo=expirado`;
    - com navegação a cada ~30s por 5 minutos, a sessão continua;
    - `voluntario1@teste.local` não expira.

    Restaurar o valor depois. Se algum passo falhar, **não** marcar: abrir um bug e registrar no `PENDENCIAS.md` (§4).

- [ ] T041 [US4] Em `spec/TASKS.md`, marcar `[x] ID-06` com uma nota de verificação (data, papéis e resultado da T040).
- [ ] T042 [US4] Executar quickstart V6 com `coordenador1@teste.local`, `voluntario1@teste.local` e `usuario1@teste.local`, percorrendo cada prefixo de `src/shared/auth/rotas.ts` (incluindo `/admin`, que deve barrar o coordenador) e as rotas novas desta feature (ação de estoque mínimo só para coordenação). Comparar com o BRD §2 (`spec/REQUISITOS_NEGOCIO.md`).
- [ ] T043 [US4] Em `spec/TASKS.md`, sob DEPLOY-06, registrar a tabela de resultado da T042 (rota × papel → acessa / `sem-permissao` / login) e marcar `[x] DEPLOY-06`. Divergências viram bug e não são marcadas.

**Checkpoint**: ID-06 e DEPLOY-06 fechados com evidência.

---

## Phase 8: User Story 6 - Roteiro operacional para colocar em produção (Priority: P3)

**Goal**: um roteiro único e ordenado dos passos de console (FR-018).

**Independent Test**: uma pessoa sem contexto diz o estado de cada passo em menos de 10 minutos (quickstart V7).

- [ ] T044 [US6] Criar `spec/ROTEIRO_PRODUCAO.md`. Cada passo tem **Pré-requisito / Ação / Onde / Como verificar / Feito em (data)**, nesta ordem:
    1. Variáveis no projeto Vercel (produção e preview), todas do `.env.example`, com destaque para `CRON_SECRET` (sem ela o cron recusa tudo) e `BETTER_AUTH_URL`. Origem: PENDENCIAS §13 / DEPLOY-01.
    2. Administrador de produção: `ADMIN_EMAIL`/`ADMIN_PASSWORD` reais só na Vercel, `npm run db:seed` contra produção, troca imediata da senha e confirmação de que **nenhuma** conta `@teste.local` ou `admin@sosjaragua.local` existe no banco de produção. Origem: §3.
    3. Aplicações OAuth: Google Cloud Console e Meta for Developers, callbacks `{BETTER_AUTH_URL}/api/auth/callback/{google,facebook}`; verificar que o botão aparece e conclui o login. Origem: §7.
    4. E-mail transacional: conta Resend, domínio verificado, `RESEND_API_KEY`/`RESEND_FROM`; verificar que um envio de teste grava `notificacao_envio` com `status` de sucesso. Origem: §6.
    5. Usuário restrito do Atlas: custom role só com `find`/`insert` em `audit_logs`, troca do `MONGODB_URI` de produção e verificação de que um `deleteOne` com esse usuário é recusado. Origem: §10 / AUD-02.
    6. Cron em produção: painel Cron Jobs com execução retornando 200 e Log Stream na primeira janela com turno em ~2h. Origem: §13 / DEPLOY-02.
    7. Limiares com a Defesa Civil: valores de `ALERTA_CADASTROS_PENDENTES`, `ALERTA_ESTOQUE_MINIMO` (padrão global) e `ALERTA_DEFICIT_PERCENTUAL`, e os mínimos por item dos itens mais críticos (água, alimentação, higiene) pela tela de `/estoque`. Origem: §8.
- [ ] T045 [US6] Em `PENDENCIAS.md`, substituir o corpo das seções 3, 6, 7, 10 e 13 por um resumo de uma linha, mais o link para o passo correspondente de `spec/ROTEIRO_PRODUCAO.md`. Elas continuam no documento até o passo ser feito, conforme a regra do topo do arquivo.

**Checkpoint**: tudo o que depende de console tem dono, ordem e critério de "feito".

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T046 Revisão final de `PENDENCIAS.md` (SC-001, SC-002), seguindo quickstart V7:
    - no máximo 7 itens, todos operacionais ou aguardando terceiros;
    - cada "Estado atual" conferido de novo contra o repositório;
    - §2 sem o resíduo do sign-up (fechado na US3); §8 reduzido a "valores pendentes com a Defesa Civil" (roteiro passo 7); §4 e §14 removidos se a US4 fechou ID-06/DEPLOY-06;
    - renumerar as seções e atualizar o parágrafo de introdução.
- [ ] T047 [P] Se a T003 reverteu o Next ou sobrou alguma vulnerabilidade alta ou crítica sem correção compatível, registrar no `PENDENCIAS.md` (FR-005/FR-017) o motivo e a versão que destrava. Senão, garantir que a seção de vulnerabilidades da T011 só cita as moderadas aceitas.
- [ ] T048 [P] Em `spec/TASKS.md`, anotar em REL-01, REL-02 e CON-01 que o bloqueio do PENDENCIAS §1 foi resolvido (exceljs, feature 020), sem mudar o `[x]`/`[ ]` delas.
- [ ] T049 Rodar a bateria completa: `npm ci`, `npm run lint`, `npx prettier --check .`, `npx tsc --noEmit`, `npm run test:tudo`, `npm run build` e `npm audit --omit=dev` (sem high/critical; SC-003). Corrigir o que falhar.
- [ ] T050 Executar quickstart V0–V7 de ponta a ponta e marcar os critérios SC-001 a SC-008 da spec. Pendências encontradas voltam para o `PENDENCIAS.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências. T001 → T002 → T003 em sequência (mesmo lockfile).
- **Foundational (Phase 2)**: depende da Setup só para o CI; logicamente independente. Bloqueia todas as stories (Princípio VI).
- **US1 (Phase 3)**: depende da T004 (decisões já no §19).
- **US2 (Phase 4)**: depende de Setup (lockfile) + T006 (emenda da constituição antes de trocar a lib).
- **US3 (Phase 5)**: depende só da Foundational.
- **US5 (Phase 6)**: depende da Foundational. A T035 (coluna no relatório) depende da T033 e se beneficia da US2 já entregue, mas funciona com qualquer biblioteca.
- **US4 (Phase 7)**: a T040/T041 (timeout) pode rodar a qualquer momento depois da Setup. A T042/T043 (matriz) deve rodar **depois** da US3 e da US5, para cobrir o código novo.
- **US6 (Phase 8)**: independente do código; a T045 depende da T044.
- **Polish (Phase 9)**: depois de todas as stories.

### Dentro de cada story

- Testes (T012, T018/T019, T026/T027) escritos e **falhando** antes da implementação.
- US5: schema (T025) → domínio (T028) → port/repo (T030) → use case (T031) → action (T032) → query (T033) → alerta (T034) → UI (T036–T038).

### Parallel Opportunities

- Phase 2: T005 ∥ T006 (arquivos diferentes; T004 e T005 tocam o mesmo `DESIGN.md`, então T004 → T005 em sequência).
- Depois da Phase 2: **US1, US2, US3, US5 e US6 podem andar em paralelo** (arquivos disjuntos, exceto o `PENDENCIAS.md`, que é só da US1/US6/Polish).
- US2: T015 ∥ T016.
- US3: T018 ∥ T019.
- US5: T026 ∥ T027 ∥ T028 ∥ T029; depois T035 ∥ T036.

---

## Parallel Example: User Story 5

```bash
# Testes primeiro, juntos:
Task: "T026 estoque-minimo.test.ts (regra pura)"
Task: "T027 definir-estoque-minimo.test.ts (caso de uso, repo em memória)"

# Peças independentes:
Task: "T028 domain/estoque-minimo.ts"
Task: "T029 infrastructure/limiar-estoque-global.ts"

# Depois da query (T033):
Task: "T035 coluna 'Estoque mínimo' em relatorios.ts"
Task: "T036 estoque-minimo-dialog.tsx"
```

## Parallel Example: User Stories 2 e 3 (P1)

```bash
Task: "T012–T017 troca xlsx → exceljs (contingencia/ + app/api/*/export)"
Task: "T018–T024 entrada pública (src/shared/auth/ + app/(publico)/login/)"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 (lockfile + Next/sharp): já elimina o CVE **crítico** e destrava o CI.
2. Phase 2 (decisões registradas).
3. Phase 3 (US1): o documento de pendências para de induzir a erro.
4. **PARAR e validar**: quickstart V0 + V7 parcial. Já é entregável sozinho.

### Incremental Delivery

1. MVP acima.
2. US2 (planilhas) → V1 → deploy. Fecha o CVE do `xlsx` e desbloqueia REL/CON.
3. US3 (entrada pública) → V2/V3 → deploy. Fecha a porta lateral e os botões quebrados.
4. US5 (estoque mínimo, com migration) → V4 → deploy.
5. US4 (verificações) → V5/V6 → marca ID-06/DEPLOY-06.
6. US6 + Polish → roteiro de produção e `PENDENCIAS.md` final.

### Notas

- Cada task termina com commit próprio (Conventional Commits).
- A migration (T025) é a única mudança irreversível de dados. É aditiva e anulável, então o rollback é só `DROP COLUMN`.
- Não marcar `[x]` no `spec/TASKS.md` sem exercitar o fluxo (regra do próprio arquivo).
