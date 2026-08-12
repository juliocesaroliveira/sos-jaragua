# Implementation Plan: Fluxo Unificado de Login

**Branch**: `001-unified-login-flow` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-unified-login-flow/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Inverter o modelo de proteção de rotas de "allowlist de roles" (rota é pública, a menos que
esteja explicitamente listada em `REGRAS_DE_ROTA`) para "deny-by-default" (toda rota exige
sessão válida, a menos que seja `/login` ou um endpoint técnico do próprio mecanismo de
auth). A página de login (`app/(auth)/login`) ganha um segundo estado de UI — alternância
client-side entre "3 botões" (Google, Facebook, usuário/senha) e o formulário de
usuário/senha existente (com "Voltar"/"Acessar") — sem criar nova rota. Os fluxos OAuth
(Google/Facebook) e de credenciais via `better-auth` permanecem inalterados; a mudança é de
roteamento/gate (`proxy.ts` + mapa de rotas) e de apresentação (componente de login), não de
mecanismo de autenticação.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Next.js 16.3.0 (App Router, Turbopack), React 19.1.1

**Primary Dependencies**: better-auth 1.6.26 (sessão/roles/social providers já configurados), Drizzle ORM sobre Neon Postgres, react-hook-form + zod (formulário), @ark-ui/react + Tailwind CSS v4 (design system existente: `Button`, `Input`, `Alert`)

**Storage**: Nenhuma mudança de schema — reutiliza `user`/`session`/`account` já existentes (better-auth); N/A para novas tabelas

**Testing**: Vitest (`npm test`) para lógica de roteamento/gate (`src/shared/auth/rotas.ts`, `proxy.ts` onde extraível para função pura); `npm run test:integracao` não é necessário aqui pois não há fluxo transacional novo

**Target Platform**: Web (Vercel), `proxy.ts` roda em runtime Node (Next 16 não suporta Edge em `proxy.ts`, conforme DESIGN.md §6.2)

**Project Type**: Monolito modular Next.js já existente (não é um projeto novo) — mudança concentrada em `proxy.ts`, `src/shared/auth/`, e `app/(auth)/login/`

**Performance Goals**: Alternância entre os dois estados da página de login MUST responder em <1s (SC-003) — é troca de estado local de componente client, sem round-trip de rede; gate de rota (`proxy.ts`) mantém o caminho rápido sem hit ao banco na ausência de cookie (já existente, não pode regredir)

**Constraints**: Preservar o timeout de inatividade de staff (`lastActivityAt`, DESIGN.md §6.3) e a defesa em profundidade existente (`proxy.ts` + re-checagem em `(staff)/layout.tsx`); preservar o comportamento atual dos fluxos OAuth Google/Facebook (FR-005) sem alteração de código nesse caminho

**Scale/Scope**: Afeta o roteamento de toda a aplicação (todas as rotas de navegação, exceto `/login` e endpoints técnicos de auth) + um componente de UI (login); nenhuma nova entidade de domínio

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Princípio IV — Segurança e Defesa em Profundidade**: PASSA, e a mudança é uma correção
  de postura de segurança. O modelo atual (`rolesExigidas` em `src/shared/auth/rotas.ts`)
  é **fail-open**: qualquer rota nova sob `app/` fica publicamente acessível por padrão, a
  menos que alguém lembre de adicioná-la a `REGRAS_DE_ROTA`. O novo modelo é **fail-closed**
  (deny-by-default): toda rota exige sessão válida, a menos que explicitamente marcada como
  pública (`/login`). Isso reforça o princípio, não o enfraquece. A barreira rápida em
  `proxy.ts` e a re-checagem em `(staff)/layout.tsx` continuam ambas em vigor — nenhuma
  camada de defesa é removida.
- **Princípio VI — Simplicidade Operacional**: PASSA. Inverter para deny-by-default é
  estruturalmente mais simples de raciocinar (uma exceção única — `/login` — em vez de uma
  lista crescente de exclusões implícitas) e não introduz nova infraestrutura, dependência
  ou serviço externo.
- **Princípio I — Clean Architecture por Módulo (DDD)**: PASSA. Não há nova regra de negócio
  de domínio; a alternância de estado da UI de login é puramente `presentation` (client
  component). O gate de rota já vive fora dos módulos DDD, em `src/shared/auth/` (cross-
  cutting), consistente com a estrutura atual.
- **Princípio V — Auditoria Não Bloqueante**: N/A — não há escrita em Voluntariado, Estoque
  ou Atividade nesta feature.
- Nenhuma violação identificada. Complexity Tracking não se aplica.

**Re-checagem pós-Phase 1**: o design em `data-model.md` e `contracts/` não introduziu
nenhuma nova dependência, tabela ou camada além das já mapeadas acima — gate de rota
(`src/shared/auth/`, cross-cutting) e UI de login (`presentation`, client component). Gates
permanecem PASSA.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
proxy.ts                                    # gate de auth/role — passa a negar por padrão

src/shared/auth/
  rotas.ts                                  # REGRAS_DE_ROTA (roles) + nova lista/regra
                                             # de rotas públicas (hoje: só /login)
  roles.ts                                  # inalterado
  inatividade.ts                            # inalterado (timeout de staff)
  client.ts                                 # inalterado (signIn.email / signIn.social)

app/(auth)/
  login/
    page.tsx                                # inalterado na estrutura; pode ganhar
                                             # redirect de usuário já autenticado
    login-form.tsx                          # ganha estado local (3 botões ↔ usuário/senha)
  cadastro/
    page.tsx, cadastro-form.tsx             # passa a exigir sessão (decisão de escopo)

app/(public)/
  page.tsx                                  # landing — passa a exigir sessão
  voluntariado/candidatura/
    page.tsx, candidatura-form.tsx          # passa a exigir sessão

app/sem-permissao/page.tsx                  # passa a exigir sessão (hoje acessível sem)
app/design-system/                          # passa a exigir sessão (galeria de componentes)

# Sem novos diretórios de teste dedicados — mudança coberta por testes unitários
# co-localizados (ex.: src/shared/auth/rotas.test.ts) e teste do componente de
# login-form.tsx, seguindo a convenção já usada no repositório (ex.: identidade.test.ts).
```

**Structure Decision**: Nenhuma reestruturação de projeto — é uma alteração cirúrgica sobre o
monolito Next.js já existente. O gate de rota (`proxy.ts` + `src/shared/auth/rotas.ts`) e a
página de login (`app/(auth)/login/`) concentram toda a mudança; as pastas hoje agrupadas em
`app/(public)/` deixam de ser publicamente acessíveis (passam a exigir sessão), mas não
precisam ser fisicamente movidas para `(staff)` ou outro route group — o route group `(public)`
é só uma convenção de organização de pastas, sem efeito na URL nem na proteção, que é decidida
inteiramente pelo mapa em `src/shared/auth/rotas.ts` consultado por `proxy.ts`.

## Complexity Tracking

*Não aplicável — nenhuma violação de constituição identificada no Constitution Check acima.*
