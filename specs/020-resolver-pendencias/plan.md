# Implementation Plan: Resolução das Pendências Abertas

**Branch**: `develop` (spec `020-resolver-pendencias`) | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-resolver-pendencias/spec.md`

## Summary

Fechar o `PENDENCIAS.md`: o que é código vira código, o que é console vira roteiro e o
que já está resolvido sai do documento. Os itens com código são:

1. **Planilhas (Q1)**: `xlsx` (SheetJS, CVE alto) → `exceljs`, mexendo só em `planilha.ts`.
   O contrato HTTP de exportação não muda, e o CSV continua artesanal.
2. **Entrada pública (Q2 + item 7)**: `disabledPaths: ['/sign-up/email']` no better-auth.
   A chamada de servidor que o `/admin` usa continua funcionando. Os botões de
   Google/Facebook só aparecem com a credencial completa.
3. **Estoque mínimo por item (Q3)**: coluna anulável `item.estoque_minimo`, regra pura com
   fallback global e edição pela tabela de `/estoque` (coordenação).
4. **Dependências (achado)**: `next`/`eslint-config-next` → 16.3.8 (CVE crítico),
   `sharp` → 0.35.5 (alto), moderadas dentro da faixa e o lockfile ressincronizado (hoje
   `npm ci` falha).

O resto é documentação: `PENDENCIAS.md` reescrito, decisões em `DESIGN.md` §19, emenda
PATCH da constituição, a seção de dev local no README e um novo
`spec/ROTEIRO_PRODUCAO.md` com os passos de console. Mais as verificações manuais que
fecham ID-06 e DEPLOY-06.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 22 (Vercel runtime)

**Primary Dependencies**: Next.js 16.3 (App Router), React 19, better-auth 1.6.26,
Drizzle ORM 0.45, Ark UI, react-hook-form + Zod 4, TanStack Query/Table. **Entra** `exceljs@4.4.0`;
**sai** `xlsx@0.18.5`.

**Storage**: Neon Postgres (Drizzle), com 1 migration nova (`item.estoque_minimo`). MongoDB
Atlas só para auditoria, sem mudança de schema.

**Testing**: Vitest. `npm test` (unitário: `domain/`, `application/`, funções puras de
`shared/auth` e `planilha`) e `npm run test:integracao` (rota de sign-up fechada + criação
pelo admin).

**Target Platform**: Vercel (Linux), navegadores móveis e desktop em pt-BR.

**Project Type**: Web application, monolito modular Next.js (`app/` + `src/modules/*`).

**Performance Goals**: Sem metas novas. A listagem de `/estoque` mantém a meta < 300ms (o
`SELECT` só ganha 1 coluna). A exportação XLSX de inventário (centenas de linhas) fica em
< 2s.

**Constraints**: A interface toda em pt-BR. Nenhuma mudança no contrato HTTP de
exportação. `auth.api.signUpEmail` precisa continuar funcionando no servidor. `npm ci`
precisa passar em instalação limpa.

**Scale/Scope**: ~10 arquivos de código alterados, 4 novos (regra de estoque mínimo,
caso de uso, helper de provedores, dialog), 1 migration, 6 documentos.

Nenhum NEEDS CLARIFICATION em aberto. As três decisões de produto vieram em
`spec.md → Clarifications`, e as incógnitas técnicas foram resolvidas em
[research.md](./research.md) (D1–D6), verificando o código-fonte do better-auth e uma
sondagem do exceljs.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio / regra                                      | Avaliação                                                                                                                                                                                                                                                                                                                               | Status         |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| I. Clean Architecture por módulo                       | A regra de estoque mínimo fica em `estoque/domain` (pura). O caso de uso fica em `estoque/application`, com port novo no repositório. A action é fina (Zod + role + 1 use case). `planilha.ts` continua em `infrastructure`.                                                                                                            | ✅             |
| I. Acesso entre módulos só via ports                   | `notificacoes` já consome `estoque/presentation/queries` (padrão existente). Passa também a importar a função pura `itensCriticos` de `estoque/domain`, que não acessa tabela nem repositório.                                                                                                                                          | ✅             |
| II. Tipagem estrita, lint, Conventional Commits, pt-BR | Sem `any`. Os textos novos (coluna, dialog, alerta, erros) estão em pt-BR.                                                                                                                                                                                                                                                              | ✅             |
| III. TDD em `domain`/`application`                     | Teste antes da implementação para `estoque-minimo.ts` e `definir-estoque-minimo.ts`. Integração para a rota de sign-up fechada. `planilha` e `provedores-sociais` ganham teste unitário (sem rede).                                                                                                                                     | ✅             |
| IV. Segurança e defesa em profundidade                 | **Fortalece**: fecha uma rota de criação de conta não prevista na decisão de 2026-08-16 e para de registrar provedores OAuth sem credencial. A escrita do mínimo checa role na action. O banco tem `CHECK >= 0`.                                                                                                                        | ✅             |
| V. Auditoria não bloqueante via `withAudit`            | `definirEstoqueMinimo` passa por `withAudit` (escrita em Estoque).                                                                                                                                                                                                                                                                      | ✅             |
| VI. Simplicidade operacional                           | Sem serviço novo. Uma coluna anulável, sem tabela nova. As decisões ficam registradas em `DESIGN.md` §19 **antes** do código (primeira fase das tasks).                                                                                                                                                                                 | ✅             |
| Stack: "**Planilhas**: `xlsx` (SheetJS)"               | **Divergência**: Q1 troca por `exceljs`. A constituição exige que nova dependência na mesma capacidade tenha "decisão documentada, não substituição silenciosa". A decisão está em spec Q1 + research D1 e exige **emenda PATCH 1.0.0 → 1.0.1** (troca de pacote, nenhum princípio muda) via `/speckit-constitution`, na mesma entrega. | ⚠️ Justificada |

**Resultado do gate**: PASSA, com uma divergência justificada e registrada em Complexity
Tracking. Ela é resolvida pela emenda da constituição, que é uma task obrigatória da
feature.

**Re-check pós-design (Phase 1)**: o data model, os contratos e o quickstart não criaram
violação nova. A divergência de stack continua a única e continua coberta pela emenda.
✅

## Project Structure

### Documentation (this feature)

```text
specs/020-resolver-pendencias/
├── plan.md              # Este arquivo
├── research.md          # D1–D6: exceljs, disabledPaths, provedores, estoque mínimo, deps, destino dos itens
├── data-model.md        # item.estoque_minimo
├── quickstart.md        # V0–V7: roteiro de validação
├── contracts/
│   ├── exportacao-planilhas.md
│   ├── entrada-publica.md
│   └── estoque-minimo.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (ainda não criado)
```

### Source Code (repository root)

```text
package.json / package-lock.json            # −xlsx +exceljs; next/eslint-config-next 16.3.8; sharp ^0.35.5; lock ressincronizado

db/
├── schema/estoque.ts                       # item.estoqueMinimo (numeric 14,3, nullable)
└── migrations/0005_*.sql                   # ADD COLUMN + CHECK (>= 0)

src/shared/auth/
├── opcoes.ts                               # disabledPaths ['/sign-up/email']; socialProviders só configurados
├── provedores-sociais.ts                   # NOVO: provedoresSociaisConfigurados(env)
├── cadastro-publico.integracao.test.ts     # NOVO: POST /sign-up/email → 404; signUpEmail no servidor segue OK
└── provedores-sociais.test.ts              # NOVO

src/modules/contingencia/infrastructure/
├── planilha.ts                             # gerarXlsx via exceljs (async)
└── planilha.test.ts                        # NOVO: invariantes 1–7
src/modules/contingencia/application/relatorios.ts   # coluna "Estoque mínimo" no inventário

src/modules/estoque/
├── domain/estoque-minimo.ts (+ .test.ts)   # NOVO: limiarDoItem, itensCriticos
├── application/ports/estoque-repository.ts # + definirEstoqueMinimo (e buscarPorId, se faltar)
├── application/use-cases/definir-estoque-minimo.ts (+ .test.ts)  # NOVO
├── infrastructure/drizzle/estoque-repository.ts  # implementação
├── presentation/actions/estoque.ts         # definirEstoqueMinimo (withAudit, ROLES_COORDENACAO)
└── presentation/queries/estoque.ts         # ItemComSaldo.estoqueMinimo (listarEstoque + inventarioParaExportacao)

src/modules/notificacoes/application/use-cases/alertas-coordenador.ts  # usa itensCriticos; mensagem por item

app/
├── api/relatorios/export/route.ts          # await gerarXlsx
├── api/contingencia/export/route.ts        # await gerarXlsx
├── (publico)/login/page.tsx                # passa provedores ao LoginForm
├── (publico)/login/login-form.tsx          # botões/divisor/aviso condicionais
└── (interno)/(staff)/estoque/
    ├── page.tsx                            # passa limiar global + pode-editar
    ├── tabela-estoque.tsx                  # coluna "Mínimo", destaque crítico, ação por linha
    └── estoque-minimo-dialog.tsx           # NOVO: dialog/drawer RHF + Zod


Documentos
├── PENDENCIAS.md                           # reescrito: ≤ 7 itens, estado conferido
├── spec/DESIGN.md                          # §16 exceljs; §17 ALERTA_*; §19 decisões Q1–Q3, itens 5 e 9
├── spec/TASKS.md                           # [x] ID-06, DEPLOY-06 (após V5/V6), REL/CON sem bloqueio
├── spec/ROTEIRO_PRODUCAO.md                # NOVO: passos de console (itens 3, 6, 7, 10, 13 + limiares)
├── README.md                               # seção "Desenvolvimento local" (string não-SRV)
└── .specify/memory/constitution.md         # 1.0.1: Stack → exceljs
```

**Structure Decision**: monolito modular existente. Nenhum diretório novo de topo. Cada
mudança fica no módulo dono do conceito: planilha em `contingencia`, mínimo em `estoque`,
alerta em `notificacoes` e entrada pública em `shared/auth`.

### Ordem de entrega sugerida (insumo para `/speckit-tasks`)

1. **Docs de decisão primeiro** (Princípio VI): §19, emenda da constituição.
2. **Dependências** (D5): lockfile + next/sharp/audit fix. Isso destrava `npm ci` e o CI
   de todo o resto.
3. **US2 planilhas** e **US3 entrada pública**: independentes, P1.
4. **US5 estoque mínimo**: migration → domínio → caso de uso → action → UI → alerta.
5. **US4 verificações** (V5, V6): manuais, depois do deploy local das mudanças.
6. **US1/US6 documentação final**: `PENDENCIAS.md` reescrito por último, refletindo o
   estado real depois de tudo, mais o roteiro de produção e o README.

## Complexity Tracking

| Violation                                                               | Why Needed                                                                             | Simpler Alternative Rejected Because                                                                                                                  |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Troca de `xlsx` (SheetJS) por `exceljs`, contra a Stack da constituição | `xlsx@0.18.5` tem CVE alto sem correção no npm. O responsável escolheu `exceljs` (Q1). | SheetJS pelo CDN mantém a constituição, mas cria dependência fora do registro público. Foi rejeitada explicitamente em Q1. Manter 0.18.5 deixa o CVE. |
