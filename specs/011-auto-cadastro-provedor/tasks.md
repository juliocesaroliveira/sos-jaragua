---
description: 'Task list for feature 011 — auto-cadastro por provedor externo'
---

# Tasks: Auto-cadastro por provedor externo e pré-preenchimento da candidatura

**Input**: Design documents from `/specs/011-auto-cadastro-provedor/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **obrigatórios**, não opcionais. O Princípio III da constituição do projeto exige TDD
em `domain/` e `application/` — "nenhuma mudança em regra de negócio é aceita sem teste que a
exercite". As tarefas de teste desta feature vêm **antes** da implementação correspondente e
devem falhar antes de passar. `infrastructure/` e `presentation/` são finas por design e não
exigem a mesma cobertura.

**Organization**: agrupado por user story, para que cada uma seja implementável e testável de
forma independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependências pendentes)
- **[Story]**: user story à qual a tarefa pertence (US1, US2)
- Caminho de arquivo exato em toda descrição

## Path Conventions

Monolito modular Next.js. Caminhos reais deste repositório:

- Esquema e migrações: `db/schema/`, `db/migrations/`
- Infra compartilhada: `src/shared/auth/`, `src/shared/ui/`
- Bounded contexts: `src/modules/<modulo>/{domain,application,infrastructure,presentation}/`
- Telas: `app/(publico)/`, `app/(interno)/`
- Testes unitários convivem com o código (`*.test.ts`); integração usa `*.integracao.test.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: garantir que o ambiente permite validar a feature e que o ponto de partida é verde.

- [X] T001 Confirmar em `.env.local` as variáveis `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `MONGODB_URI`, e a URI de redirecionamento `http://localhost:3000/api/auth/callback/google` registrada no console do provedor (roteiro em `GOOGLE_AUTH_SETUP.md`)
- [X] T002 [P] Registrar baseline verde executando `npm test`, `npm run test:integracao` e `npm run lint` antes de qualquer alteração

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: a coluna de dado e sua exposição na sessão. Sem isso, nenhuma das duas stories
existe.

**⚠️ CRITICAL**: nenhuma user story pode começar antes desta fase terminar.

- [X] T003 Adicionar a coluna `dataNascimento` (`date`, nullable, sem default) à tabela `user` em `db/schema/identidade.ts`, com comentário explicando que o valor é gravado no primeiro envio de candidatura e não vem de provedor externo (data-model.md §Alteração de esquema)
- [X] T004 Gerar a migração com `npm run db:generate` e aplicá-la com `npm run db:migrate`, conferindo que `db/migrations/0002_*.sql` contém apenas um `ADD COLUMN` nullable e que nenhum backfill foi incluído (research.md D11)
- [X] T005 Declarar `dataNascimento` em `user.additionalFields` de `src/shared/auth/auth.ts` com `required: false` e **`input: false`**, ao lado de `role` e `ativo`; no mesmo arquivo, adicionar comentário de contrato registrando que `account.accountLinking.updateUserInfoOnLink`, `overrideUserInfo` e `requireLocalEmailVerified` **não devem ser definidos** e por quê (contracts/auto-cadastro.md C-01, research.md D3 e D4)
- [X] T006 [P] Acrescentar `dataNascimento: string | null` ao tipo `SessaoAtor` e ao objeto retornado por `obterSessao` em `src/shared/auth/sessao.ts`, lendo do `additionalField` já devolvido por `auth.api.getSession` sem consulta extra ao banco (research.md D8)

**Checkpoint**: coluna existe, sessão carrega o dado, escrita pelo cliente está fechada. As duas
stories podem começar.

---

## Phase 3: User Story 1 - Entrar pela primeira vez e ter a conta criada (Priority: P1) 🎯 MVP

**Goal**: primeiro acesso por Google/Facebook cria a conta com nome, e-mail, `role = usuario` e
data de nascimento em branco, com auditoria da criação e mensagens de recusa em pt-BR.

**Independent Test**: entrar com uma conta de provedor nunca usada e verificar em
`npm run db:studio` que a linha em `user` foi criada com os valores esperados, sem nenhum
formulário de cadastro exibido, e que o registro correspondente existe em `audit_logs`.

### Tests for User Story 1 ⚠️

> Escrever primeiro e confirmar que falham antes de implementar.

- [X] T007 [P] [US1] Criar `src/modules/identidade/application/use-cases/registrar-auto-cadastro.test.ts` cobrindo: registro de auditoria emitido com `entidade: 'Usuario'`, `acao: 'create'`, `tabela: 'user'` e ator explícito igual ao usuário criado com role `usuario`; `dadosNovos` **sem** `accessToken`, `refreshToken`, `idToken` e `image`; e falha do escritor de auditoria **não** propagando exceção (contracts/auto-cadastro.md C-06, Princípio V)

