# Implementation Plan: Migração do Toast para react-toastify

**Branch**: `010-toast-react-toastify` | **Date**: 2026-08-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-toast-react-toastify/spec.md`

## Summary

Substituir o motor do componente de aviso — hoje o primitivo `Toast` do Ark via `createToaster` — pelo `react-toastify`, preservando integralmente a aparência (design system) e a API de disparo em pt-BR (`avisar.*`).

A abordagem central é usar o entry point **`react-toastify/unstyled`**, que expõe a mesma API e o mesmo comportamento do build padrão porém **sem nenhuma folha de estilo**. Com isso o `react-toastify` passa a ser responsável apenas pelo ciclo de vida do aviso (fila, limite, temporizador, pausa em hover/foco, desmontagem, animação) enquanto 100% do pixel continua vindo dos tokens Tailwind do projeto. Não existe CSS padrão para sobrescrever, logo não existe guerra de especificidade nem paleta estranha vazando.

O blast radius é deliberadamente mínimo: `src/shared/ui/toast/toast.tsx` é reescrito por dentro mantendo caminho, nome de arquivo e nomes exportados (`Toaster`, `avisar`), de modo que `app/layout.tsx` e as 12 telas chamadoras não são tocadas.

## Technical Context

**Language/Version**: TypeScript estrito, React 19, Next.js 16 (App Router)

**Primary Dependencies**:

- **Adicionada**: `react-toastify@^11.1.0` (peer deps declaram `react: ^18 || ^19` — compatível)
- **Mantidas**: Tailwind CSS v4, `lucide-react` (ícones dos avisos), `@ark-ui/react` (permanece no projeto para Dialog, Menu, Table e demais componentes — apenas o primitivo `Toast` deixa de ser usado)

**Storage**: N/A — feedback efêmero, sem persistência

**Testing**: validação manual via `quickstart.md` + galeria do design system (`/design-system`). O projeto **não possui** stack de teste de componente (`vitest.config.ts` usa `environment: 'node'`, `include: ['src/**/*.test.ts']`, sem jsdom nem Testing Library) — ver decisão D7 em `research.md`.

**Target Platform**: navegadores modernos, desktop e mobile (mínimo de referência: 360px de largura)

**Project Type**: aplicação web (monolito Next.js modular na Vercel)

**Performance Goals**: exibição do aviso imperceptível ao usuário; troca de tema com aviso aberto sem re-render em JS (resolvida em CSS puro)

**Constraints**:

- Zero alteração nos 26 pontos de disparo distribuídos por 12 telas
- Zero alteração em `app/layout.tsx`
- Paridade visual com o toast atual em tema claro e escuro
- Durações por tipo, limite de 4 simultâneos e posição inferior-direita preservados
- Interface 100% pt-BR
- `z-index` do aviso deve continuar acima de diálogos (escala `CAMADA` de `src/shared/ui/cn.ts`)

**Scale/Scope**: 1 componente reescrito, 1 barrel ajustado, 1 bloco de CSS de animação, 1 seção de documentação atualizada. 26 pontos de disparo preservados sem edição.

## Constitution Check

_GATE: avaliado antes da Fase 0 e reavaliado após a Fase 1._

| Princípio                                    | Situação                            | Justificativa                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Clean Architecture por Módulo**         | ✅ PASS                             | Mudança confinada a `src/shared/ui/` — camada de apresentação compartilhada. Não toca `domain/`, `application/` nem `infrastructure/` de nenhum módulo. Nenhuma dependência cruzada nova.                                                                                                                                                                                                                                                                              |
| **II. Tipagem Estrita e Qualidade**          | ✅ PASS                             | `react-toastify` v11 embarca os próprios tipos (`dist/index.d.ts`), sem `@types/*` extra e sem `any`. Textos e rótulos permanecem em pt-BR (FR-010). Commit segue Conventional Commits (`refactor:` ou `feat:`).                                                                                                                                                                                                                                                       |
| **III. Testes Focados em Regras de Negócio** | ✅ PASS                             | O princípio afirma explicitamente que `presentation/` é fina por design e **não exige a mesma cobertura exaustiva** de `domain`/`application`. Não há regra de negócio nesta mudança. Introduzir jsdom + Testing Library só para este componente adicionaria stack de teste nova ao projeto — o oposto do Princípio VI. Validação é manual e roteirizada (`quickstart.md`).                                                                                            |
| **IV. Segurança e Defesa em Profundidade**   | ✅ PASS                             | Sem superfície de segurança: nenhum dado sensível, nenhuma rota, nenhuma sessão. Os avisos exibem apenas mensagens já devolvidas pelas Server Actions.                                                                                                                                                                                                                                                                                                                 |
| **V. Auditoria Não Bloqueante**              | ✅ PASS                             | Sem implicação — o toast é feedback de UI, não trilha de auditoria. O histórico de eventos continua no sino de notificações, mecanismo distinto e fora de escopo.                                                                                                                                                                                                                                                                                                      |
| **VI. Simplicidade Operacional**             | ⚠️ **PASS com decisão documentada** | A constituição exige decisão documentada ao adicionar dependência que **duplique capacidade já coberta pela stack** — e o Ark já cobre toast. Esta feature **é** essa decisão: `spec.md` (pedido do usuário) + `research.md` D1 (por que `unstyled`) constituem o registro exigido. Mitigação: o Ark **não** ganha um concorrente permanente — o primitivo `Toast` é removido no mesmo commit (FR-013), então o projeto continua com exatamente um mecanismo de aviso. |

**Veredito**: nenhum gate bloqueado. A única tensão (VI) é o próprio objeto da feature e está sanada pelo registro formal + remoção simultânea do mecanismo anterior.

**Reavaliação pós-Fase 1**: mantida. O desenho não introduziu nenhuma dependência além do `react-toastify`, nenhum arquivo fora de `src/shared/ui/`, e nenhuma camada nova.

## Project Structure

### Documentation (this feature)

```text
specs/010-toast-react-toastify/
├── spec.md              # Especificação (/speckit-specify)
├── plan.md              # Este arquivo (/speckit-plan)
├── research.md          # Fase 0 — decisões técnicas D1..D7
├── data-model.md        # Fase 1 — entidades Aviso e Fila de Avisos
├── quickstart.md        # Fase 1 — roteiro de validação manual
├── contracts/
│   └── avisar.contract.md   # Fase 1 — contrato da API pública do módulo
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/shared/ui/
├── toast/
│   └── toast.tsx            # REESCRITO por dentro. Caminho, nome e exports
│                            # (`Toaster`, `avisar`) preservados — é isto que
│                            # mantém `app/layout.tsx` e as 12 telas intactos.
├── index.ts                 # AJUSTADO: remove `toaster` do barrel (era detalhe
│                            # do Ark, verificado sem uso externo). `Toaster` e
│                            # `avisar` permanecem.
└── cn.ts                    # INALTERADO — `CAMADA.toast = 100` é reutilizado.

app/
├── globals.css              # ADIÇÃO: keyframes de entrada/saída do aviso
│                            # (o build unstyled não traz animação) + respeito a
│                            # prefers-reduced-motion.
├── layout.tsx               # INALTERADO — continua montando <Toaster />.
└── (interno)/design-system/
    └── galeria.tsx          # AJUSTADO: hoje demonstra só `sucesso` e `erro`.
                             # Ganha os botões de `atencao` e `info` — sem eles
                             # dois cenários de validação ficam sem superfície.
                             # As chamadas existentes não mudam.

spec/
└── DESIGN_SYSTEM.md         # ATUALIZADO: §4.8 deixa de citar "Ark UI Toast
                             # (via createToaster)" e passa a citar o novo motor.

package.json                 # ADIÇÃO: react-toastify ^11.1.0
```

**Structure Decision**: monolito Next.js de projeto único. A feature é uma troca de motor dentro de um único componente do design system compartilhado. A escolha de **preservar caminho de arquivo e nomes exportados** é o que reduz a mudança de "migração de biblioteca em 13 arquivos" para "reescrita de 1 arquivo", e é o mecanismo direto que satisfaz FR-012 e SC-001.

## Complexity Tracking

Nenhuma violação constitucional a justificar. O item VI aparece como tensão, não violação — é o próprio objeto da feature, e a constituição prevê exatamente este caminho (decisão documentada), que foi seguido.
