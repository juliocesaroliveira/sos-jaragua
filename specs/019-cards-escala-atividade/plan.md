# Implementation Plan: Cards de Escala na Página da Atividade

**Branch**: `develop` (spec `019-cards-escala-atividade`) | **Date**: 2026-10-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/019-cards-escala-atividade/spec.md`

## Summary

Trocar, no painel de escala de `/atividades/[id]`, a coluna única "Escala" por um card para cada turno, dispostos em grade que quebra a linha. Dentro de cada card, os voluntários aparecem em lista vertical. A mudança é só de apresentação e fica em um Client Component, `painel-escala.tsx`, mais a documentação do design system.

Abordagem (research):

1. **Grade CSS `repeat(auto-fill, minmax(min(100%, 18rem), 1fr))` com `items-start`** (D1). Os cards quebram sozinhos, têm a mesma largura, ficam um por linha no celular, não esticam quando há um só e nunca geram rolagem horizontal.
2. **Reaproveitar o `KanbanCard` existente como card da escala** e substituir a `KanbanColumn` por uma `<section>` com `h2` "Escalas" e a contagem (D2). O destaque de déficit e a formatação de ocupação continuam com uma fonte única.
3. **Ajustes de acessibilidade e estado vazio** (D3, D4). O rótulo de "Alocar" passa a identificar o turno, e o card vazio mostra "Nenhum voluntário escalado ainda."

## Technical Context

**Language/Version**: TypeScript 5.9 (estrito), React 19

**Primary Dependencies**: Next.js 16.3 (App Router), Tailwind CSS v4, Ark UI (via `src/shared/ui`), lucide-react

**Storage**: N/A. Nenhuma mudança de dados. Lê `buscarAtividadeDetalhada` (Neon/Drizzle) como hoje.

**Testing**: lint, `tsc`, `npm test` (sem regressão) e `next build`. Validação visual e responsiva pelo `quickstart.md`, manual ou com Playwright. Não há testes de componente no projeto (research D5).

**Target Platform**: navegadores modernos, de desktop (até 1920px) a celular (a partir de 320px), nos temas claro e escuro

**Project Type**: aplicação web (monolito modular Next.js)

**Performance Goals**: nenhuma query ou round-trip a mais. A renderização continua O(turnos + alocados).

**Constraints**: sem rolagem horizontal entre 320px e 1920px. Área de toque de pelo menos 44px. Textos em pt-BR.

**Scale/Scope**: 1 componente alterado, 1 documento de design system e 1 trecho da galeria (opcional). Atividades típicas têm de 1 a 15 turnos, com até cerca de 20 alocados por turno.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio                        | Avaliação                                                                                                                                                    | Status |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| I. Clean Architecture por Módulo | A mudança fica só em `app/.../painel-escala.tsx` (apresentação). Nada em `domain`, `application` ou `infrastructure`, e nenhum acesso cruzado entre módulos. | ✅     |
| II. Tipagem estrita e qualidade  | Sem `any`. Segue o ESLint/Prettier existentes. Textos em pt-BR. Commit `feat:`. Usa o termo "escala", alinhado ao pedido e à UI atual.                       | ✅     |
| III. Testes em regras de negócio | Não toca `domain`/`application`, então o TDD não se aplica. A validação de apresentação segue o quickstart (D5).                                             | ✅     |
| IV. Segurança                    | Sem mudança de rota, de roles ou de Server Action. A autorização continua no layout `(staff)` e nas actions.                                                 | ✅     |
| V. Auditoria                     | As escritas continuam pelas mesmas actions auditadas (`alocarVoluntario`, `cancelarAlocacao`).                                                               | ✅     |
| VI. Simplicidade                 | Nenhuma dependência nova. Reaproveita o `KanbanCard`. A decisão de layout é registrada em `DESIGN_SYSTEM.md` §4.16 (D6).                                     | ✅     |
| Fluxo: responsividade mobile     | É o núcleo da feature (FR-003/004, SC-003/004).                                                                                                              | ✅     |

**Pós-design (re-check)**: os artefatos da Fase 1 não introduzem nada novo. O status continua ✅ e não há violações a justificar.

## Project Structure

### Documentation (this feature)

```text
specs/019-cards-escala-atividade/
├── plan.md              # Este arquivo
├── research.md          # Fase 0: decisões D1–D6
├── data-model.md        # Fase 1: modelo de leitura consumido (sem mudança de dados)
├── quickstart.md        # Fase 1: roteiro de validação
├── contracts/
│   └── ui-painel-escala.md   # Fase 1: contrato de UI U-01/U-02
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks — ainda não criado)
```

### Source Code (repository root)

```text
app/(interno)/(staff)/atividades/[id]/
├── page.tsx                 # sem mudança
└── painel-escala.tsx        # ALTERADO: section + grade de KanbanCard, rótulo de alocar por turno, estado vazio

src/shared/ui/kanban/
├── kanban-card.tsx          # sem mudança (reaproveitado como card da escala)
└── kanban-column.tsx        # sem mudança (deixa de ser usado no painel; segue na galeria)

app/(interno)/design-system/
└── galeria.tsx              # OPCIONAL: exemplo "Escalas em grade" ao lado do Kanban de turnos

spec/
└── DESIGN_SYSTEM.md         # ALTERADO: §4.16 registra o uso em grade no painel de escala
```

**Structure Decision**: o projeto é um monolito modular Next.js com rotas em `app/` e módulos em `src/modules/`. Esta feature fica só na camada de rota (`app/(interno)/(staff)/atividades/[id]`), reaproveitando primitivos de `src/shared/ui`, sem tocar `src/modules/voluntariado`.

## Complexity Tracking

Sem violações. Nada a justificar.
