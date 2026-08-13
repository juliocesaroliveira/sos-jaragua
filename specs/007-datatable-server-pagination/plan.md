# Implementation Plan: Rodapé de paginação server-side no DataTable

**Branch**: `007-datatable-server-pagination` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-datatable-server-pagination/spec.md`

## Summary

Adicionar ao componente `Table` compartilhado uma barra de rodapé com total de registros, faixa exibida, indicador de página, seletor de registros por página (5/10/20/50) e o `Pagination` sobre Ark UI; e migrar todas as listagens da aplicação para buscar cada página no servidor via TanStack Query + Server Functions, com a primeira página hidratada do RSC.

Abordagem técnica (detalhada em [research.md](./research.md)): o rodapé passa a ser responsabilidade do `Table` (prop opcional `paginacao`), eliminando as três montagens duplicadas de `<Table> + <Pagination> + navegar()` existentes hoje. Um módulo novo `src/shared/paginacao/` centraliza os tamanhos válidos, o saneamento Zod dos parâmetros de URL e o hook de sincronização. Um `QueryProvider` — ausente no repositório apesar de `@tanstack/react-query` estar em `package.json` — é montado em `app/(interno)/layout.tsx`. Cada módulo ganha uma server function de leitura (`'use server'`) que faz o gate de sessão/role e delega para a query `'use cache'` já existente, que não pode ler cookies.

## Technical Context

**Language/Version**: TypeScript estrito, React 19, Next.js 16 (App Router, Turbopack, `cacheComponents: true`)

**Primary Dependencies**: `@ark-ui/react` (Pagination, Select), `@tanstack/react-table` (headless, sem features), `@tanstack/react-query` ^5.101.4 (já instalado, **ainda não inicializado**), Tailwind CSS v4, Zod (`@/src/shared/validacao/zod-ptbr`)

**Storage**: Neon Postgres via Drizzle (repositórios já expõem `listar({page, pageSize, ...}) → {rows, totalCount}`); MongoDB apenas para auditoria (não tocado)

**Testing**: Vitest (`npm test` unitário; `npm run test:integracao` contra Neon real)

**Target Platform**: Web responsivo (Vercel), mínimo 360px de largura, pt-BR

**Project Type**: Monolito modular Next.js — `app/` (rotas) + `src/modules/<contexto>/{domain,application,infrastructure,presentation}` + `src/shared/`

**Performance Goals**: troca de página renderizada em < 1s (SC-002); leituras críticas < 300ms (constituição §Fluxo de Desenvolvimento); nunca mais que `pageSize` linhas por requisição (SC-003/FR-008)

**Constraints**: `'use cache'` não pode ler `cookies()`/`headers()`; Server Actions são POST serializadas pelo Next (uma por vez) — sem prefetch especulativo; sem novas dependências (Princípio VI); todo texto em pt-BR

**Scale/Scope**: 5 telas com `<Table>` (`/admin`, `/voluntarios`, `/estoque`, `/relatorios`, galeria do design system); 4 módulos tocados (identidade, voluntariado, estoque, + shared)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio | Gate | Status |
|---|---|---|
| I. Clean Architecture por Módulo | Server functions de leitura ficam em `presentation/actions/` e chamam a query do próprio módulo; nenhum `domain/` tocado; nenhum módulo lê tabela de outro | ✅ PASS |
| II. Tipagem Estrita e Qualidade | Sem `any`; genéricos preservados em `Table<TData>`; textos pt-BR; commits Conventional | ✅ PASS |
| III. Testes de Regra de Negócio | A feature é presentation/UI — não altera `domain`/`application`. Cobertura: unitário do saneamento de parâmetros (`src/shared/paginacao`, regra pura) + contrato das server functions | ✅ PASS |
| IV. Segurança e Defesa em Profundidade | Cada server function de leitura revalida sessão/role independentemente do gate da página (mesmo padrão de `actions/usuarios.ts`) | ✅ PASS |
| V. Auditoria Não Bloqueante | Feature só faz leitura — `withAudit` não se aplica | ✅ N/A |
| VI. Simplicidade Operacional | Zero dependências novas (`nuqs` rejeitado, D9); reusa `Pagination`/`Select`/`Table` existentes; decisões registradas aqui antes do código | ✅ PASS |
| §Stack: "TanStack Query + Server Actions; TanStack Table com paginação obrigatoriamente server-side" | A feature **corrige** um drift: TanStack Query estava instalado mas sem `QueryClient` | ✅ PASS (aproxima da constituição) |
| §Fluxo: responsividade mobile como critério de aceitação | SC-007 e D11 tratam 360px explicitamente | ✅ PASS |

**Resultado**: nenhuma violação. Complexity Tracking não se aplica.

**Re-avaliação pós-Phase 1**: mantido — os contratos em `contracts/` não introduzem nova superfície HTTP nem novo armazenamento; o único componente novo de infraestrutura é o `QueryProvider`, exigido pela própria constituição.

## Project Structure

### Documentation (this feature)

```text
specs/007-datatable-server-pagination/
├── plan.md              # Este arquivo
├── spec.md
├── research.md          # Phase 0 — D1..D11
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── paginacao-ui.md      # Contrato do rodapé/Table/Pagination
│   └── leituras-paginadas.md # Contrato das server functions de leitura
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks — NÃO criado aqui
```

### Source Code (repository root)

```text
src/shared/
├── paginacao/                  # NOVO — contrato único de paginação
│   ├── constantes.ts           # TAMANHOS_PAGINA, TAMANHO_PAGINA_PADRAO
│   ├── esquema.ts              # Zod .catch() → FR-012/FR-018
│   ├── esquema.test.ts         # unitário (regra pura)
│   ├── use-parametros-listagem.ts  # hook URL ↔ estado (FR-011/FR-019)
│   └── index.ts
├── query/                      # NOVO — TanStack Query
│   ├── query-provider.tsx      # 'use client', QueryClient por request
│   ├── chaves.ts               # queryKey espelhando CACHE_TAGS (D6)
│   └── index.ts
└── ui/
    ├── table/table.tsx         # ALTERADO — prop `paginacao`, estado "atualizando"
    ├── table/table-footer.tsx  # NOVO — barra de rodapé (interno ao Table)
    ├── pagination/pagination.tsx # ALTERADO — não some com 1 página (FR-007)
    └── index.ts                # ALTERADO — novos tipos exportados

