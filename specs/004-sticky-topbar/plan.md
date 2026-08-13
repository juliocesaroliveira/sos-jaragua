# Implementation Plan: Topbar Fixo Durante a Rolagem

**Branch**: `004-sticky-topbar` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-sticky-topbar/spec.md`

## Summary

Hoje o shell autenticado (`AppShell`) cresce com a altura do conteúdo — é `<html>`/`<body>` quem rola, e o `Topbar` (fluxo normal, sem `sticky`/`fixed`) some ao rolar para baixo.

A abordagem travará a altura da raiz do shell na altura da viewport (`h-dvh` fixo, não `min-h-dvh`) e moverá a rolagem para dentro de `<main>` (`overflow-y-auto`). Com isso o `Topbar` nunca fica dentro de uma área que rola — não precisa de `position: sticky`/`fixed`, `z-index` nem sincronização de altura via `padding-top`. `SidebarNav` (coluna em desktop, gaveta em mobile) não muda de comportamento: dentro do contêiner travado, ela continua ocupando espaço no fluxo normal, apenas encolhendo a área visível de `main` em vez de aumentar a altura da página.

## Technical Context

**Language/Version**: TypeScript estrito, React 19.1, Next.js 16.3 (App Router, Turbopack)

**Primary Dependencies**: Tailwind CSS v4 (`src/shared/ui/shell/*`). Nenhuma dependência nova.

**Storage**: N/A — feature puramente de layout/CSS, sem I/O.

**Testing**: Sem teste automatizado novo (research.md D5) — mudança de classes Tailwind/estrutura de layout, sem lógica de domínio/aplicação nova. Validação por `quickstart.md` (manual, desktop + mobile via DevTools).

**Target Platform**: Web responsivo (mobile-first, 360px+), Vercel

**Project Type**: Monolito modular Next.js — camada de apresentação (`src/shared/ui`)

**Performance Goals**: Sem impacto — mudança é só de CSS/estrutura de containers; nenhuma consulta ou render adicional.

**Constraints**: pt-BR (sem texto novo), tema claro/escuro inalterado, alvo de toque ≥44px dos controles existentes preservado, `dvh` como unidade de viewport (research.md D4).

**Scale/Scope**: 3 arquivos alterados (`app-shell.tsx`, `topbar.tsx` se necessário para ajuste de classe, `sidebar-nav.tsx` para `overflow-y-auto` da coluna desktop), zero arquivo novo de código.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Veredito |
|-----------|-----------|----------|
| **I. Clean Architecture por Módulo** | Feature transversal de apresentação, vive inteiramente em `src/shared/ui/shell/`. Não toca `domain/` nem `application/` de nenhum módulo. | ✅ PASS |
| **II. Tipagem Estrita e Qualidade** | Nenhuma prop, tipo ou texto novo — só classes Tailwind. Sem `any`. | ✅ PASS |
| **III. Testes em Regras de Negócio** | Não há regra de negócio nova; é apresentação pura. Cai no carve-out do próprio princípio para `presentation/` — validação por contrato (`contracts/app-shell-layout.md`) e roteiro manual (`quickstart.md`), sem introduzir tooling de teste de componente (`@testing-library/react`) que o projeto não usa hoje. | ✅ PASS |
| **IV. Segurança e Defesa em Profundidade** | Não altera autenticação, sessão, roles, `proxy.ts` nem `(staff)/layout.tsx`. Puramente visual. | ✅ N/A |
| **V. Auditoria Não Bloqueante** | Nenhuma escrita de domínio. | ✅ N/A |
| **VI. Simplicidade Operacional** | Zero dependência nova. A solução escolhida (contêiner de altura travada) evita `position: sticky/fixed` + `z-index` + sincronização de altura — menos superfície do que a alternativa avaliada e rejeitada em research.md D1. | ✅ PASS |

**Gate pós-desenho (Phase 1)**: reavaliado ao fim deste documento — sem violações, `Complexity Tracking` vazio.

## Project Structure

### Documentation (this feature)

```text
specs/004-sticky-topbar/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões D1..D5
├── data-model.md        # Phase 1 — sem entidades novas
├── quickstart.md         # Phase 1 — roteiro de validação manual (desktop + mobile)
├── contracts/
│   └── app-shell-layout.md  # Contrato das garantias estruturais do shell
├── checklists/
│   └── requirements.md  # Já gerado por /speckit-specify
└── tasks.md              # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

`~` alterado, nenhum arquivo novo.

```text
src/shared/ui/shell/
├── app-shell.tsx     # ~ raiz passa de `min-h-dvh` (crescer com conteúdo) para
│                     #   `h-dvh overflow-hidden` (altura travada); `min-h-0` nos
│                     #   ramos flex intermediários; `<main>` ganha `overflow-y-auto`
├── topbar.tsx        # ~ (se necessário) remover qualquer suposição de que a página
│                     #   inteira rola; sem mudança de props
└── sidebar-nav.tsx   # ~ coluna desktop (`lg:w-72`) ganha rolagem própria
                      #   (`overflow-y-auto`) para listas longas não empurrarem o topbar
```

**Structure Decision**: nenhuma pasta nova — a mudança é inteiramente dentro de `src/shared/ui/shell/`, que já concentra o shell autenticado desde a feature 002 (`role-based-app-shell`).

As duas escolhas que importam:

1. **Contêiner de altura travada, não `sticky`/`fixed` no `Topbar`.** Ver research.md D1 — a alternativa `sticky` exigiria resolver empilhamento com a gaveta mobile (que hoje fica *acima* do `Topbar` no fluxo, não em overlay); o contêiner travado evita esse conflito por construção, sem tocar `SidebarNav`.
2. **`SidebarNav` não muda de comportamento, só ganha `overflow-y-auto` na variante desktop.** A gaveta mobile continua empurrando o layout (research.md D2) — o pedido da spec é sobre o `Topbar`, não uma reformulação da navegação.

## Complexity Tracking

> Preenchido apenas se o Constitution Check tiver violações a justificar.

Sem violações. A mudança reduz superfície (nenhum `z-index`/`position` especial) em vez de adicionar.

## Constitution Re-Check (pós Phase 1)

- **III** — `contracts/app-shell-layout.md` (L-01..L-07) isola exatamente o que passa a ser garantido, sem exigir teste de componente novo; o carve-out de apresentação fina do Princípio III cobre essa lacuna. ✅
- **VI** — nenhum artefato introduziu `z-index`, prop nova ou dependência nova; `data-model.md` confirma zero entidade nova. ✅

Gate mantido: **PASS**.

## Riscos e Pontos de Atenção

1. **`min-h-0` é fácil de esquecer e o efeito do esquecimento é silencioso.** Sem ele em cada ramo flex intermediário, `<main>` volta a crescer com o conteúdo em vez de rolar internamente, e o defeito original reaparece só em páginas longas — pode passar despercebido em uma página curta durante a implementação. Ver research.md D3; o roteiro de `quickstart.md` usa deliberadamente uma página com listagem extensa para pegar essa regressão.
2. **Barra de endereço retrátil em navegadores mobile.** `dvh` já mitiga a maior parte da inconsistência de `100vh` em mobile (research.md D4), mas vale confirmar visualmente no roteiro mobile do `quickstart.md` que não sobra uma faixa de rolagem residual ao mostrar/escancarar a barra do navegador.
3. **Gaveta mobile muito longa.** Se a lista de navegação de um perfil for grande, a gaveta aberta pode encolher `<main>` a quase zero em telas pequenas. Não é um requisito da spec impor um limite de altura para a gaveta — registrado aqui como observação para acompanhar no roteiro manual, não como requisito novo.