### Implementation for User Story 1

- [X] T008 [US1] Implementar `RegistrarAutoCadastroUseCase` em `src/modules/identidade/application/use-cases/registrar-auto-cadastro.ts`, recebendo `{ id, name, email, role, provedor, ip?, userAgent? }` e chamando `withAudit` com `opcoes.ator` **explícito** — não `atorAtual()`, que está vazio no auto-cadastro por não haver sessão ainda (research.md D5, `src/modules/auditoria/index.ts:21-22`)
- [X] T009 [US1] Ligar `databaseHooks.user.create.after` em `src/shared/auth/auth.ts` chamando o caso de uso de T008, extraindo o provedor de origem do `context` e envolvendo a chamada de forma que qualquer erro seja apenas logado, nunca propagado ao fluxo de login (data-model.md R4)
- [X] T010 [US1] Em `app/(publico)/login/login-form.tsx`, traduzir para pt-BR a recusa de vinculação (`"account not linked"`) e a ausência de e-mail do provedor, distinguindo-as de credencial inválida; usar como referência o texto de contracts/auto-cadastro.md C-04 e C-05, e ler o erro pelo parâmetro de query devolvido no retorno do callback OAuth (FR-005a, FR-007)
- [X] T011 [US1] No mesmo `app/(publico)/login/login-form.tsx`, acrescentar acima dos botões de provedor o aviso de quais dados serão obtidos, conforme contracts/auto-cadastro.md C-07 (FR-010) — depende de T010 por tocar o mesmo arquivo

**Checkpoint**: User Story 1 completa e verificável sozinha (quickstart V1, V6, V7).

---

## Phase 4: User Story 2 - Candidatar-se sem redigitar dados que o sistema já tem (Priority: P1)

**Goal**: o formulário de candidatura carrega e-mail, nome e data de nascimento da conta, com os
estados de habilitação corretos, e o servidor é a autoridade sobre e-mail e data.

**Independent Test**: abrir `/voluntariado/candidatura` com qualquer conta autenticada
(inclusive criada antes desta feature) e verificar os três campos com seus estados; enviar e
conferir em `db:studio` que `user.data_nascimento` foi gravada e `user.name` não mudou.

### Tests for User Story 2 ⚠️

> Escrever primeiro e confirmar que falham antes de implementar.

- [X] T012 [P] [US2] Acrescentar a `src/modules/voluntariado/domain/candidatura.test.ts` (criar o arquivo) os casos de `resolverDataNascimento`: conta preenchida vence o valor do formulário; conta vazia usa o do formulário; ambos vazios devolvem `undefined`; e o caso de a data da conta ser de menor de idade continuar reprovando em `validarCandidatura` (data-model.md R1, FR-020)
- [X] T013 [P] [US2] Criar `src/modules/voluntariado/application/use-cases/submeter-candidatura.test.ts` com repositórios falsos, cobrindo: data forjada no envio é descartada quando a conta já tem o valor; a data do formulário é gravada na conta quando ela estava ausente; `definirDataNascimentoSeAusente` **não** é chamado quando a conta já possui data; CPF de outra conta segue recusado; candidatura já aprovada segue recusando reenvio (contracts/candidatura-precarregada.md C-14)

### Implementation for User Story 2

