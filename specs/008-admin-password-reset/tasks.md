---
description: 'Task list for 008-admin-password-reset'
---

# Tasks: Redefinição de senha e e-mail somente leitura na edição de conta

**Input**: Design documents from `/specs/008-admin-password-reset/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **obrigatórios** nesta feature. A regra "só redefine quem tem senha própria" vive em `application/`, e o Princípio III da constituição exige TDD para essa camada. Os testes de `EditarUsuarioUseCase` (T016–T018) vêm **antes** da implementação e devem falhar primeiro.

**Organization**: tarefas agrupadas por user story. US1 é independente do servidor e pode ser entregue sozinha.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependências pendentes)
- **[Story]**: US1, US2, US3 conforme spec.md
- Caminhos relativos à raiz do repositório

## Path Conventions

Monolito modular: `src/modules/identidade/{application,infrastructure,presentation}` + `app/(interno)/(staff)/admin/`. **Nenhuma migração** — `db/schema/identidade.ts` não é alterado.

---

## Phase 1: Setup (Contratos de tipos)

**Purpose**: declarar os contratos antes das implementações, para que `application` e `infrastructure` sejam escritas contra a mesma assinatura

- [x] T001 [P] Adicionar `definirSenha(userId, senha): Promise<void>` e `encerrarSessoes(userId, exceto?): Promise<void>` à interface `AutenticacaoService` em `src/modules/identidade/application/ports/autenticacao-service.ts`, com JSDoc registrando que `definirSenha` **não** cria conta `credential` quando não existe (contrato S-03.1, diverge do plugin `admin` do better-auth de propósito)
- [x] T002 [P] Adicionar `possuiSenhaPropria(userId): Promise<boolean>` à interface `UsuarioRepository` e o campo `podeTrocarSenha: boolean` ao tipo `LinhaUsuario`, em `src/modules/identidade/application/ports/usuario-repository.ts` (contrato S-04, data-model)
- [x] T003 Adicionar `novaSenha?: string` a `EntradaEditarUsuario` em `src/modules/identidade/application/use-cases/editar-usuario.ts`, sem ainda implementar o comportamento (depende de T001, T002)

---

## Phase 2: Foundational (Implementações de infraestrutura)

**Purpose**: fazer `podeTrocarSenha` chegar à tela e a redefinição existir tecnicamente

**⚠️ CRITICAL**: bloqueia US2 e US3 (não bloqueia US1)

- [x] T004 Implementar `possuiSenhaPropria` em `src/modules/identidade/infrastructure/drizzle/usuario-repository.ts` como `exists` sobre `account` com `providerId = 'credential'` e `password IS NOT NULL` (S-04.1, S-04.2)
- [x] T005 Projetar `podeTrocarSenha` por linha em `UsuarioRepository.listar` (`src/modules/identidade/infrastructure/drizzle/usuario-repository.ts`) via subconsulta correlacionada — sem consulta adicional por linha, mesmo padrão de `HABILIDADES_DO_PERFIL` em `voluntariado` (S-04.3)
- [x] T006 Implementar `definirSenha` em `src/modules/identidade/infrastructure/better-auth/autenticacao-service.ts` usando `auth.$context` → `ctx.password.hash(senha)` → `ctx.internalAdapter.updatePassword(userId, hash)`; hash sempre delegado ao better-auth, nunca calculado aqui (research D1, S-03.2)
- [x] T007 Implementar `encerrarSessoes(userId, exceto?)` em `src/modules/identidade/infrastructure/better-auth/autenticacao-service.ts` listando os tokens de sessão da conta e chamando `ctx.internalAdapter.deleteSessions(tokens)` com exclusão de `exceto` — **não** usar `deleteUserSessions`, que derrubaria quem executa ao redefinir a própria senha (research D4, S-03.3)
- [x] T008 Verificar que `LinhaUsuario` com `podeTrocarSenha` atravessa `src/modules/identidade/presentation/queries/usuarios.ts` até a tabela de `/admin` sem alteração de código na query (o tipo vem do port) e que `npx tsc --noEmit` passa (depende de T002, T005)

**Checkpoint**: a tela já recebe `podeTrocarSenha`; nada mudou visualmente ainda

---

## Phase 3: User Story 1 - E-mail somente leitura na edição (Priority: P1) 🎯 MVP

**Goal**: quem edita uma conta vê de qual conta se trata, sem poder alterar o e-mail.

**Independent Test**: abrir a edição de qualquer conta, conferir o e-mail correto exibido e não editável, e confirmar que salvar nome/papel continua funcionando; o cadastro segue com e-mail editável.

**Não depende das Fases 1 e 2** — é só apresentação e pode ser entregue primeiro.

- [x] T009 [US1] Em `app/(interno)/(staff)/admin/usuario-form-dialog.tsx`, exibir no modo edição um `Input` de e-mail com `disabled`, valor vindo de `usuario.email` e **fora** do `register` do react-hook-form, para que não entre no payload da action (U-01.1, FR-001/FR-002)
- [x] T010 [US1] Garantir em `app/(interno)/(staff)/admin/usuario-form-dialog.tsx` que o modo cadastro mantém o campo de e-mail editável, obrigatório e validado como hoje (FR-003) (depende de T009)
- [x] T011 [US1] Confirmar que `esquemaEditar` em `src/modules/identidade/presentation/actions/usuarios.ts` continua **sem** `email`, de modo que um payload forjado seja descartado pelo Zod (SC-004, defesa em profundidade)

**Checkpoint**: US1 entregável — cenário 1 do quickstart passa

---

## Phase 4: User Story 3 - Não oferecer troca para contas de provedor externo (Priority: P2)

**Goal**: a ação "Trocar Senha" aparece apenas para contas com senha própria.

**Independent Test**: abrir a edição de uma conta criada por login Google e verificar que o rodapé não oferece "Trocar Senha"; uma conta criada manualmente oferece.

**Entra antes de US2 de propósito**: entregar a redefinição primeiro colocaria em produção um botão que promete o que não pode cumprir para contas sociais.

- [x] T012 [US3] Adicionar ao slot `acoes` do `Dialog` em `app/(interno)/(staff)/admin/usuario-form-dialog.tsx` o botão "Trocar Senha" (`type="button"`, variante secundária, à esquerda de Cancelar/Salvar), exibido **somente** quando `modoEdicao && usuario.podeTrocarSenha` (U-02.1, U-02.2, U-02.4, FR-004/FR-005/FR-006) (depende de T008)
- [x] T013 [US3] Adicionar o estado local `trocandoSenha` em `app/(interno)/(staff)/admin/usuario-form-dialog.tsx`, alternado pelo botão e resetado no `useEffect` de `reset` já existente — inclusive ao alternar entre duas contas sem fechar o diálogo (U-04.1, U-04.2, FR-020) (depende de T012)
- [ ] T014 [US3] Verificar manualmente com uma conta Google e uma conta credencial que o botão aparece e some corretamente (cenário 3 do quickstart) (depende de T013)

**Checkpoint**: US1 e US3 entregáveis juntas — a tela está correta mesmo antes de a redefinição existir

---

## Phase 5: User Story 2 - Redefinir a senha de uma conta com senha própria (Priority: P2)

**Goal**: a administração redefine a senha de uma conta pela própria tela de edição.

**Independent Test**: redefinir a senha de uma conta criada manualmente, sair e entrar com a nova senha; a antiga deixa de funcionar.

### Tests for User Story 2 (TDD — obrigatório pelo Princípio III) ⚠️

> Escrever primeiro e confirmar que **falham** antes de implementar.

- [x] T015 [US2] Estender os dublês de `src/modules/identidade/application/use-cases/editar-usuario.test.ts` com `possuiSenhaPropria` no `UsuarioRepository` e um `AutenticacaoService` falso com `definirSenha`/`encerrarSessoes`
- [x] T016 [P] [US2] Teste em `src/modules/identidade/application/use-cases/editar-usuario.test.ts`: **sem** `novaSenha`, nem `possuiSenhaPropria` nem `definirSenha` são chamados e nome/papel são gravados como hoje (FR-008, S-02.3) (depende de T015)
- [x] T017 [P] [US2] Teste em `src/modules/identidade/application/use-cases/editar-usuario.test.ts`: com `novaSenha` em conta **sem** senha própria, o resultado é falha `senha_nao_aplicavel` e **nem** `definirSenha` **nem** `atualizarNomeERole` são chamados (FR-013, FR-015, S-02.1) (depende de T015)
- [x] T018 [P] [US2] Teste em `src/modules/identidade/application/use-cases/editar-usuario.test.ts`: com `novaSenha` em conta com senha própria, `definirSenha` é chamado **antes** de `atualizarNomeERole`, e `encerrarSessoes` é chamado com o id da conta (FR-009, FR-016, S-02.2) (depende de T015)
- [x] T019 [P] [US2] Teste em `src/modules/identidade/application/use-cases/editar-usuario.test.ts`: falha de `encerrarSessoes` **não** derruba a operação — o resultado continua `ok` (S-02.4, research D5) (depende de T015)

### Implementation for User Story 2

- [x] T020 [US2] Implementar em `src/modules/identidade/application/use-cases/editar-usuario.ts` o fluxo com `novaSenha`: checar `possuiSenhaPropria` → `definirSenha` → `atualizarNomeERole` (dentro do `withAudit` já existente) → `encerrarSessoes`, injetando `AutenticacaoService` no construtor (S-02) (depende de T016–T019)
- [x] T021 [US2] Acrescentar `senhaRedefinida: true` a `dadosNovos` do `withAudit` em `src/modules/identidade/application/use-cases/editar-usuario.ts` quando houve troca — booleano, nunca o valor da senha (FR-019, S-02.5) (depende de T020)
- [x] T022 [US2] Adicionar `novaSenha: z.string().min(8, …).optional()` a `esquemaEditar` e passar o `autenticacaoService` ao `EditarUsuarioUseCase` em `src/modules/identidade/presentation/actions/usuarios.ts`, mantendo a revalidação de `administrador` e o `updateTag` já existentes (S-01) (depende de T020)
- [x] T023 [US2] Passar à action o token da sessão de quem executa, para que `encerrarSessoes` o preserve quando a administradora redefine a própria senha (`src/modules/identidade/presentation/actions/usuarios.ts`) (FR-016 + assumption do spec) (depende de T022)
- [x] T024 [US2] Revelar o campo de senha em `app/(interno)/(staff)/admin/usuario-form-dialog.tsx` quando `trocandoSenha`: `type="password"`, vazio, apoio "Mínimo de 8 caracteres", e a ação do rodapé alternando para cancelar a troca (limpando o campo) (U-02.3, U-03, FR-007/FR-012) (depende de T013)
- [x] T025 [US2] Selecionar o resolver do react-hook-form por `modoEdicao && trocandoSenha` em `app/(interno)/(staff)/admin/usuario-form-dialog.tsx`, de modo que campo revelado e vazio bloqueie o envio e campo oculto não envie `novaSenha` (research D7, FR-008/FR-011) (depende de T024)
- [x] T026 [US2] Tratar em `app/(interno)/(staff)/admin/usuario-form-dialog.tsx` o erro `senha_nao_aplicavel` como erro geral via `avisar.erro`, mantendo `camposComErro` para os erros por campo, e reapresentar o campo de senha sempre vazio após falha (U-05) (depende de T024)

**Checkpoint**: todas as stories funcionais — cenários 2, 4, 5 e 8 do quickstart passam

---

## Phase 6: Polish & Cross-Cutting Concerns

> T014, T027, T028, T030 e T032 exigem a aplicação rodando com banco acessível
> e as três contas de teste (credencial, social, administradora). Não puderam
> ser executadas nesta sessão — o Neon está inacessível deste ambiente, falha
> pré-existente e independente destas mudanças. Continuam pendentes de
> validação manual.

- [ ] T027 Validar o cenário 6 do quickstart: sessão da conta afetada em outro navegador é encerrada, e a sessão de quem executa **não** é, ao redefinir a própria senha (FR-016)
- [ ] T028 Validar o cenário 7 do quickstart: o registro de auditoria traz `senhaRedefinida: true`, o executor e a conta afetada — e **nenhuma** senha em texto legível (FR-019, SC-006, SC-007)
- [x] T029 Verificar que a senha não aparece em resposta da action, em `avisar`, em log nem no payload devolvido ao cliente (FR-018)
- [ ] T030 [P] Conferir acessibilidade do formulário: rótulo do e-mail desabilitado anunciado, campo de senha alcançável por teclado ao ser revelado, foco não perdido ao alternar a troca (U-01.2, U-03.6)
- [x] T031 Rodar `npm test`, `npm run lint` e `npx tsc --noEmit` — sem `any` novo e sem texto de interface fora de pt-BR (Princípio II)
- [ ] T032 Executar os 8 cenários de [quickstart.md](./quickstart.md) com as três contas de teste (credencial, social e administradora)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sem dependências
- **Foundational (Fase 2)**: depende da Fase 1 — bloqueia US2 e US3
- **US1 (Fase 3)**: **não** depende das Fases 1 e 2 — pode começar imediatamente
- **US3 (Fase 4)**: depende da Fase 2 (precisa de `podeTrocarSenha` na tela)
- **US2 (Fase 5)**: depende da Fase 2 e de US3 (o campo revelável vive dentro da ação que US3 introduz)
- **Polish (Fase 6)**: depende das stories desejadas

### User Story Dependencies

- **US1 (P1)**: totalmente independente — é o MVP e pode ir sozinha para produção
- **US3 (P2)**: independente de US2; entrega a regra de visibilidade antes de a redefinição existir
- **US2 (P2)**: depende de US3 pela composição do rodapé, e da Fase 2 pelas implementações

### Within User Story 2

- Testes (T016–T019) **antes** da implementação (T020) — Princípio III
- Caso de uso (T020, T021) antes da action (T022, T023)
- Action antes do formulário consumir a nova entrada (T024–T026)

### Parallel Opportunities

- Fase 1: T001 e T002 em paralelo (arquivos diferentes)
- Fase 2: T004/T005 (Drizzle) em paralelo com T006/T007 (better-auth) — módulos distintos
- **US1 inteira em paralelo com as Fases 1 e 2**: só toca a tela, enquanto as outras tocam servidor
- Fase 5: T016–T019 em paralelo entre si, após T015
- Fase 6: T030 em paralelo com as demais validações

---

## Parallel Example: início do trabalho

```text
# Duas frentes desde o primeiro momento:
Dev A: T009 → T010 → T011              (US1, só apresentação)
Dev B: T001/T002 → T003 → T004..T008   (contratos + infraestrutura)
# Depois que B termina a Fase 2, as duas frentes se juntam em US3 → US2.
```

---

## Implementation Strategy

### MVP First (US1)

1. Fase 3 (T009–T011) — não espera por nada
2. **PARAR e VALIDAR**: cenário 1 do quickstart
3. Deploy — a tela de edição já mostra de qual conta se trata

### Incremental Delivery

1. US1 → e-mail visível e protegido → demo (MVP)
2. Fases 1 e 2 → infraestrutura pronta, nada visível
3. US3 → botão correto por tipo de conta → demo
4. US2 → redefinição funcionando → demo
5. Polish → sessões, auditoria, acessibilidade

---

## Notes

- **Nenhuma migração**: `account.providerId` e `account.password` já existem (`db/schema/identidade.ts:67`)
- **Nenhuma dependência nova**: o plugin `admin` do better-auth foi rejeitado em research D1 por impor um segundo modelo de papéis, incompatível com `src/shared/auth/roles.ts`
- `definirSenha` **não** cria conta `credential` quando não existe — é onde nosso comportamento diverge do plugin oficial, e é exatamente o que FR-005 exige
- FR-015 não é uma transação atômica real entre better-auth e Postgres; a ordem senha → papel é o que garante que uma falha provável não deixe nada alterado (research D3)
- A senha nunca entra em auditoria, log ou resposta — só no campo mascarado
- Commits em Conventional Commits, um por tarefa ou grupo lógico
