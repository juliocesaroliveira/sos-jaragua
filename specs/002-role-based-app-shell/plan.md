# Implementation Plan: Shell de Navegação por Perfil (Topbar + Sidebar)

**Branch**: `002-role-based-app-shell` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-role-based-app-shell/spec.md`

## Summary

O shell (topbar + sidebar) já existe, mas vive dentro do route group `(staff)` — só os três perfis internos o enxergam. `usuario` e `voluntario` navegam em páginas soltas, cada uma com seu próprio cabeçalho improvisado (`<header>` + `ThemeToggle` copiado em três arquivos), sem identificação de quem está logado e sem ação de sair.

A abordagem é **subir o shell um nível** em vez de criar um segundo: extrair `StaffShell` para um `AppShell` compartilhado, introduzir um route group `(interno)` cujo layout aplica `exigirSessao()` e renderiza o shell, e rebaixar `(staff)` a um grupo aninhado que só acrescenta o gate de role. Toda página autenticada passa a herdar o shell por construção — inclusive as que ainda não existem (FR-004).

Os itens do menu saem de um registro único (`src/shared/auth/navegacao.ts`), co-locado com `rotas.ts`. Cada item declara suas roles explicitamente (FR-021), e um teste unitário trava a consistência contra `rolesExigidas()` — o mesmo padrão de trava que `roles.ts` já usa contra o enum do banco.

## Technical Context

**Language/Version**: TypeScript estrito, React 19.1, Next.js 16.3 (App Router, Turbopack)

**Primary Dependencies**: Ark UI 5 + Tailwind CSS v4 (design system em `src/shared/ui`), better-auth 1.6 (sessão/roles), lucide-react (ícones). Nenhuma dependência nova.

**Storage**: N/A — a feature não introduz persistência. Lê sessão (better-auth/Postgres) e o contador de notificações já existente.

**Testing**: Vitest (`npm test`) para o registro de navegação e a trava de consistência menu↔autorização. Sem testes de integração: a feature não toca fluxo transacional.

**Target Platform**: Web responsivo (mobile-first, 360px+), Vercel

**Project Type**: Monolito modular Next.js — camada `presentation`/UI compartilhada

**Performance Goals**: Sem regressão na primeira renderização útil das telas de operação de campo (meta vigente <300ms nas leituras críticas). O shell não pode adicionar consulta ao banco no caminho de render de nenhuma página.

**Constraints**: Interface 100% pt-BR; tema claro/escuro; operável por teclado; alvos de toque ≥44px; nenhuma regra de autorização criada, afrouxada ou endurecida.

**Scale/Scope**: 5 perfis, ~16 destinos de navegação, ~15 páginas autenticadas existentes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Veredito |
|-----------|-----------|----------|
| **I. Clean Architecture por Módulo** | A feature é puramente de apresentação e transversal a módulos — não pertence a nenhum bounded context. Fica em `src/shared/` (navegação, shell de UI) e `app/` (layouts), sem tocar `domain/` ou `application/` de módulo algum. Nenhum módulo passa a acessar dado de outro. | ✅ PASS |
| **II. Tipagem Estrita e Qualidade** | Registro de navegação totalmente tipado (`Role[]` reaproveitado). Sem `any`. Rótulos e grupos em pt-BR. Nomes de domínio preservados (`Voluntário`, `Coordenador`). | ✅ PASS |
| **III. Testes em Regras de Negócio** | Não há regra de domínio nova. O que **é** testável e crítico é o registro de navegação: função pura, sem rede, sem I/O → `npm test`. A trava de consistência menu↔`rolesExigidas` é o teste de maior valor da feature. Layouts e shell (presentation) ficam com validação de contrato, conforme o princípio. | ✅ PASS |
| **IV. Segurança e Defesa em Profundidade** | Ponto de maior atenção. O menu é **ergonomia, não barreira** (FR-015). `proxy.ts` e os gates de layout permanecem inalterados. O novo `(interno)/layout.tsx` **acrescenta** uma checagem (`exigirSessao`) onde hoje não há nenhuma no render — as páginas de `usuario`/`voluntario` dependiam só do proxy. Defesa em profundidade melhora, não piora. O gate de `ROLES_STAFF` continua existindo, apenas desce um nível. | ✅ PASS (reforça) |
| **V. Auditoria Não Bloqueante** | Nenhuma escrita de domínio é introduzida. Sem interação com `withAudit`. | ✅ N/A |
| **VI. Simplicidade Operacional** | Um shell, não dois. Um registro de navegação, não uma tabela de permissões paralela. Zero dependência nova, zero infraestrutura nova. A reorganização de route groups é a alternativa **mais** simples que satisfaz FR-004 (herança por construção) — ver research.md D2. | ✅ PASS |

**Gate pós-desenho (Phase 1)**: reavaliado ao fim deste documento — sem violações, `Complexity Tracking` permanece vazio.

## Project Structure

### Documentation (this feature)

```text
specs/002-role-based-app-shell/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões D1..D7
├── data-model.md        # Phase 1 — entidades de navegação
├── quickstart.md        # Phase 1 — roteiro de validação por perfil
├── contracts/
│   ├── navegacao.md     # Contrato do registro de itens e da matriz por perfil
│   └── app-shell.md     # Contrato de UI do shell (props, slots, responsividade)
├── checklists/
│   └── requirements.md  # Já gerado por /speckit-specify
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