- [X] T014 [US2] Implementar a função pura `resolverDataNascimento(daConta, doFormulario)` em `src/modules/voluntariado/domain/candidatura.ts`, sem importar Next.js, Drizzle ou Mongo (Princípio I, data-model.md R1)
- [X] T015 [P] [US2] Adicionar `definirDataNascimentoSeAusente(userId, data)` e `buscarDataNascimento(userId)` à interface `UsuarioRepository` em `src/modules/identidade/application/ports/usuario-repository.ts`, documentando que a condição "se ausente" pertence ao `WHERE` do UPDATE e não a uma leitura anterior (contracts/candidatura-precarregada.md C-15)
- [X] T016 [US2] Implementar os dois métodos em `src/modules/identidade/infrastructure/drizzle/usuario-repository.ts`, com o UPDATE condicional `... where(and(eq(user.id, userId), isNull(user.dataNascimento)))` para garantir idempotência sob envios simultâneos (data-model.md R2) — depende de T015
- [X] T017 [US2] Alterar `SubmeterCandidaturaUseCase` em `src/modules/voluntariado/application/use-cases/submeter-candidatura.ts` para receber `dataNascimentoDaConta`, resolver a data com T014 antes de `validarCandidatura`, e executar `salvarCandidatura` + `definirDataNascimentoSeAusente` dentro de um único `unidadeDeTrabalho.executar`, mantendo o `withAudit` existente e todas as mensagens de erro atuais (contracts/candidatura-precarregada.md C-14, FR-020/FR-021) — depende de T014 e T016
- [X] T018 [US2] Em `src/modules/voluntariado/presentation/actions/candidatura.ts`, tornar `dataNascimento` opcional no esquema Zod, garantir que **nenhum** campo de e-mail é aceito, e passar `dataNascimentoDaConta: ator.dataNascimento` — vindo da sessão, nunca do corpo do POST — ao caso de uso, preservando as invalidações de cache existentes (contracts/candidatura-precarregada.md C-13, FR-017) — depende de T017
- [X] T019 [P] [US2] Criar em `src/shared/ui/campo/campo.tsx` (e expor pelo `Input` em `src/shared/ui/input/input.tsx`) o estado "preenchido pela sua conta": `readOnly` + `aria-readonly` em vez de `disabled`, fundo sutilmente distinto e texto em contraste pleno — **não** reaproveitar o `disabled:opacity-50` da linha 74, que reprova o mínimo de 4.5:1 do WCAG AA (research.md D10, FR-015/FR-022)
- [X] T020 [US2] Em `app/(interno)/voluntariado/candidatura/page.tsx`, resolver no servidor e passar ao formulário `email`, `nomeInicial` (nome da candidatura anterior quando houver, senão o da conta) e `dataNascimentoDaConta`, aproveitando o `obterSessao()` já memoizado por request (contracts/candidatura-precarregada.md C-10, data-model.md R3)
- [X] T021 [US2] Em `app/(interno)/voluntariado/candidatura/candidatura-form.tsx`, adicionar o campo de e-mail somente leitura, aplicar o estado de T019 aos campos vindos da conta, manter o nome editável pré-preenchido, e renderizar a data de nascimento como texto formatado `dd/mm/aaaa` quando bloqueada — em vez de montar o `DatePicker`, que só expõe `disabled` — mantendo-o interativo e obrigatório quando a conta não tem a data (contracts/candidatura-precarregada.md C-11 e C-12) — depende de T019 e T020
- [X] T022 [US2] Criar `src/modules/voluntariado/application/use-cases/submeter-candidatura.integracao.test.ts` cobrindo contra o Neon real: perfil e `user.data_nascimento` gravados na mesma transação, e segunda chamada com data diferente deixando o primeiro valor intacto (data-model.md R2, Princípio III)

**Checkpoint**: User Stories 1 e 2 funcionam de forma independente (quickstart V2, V3, V4).

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T023 [P] Verificar contraste ≥ 4.5:1 dos campos somente leitura nos temas claro e escuro e a navegação por teclado/leitor de tela no formulário, conforme quickstart V5 (FR-022)
- [X] T024 [P] Conferir na tela de consentimento do Google que nenhum escopo além do básico é solicitado e que `src/shared/auth/auth.ts` não ganhou `scope` nem `mapProfileToUser` (SC-008, contracts/auto-cadastro.md C-01)
- [ ] T025 Executar o roteiro completo de validação manual V1–V7 de [quickstart.md](./quickstart.md), incluindo o teste de auditoria indisponível (V6), e registrar o resultado
- [X] T026 [P] Rodar `npm run test:tudo`, `npm run lint` e `npm run format`, confirmando que o conjunto unitário permanece rápido e sem rede (Princípio III)
- [X] T027 Revisar o diff contra os Princípios I, IV e VI antes do merge, conforme exigido pela seção Governance da constituição para mudanças no fluxo de autenticação

### Resultado do polish

**T023 — contraste (verificado, aprovado)**: medido contra os tokens reais de `app/globals.css`.
Tema claro, `#171717` sobre `slate-100 #f1f5f9` → **16.36:1**. Tema escuro, `#ededed` sobre
`slate-800 #1e293b` → **12.50:1**. Ambos muito acima do mínimo AA de 4.5:1. Para comparação, o
`disabled:opacity-50` que a variante substitui daria **3.41:1** (claro) e **3.93:1** (escuro) —
os dois reprovando. Confirma D10. A parte de leitor de tela depende de execução manual (V5).

