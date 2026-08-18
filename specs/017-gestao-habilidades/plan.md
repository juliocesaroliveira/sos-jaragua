# Implementation Plan: Gestão de Habilidades

**Branch**: `017-gestao-habilidades` | **Date**: 2026-08-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/017-gestao-habilidades/spec.md`

## Summary

Tela `/habilidades` para gerir a lista de referência de competências dos voluntários: listagem
paginada server-side, cadastro e edição em diálogo (react-hook-form + Zod) e exclusão com confirmação,
liberada para `membro_defesa_civil`, `coordenador` e `administrador`.

Estruturalmente a tela é a mesma de `/admin` (006 + 007 + 008) com um campo em vez de quatro — o plano
reusa `Table`/`useListagemPaginada`, `Dialog`/`Formulario`/`useFormulario`, `ResultadoAction<T>` e
`withAudit` sem introduzir dependência nem padrão novo (research D10).

As duas decisões que fogem do trilho de `/admin` são de **banco**, e são o que torna a spec
verdadeira em vez de apenas provável:

1. **Índice único sobre `lower(nome)`** substituindo o `UNIQUE(nome)` sensível a caixa — sem ele,
   FR-009 falha para "motosserra" vs "Motosserra" e SC-004 falha sob concorrência (research D3).
2. **`voluntario_habilidade.habilidade_id` de `CASCADE` para `RESTRICT`** — hoje excluir uma habilidade
   apaga em silêncio a declaração de todos os voluntários que a possuem, o oposto exato de FR-012/SC-008
   (research D4).

O restante é aplicação da arquitetura já estabelecida: entidade e normalização puras no `domain/`, três
casos de uso auditados no `application/`, repositório Drizzle no `infrastructure/`, Server Actions finas
no `presentation/`, e a tela em `app/(interno)/(staff)/habilidades/`.

## Technical Context

**Language/Version**: TypeScript 5.9 (estrito), React 19.1, Next.js 16.3 (App Router, Turbopack)

**Primary Dependencies**: drizzle-orm 0.45 sobre Neon Postgres, @tanstack/react-query 5.101,
@tanstack/react-table 9.1, react-hook-form 7.85 + @hookform/resolvers 5.7 + zod 4.4 (locale pt-BR via
`src/shared/validacao/zod-ptbr.ts`), @ark-ui/react 5.38, Tailwind CSS v4, lucide-react.
**Nenhuma dependência nova.**

**Storage**: Neon Postgres — tabela `habilidade` já existente. Uma migração (`npm run db:generate` →
`npm run db:migrate`) altera dois constraints: índice único funcional em `lower(nome)` e FK de
`voluntario_habilidade.habilidade_id` para `ON DELETE RESTRICT`. Nenhuma coluna nova, nenhum dado
migrado. Auditoria segue em MongoDB via `withAudit`.

**Testing**: Vitest 4.1 — `npm test` (unitário, `domain/` + `application/` com repositório falso) e
`npm run test:integracao` (as duas invariantes de banco: unicidade sob concorrência e recusa de exclusão
vinculada). Interface por roteiro manual em [quickstart.md](quickstart.md) — research D9.

**Target Platform**: Web responsivo (mobile-first), navegadores modernos, tema claro/escuro.

**Project Type**: Aplicação web — monolito modular Next.js; telas em `app/`, domínio em `src/modules/`,
compartilhado em `src/shared/`.

**Performance Goals**: primeira página pronta em <1s com até 500 habilidades (SC-003); a listagem é uma
leitura cacheada (`'use cache'` + `cacheTag`) com hidratação da primeira página no Server Component. A
contagem de vínculos sai na mesma consulta, sem N+1 (research D5).

**Constraints**:

- Paginação obrigatoriamente server-side (Stack e Convenções Técnicas).
- Interface e toda mensagem 100% pt-BR (Princípio II).
- Autorização revalidada em cada Server Action, não herdada do gate da página (Princípio IV).
- Toda escrita passa por `withAudit`, nunca log ad-hoc (Princípio V).
- Nenhum vínculo de voluntário pode ser removido por exclusão de habilidade (SC-008).

**Scale/Scope**: dezenas de habilidades (SC-003 dimensiona para 500); 1 rota nova, 1 migração,
~10 arquivos novos, 4 arquivos compartilhados tocados.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio | Situação | Como o plano atende |
| --- | --- | --- |
| I. Clean Architecture por Módulo | ✅ Passa | Entidade vive no módulo `voluntariado`, dono da tabela (research D1). Dependências para dentro: `domain` (normalização pura, sem Drizzle/Next) ← `application` (casos de uso sobre o port `HabilidadeRepository`) ← `infrastructure`/`presentation`. Nenhum outro módulo acessa `habilidade` diretamente — `lookups.ts` já é do próprio módulo. |
| II. Tipagem Estrita e Qualidade | ✅ Passa | Sem `any`; tipos derivados do schema. Textos em pt-BR; linguagem ubíqua preservada (`Habilidade`, não `Skill`). Commits em Conventional Commits. |
| III. Testes Focados em Regras de Negócio | ✅ Passa | TDD em `domain/habilidade.ts` e nos três casos de uso; integração só para as duas invariantes que exigem banco real. `presentation`/`infrastructure` finos por design (research D9). |
| IV. Segurança e Defesa em Profundidade | ✅ Passa | Rota nova entra em `REGRAS_DE_ROTA` (obrigatório para `(staff)`); `proxy.ts` → `(staff)/layout.tsx` → `exigirAcessoA('/habilidades')` → checagem própria em cada uma das quatro Server Actions. Esconder o item de menu não é autorização e não é tratado como tal. |
| V. Auditoria Não Bloqueante | ✅ Passa | Criação, edição e exclusão passam por `withAudit` com `dadosAnteriores`/`dadosNovos` (FR-017); ator vindo da sessão via `comAtorDaSessao`. Degradação graciosa herdada do wrapper, não reimplementada. |
| VI. Simplicidade Operacional | ✅ Passa | Zero dependência nova, zero serviço novo. Nenhuma abstração especulativa: o diálogo de confirmação nasce local à feature em vez de virar componente compartilhado sobre uma amostra só (research D7). Decisões registradas em [research.md](research.md) antes do código. |

**Gate de estoque de decisões**: nenhum `NEEDS CLARIFICATION` pendente — a única ambiguidade da spec
(exclusão de habilidade vinculada) foi resolvida em `/speckit-clarify` e está registrada em FR-012.

**Ponto de atenção declarado**: a mudança de FK `CASCADE` → `RESTRICT` é alteração de infraestrutura e,
pela Governance, precisa de verificação explícita contra os Princípios I/IV/VI. Verificada: não cria
módulo nem dependência (VI), não altera fluxo de autenticação (IV), e move para o banco uma regra de
negócio que a spec exige ser inviolável (I — o `domain` continua sendo quem dá a mensagem, o banco é a
rede de segurança).

### Re-avaliação pós-Phase 1

Reavaliado após [data-model.md](data-model.md) e [contracts/](contracts/): sem violação nova. Os
contratos mantêm `presentation` fina (parse Zod → sessão/role → um caso de uso → invalidação de cache) e
nenhuma regra de negócio escapou para a Server Action. **Tabela de Complexity Tracking permanece vazia.**

## Project Structure

### Documentation (this feature)

```text
specs/017-gestao-habilidades/
├── plan.md              # Este arquivo
├── spec.md              # Especificação (entrada)
├── research.md          # Phase 0 — decisões D1..D10
├── data-model.md        # Phase 1 — entidade, invariantes, migração
├── quickstart.md        # Phase 1 — roteiro de validação
├── contracts/
│   ├── gestao-habilidades.md   # Server Actions, autorização, erros
│   └── ui-habilidades.md       # Contrato de tela (tabela, diálogos, estados)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
db/
├── schema/voluntariado.ts              # ALTERADO: índice único lower(nome); FK restrict
└── migrations/0003_*.sql               # NOVO: gerado por `npm run db:generate`