Estado alvo. `→` marca movimentação de arquivo existente; `+` marca arquivo novo.

```text
app/
├── layout.tsx                              # inalterado (ThemeProvider, Toaster)
├── (publico)/                              # + grupo sem shell — pré-autenticação
│   ├── page.tsx                            # → de app/(public)/page.tsx (landing)
│   ├── login/page.tsx                      # → de app/(auth)/login/
│   └── cadastro/page.tsx                   # → de app/(auth)/cadastro/
├── (interno)/                              # + grupo autenticado — TODO conteúdo com shell
│   ├── layout.tsx                          # + exigirSessao() + <AppShell> + slot de notificações
│   ├── sem-permissao/page.tsx              # → de app/sem-permissao/
│   ├── voluntariado/
│   │   ├── candidatura/page.tsx            # → de app/(public)/voluntariado/candidatura/
│   │   └── minhas-atividades/page.tsx      # → de app/voluntariado/minhas-atividades/
│   └── (staff)/                            # grupo aninhado — só o gate de role
│       ├── layout.tsx                      # exigirRoles(ROLES_STAFF); NÃO renderiza mais o shell
│       ├── sino-notificacoes.tsx           # inalterado
│       ├── dashboard/ cadastros-pendentes/ voluntarios/ atividades/
│       ├── estoque/ crise/ convocacao/ relatorios/
│       └── (staff-shell.tsx REMOVIDO — absorvido por src/shared/ui/shell/)
├── design-system/page.tsx                  # inalterado (rota de desenvolvimento)
└── api/                                    # inalterado

src/shared/
├── auth/
│   ├── roles.ts                            # inalterado
│   ├── rotas.ts                            # inalterado — continua a fonte de verdade de autorização
│   ├── navegacao.ts                        # + registro de itens/grupos + itensDeNavegacao(role)
│   └── navegacao.test.ts                   # + matriz por perfil + trava de consistência vs. rotas.ts
└── ui/
    ├── index.ts                            # exporta AppShell
    └── shell/
        ├── app-shell.tsx                   # + shell compartilhado (era staff-shell.tsx)
        ├── sidebar-nav.tsx                 # + lista/grupos + estado ativo
        └── topbar.tsx                      # + identificação, tema, notificações, sair
```

**Structure Decision**: Mantida a convenção já vigente no repositório — rotas em `app/` na raiz, lógica compartilhada em `src/shared/`, design system em `src/shared/ui/`. A feature não cria módulo de domínio porque não tem domínio: é navegação, transversal a todos os bounded contexts.

A escolha central é o **aninhamento de route groups** (`(interno)` → `(staff)`) em vez de repetir o shell em cada layout. Isso faz com que uma página autenticada nova nasça com shell e com gate de sessão sem nenhuma ação de quem a cria (FR-004), espelhando exatamente o modelo *deny-by-default* que `rotas.ts` já adota para autorização.

O registro de navegação fica em `src/shared/auth/` — e não em `src/shared/ui/` — de propósito: ele é derivado da matriz de atores, não do design system. Co-locá-lo com `rotas.ts` é o que torna óbvio, para quem editar um, que o outro existe (FR-011).

## Complexity Tracking

> Preenchido apenas se o Constitution Check tiver violações a justificar.

Sem violações. Nenhuma dependência nova, nenhum módulo novo, nenhuma infraestrutura nova. A feature remove código (três cabeçalhos improvisados duplicados) e centraliza o que estava disperso.

## Constitution Re-Check (pós Phase 1)

Reavaliado após `research.md`, `data-model.md` e `contracts/`:

- **I** — os artefatos confirmam que nada desce a `domain`/`application`. ✅
- **III** — `contracts/navegacao.md` define o registro como função pura, testável sem rede; a trava de consistência é o teste central. ✅
- **IV** — `contracts/app-shell.md` fixa que o shell recebe `role` já validada pelo servidor e nunca a lê do cliente; `data-model.md` reafirma que omitir item não é autorização. ✅
- **VI** — nenhum artefato introduziu abstração adicional; o registro é um array tipado, não um sistema de permissões. ✅

Gate mantido: **PASS**, `Complexity Tracking` permanece vazio.

## Riscos e Pontos de Atenção

1. **Movimentação de arquivos é a maior fonte de risco da feature.** Route groups não afetam a URL, então mover `app/(auth)/login/` → `app/(publico)/login/` preserva `/login`. As URLs a conferir uma a uma estão em `quickstart.md`; nenhuma deve mudar.

2. **Inconsistência pré-existente descoberta, fora do escopo desta feature**: `proxy.ts` só isenta `/login` de sessão (`ROTA_PUBLICA`), mas `/`, `/cadastro` e `/voluntariado/candidatura` têm código escrito para visitante deslogado — a landing declara em comentário estar "excluída do matcher", e o formulário de candidatura tem um caminho "convide a entrar/criar conta" que hoje é inalcançável. Ou o deny-by-default de 001 está mais estrito que o pretendido, ou essas três páginas são resquício. **Esta feature não decide isso e não altera `rotas.ts`** — ver research.md D1 para como o plano fica correto sob qualquer das duas resoluções.

3. **`instant = false`** precisa acompanhar o gate. Hoje `(staff)/layout.tsx` declara `instant = false` porque lê sessão. Esse gate sobe para `(interno)/layout.tsx`, e a declaração precisa subir junto — caso contrário o Next tentaria prerenderizar um segmento que depende de cookies.
