---

description: "Task list for feature implementation"
---

# Tasks: Fluxo Unificado de Login

**Input**: Design documents from `/specs/001-unified-login-flow/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/routing-gate.md, contracts/login-ui.md, quickstart.md

**Tests**: Unit tests are included only for the pure-logic route classification (`src/shared/auth/rotas.ts`), consistent with the existing test pattern in the repo (e.g. `src/modules/auditoria/auditoria.test.ts`). No React component-testing library (e.g. Testing Library) is installed in this repo, so UI state-transition verification is manual, via `quickstart.md` — adding a new test dependency is out of scope for this feature.

**Organization**: Tasks are grouped by user story (US1, US2, US3, per `spec.md` priorities) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Existing Next.js App Router monolith (see `plan.md` Project Structure). No new top-level directories.

---

## Phase 1: Setup

**Purpose**: Confirm a clean baseline before touching the auth/routing code path.

- [ ] T001 Run `npm run lint` and `npm test` on the current branch to confirm a clean, passing baseline before making changes (no code changes in this task).

**Checkpoint**: Baseline confirmed clean — safe to start Foundational/story work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared scaffold that both US2 and US3 build on — the login page needs a single `modo` state machine (`'opcoes' | 'credenciais'`); building only half of it would leave the page in a broken state, so the scaffold itself is foundational even though the story-specific *behavior* inside each branch is delivered by US2/US3.

**⚠️ CRITICAL**: No user story 2 or 3 work can begin until this phase is complete. User Story 1 (routing gate) is independent of this phase and can be done in parallel.

- [ ] T002 In `app/(auth)/login/login-form.tsx`, introduce local state `modo: 'opcoes' | 'credenciais'` (default `'opcoes'`) per `data-model.md` §2. Render two mutually exclusive blocks driven by `modo`: an `opcoes` block (currently empty/placeholder) and a `credenciais` block containing the existing e-mail/senha form + OAuth "ou continue com" section moved as-is (no behavior change yet, just relocated under the `credenciais` branch) — this is the scaffold both US2 and US3 will fill in.

**Checkpoint**: `login-form.tsx` has a working two-branch state machine; app still compiles and the (temporarily relocated) existing login flow still works end-to-end from the `credenciais` branch.

---

## Phase 3: User Story 1 - Redirecionamento para login sem sessão válida (Priority: P1) 🎯 MVP

**Goal**: Qualquer rota de navegação, exceto `/login`, exige sessão válida; usuário sem sessão é redirecionado para `/login`; usuário já autenticado que acessa `/login` é redirecionado para sua área.

**Independent Test**: Sem cookie de sessão, acessar `/` ou qualquer rota interna (ex. `/dashboard`, `/voluntariado/candidatura`) e confirmar redirecionamento para `/login` sem exposição de conteúdo protegido (Cenário 1 de `quickstart.md`).

### Implementation for User Story 1

- [ ] T003 [P] [US1] Rewrite route classification in `src/shared/auth/rotas.ts` per `data-model.md` §1 / `contracts/routing-gate.md`: replace the "public unless listed" model with "protected unless `/login`". Keep `REGRAS_DE_ROTA` (role matrix) unchanged as a second-stage check. Export a function equivalent to today's `rolesExigidas(pathname)` plus a new `ehRotaPublica(pathname)` (or fold into one classification function) that returns whether a session is required and, if so, which roles (if any) are additionally required.
- [ ] T004 [US1] Update `proxy.ts` to consult the new classification from T003: (1) if the route is public (`/login`) → `NextResponse.next()` without any session check; (2) else if no session cookie → redirect to `/login?redirecionar=...`; (3) else apply the existing inactivity-timeout and role-matrix checks unchanged. Preserve the existing fast-path behavior (no DB hit on the happy path) and the existing `config.matcher` exclusions (`/api/auth/*`, static assets). (Depends on T003.)
- [ ] T005 [P] [US1] Add `areaPadraoPorRole(role: Role): string` helper (e.g. in `src/shared/auth/rotas.ts`) mapping each role to its default authenticated landing route (`coordenador`/`membro_defesa_civil`/`administrador` → `/dashboard`, `voluntario` → `/voluntariado/minhas-atividades`, `usuario` → `/voluntariado/candidatura` or another sensible default), for reuse in T006.
- [ ] T006 [US1] In `app/(auth)/login/page.tsx` (Server Component), check for a valid session via `auth.api.getSession` (same pattern already used in `app/(staff)/layout.tsx`) before rendering; if valid, `redirect()` to the route from `areaPadraoPorRole` (T005) instead of rendering `LoginForm` (FR-003). (Depends on T005.)
- [ ] T007 [P] [US1] Add unit tests in `src/shared/auth/rotas.test.ts` covering the classification table in `contracts/routing-gate.md`: `/login` → public; `/` , `/cadastro`, `/voluntariado/candidatura`, `/design-system`, `/sem-permissao` → session required, no specific role; `/estoque/descarte`, `/estoque/kits` → session + `coordenador`/`administrador`; other `REGRAS_DE_ROTA` entries unchanged. (Depends on T003.)

**Checkpoint**: User Story 1 is fully functional and independently testable — run Cenário 1 and Cenário 4.1 of `quickstart.md`.

---

## Phase 4: User Story 2 - Login via provedor social (Google/Facebook) (Priority: P1)

**Goal**: A partir do estado inicial (`opcoes`) da página de login, os botões "Acessar com Google" e "Acessar com Facebook" iniciam o mesmo fluxo OAuth de hoje, sem alteração de comportamento.

**Independent Test**: Na página de login (estado `opcoes`), clicar em cada botão social e confirmar que o fluxo OAuth existente é acionado e retorna o usuário autenticado (Cenário 2 de `quickstart.md`).

### Implementation for User Story 2

- [ ] T008 [US2] In `app/(auth)/login/login-form.tsx`, populate the `opcoes` branch (from T002) with the "Acessar com Google" and "Acessar com Facebook" buttons, wired to the existing `entrarComRedeSocial('google' | 'facebook')` handler (`signIn.social`) — moved as-is from the old flat layout, no logic change (FR-005). Preserve loading state (`carregandoSocial`) and error handling (`erroServidor`) exactly as today.
- [ ] T009 [US2] Confirm button label/order in the `opcoes` branch matches FR-004: "Acessar com Google", "Acessar com Facebook", "Usar usuário e senha" (the third button's behavior is delivered in US3; its label and position must exist now so the initial state is complete per FR-004).

**Checkpoint**: User Stories 1 AND 2 both work independently — run Cenário 2 of `quickstart.md`, plus re-run Cenário 1.

---

## Phase 5: User Story 3 - Alternância para login com usuário e senha (Priority: P2)

**Goal**: O botão "Usar usuário e senha" alterna a página para o formulário de credenciais, com "Voltar" (retorna ao estado inicial, descartando os campos) e "Acessar" (autentica ou mostra erro).

**Independent Test**: Clicar em "Usar usuário e senha", confirmar a troca de exibição, testar "Voltar" (retorna ao estado inicial) e "Acessar" com credenciais válidas/inválidas/vazias (Cenário 3 de `quickstart.md`).

### Implementation for User Story 3

- [ ] T010 [US3] Wire the "Usar usuário e senha" button in the `opcoes` branch (T009) to set `modo = 'credenciais'` (FR-006). (Depends on T008/T009.)
- [ ] T011 [US3] In the `credenciais` branch of `login-form.tsx`, add a "Voltar" button before/alongside the existing "Acessar"/submit button that sets `modo = 'opcoes'` and resets the form (react-hook-form `reset()`) so e-mail/senha are discarded (FR-007).
- [ ] T012 [P] [US3] Confirm the existing zod schema (`esquema` in `login-form.tsx`) already blocks submission with empty e-mail/senha and surfaces field-level errors without a network call (FR-010) — adjust messages only if needed; no schema logic change expected.
- [ ] T013 [P] [US3] Confirm the existing invalid-credentials handling (`setErroServidor('E-mail ou senha incorretos.')`) still fires from the `credenciais` branch and keeps the user in `modo: 'credenciais'` (FR-009) — no behavior change expected, verify after the T002/T011 relocation.

**Checkpoint**: All three user stories independently functional — run Cenário 3 and Cenário 4.2/4.3 of `quickstart.md`.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation alignment across all stories.

- [ ] T014 Run the full `quickstart.md` validation (Cenários 1–4) end-to-end manually against `npm run dev`.
- [ ] T015 [P] Update `spec/DESIGN.md` §6.2 (`proxy.ts` gate description) and the route table to reflect the deny-by-default model (public route is only `/login`), replacing the outdated "landing pública" exclusion note.
- [ ] T016 Run `npm run lint` and `npm test` (full suite, including `src/shared/auth/rotas.test.ts` from T007) to confirm no regressions.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS User Story 2 and User Story 3 (both edit `login-form.tsx` inside the scaffold from T002). Does NOT block User Story 1 (routing gate is a separate file set).
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion (per template convention) but has no file overlap with Phase 2/US2/US3 — may be implemented in parallel with Phase 2 in practice.
- **User Story 2 (Phase 4)**: Depends on Phase 2 (T002 scaffold). Independent of US1.
- **User Story 3 (Phase 5)**: Depends on Phase 2 (T002) and on US2's T008/T009 (same `opcoes` branch, same file) — sequential within `login-form.tsx`, but independently testable once complete.
- **Polish (Phase 6)**: Depends on US1, US2, and US3 all being complete.

### Within Each User Story

- US1: T003 → T004; T005 → T006; T007 depends on T003. T004/T005/T006/T007 can proceed once T003 lands.
- US2: T008 → T009 (same file, sequential).
- US3: T010 depends on T008/T009; T011 depends on T010; T012/T013 are verification tasks, parallelizable with T011.

### Parallel Opportunities

- T003 and T005 (both in `src/shared/auth/rotas.ts` but distinct functions) can be drafted in parallel, then merged before T004/T006.
- T007 (tests) can be written in parallel with T004 once T003 lands.
- Phase 3 (US1) can proceed entirely in parallel with Phase 2/4/5, since it touches `proxy.ts` + `src/shared/auth/rotas.ts` only, never `login-form.tsx`.
- T012 and T013 (US3 verification tasks) can run in parallel with each other and with T011.

---

## Parallel Example: User Story 1

```bash
Task: "Rewrite route classification in src/shared/auth/rotas.ts (T003)"
Task: "Add areaPadraoPorRole helper in src/shared/auth/rotas.ts (T005)"
# after T003 lands:
Task: "Add unit tests in src/shared/auth/rotas.test.ts (T007)"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2 — both P1)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (scaffold in `login-form.tsx`) — needed for US2's `opcoes` branch content, not for US1.
3. Complete Phase 3: User Story 1 (routing gate) — can run in parallel with Phase 2.
4. Complete Phase 4: User Story 2 (social login buttons in the new scaffold).
5. **STOP and VALIDATE**: Run Cenário 1 and Cenário 2 of `quickstart.md`. At this point the app is secure (deny-by-default) and the primary login path (social) works — the "Usar usuário e senha" button is visible but not yet wired to a working credentials screen, which is acceptable for an MVP checkpoint but not for shipping (see below).
6. Note: because `credenciais` already contains the relocated original form from T002, MVP users still have a *technically working* fallback credentials path even before US3's polish (T010–T013) — but do not consider the feature complete/shippable until US3 is done, since FR-006/007/010/011 (the toggle UX itself) are unmet.

### Incremental Delivery

1. Setup + Foundational → scaffold ready.
2. Add User Story 1 → validate independently → routing is secure.
3. Add User Story 2 → validate independently → social login preserved.
4. Add User Story 3 → validate independently → full toggle UX complete, feature shippable.
5. Polish (Phase 6) → documentation + full regression pass.

---

## Notes

- [P] tasks = different files or independently verifiable behavior, no blocking dependency.
- [Story] label maps each task to US1/US2/US3 for traceability back to `spec.md`.
- No new npm dependencies are introduced by this feature (confirmed in `plan.md` Technical Context).
- Commit after each task or logical group; stop at each Checkpoint to validate the story independently via `quickstart.md`.
