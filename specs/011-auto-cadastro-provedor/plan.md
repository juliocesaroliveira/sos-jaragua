# Implementation Plan: Auto-cadastro por provedor externo e pré-preenchimento da candidatura

**Branch**: `011-auto-cadastro-provedor` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-auto-cadastro-provedor/spec.md`

## Summary

A conta de usuário ganha uma coluna `dataNascimento` (`date`, nullable), exposta como
`additionalField` do better-auth com `input: false` — nunca aceita do cliente. O auto-cadastro
por Google/Facebook já funciona e permanece com os escopos básicos (nome + e-mail, decisão D2);
o que muda no fluxo de login é apenas o registro de auditoria da criação automática
(`databaseHooks.user.create.after`) e a tradução para pt-BR das recusas de vinculação.

No formulário de candidatura, `page.tsx` passa a entregar ao componente cliente o e-mail, o nome
e a data de nascimento da conta. O e-mail é exibido como somente leitura; o nome vem
pré-preenchido e editável; a data vem bloqueada quando a conta já a possui e editável quando
não. A autoridade continua sendo o servidor: `SubmeterCandidaturaUseCase` resolve a data pela
conta quando ela existe (função pura no `domain`) e, quando não existe, grava a informada na
conta **dentro da mesma transação** do perfil, usando a `UnidadeDeTrabalho` já existente e o
port `UsuarioRepository` de Identidade.

O único trabalho de design system é um estado de campo "preenchido pela sua conta" que preserve
contraste — o `disabled:opacity-50` atual falha o requisito de acessibilidade (D10).

## Technical Context

**Language/Version**: TypeScript 5.9 (estrito)

**Primary Dependencies**: Next.js 16.3.0 (App Router, Turbopack, `cacheComponents`), React 19.1,
better-auth 1.6.26 (adapter Drizzle), Drizzle ORM 0.45.2, react-hook-form 7.85 + `@hookform/resolvers` 5.7,
Zod 4.4 (via `@/src/shared/validacao/zod-ptbr`), Ark UI 5.38, Tailwind CSS v4

**Storage**: Neon Postgres via Drizzle (domínio); MongoDB Atlas (auditoria imutável, somente
escrita pelo `withAudit`)

**Testing**: Vitest — `npm test` (unitário, `domain`/`application`, sem rede) e
`npm run test:integracao` (fluxos transacionais contra o Neon real)

**Target Platform**: Vercel (Fluid Compute), navegadores modernos desktop e mobile

**Project Type**: Monolito modular Next.js com bounded contexts em `src/modules/<modulo>/`

**Performance Goals**: nenhuma consulta adicional no caminho de render da candidatura — a conta
vem do `obterSessao()` já memoizado por request (`src/shared/auth/sessao.ts:39`). Sem regressão
no tempo de login.

**Constraints**: campo desabilitado no cliente nunca é enforcement (Princípio IV); a auditoria
não pode bloquear login nem candidatura (Princípio V); interface 100% pt-BR (Princípio II);
contraste WCAG AA em tema claro e escuro nos campos somente leitura (FR-022).

**Scale/Scope**: 2 módulos tocados (`identidade`, `voluntariado`), 1 migração de coluna, 2 telas
(`/login`, `/voluntariado/candidatura`), 1 variante nova no design system.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio | Avaliação | Status |
| --- | --- | --- |
| **I. Clean Architecture por Módulo** | `user` pertence a Identidade. Voluntariado escreve a data de nascimento **apenas** via `UsuarioRepository` (port), seguindo o precedente já documentado de `atualizarRole` (D7). A resolução "conta vs. formulário" é função pura no `domain` de Voluntariado, sem Next/Drizzle (D9). `presentation` continua fina: parse Zod → sessão → um caso de uso → invalidação de cache. | ✅ PASS |
| **II. Tipagem Estrita e Qualidade** | Sem `any`. Nomes de domínio em pt-BR (`dataNascimento`, `resolverDataNascimento`). Mensagens de interface em pt-BR, incluindo as recusas de vinculação (FR-005a). Commits `feat:`/`test:`/`docs:`. | ✅ PASS |
| **III. Testes Focados em Regras de Negócio** | TDD obrigatório em `resolverDataNascimento` (domain) e em `SubmeterCandidaturaUseCase` (application, com repos falsos). O par transacional "perfil salvo + data gravada na conta" vai para `test:integracao`, junto do teste de idempotência do UPDATE condicional. | ✅ PASS |
| **IV. Segurança e Defesa em Profundidade** | `input: false` no `additionalField` fecha a escrita pelos endpoints do better-auth. A Server Action re-deriva e-mail e data da conta em vez de confiar no POST (D9). `requireLocalEmailVerified` **mantido no default estrito** em vez de afrouxado para fazer um cenário passar (D4). Nenhuma rota nova; nenhuma mudança na matriz de roles. | ✅ PASS |
| **V. Auditoria Não Bloqueante** | Auto-cadastro auditado via `withAudit` com ator explícito (D5) — o parâmetro existe justamente para escopos sem sessão. A escrita da data na candidatura já está sob o `withAudit` do caso de uso existente. Falha de auditoria continua degradando graciosamente. | ✅ PASS |
| **VI. Simplicidade Operacional** | Uma coluna nullable, sem tabela nova, sem serviço novo, sem dependência nova. Nenhum escopo OAuth adicional e portanto nenhuma dependência de App Review (D2). Decisões registradas neste diretório antes do código. | ✅ PASS |

**Gate result**: aprovado, sem violações. `Complexity Tracking` não se aplica.

**Desvio registrado (não é violação)**: o cenário "conta com senha entra pelo Google" não é
atendido — é bloqueado pelo próprio better-auth por uma razão de segurança que o Princípio IV
endossa. A spec foi corrigida para descrever a recusa em vez de prometer a vinculação (D4).

## Project Structure

### Documentation (this feature)

```text
specs/011-auto-cadastro-provedor/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — D1..D11 e riscos residuais
├── data-model.md        # Fase 1 — entidades, migração, regras
├── quickstart.md        # Fase 1 — roteiro de validação ponta a ponta
├── contracts/
│   ├── auto-cadastro.md          # Contrato do fluxo de login/criação de conta
│   └── candidatura-precarregada.md # Contrato da tela e da Server Action
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
db/
├── schema/identidade.ts                     # + coluna dataNascimento em `user`
└── migrations/0002_*.sql                    # gerada por `npm run db:generate`

