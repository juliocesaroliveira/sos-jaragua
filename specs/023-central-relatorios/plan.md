# Implementation Plan: Central de relatórios

**Branch**: `023-central-relatorios` | **Date**: 2026-10-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/023-central-relatorios/spec.md`

## Summary

Transformar `/relatorios` (hoje: inventário e saídas sem filtro + pacote de contingência) numa
central com **17 relatórios** agrupados por assunto, lidos das duas bases (Neon e a trilha de
auditoria no Mongo). Cada relatório é uma **definição única** (filtros, colunas, carregador,
resumo) que alimenta tanto a prévia paginada em `/relatorios/[relatorio]` quanto a exportação
CSV/XLSX em `/api/relatorios/export`, que passa a aceitar filtros e a escrever cabeçalho de
documento. A autorização por relatório deriva de `REGRAS_DE_ROTA` (regra nova
`/relatorios/auditoria` → só administrador). Os dados vêm de consultas expostas por cada módulo
dono; Contingência só orquestra (Princípio I). Detalhes em [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript estrito (Node.js 24 LTS na Vercel)

**Primary Dependencies**: Next.js 16.3 (App Router, Server Actions, Route Handlers), React 19,
TanStack Query 5 + TanStack Table 9, Ark UI + Tailwind v4, Zod 4, Drizzle ORM 0.45, driver
`mongodb` 6, `exceljs` 4 — **nenhuma dependência nova**

**Storage**: Neon Postgres (leitura de todas as tabelas de negócio + 3 índices novos); MongoDB
Atlas `audit_logs` (somente leitura)

**Testing**: Vitest — `npm test` (domínio/aplicação, sem rede) e `npm run test:integracao`
(Neon e Mongo reais)

**Target Platform**: Web (Vercel, Fluid Compute), desktop e celular

**Project Type**: Monolito modular web (Next.js) — `app/` + `src/modules/*`

**Performance Goals**: prévia ≤ 3 s com até 10.000 linhas no filtro (SC-002); exportação de
até 50.000 linhas ≤ 30 s (SC-004)

**Constraints**: sem cache nas leituras de relatório (FR-009); exportação em **streaming**
(o limite de 4,5 MB de corpo de resposta não vale para streaming, research D8), com teto de
50.000 linhas por duração e memória; datas em
America/Sao_Paulo; interface pt-BR; mobile sem rolagem horizontal de página

**Scale/Scope**: 17 relatórios, 5 grupos, 2 rotas de tela (catálogo + página dinâmica),
1 endpoint de exportação, 1 Server Action de consulta, 6 arquivos de consulta por módulo

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio | Verificação | Status |
| --- | --- | --- |
| I. Clean Architecture por módulo | Consultas ficam no módulo dono (`<modulo>/presentation/queries/relatorios.ts`); Contingência importa só essas funções; regras puras (período, diff, balanço, agrupamento de destino, validade, ocupação) em `contingencia/domain`; Server Action e Route Handler fazem parse → gate → um use case | ✅ |
| II. Tipagem estrita e qualidade | Definições tipadas por relatório (`DefinicaoRelatorio<F, L>`); sem `any` (o `as unknown as Aba<never>` atual sai com a tipagem genérica); textos pt-BR e linguagem ubíqua | ✅ |
| III. Testes de regras de negócio | TDD em `contingencia/domain` e `application` (catálogo/acesso, período, diff, cálculos); integração contra Neon para fechamento de R-07 e fronteira de fuso, e contra Mongo para a trilha | ✅ |
| IV. Segurança em profundidade | Proxy (`/relatorios`, `/relatorios/auditoria`, `/api/relatorios/export`) + `exigirAcessoA` na página + `podeAcessar(definicao.rota)` na Action e no Route Handler; dados sensíveis expostos por decisão registrada (Clarification Q1) com aviso LGPD; leitor da auditoria sem operações de escrita | ✅ |
| V. Auditoria não bloqueante | Feature só lê; nenhuma escrita passa a depender do Mongo; falha do Mongo afeta só R-17 | ✅ |
| VI. Simplicidade operacional | Sem dependência nova, sem fila nem cache dedicado; exportação em streaming no próprio Route Handler, com teto; 3 índices justificados (D12); decisões registradas em DESIGN.md §14 (tarefa) | ✅ |
| Stack | TanStack Table com paginação server-side; `exceljs`; Mongo só para auditoria | ✅ |

**Re-check pós-design (Phase 1)**: mantido ✅. O design não introduziu acesso cruzado a tabelas
nem cache. Ponto de atenção registrado: DESIGN.md §14 ainda cita `xlsx` (SheetJS) e
`coordenador` em §6.2 — a atualização da documentação entra nas tarefas.

## Project Structure

### Documentation (this feature)

```text
specs/023-central-relatorios/
├── plan.md              # este arquivo
├── research.md          # decisões D1–D12
├── data-model.md        # catálogo, filtros, resultado, colunas, índices
├── quickstart.md        # roteiro de validação
├── contracts/
│   ├── exportacao-http.md
│   ├── consulta-e-rotas.md
│   └── ui-central.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
app/(interno)/(staff)/relatorios/
├── page.tsx                         # catálogo (substitui as abas atuais)
├── catalogo-relatorios.tsx          # grade de cards por grupo + pacote de contingência
└── [relatorio]/
    ├── page.tsx                     # gate + filtros da URL + hidratação da 1ª página
    ├── filtros-relatorio.tsx        # período + filtros específicos → URL
    └── painel-relatorio.tsx         # avisos, resumo, exportação, prévia genérica, detalhe R-17
app/api/relatorios/export/route.ts   # só reexporta contingencia/presentation/http/exportar-relatorio.ts

src/modules/contingencia/
├── domain/
│   ├── catalogo.ts                  # slugs, grupos, DescricaoRelatorio (puro)
│   ├── periodo.ts                   # Periodo, padrão 30 dias, intervaloUtc (BRT)
│   ├── calculos.ts                  # balanço R-07, destino R-08, validade R-06, ocupação, horas, variação
│   ├── diff-auditoria.ts            # AlteracaoCampo[] a partir de antes/depois
│   └── *.test.ts
├── application/
│   ├── definicoes/                  # uma DefinicaoRelatorio por grupo (estoque, voluntariado, crise, comunicacao, auditoria)
│   ├── gerar-relatorio.ts           # use case: pagina() e completo() com teto de exportação
│   ├── relatorios.ts                # (removido — absorvido por definicoes/estoque.ts)
│   └── pacote-contingencia.ts       # inalterado, salvo import de COLUNAS_INVENTARIO
├── infrastructure/planilha.ts       # + cabecalhoDocumento, resumo, escape de fórmula no CSV
├── presentation/actions/relatorios.ts  # consultarRelatorioAction
└── presentation/http/exportar-relatorio.ts  # GET da exportação em streaming (testável pelo vitest)

src/modules/estoque/presentation/queries/relatorios.ts       # R-01…R-08
src/modules/voluntariado/presentation/queries/relatorios.ts  # R-09…R-13
src/modules/logistica/presentation/queries/relatorios.ts     # R-14
src/modules/notificacoes/presentation/queries/relatorios.ts  # R-16
src/modules/identidade/presentation/queries/relatorios.ts    # nomesPorIds, opções de autor
src/modules/auditoria/
├── infrastructure/audit-reader.ts   # find/count com maxTimeMS; erro tipado
└── presentation/queries/trilha.ts   # R-17

src/shared/auth/rotas.ts             # + /relatorios/auditoria (administrador)
src/shared/auth/navegacao.ts         # só a descrição do atalho
src/shared/query/chaves.ts           # + chaveRelatorio
db/schema/{estoque,notificacoes}.ts  # + 3 índices → migration 0008
spec/DESIGN.md                       # §14 reescrito; §6.2 corrigido
```

**Structure Decision**: segue o layout existente — telas em `app/(interno)/(staff)`, regras em
`src/modules/<modulo>/{domain,application,infrastructure,presentation}`. O módulo
`contingencia` (hoje quase vazio) recebe o catálogo e o use case; cada módulo de dados ganha um
único arquivo `queries/relatorios.ts`. Nenhum módulo novo.

## Complexity Tracking

Sem violações da constituição a justificar.