src/modules/voluntariado/
├── domain/
│   ├── habilidade.ts                   # NOVO: normalizarNomeHabilidade + validarNomeHabilidade
│   ├── habilidade.test.ts              # NOVO
│   └── index.ts                        # ALTERADO: reexporta habilidade
├── application/
│   ├── ports/habilidade-repository.ts  # NOVO: HabilidadeRepository, LinhaHabilidade
│   └── use-cases/
│       ├── gerir-habilidade.ts         # NOVO: Criar/Editar/Excluir
│       └── gerir-habilidade.test.ts    # NOVO (repositório falso)
├── infrastructure/drizzle/
│   ├── habilidade-repository.ts        # NOVO: Drizzle + tradução de 23505/23503
│   └── habilidade-repository.integracao.test.ts  # NOVO
└── presentation/
    ├── queries/habilidades.ts          # NOVO: listagem paginada + contagem de vínculos
    └── actions/habilidades.ts          # NOVO: 4 Server Actions

app/(interno)/(staff)/habilidades/
├── page.tsx                            # NOVO: gate + hidratação da 1ª página
├── tabela-habilidades.tsx              # NOVO: DataTable + ações
├── habilidade-form-dialog.tsx          # NOVO: cadastro/edição (RHF + Zod)
└── excluir-habilidade-dialog.tsx       # NOVO: confirmação

src/shared/
├── auth/rotas.ts                       # ALTERADO: REGRAS_DE_ROTA['/habilidades']
├── auth/navegacao.ts                   # ALTERADO: item no grupo `operacao`
├── cache/tags.ts                       # ALTERADO: habilidadesListagem
└── query/chaves.ts                     # ALTERADO: RAIZ_HABILIDADES + chaveHabilidades
```

**Structure Decision**: monolito modular já estabelecido — a feature mora inteira no módulo
`voluntariado` (dono da tabela, research D1), com a tela sob o route group `(staff)` e quatro pontos de
extensão em `src/shared/` que são registros compartilhados por design (rotas, navegação, tags de cache,
chaves de query). Nenhuma estrutura nova é introduzida.

## Complexity Tracking

> Sem violações da Constitution Check — nada a justificar.