**T024 — escopos (verificado, aprovado)**: `src/shared/auth/auth.ts` não contém `scope`,
`mapProfileToUser`, `updateUserInfoOnLink`, `overrideUserInfo` nem `requireLocalEmailVerified`
como configuração — apenas no comentário de contrato. A conferência na tela de consentimento do
Google faz parte de V1.

**T026 — suíte (verde)**: `npx tsc --noEmit` limpo; `npm test` 181/181 em ~0,7s (era 161 antes
da feature, sem rede); `npm run test:integracao` 16/16; `prettier` aplicado. `npm run lint`
reporta **um erro pré-existente** em `app/(interno)/(staff)/crise/gestao-crise.tsx:5`
(`'MoreVertical' is defined but never used`), arquivo não tocado por esta feature — deixado
como está para não misturar correção alheia no diff.

**T027 — revisão constitucional (aprovada)**:

- *Princípio I*: `voluntariado` escreve em `user` só via `UsuarioRepository`;
  `resolverDataNascimento` é pura no `domain`; a Server Action segue fina (parse → sessão → um
  caso de uso → invalidação).
- *Princípio IV*: `input: false` fecha a escrita pelo cliente; a data vem da sessão e não do
  POST; `requireLocalEmailVerified` permanece no default estrito; nenhuma rota nova.
- *Princípio VI*: uma coluna nullable, nenhuma dependência nova em `package.json`, nenhum
  serviço novo.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências
- **Foundational (Phase 2)**: depende do Setup — **bloqueia as duas stories**
- **User Story 1 (Phase 3)**: depende da Phase 2
- **User Story 2 (Phase 4)**: depende da Phase 2 — independente da US1
- **Polish (Phase 5)**: depende das stories entregues

### User Story Dependencies

As duas stories dependem apenas da Phase 2 e **não dependem uma da outra**. US1 é observável sem
o formulário; US2 funciona com qualquer conta autenticada, inclusive criada por e-mail e senha
antes desta feature.

### Cadeias sequenciais dentro das fases

- T003 → T004 (migração só depois do esquema)
- T005 → T009 (o hook mora no mesmo arquivo do `additionalField`)
- T010 → T011 (mesmo arquivo `login-form.tsx`)
- T012, T013 → T014, T017 (teste antes da implementação, Princípio III)
- T015 → T016 → T017 → T018 (port → infra → caso de uso → action)
- T019, T020 → T021 (o formulário consome a variante de campo e as props)

### Parallel Opportunities

- T002 durante o Setup
- T006 em paralelo com T005 (arquivos distintos)
- T007 (teste da US1) em paralelo com T012 e T013 (testes da US2)
- T015 e T019 em paralelo — port de Identidade e design system não se tocam
- Toda a Phase 3 em paralelo com a Phase 4, se houver duas pessoas
- T023, T024 e T026 em paralelo no Polish

---

## Parallel Example: após a Phase 2

```bash
# Duas pessoas, uma por story:
Dev A: T007 → T008 → T009 → T010 → T011        # US1 completa
Dev B: T012, T013 (paralelos) → T014 → T015 → T016 → T017 → T018 → T021 → T022

# Dentro da US2, estes dois não competem por arquivo:
Task: "Métodos novos no port em src/modules/identidade/application/ports/usuario-repository.ts"
Task: "Estado 'preenchido pela conta' em src/shared/ui/campo/campo.tsx"
```

---

## Implementation Strategy

### MVP (User Story 1)

1. Phase 1 → Phase 2 → Phase 3
2. **PARAR E VALIDAR**: quickstart V1 (primeiro acesso), V6 (auditoria não bloqueante) e V7
   (e-mail já usado por conta com senha)
3. Entregável real: contas criadas com auditoria e recusas explicadas em pt-BR — corrige, por si
   só, o erro genérico que hoje aparece para quem tenta entrar pelo Google tendo conta com senha

### Entrega incremental

1. Phase 1 + 2 → fundação pronta
2. + US1 → validar → demo (MVP)
3. + US2 → validar → demo
4. Polish → merge

### Observação de sequenciamento

A Phase 2 inclui uma migração de banco. Ela é compatível com o código atual (coluna nullable que
ninguém lê ainda), então pode ser mergeada e aplicada antes das stories sem quebrar produção.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente
- Testes de `domain`/`application` **antes** da implementação — exigência do Princípio III, não
  preferência de estilo
- Confirmar que cada teste falha antes de implementar
- Commits em Conventional Commits (`feat:`, `test:`, `docs:`) — Princípio II
- Interface e mensagens de erro estritamente em pt-BR
- Ponto de atenção recorrente: campo desabilitado no navegador nunca é enforcement; a autoridade
  é sempre a Server Action lendo a sessão
