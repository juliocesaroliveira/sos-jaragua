# Implementation Plan: Fluxo Único de Login

**Branch**: `feat/spec-tasks-implementation` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-unified-login-flow/spec.md`

## Summary

Tornar `/login` a única rota navegável publicamente da aplicação, redirecionando via
`proxy.ts` qualquer requisição sem sessão válida para ela (e usuários já autenticados
que tentem acessar `/login` para a área do seu papel). A página de login passa a ter
dois estados client-side alternáveis sem navegação: a tela inicial com três botões
("Acessar com Google", "Acessar com Facebook", "Usar usuário e senha") e a tela de
credenciais (e-mail/senha + "Voltar"/"Acessar"), reaproveitando o mesmo fluxo de
autenticação better-auth já decidido em `spec/DESIGN.md` §6 para os três métodos.

## Technical Context

**Language/Version**: TypeScript estrito, Next.js 16.3.0 (App Router, Turbopack), React
19.1.1

**Primary Dependencies**: `better-auth` (a adicionar — `emailAndPassword` +
`socialProviders: { google, facebook }`), Ark UI + Tailwind CSS v4 (componentes de
botão/input/form), `react-hook-form` + `zod` (formulário de credenciais),
`lucide-react` (ícones)

**Storage**: Neon Postgres via Drizzle ORM — tabelas core do better-auth (`user`,
`session`, `account`, `verification`) conforme `spec/DB_SCHEMA.md` §4.1; nenhuma tabela
nova exigida por esta feature

**Testing**: Sem framework automatizado configurado no projeto; verificação manual
conforme Constitution Principle III e `specs/001-unified-login-flow/quickstart.md`

**Target Platform**: Web responsivo (desktop + mobile), deploy Vercel

**Project Type**: Web (monolito modular Next.js — sem frontend/backend separados)

**Performance Goals**: Página de login deve carregar e alternar entre as duas telas de
forma instantânea (sem round-trip de rede na alternância `options` ↔ `credentials`,
apenas estado local)

**Constraints**: `/login` é a única rota de conteúdo pública (FR-001); endpoints
técnicos de auth (`/api/auth/*`, callbacks OAuth) permanecem públicos por necessidade do
próprio mecanismo; interface 100% pt-BR; timeout de inatividade de staff já previsto em
`spec/DESIGN.md` §6.3 deve continuar sendo respeitado pelo gate

**Scale/Scope**: Um `proxy.ts` (gate global), uma página (`app/(auth)/login/page.tsx`)
com dois estados de UI, a base de `src/modules/identidade` (auth config, handler de
rota, use cases de login) — escopo pequeno e bem delimitado

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação |
| --- | --- |
| I. Modular DDD & Clean Architecture | PASS — auth config, roles e helpers de sessão ficam em `src/shared/auth/`; casos de uso de login (se necessários além do que o better-auth já resolve) ficam em `src/modules/identidade/application/`; `presentation/` (a página `/login` e o handler `/api/auth/[...all]`) permanece fino, sem regra de negócio própria além de redirecionar por papel. |
| II. Strict Typing & Result-Based Error Handling | PASS — validação do formulário de credenciais via Zod na fronteira de `presentation/`; nenhuma regra nova de domínio complexa que exija `Result<T, DomainError>` além do que o better-auth já retorna (tratado e mapeado para mensagens de erro pt-BR na UI). |
| III. Verified-Before-Done (NON-NEGOTIABLE) | PASS — `quickstart.md` define os 12 cenários manuais que devem passar antes de marcar tasks relacionadas como `[x]` em `spec/TASKS.md`. |
| IV. Server-Side Performance & Data Discipline | PASS (N/A parcial) — não há listagem paginada nesta feature; a única exigência de performance é a alternância de tela ser client-side/instantânea, já coberta pelo design (sem chamada de rede na troca de view). |
| V. Security, Audit & Crisis-Ready UX | PASS — gate de rota única em `proxy.ts` (defesa central), reforçado pela checagem em `(staff)/layout.tsx` já prevista em `spec/DESIGN.md` para rotas internas; timeout de inatividade de staff mantido; UI 100% pt-BR; fluxo de dois botões + fallback de senha desenhado para ser claro sob estresse (poucos cliques, mensagens de erro diretas). |

Nenhuma violação — Complexity Tracking não se aplica.

## Project Structure

### Documentation (this feature)

```text
specs/001-unified-login-flow/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── route-protection.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created here)
```

### Source Code (repository root)

```text
proxy.ts                                      # gate de auth: sessão válida? role permitida?
                                               # redireciona para /login quando necessário (FR-001..003, FR-010)

app/
  (auth)/
    login/
      page.tsx                                # página única de login (client component)
                                               # estado local: view 'options' | 'credentials'
  api/
    auth/
      [...all]/route.ts                       # handler better-auth (Google, Facebook, credential)
  (staff)/
    layout.tsx                                # re-checagem de sessão/role (defesa em profundidade)

src/
  modules/
    identidade/
      domain/                                 # regras puras já previstas (ex.: validação de e-mail)
      application/
        use-cases/                            # casos de uso de login/logout, se necessários além do better-auth
        ports/
      infrastructure/                         # adapters, se necessários
      presentation/
        actions/                              # server action de login por credenciais (se aplicável)
        queries/                              # leitura de sessão para redirecionamento por papel
  shared/
    auth/                                     # instância better-auth, enum de roles, helpers de sessão/inatividade
    kernel/                                   # Result<T, E>, DomainError (reutilizados, não recriados)
    ui/                                       # botões/inputs Ark UI + Tailwind reutilizados na página de login

db/
  schema/
    identidade.ts                             # user/session/account/verification (better-auth + additionalFields)
```

**Structure Decision**: Monolito modular Next.js único (sem separação
frontend/backend), seguindo a estrutura de módulos DDD já mandatada pela Constitution
Principle I e por `spec/DESIGN.md` §5. Esta feature vive majoritariamente em `proxy.ts`
(gate global), `app/(auth)/login/page.tsx` (UI) e `src/modules/identidade` +
`src/shared/auth` (base de autenticação), sem introduzir módulos novos.

## Complexity Tracking

*Sem violações de Constitution Check — seção não aplicável.*
