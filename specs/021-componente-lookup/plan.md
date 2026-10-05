# Implementation Plan: Componente Lookup para campos de referência

**Branch**: `021-componente-lookup` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/021-componente-lookup/spec.md`

## Summary

Criar um componente de formulário genérico `Lookup` (campo de texto com sugestões ≤ 5 +
botão de pesquisa que abre um diálogo com tabela paginada no servidor) e aplicá-lo a todos os
campos de item e de kit dos formulários de Estoque: Entrada (nome do item em modo valor livre +
destinação de kit), Descarte, Saída (itens avulsos e kits) e Composição de Kits.

Abordagem: compor o `Combobox` existente (estendido com slot de ação e opções desabilitadas),
o `Dialog` e o `Table` (estendido com seleção por teclado e linha desabilitada) do design
system; buscas via TanStack Query contra quatro Server Functions de leitura novas no módulo
Estoque; busca sem acento com `unaccent` + índice trigram de expressão. Nenhuma mudança em
`domain`/`application` nem nos payloads das escritas.

## Technical Context

**Language/Version**: TypeScript 5.9 (estrito), React 19, Next.js 16.3 (App Router, Turbopack)

**Primary Dependencies**: Ark UI 5 (Combobox, Dialog), TanStack Query 5, TanStack Table 9,
react-hook-form 7 + Zod 4, lucide-react — todas já no projeto; nenhuma dependência nova

**Storage**: Neon Postgres via Drizzle — 1 migration (extensão `unaccent`, função
`f_unaccent`, índice GIN de expressão em `item.nome`)

**Testing**: Vitest (`npm test`, ambiente node) para o helper puro `escaparLike`; validação de UI
manual pelo [quickstart.md](./quickstart.md) (o projeto não tem testes de componente)

**Target Platform**: Web (desktop e celular), Vercel / Fluid Compute

**Project Type**: Aplicação web Next.js monolito modular

**Performance Goals**: sugestões ≤ 1 s após a pausa de digitação (SC-002); página do diálogo
≤ 2 s (SC-003); leitura de itens < 300 ms no servidor (constituição)

**Constraints**: paginação obrigatoriamente server-side; diálogo sem estado em URL; pt-BR;
mobile sem rolagem horizontal; conectividade instável (estados de erro com retry)

**Scale/Scope**: catálogo de milhares de itens, dezenas de kits; 1 componente novo, 3
componentes compartilhados estendidos, 1 hook novo, 4 leituras novas, 5 formulários migrados

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio | Avaliação | Status |
| --------- | --------- | ------ |
| I. Clean Architecture | Leituras ficam em `presentation/actions/lookups.ts` (gate + parse + uma query) e `presentation/queries/estoque.ts`, como `listagens.ts`. Lookup é UI genérica em `src/shared/ui`; não importa nada de módulo — recebe a `FonteLookup` do formulário. Nenhum acesso cruzado entre módulos. | ✅ |
| II. Tipagem/qualidade | `Lookup<T>` genérico sem `any`; textos pt-BR; Conventional Commits. | ✅ |
| III. Testes | Sem mudança em `domain`/`application` (FR-024). Helper puro `escaparLike` com teste unitário. Escritas inalteradas ⇒ testes de integração existentes seguem válidos. | ✅ |
| IV. Segurança | Cada leitura revalida sessão e role (`podeAcessar('/estoque')`); termo limitado a 100 chars e escapado no `ilike`; parâmetros via Drizzle `sql` (bind), sem concatenação. | ✅ |
| V. Auditoria | Feature só adiciona leituras; escritas continuam via `withAudit`. | ✅ (N/A) |
| VI. Simplicidade | Sem dependência nova; `unaccent` é extensão nativa do Postgres/Neon — registrada no `spec/DESIGN.md` §19. Sem Route Handler genérico nem registro de fontes no servidor. | ✅ |
| Stack: paginação server-side | Diálogo usa `PaginaDe<T>` + `paginarComClamp` (007). | ✅ |
| Fluxo: mobile + < 300 ms | Diálogo vira folha inferior; índice de expressão sustenta a meta. | ✅ |

**Re-check pós-design**: mantido ✅ — o design (research R1–R8, contratos) não introduziu
camada, dependência ou superfície de autorização nova.

## Project Structure

### Documentation (this feature)

```text
specs/021-componente-lookup/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── lookup-componente.md
│   └── leituras-lookup.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
db/
├── schema/estoque.ts                       # + índice item_nome_unaccent_trgm_idx
└── migrations/0006_*.sql                   # unaccent, f_unaccent, índice

src/shared/
├── busca/escapar-like.ts (+ .test.ts)      # novo — L-04
├── query/use-listagem-local.ts             # novo — paginação sem URL (R3)
├── query/index.ts                          # exporta useListagemLocal
└── ui/
    ├── combobox/combobox.tsx               # + acaoFim, opção disabled, inputValueExterno, rodapeLista
    ├── table/table.tsx                     # + linha focável/teclado, linhaDesabilitada
    ├── lookup/lookup.tsx                   # novo — Lookup<T>
    ├── lookup/lookup-dialog.tsx            # novo — diálogo com filtro + Table paginada
    └── index.ts                            # exporta Lookup / FonteLookup

src/modules/estoque/
├── presentation/actions/lookups.ts         # novo — 4 leituras (contracts/leituras-lookup.md)
├── presentation/actions/estoque.ts         # − buscarItens
├── presentation/queries/estoque.ts         # + sugerirItens, listarItensLookup, sugerirKits, listarKitsLookup, KitLookup
├── presentation/lookups/fontes.ts          # novo ('use client') — fonteItens, fonteKits (colunas, descrição)
├── application/ports/estoque-repository.ts # − buscarPorNome
└── infrastructure/drizzle/estoque-repository.ts # − buscarPorNome

app/(interno)/(staff)/estoque/
├── entrada/{page.tsx,entrada-form.tsx}     # Lookup item (valor livre) + kit destino; page sem kits
├── descarte/{page.tsx,descarte-form.tsx}   # Lookup item; page sem listarItens
├── saida/{page.tsx,saida-form.tsx}         # Lookup por linha (item|kit); page sem listarItens/kits
└── kits/{page.tsx,gestao-kits.tsx}         # Lookup por componente; saldos de kit.componentes

spec/DESIGN_SYSTEM.md                        # §4.4.1 Lookup; notas Combobox/Table
spec/DESIGN.md                               # §19 decisão unaccent
```

**Structure Decision**: monolito Next.js existente. O componente é infraestrutura de UI
compartilhada (`src/shared/ui/lookup`), agnóstico de módulo; as fontes concretas (quais actions,
colunas e descrição) vivem no módulo dono dos dados (`src/modules/estoque/presentation/lookups`),
preservando o Princípio I. Outros módulos adotam o Lookup criando suas próprias fontes.

## Ordem sugerida de implementação

1. Migration + schema + `escaparLike` (teste) + queries/leituras (`lookups.ts`).
2. Extensões de `Combobox`, `Table`; `useListagemLocal`.
3. `Lookup` + `LookupDialog` + fontes do Estoque (US1 + US2, validados no Descarte).
4. Migração dos demais formulários (US3): Saída, Kits, Entrada; remoção de `buscarItens` /
   `buscarPorNome`; ajustes das `page.tsx`; invalidação `['lookup']` após escritas.
5. Documentação (DESIGN_SYSTEM, DESIGN) e roteiro do quickstart.

## Complexity Tracking

Sem violações da constituição — seção não aplicável.