src/modules/
├── identidade/presentation/
│   ├── actions/usuarios.ts     # ALTERADO — + listarUsuariosAction
│   └── queries/usuarios.ts     # ALTERADO — clamp de página, pageSize variável
├── voluntariado/presentation/  # idem para listarVoluntarios
└── estoque/presentation/       # idem para listarEstoque + nova listarSaidas paginada

app/
├── (interno)/layout.tsx                    # ALTERADO — monta QueryProvider
├── (interno)/(staff)/admin/{page,tabela-usuarios}.tsx        # P1
├── (interno)/(staff)/voluntarios/{page,tabela-voluntarios}.tsx
├── (interno)/(staff)/estoque/{page,tabela-estoque}.tsx
├── (interno)/(staff)/relatorios/{page,painel-relatorios}.tsx
└── (interno)/design-system/galeria.tsx     # ALTERADO — demo do rodapé
```

**Structure Decision**: mantida a estrutura existente do monolito modular. O único diretório novo em `src/shared/` é `paginacao/` e `query/` — ambos transversais por natureza (usados por 3+ bounded contexts), portanto não pertencem a nenhum módulo (Princípio I). Nenhum arquivo em `domain/` ou `application/` é alterado.

## Ordem de execução sugerida

1. **Fundação** (bloqueia tudo): `src/shared/paginacao/` + `src/shared/query/` + `QueryProvider` em `(interno)/layout.tsx`.
2. **Design system**: `Pagination` ajustado → `TableFooter` → prop `paginacao` no `Table` → demo na galeria. Verificável isoladamente em `/design-system`.
3. **US1 + US2 em `/admin`** (P1/P2): server function `listarUsuariosAction`, hidratação, `useQuery`, rodapé completo. É o slice que valida o padrão inteiro.
4. **US3 rollout**: `/voluntarios`, `/estoque` (preservando filtros), `/relatorios` (separando leitura de tela da leitura de exportação).

## Complexity Tracking

Não aplicável — Constitution Check sem violações.