src/shared/
├── auth/auth.ts                             # + additionalField, + databaseHooks.user.create.after
├── auth/sessao.ts                           # SessaoAtor + dataNascimento
└── ui/campo/campo.tsx                       # + estado "preenchido pela conta" (contraste)

src/modules/identidade/
├── application/ports/usuario-repository.ts  # + definirDataNascimentoSeAusente, + buscarDataNascimento
├── application/use-cases/
│   └── registrar-auto-cadastro.ts           # NOVO — auditoria da criação automática
└── infrastructure/drizzle/usuario-repository.ts  # implementação dos métodos novos

src/modules/voluntariado/
├── domain/candidatura.ts                    # + resolverDataNascimento (pura)
├── domain/candidatura.test.ts               # NOVO — testes da resolução
├── application/use-cases/submeter-candidatura.ts       # usa UnidadeDeTrabalho + port de Identidade
├── application/use-cases/submeter-candidatura.test.ts  # NOVO
└── presentation/actions/candidatura.ts      # não aceita e-mail; data condicional

app/
├── (publico)/login/login-form.tsx           # aviso de dados obtidos + recusas em pt-BR
└── (interno)/voluntariado/candidatura/
    ├── page.tsx                             # passa email/nome/dataNascimento da conta
    └── candidatura-form.tsx                 # campo de e-mail; estados de habilitação
```

**Structure Decision**: mantida a estrutura de bounded contexts já existente. `identidade` é
dono de `user` e ganha os métodos de port; `voluntariado` consome via port. Nenhum módulo novo,
nenhuma pasta nova fora de `use-cases`. Rotas inalteradas — `proxy.ts` e a matriz de roles não
são tocados.

## Ordem de execução sugerida

1. **Dado** — coluna, migração, `additionalField`, `SessaoAtor`. Nada visível ainda.
2. **Identidade** — métodos do port + implementação Drizzle + caso de uso de auditoria + hook.
3. **Voluntariado** — `resolverDataNascimento` (com teste primeiro), caso de uso transacional,
   Server Action.
4. **Design system** — estado "preenchido pela conta" com contraste verificado nos dois temas.
5. **Telas** — candidatura e login.
6. **Integração** — `test:integracao` do par transacional e da idempotência.

Passos 1–3 entregam a User Story 1 completa; 3–5 entregam a User Story 2.

## Complexity Tracking

Não aplicável — Constitution Check passou sem violações.
