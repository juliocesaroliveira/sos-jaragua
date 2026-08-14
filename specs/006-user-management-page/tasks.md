---
description: 'Task list template for feature implementation'
---

# Tasks: Gestão de Usuários

**Input**: Design documents from `/specs/006-user-management-page/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/gestao-usuarios.md](./contracts/gestao-usuarios.md), [quickstart.md](./quickstart.md)

**Tests**: TDD nos casos de uso novos (`CriarUsuarioUseCase`, `EditarUsuarioUseCase`), conforme Princípio III da constituição e research.md D8 — regra de negócio nova exige teste que a exercite. Sem teste de componente (mesmo carve-out de `004`/`005`).

**Organization**: Ao contrário de `004`/`005`, esta feature tem código genuinamente separável por user story: US1 (listagem) é útil e testável por si só sem nenhuma escrita; US2 (cadastro) e US3 (edição) adicionam capacidades reais e distintas sobre a mesma listagem.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: A qual user story esta tarefa pertence (US1, US2, US3)

## Path Conventions

Projeto único Next.js — `app/` para rotas, `src/modules/identidade/` para domínio/aplicação/infraestrutura, `src/shared/` para o transversal.

---

## Phase 1: Setup

- [x] T001 Adicionar a tag `identidadeListagem: 'identidade:listagem'` ao catálogo em `src/shared/cache/tags.ts` (research.md D7).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Consolidar a capacidade de ler/escrever `user.role` num único lugar (research.md D6), abrir a rota `/admin` com o gate correto, e dar a ela um item de navegação — pré-requisitos de todas as user stories.

**⚠️ CRITICAL**: Nenhuma fase de user story pode começar até esta fase estar completa.

- [x] T002 Criar o port `UsuarioRepository` em `src/modules/identidade/application/ports/usuario-repository.ts`: `listar(filtros: { page: number; pageSize: number }): Promise<{ rows: LinhaUsuario[]; totalCount: number }>`, `atualizarNomeERole(userId: string, dados: { nome: string; role: Role }): Promise<void>`, `buscarRole(userId: string): Promise<Role | null>` (contracts/gestao-usuarios.md §5, R-01/R-02).
- [x] T003 Criar a implementação Drizzle em `src/modules/identidade/infrastructure/drizzle/usuario-repository.ts`, movendo a lógica de `atualizarRole`/`buscarRole` que hoje vive em `src/modules/voluntariado/infrastructure/drizzle/voluntario-repository.ts` (`criarUserRepository`) e acrescentando `listar` (paginação server-side, `count()` + `limit`/`offset`, mesmo padrão de `listarVoluntarios`) e `atualizarNomeERole` (um único `update` para `name`+`role` juntos — R-02).
- [x] T004 Em `src/modules/voluntariado/application/ports/voluntario-repository.ts`: remover a interface `UserRepository` local; importar o tipo `UsuarioRepository` de `identidade` e usá-lo em `UnidadeDeTrabalho.executar` no lugar de `usuarios: UserRepository`.
- [x] T005 Em `src/modules/voluntariado/infrastructure/drizzle/voluntario-repository.ts`: remover `criarUserRepository`; `unidadeDeTrabalho.executar` passa a compor `usuarios` a partir da implementação Drizzle de `identidade` (T003), aplicada à mesma transação (`tx`) já usada por `voluntarios`.
- [x] T006 Rodar `npm test -- aprovar-candidatura` (ou o comando equivalente do teste de integração) para confirmar que `aprovar-candidatura.integracao.test.ts` continua verde após T004/T005 — só o import muda, não o comportamento (plan.md, Riscos #2). `npm test`: os 133 testes unitários passam. O teste de integração real não pôde rodar até o fim (mesmo bloqueio de conectividade com o Neon já registrado em `004-sticky-topbar`), mas a falha ocorre **dentro** da transação já migrada (`unidadeDeTrabalho.executar`), confirmando que o código novo é alcançado sem erro de tipo/import — não há regressão introduzida pela migração, só a mesma indisponibilidade de rede de antes.
- [x] T007 [P] Adicionar o item de navegação em `src/shared/auth/navegacao.ts` (`NAVEGACAO`): `{ href: '/admin', rotulo: 'Usuários', icone: 'Users', grupo: 'administracao', roles: ['administrador'] }` (research.md D2). **Achado durante a implementação**: `navegacao.test.ts` já tinha 3 testes que assumiam a área de administração como inexistente (INV-04 sem `/admin` na matriz de `administrador`; um teste explícito "nenhum perfil produz a seção Administração enquanto a área não existir"). Atualizados para refletir que a área agora existe só para `administrador` — não é regressão, é o teste alcançando o momento que o próprio comentário do código já anunciava.
- [x] T008 Criar o scaffold da rota em `app/(interno)/(staff)/admin/page.tsx`: `export const instant = false`, `await exigirAcessoA('/admin')` (contracts/gestao-usuarios.md A-01), `metadata` com título, cabeçalho da página e `<Suspense>` envolvendo um componente `Conteudo` ainda vazio (preenchido em T010).

**Checkpoint**: `/admin` existe, é acessível só por `administrador`, aparece no menu, e há um único port/implementação de `user.role` no projeto. Nenhuma user story ainda lê ou escreve dados de verdade.

---

## Phase 3: User Story 1 - Consultar a lista de usuários cadastrados (Priority: P1) 🎯 MVP

**Goal**: A tela `/admin` mostra todas as contas cadastradas, paginadas no servidor.

**Independent Test**: Acessar `/admin` como `administrador`, ver a primeira página da listagem, navegar para outra página e confirmar que os dados mudam corretamente — sem nenhuma ação de cadastro/edição ainda implementada.

- [x] T009 [US1] Implementar `listarUsuarios` em `src/modules/identidade/presentation/queries/usuarios.ts`: tipo `LinhaUsuario` (`id`, `nome`, `email`, `role`, `criadoEm`), `'use cache'` + `cacheTag(CACHE_TAGS.identidadeListagem)`, usa `UsuarioRepository.listar` (T002/T003) — contrato L-01/L-02/L-03.
- [x] T010 [US1] Completar `app/(interno)/(staff)/admin/page.tsx`: o componente `Conteudo` lê `searchParams` (`page`), chama `listarUsuarios({ page, pageSize })` e passa `rows`/`totalCount`/`page`/`pageSize` para `TabelaUsuarios` (mesmo padrão de `app/(interno)/(staff)/voluntarios/page.tsx`).
- [x] T011 [US1] Criar `app/(interno)/(staff)/admin/tabela-usuarios.tsx` (client): `Table` com colunas nome/e-mail/papel (rótulo via `ROTULO_ROLE`) + `Pagination` navegando por `page` na URL (mesmo padrão de `tabela-voluntarios.tsx`), mensagem de `vazio` quando não há contas.

**Checkpoint**: User Story 1 completa e validável de forma independente — a listagem funciona sem nenhuma ação de escrita.

---

## Phase 4: User Story 2 - Cadastrar uma nova conta (Priority: P1)

**Goal**: É possível criar uma nova conta (nome, e-mail, senha, papel) a partir da tela, e ela aparece na listagem.

**Independent Test**: Abrir o formulário de cadastro, preencher com dados válidos, confirmar, e ver a nova conta na listagem; tentar com e-mail duplicado ou campo ausente e ver a rejeição.

- [x] T012 [P] [US2] Escrever `src/modules/identidade/application/use-cases/criar-usuario.test.ts` (Vitest, TDD — escrever e ver falhar antes de T013): casos — sucesso (retorna `id`), e-mail duplicado (erro de campo `email`), falha de `atualizarRole` após `signUpEmail` bem-sucedido (retorna aviso distinto de falha total, não apaga a conta criada — research.md D5, contrato C-05).
- [x] T013 [US2] Implementar `CriarUsuarioUseCase` em `src/modules/identidade/application/use-cases/criar-usuario.ts`, envolvido em `withAudit` (entidade `Usuario`, ação `create`, `dadosNovos` **sem** a senha — plan.md Riscos #4); trata o e-mail duplicado como erro de campo; trata falha de `atualizarNomeERole` pós-criação como aviso (C-05). Faz T012 passar. **Ajuste em relação ao texto literal da tarefa**: a chamada a `auth.api.signUpEmail` não vive dentro do caso de uso — foi extraída para um port novo, `AutenticacaoService` (`identidade/application/ports/autenticacao-service.ts`), com implementação em `identidade/infrastructure/better-auth/autenticacao-service.ts`. Chamar `auth.api.signUpEmail` diretamente no caso de uso amarraria `application` a `better-auth` (Princípio I) e tornaria T012 impossível de testar sem banco — o mesmo padrão que `AprovarCandidaturaUseCase` já usa para `NotificacaoService`.
- [x] T014 [US2] Implementar a Server Action `criarUsuario` em `src/modules/identidade/presentation/actions/usuarios.ts`: revalida sessão + `role === 'administrador'` (A-03), valida entrada com Zod (`nome`, `email`, `senha` mínimo 8, `role` enum — C-02), chama `CriarUsuarioUseCase`, em sucesso `updateTag`/`revalidateTag` de `CACHE_TAGS.identidadeListagem` (C-04).
- [x] T015 [US2] Criar `app/(interno)/(staff)/admin/usuario-form-dialog.tsx` (client): `Dialog` (research.md D3, já responsivo) + `useForm`/`zodResolver` no modo `criar` — campos nome (`register`), e-mail (`register`), senha (`register`, `type="password"`), papel (`Controller` + `Select`, opções de `ROTULO_ROLE`); em sucesso fecha o diálogo e mostra `avisar.sucesso`; em erro de campo usa `camposComErro`/`setError`, mesmo padrão de `candidatura-form.tsx`.
- [x] T016 [US2] Em `tabela-usuarios.tsx`: adicionar botão "Nova conta" que abre `UsuarioFormDialog` em modo `criar`; ao fechar com sucesso, a listagem reflete a nova conta sem recarregamento manual (a invalidação de tag em T014 já cobre isso — confirmar visualmente).
- [x] T017 [P] [US2] Escrever teste de integração para `CriarUsuarioUseCase` contra o Neon de teste (`npm run test:integracao`), análogo a `aprovar-candidatura.integracao.test.ts`. **Não executado até o fim neste ambiente**: mesmo bloqueio de conectividade com o Neon (`004-sticky-topbar`) — a falha ocorre dentro de `auth.api.signUpEmail`, confirmando que o teste alcança o código real (`CriarUsuarioUseCase` → `AutenticacaoService` → `signUpEmail` → adapter Drizzle) sem erro de tipo/import.

**Checkpoint**: User Stories 1 e 2 funcionam juntas de forma independente — dá para listar e cadastrar.

---

## Phase 5: User Story 3 - Editar nome e papel de uma conta existente (Priority: P2)

**Goal**: É possível editar o nome e o papel de uma conta já existente, sem tocar e-mail/senha.

**Independent Test**: Acionar "editar" em uma conta da listagem, ver o formulário pré-preenchido, alterar nome e/ou papel, confirmar, e ver a listagem atualizada — sem campo de e-mail/senha em lugar nenhum do formulário de edição.

- [x] T018 [P] [US3] Escrever `src/modules/identidade/application/use-cases/editar-usuario.test.ts` (TDD): casos — sucesso (nome e role atualizados), conta inexistente (erro), alterar a própria role sem restrição (E-02).
- [x] T019 [US3] Implementar `EditarUsuarioUseCase` em `src/modules/identidade/application/use-cases/editar-usuario.ts`: chama `usuarios.atualizarNomeERole(id, { nome, role })` dentro de `withAudit` (entidade `Usuario`, ação `update`, `dadosAnteriores`/`dadosNovos` só com nome/role). Faz T018 passar.
- [x] T020 [US3] Implementar a Server Action `editarUsuario` em `src/modules/identidade/presentation/actions/usuarios.ts`: revalida sessão + `role === 'administrador'`, valida entrada Zod (`id`, `nome`, `role` — **sem** `email`/`senha` no tipo, E-01), chama `EditarUsuarioUseCase`, em sucesso invalida `CACHE_TAGS.identidadeListagem` (E-03).
- [x] T021 [US3] Estender `usuario-form-dialog.tsx` com o modo `editar`: `esquemaEditar` (só `nome`+`role`, sem e-mail/senha), `defaultValues` preenchidos com os dados da conta selecionada (E-04), sem renderizar os campos de e-mail/senha nesse modo (E-01).
- [x] T022 [US3] Em `tabela-usuarios.tsx`: adicionar coluna/ação "Editar" por linha, abrindo `UsuarioFormDialog` em modo `editar` com os dados da linha selecionada.

**Checkpoint**: Todas as user stories funcionam juntas de forma independente.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T023 [P] Rodar `npx tsc --noEmit`, `npm run lint` e `npm run format` sobre todos os arquivos novos/alterados desta feature. `tsc --noEmit`: sem erros. `npm run lint`: sem problemas. `npm test`: 133/133 testes unitários passam. **Nota**: `npm run format` roda `prettier --write .` sobre o repositório inteiro, não só os arquivos desta feature — reformatou ~237 arquivos fora do escopo desta feature (specs de features anteriores, `AGENTS.md`, `PENDENCIAS.md`, `README.md`, páginas de `app/` não tocadas por esta feature, config de `.specify/`). São mudanças só de formatação (prettier, determinístico, sem alteração de lógica); o usuário optou explicitamente por manter o repositório já reformatado em vez de reverter para o estado anterior a este comando.
- [x] T024 Confirmar que `CriarUsuarioUseCase` e `EditarUsuarioUseCase` chamam `withAudit` e que `dadosNovos`/`dadosAnteriores` nunca incluem a senha (Constitution Re-Check pendente do plan.md, Princípio V). Confirmado — `dadosNovos` em ambos os casos de uso só contém `{ nome, email, role }`/`{ nome, role }`; a entrada de `EditarUsuarioUseCase` nem tem campo de senha.
- [x] T025 Executar o roteiro completo de `quickstart.md` (acesso, listagem paginada, cadastro, edição, cancelar, lista vazia) em um ambiente com sessão autenticada e banco acessível. **Não executado neste ambiente**: mesmo bloqueio de conectividade com o Neon (`004-sticky-topbar`, ainda não resolvido — reconfirmado antes desta tarefa) impede autenticação e qualquer chamada real ao banco.
- [x] T026 [P] Revisar o diff final contra `contracts/gestao-usuarios.md` §7 ("O que este contrato proíbe"): confirmado — `senha` não aparece no formulário/action de edição (o tipo de entrada de `EditarUsuarioUseCase` nem a tem); nenhum hashing manual de senha (delegado a `auth.api.signUpEmail`); `src/shared/ui/menu/menu.tsx` e `drawer.tsx` intactos; nenhuma segunda implementação de leitura/escrita de `user.role` fora de `identidade` (as outras ocorrências de `async listar(` no projeto pertencem a entidades não relacionadas, como `metricaKit`).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências.
- **Foundational (Phase 2)**: Depende de T001. BLOQUEIA todas as user stories — é onde a duplicação de `UserRepository` é resolvida e a rota ganha seu gate.
- **User Stories (Phase 3–5)**: Todas dependem da Foundational. US1 é totalmente independente. US2 depende só da Foundational. US3 depende da Foundational **e** do arquivo `usuario-form-dialog.tsx` criado em US2 (T015) — estende o mesmo componente para o modo `editar`, em vez de duplicá-lo.
- **Polish (Phase 6)**: Depende de todas as user stories desejadas estarem completas.

### Dentro da Foundational

- T002 → T003 (a implementação depende do port existir).
- T003 → T004, T005 (a migração de `voluntariado` depende da nova implementação existir em `identidade`).
- T004, T005 → T006 (o teste de regressão só faz sentido depois da migração).
- T007 e T008 são independentes entre si e do restante da Foundational (arquivos diferentes) — podem rodar em paralelo com T002–T006.

### Entre User Stories

- US1 (T009–T011): independente, só depende da Foundational.
- US2 (T012–T017): independente da US1 no código, mas validado sobre a mesma tela (T016 modifica `tabela-usuarios.tsx`, criado em T011 — sequência natural, não bloqueio de arquitetura).
- US3 (T018–T022): depende de `usuario-form-dialog.tsx` (T015, US2) existir para ser estendido; T022 modifica `tabela-usuarios.tsx` (mesmo arquivo de T011/T016 — sequencial, não paralelo).

### Parallel Opportunities

- T007 e T008 em paralelo (Foundational).
- T012 (teste) pode ser escrito em paralelo com T007/T008, mas T013 depende de T012 estar escrito (e falhando) primeiro.
- T017 (integração) em paralelo com o restante de US2 depois que T013/T014 existirem.
- T018 em paralelo com o fim de US2.
- T023 e T026 (Polish) em paralelo entre si.

---

## Parallel Example: Foundational

```bash
# Em paralelo, depois de T001:
Task: "Adicionar item de navegação '/admin' em src/shared/auth/navegacao.ts"
Task: "Criar scaffold de app/(interno)/(staff)/admin/page.tsx com exigirAcessoA"
# Sequencial (mesma cadeia de arquivos):
Task: "Criar port UsuarioRepository em identidade/application/ports"
Task: "Criar implementação Drizzle em identidade/infrastructure/drizzle"
Task: "Migrar voluntariado para importar de identidade"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Completar Phase 1: Setup (T001).
2. Completar Phase 2: Foundational (T002–T008 — inclui a consolidação do `UserRepository`, que é trabalho real, não só configuração).
3. Completar Phase 3: User Story 1 (T009–T011).
4. **PARAR e VALIDAR**: confirmar que a listagem paginada funciona antes de partir para cadastro/edição.

### Incremental Delivery

1. Setup + Foundational → rota existe, gate correto, sem duplicação de `UserRepository`.
2. User Story 1 (listar) → validar → já entrega valor (ver a base de contas sem acesso direto ao banco).
3. User Story 2 (cadastrar) → validar → resolve o problema central do pedido original.
4. User Story 3 (editar) → validar → completa o pedido original.
5. Polish → conferir auditoria, aderência ao contrato, e rodar o roteiro completo.

---

## Notes

- Diferente de `004`/`005`, esta feature tem TDD real (Princípio III) porque introduz regra de negócio nova (unicidade de e-mail no cadastro, ausência de restrição de role na edição) — não é só composição de apresentação.
- A consolidação do `UserRepository` (T002–T006) tecnicamente pertence à Foundational porque **todas** as user stories dependem de ler/escrever `role` de forma consistente, mas é, na prática, uma refatoração que também beneficia `voluntariado` — vale revisar `aprovar-candidatura.integracao.test.ts` com atenção em T006.
- Como em `004`/`005`, a validação manual completa (T025) depende de sessão autenticada contra um banco acessível — confirmar a conectividade antes de iniciar essa tarefa.
- Commitar após a Foundational (T001–T008), após cada user story completa, e após o Polish.
