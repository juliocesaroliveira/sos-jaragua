# Implementation Plan: Cadastro de item novo na composição de kit

**Branch**: `022-cadastro-item-kit` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-cadastro-item-kit/spec.md`

## Summary

No diálogo de Novo/Editar kit, o campo "Item" de cada componente passa a aceitar um nome de
item novo, como na Entrada. Abaixo da linha aparece um grupo "Item novo" com categoria e
unidade obrigatórias e estoque mínimo opcional. Ao salvar, os itens novos são criados com
saldo 0 junto com o kit, numa única transação. Um nome idêntico a um item existente vincula
automaticamente a esse item. O item criado pelo kit fica fora do alerta de estoque crítico até
a primeira entrada.

Abordagem:

- A gravação de kit sai da Server Action e vira o caso de uso `SalvarKitUseCase`, com a
  validação de receita no domínio.
- Um método de repositório `salvarComposicao` faz tudo numa transação, com advisory lock por
  nome.
- O `Lookup` ganha a prop opcional `vincularIdentico`.
- A coluna `item.aguardando_primeira_entrada` tira o item novo do alerta de crítico.

## Technical Context

**Language/Version**: TypeScript 5.9 (estrito), React 19, Next.js 16.3 (App Router, Turbopack)

**Primary Dependencies**: react-hook-form 7 + Zod 4, TanStack Query 5, Ark UI 5 (via `Lookup`,
`Select`, `NumberInput`), Drizzle ORM. Nenhuma dependência nova.

**Storage**: Neon Postgres via Drizzle. Uma migration (`0007`), que adiciona a coluna
`item.aguardando_primeira_entrada`. A auditoria vai para o MongoDB, como hoje.

**Testing**: Vitest (`npm test`): `validarReceita`, `normalizarNomeItem`, `itensCriticos` e
`SalvarKitUseCase` com repositório dublê. `npm run test:integracao`: `salvarComposicao` contra o
Neon (atomicidade, vínculo, ambiguidade, lock). UI pelo [quickstart.md](./quickstart.md).

**Target Platform**: Web (desktop e celular), Vercel / Fluid Compute

**Project Type**: Aplicação web Next.js, monolito modular

**Performance Goals**: salvar um kit de até 5 componentes com itens novos em < 1 s no servidor.
Cada nome novo gera um lock e uma busca indexada (trigram), então o custo cresce de forma linear
e pequena.

**Constraints**: atomicidade total (FR-006); pt-BR; celular sem rolagem horizontal; Entrada,
Descarte e Saída sem mudança de comportamento.

**Scale/Scope**: receitas de até ~20 componentes; catálogo de milhares de itens. Escopo: 1 caso
de uso novo, 1 função de domínio nova (mais 1 ajustada), 1 método de repositório (3 removidos),
1 migration, 1 prop nova no `Lookup` e 1 formulário alterado.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio | Avaliação | Status |
| --------- | --------- | ------ |
| I. Clean Architecture | A regra nova (resolver nome, duplicidade, criar item) fica em `domain/receita-kit.ts` e `application/use-cases/salvar-kit.ts`. A action `salvarKit` passa a fazer só gate + parse + **um** caso de uso + cache. Isso corrige o desvio atual, em que a action chamava repositório e `withAudit` direto. A transação fica no repositório (`infrastructure`). `Lookup` (shared/ui) recebe o critério de identidade por prop e não importa nada do módulo. | ✅ |
| II. Tipagem/qualidade | União discriminada `ComponenteInformado`; sem `any`; textos pt-BR; Conventional Commits. | ✅ |
| III. Testes | TDD de `validarReceita`, `normalizarNomeItem`, `itensCriticos` (ajustado) e `SalvarKitUseCase`. Teste de integração de `salvarComposicao`, porque é um fluxo transacional crítico que cria itens e receita. O teste de integração da Entrada cobre zerar a flag. | ✅ |
| IV. Segurança | Mantém `ROLES_COORDENACAO`. Zod na borda, `ilike` com `escaparLike` e parâmetros por bind. Nenhuma rota nova. | ✅ |
| V. Auditoria | `withAudit` para o kit e um `withAudit` por item criado (`origem: 'kit'`). Continua não bloqueante, sem log solto (R6). | ✅ |
| VI. Simplicidade | Sem dependência nova, sem Unit of Work genérica, sem índice único. Uma coluna boolean. A decisão da flag e do lock fica registrada em `spec/DESIGN.md` §19. | ✅ |
| Stack: auditoria em Mongo, domínio no Postgres | Sem mudança. | ✅ |

**Re-check pós-design**: continua ✅. O design (R1–R9, contratos S-01..S-08 e V-01..V-07) não
criou camada, dependência ou superfície de autorização nova. A remoção de `criar`, `atualizar`
e `definirReceita` do `KitRepository` reduz a superfície.

## Project Structure

### Documentation (this feature)

```text
specs/022-cadastro-item-kit/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── salvar-kit.md
│   └── lookup-vincular-identico.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
db/
├── schema/estoque.ts                                  # + item.aguardandoPrimeiraEntrada
└── migrations/0007_*.sql                              # add column (default false)

src/shared/ui/lookup/lookup.tsx                        # + vincularIdentico (contracts/lookup-vincular-identico.md)

src/modules/estoque/
├── domain/receita-kit.ts (+ .test.ts)                 # + ComponenteInformado, NovoItem, validarReceita, normalizarNomeItem
├── domain/estoque-minimo.ts (+ .test.ts)              # itensCriticos ignora aguardandoPrimeiraEntrada
├── domain/index.ts                                    # exporta os novos
├── application/ports/estoque-repository.ts            # KitRepository: + salvarComposicao; − criar, atualizar, definirReceita
├── application/use-cases/salvar-kit.ts (+ .test.ts)   # novo — SalvarKitUseCase
├── application/use-cases/salvar-kit.integracao.test.ts# novo — transação real
├── infrastructure/drizzle/estoque-repository.ts       # salvarComposicao (tx + advisory lock); entrada zera a flag
├── presentation/actions/estoque.ts                    # salvarKit: esquema união + caso de uso + tags
└── presentation/queries/estoque.ts                    # ItemComSaldo + aguardandoPrimeiraEntrada (listagem, inventário)

app/(interno)/(staff)/estoque/
├── kits/page.tsx                                      # passa limiarGlobal
├── kits/gestao-kits.tsx                               # Lookup valor livre + grupo "Item novo" por linha
└── tabela-estoque.tsx                                 # selo "abaixo do mínimo" respeita a flag

spec/DESIGN.md                                         # §19: flag aguardando_primeira_entrada + lock por nome
spec/DESIGN_SYSTEM.md                                  # §4.4.1: nota de vincularIdentico
```

**Structure Decision**: monolito Next.js existente, com tudo no módulo Estoque. O `Lookup`
continua genérico, porque o critério de "idêntico" vem do formulário. Nenhum outro módulo é
tocado: `notificacoes` consome `itensCriticos` do domínio do Estoque, como hoje, e recebe a
linha com a flag a partir de `inventarioParaExportacao`.

## Ordem sugerida de implementação

1. Migration e schema (flag). `itensCriticos` com teste. `EntradaRepository` zera a flag.
   Queries com a flag. Selo da tabela.
2. Domínio: `normalizarNomeItem` e `validarReceita` (TDD).
3. Port e `salvarComposicao` (transação, lock, resolução) com teste de integração.
4. `SalvarKitUseCase` (TDD com dublê), com auditoria do kit e por item.
5. Action `salvarKit`: esquema união, caso de uso, mapeamento de conflitos para `campos`, tags.
   Remover os métodos órfãos do port.
6. `Lookup.vincularIdentico`.
7. `gestao-kits.tsx` e `kits/page.tsx` (US1, US2, US3).
8. Documentação (DESIGN §19, DESIGN_SYSTEM) e roteiro do quickstart.

## Complexity Tracking

Sem violações da constituição. A seção não se aplica.
