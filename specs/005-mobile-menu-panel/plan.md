# Implementation Plan: Menu Mobile/Tablet Abaixo do Topbar

**Branch**: `005-mobile-menu-panel` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-mobile-menu-panel/spec.md`

## Summary

Hoje, abaixo do breakpoint `lg`, o painel de navegação é o mesmo `SidebarNav` usado no desktop, alternado por `menuAberto` e renderizado como sibling **antes** da coluna Topbar+main — por isso ele aparece acima da barra superior quando aberto.

A abordagem separa as duas variantes: `SidebarNav` volta a ser exclusivamente a coluna fixa de desktop (`lg+`), e um componente novo (`MenuMobile`) passa a cobrir mobile/tablet, construído sobre os primitivos do Ark UI Menu (`@ark-ui/react/menu`) — não sobre o wrapper genérico `Menu` já existente (feito para ações contextuais em lista plana) nem sobre o `Drawer` já existente (modal com backdrop, que é exatamente o padrão que a spec não pede). O painel é ancorado ao elemento inteiro do `Topbar` via `positioning.getAnchorElement` (não ao botão de hambúrguer), com `placement: 'bottom'` e `sameWidth: true`, resultando em um painel de largura cheia sempre abaixo da barra — nunca acima, nunca sobreposto. O estado `menuAberto` já existente em `AppShell` continua sendo a fonte de verdade, agora também alimentando o `useMenu` controlado; `Topbar` e `MenuMobile` compartilham esse mesmo menu via `Menu.RootProvider`.

## Technical Context

**Language/Version**: TypeScript estrito, React 19.1, Next.js 16.3 (App Router, Turbopack)

**Primary Dependencies**: `@ark-ui/react` 5.38 (primitivos `Menu`, já em uso no projeto para outros componentes — `src/shared/ui/menu/menu.tsx`), Tailwind CSS v4. Nenhuma dependência nova.

**Storage**: N/A — feature de composição de UI, sem I/O.

**Testing**: Sem teste automatizado novo (research.md D6) — mesma decisão e mesmo motivo de `004-sticky-topbar`. Validação por `quickstart.md` (manual, mobile + tablet + teclado + regressão desktop).

**Target Platform**: Web responsivo (mobile-first, 360px+), Vercel

**Project Type**: Monolito modular Next.js — camada de apresentação (`src/shared/ui/shell`)

**Performance Goals**: Sem impacto — reorganização de componentes já client-side existentes; `@ark-ui/react` já é dependência carregada pela aplicação.

**Constraints**: pt-BR (sem texto novo), tema claro/escuro inalterado, alvo de toque ≥44px dos itens de navegação preservado (já garantido por `min-h-11` em `sidebar-nav.tsx`, reaproveitado no painel novo), operável 100% por teclado (FR-006).

**Scale/Scope**: 1 arquivo novo (`menu-mobile.tsx`), 3 arquivos alterados (`app-shell.tsx`, `topbar.tsx`, `sidebar-nav.tsx`), zero dependência nova.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio                                  | Avaliação                                                                                                                                                                                                                                                                                        | Veredito |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| **I. Clean Architecture por Módulo**       | Feature transversal de apresentação, vive inteiramente em `src/shared/ui/shell/`. Não toca `domain/` nem `application/` de nenhum módulo.                                                                                                                                                        | ✅ PASS  |
| **II. Tipagem Estrita e Qualidade**        | Sem `any`. Reaproveita tipos já existentes (`ItemNavegacao`, `SecaoNavegacao`); nenhum texto novo em pt-BR além do que já existe (rótulos de navegação inalterados).                                                                                                                             | ✅ PASS  |
| **III. Testes em Regras de Negócio**       | Não há regra de negócio nova; é composição de apresentação sobre um primitivo de UI já usado no projeto. Cai no carve-out do próprio princípio para `presentation/` — validação por contrato (`contracts/mobile-menu-panel.md`) e roteiro manual (`quickstart.md`).                              | ✅ PASS  |
| **IV. Segurança e Defesa em Profundidade** | Não altera autenticação, sessão, roles, `proxy.ts` nem os dados/regras de `navegacao.ts` (quais destinos aparecem para qual perfil). Puramente de apresentação.                                                                                                                                  | ✅ N/A   |
| **V. Auditoria Não Bloqueante**            | Nenhuma escrita de domínio.                                                                                                                                                                                                                                                                      | ✅ N/A   |
| **VI. Simplicidade Operacional**           | Zero dependência nova — reaproveita `@ark-ui/react` já instalado. `SidebarNav` fica mais simples (perde a variante mobile) em vez de acumular duas responsabilidades; o painel novo usa o mesmo primitivo já padronizado no design system (`Menu`), só com composição diferente da já existente. | ✅ PASS  |

**Gate pós-desenho (Phase 1)**: reavaliado ao fim deste documento — sem violações, `Complexity Tracking` vazio.

## Project Structure

### Documentation (this feature)

```text
specs/005-mobile-menu-panel/
├── plan.md               # Este arquivo
├── research.md           # Phase 0 — decisões D1..D6
├── data-model.md         # Phase 1 — sem entidades novas
├── quickstart.md         # Phase 1 — roteiro de validação manual
├── contracts/
│   └── mobile-menu-panel.md  # Garantias M-01..M-09
├── checklists/
│   └── requirements.md   # Já gerado por /speckit-specify
└── tasks.md               # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

`+` novo, `~` alterado.

```text
src/shared/ui/shell/
├── app-shell.tsx      # ~ cria o menu controlado via useMenu({ open: menuAberto, onOpenChange,
│                      #   positioning: { getAnchorElement, placement: 'bottom', sameWidth: true } });
│                      #   envolve a árvore em <Menu.RootProvider value={menu}>; passa a ref do
│                      #   topbar para a opção de ancoragem
├── topbar.tsx         # ~ o botão de menu passa a ser envolvido por <Menu.Trigger asChild>;
│                      #   o <header> ganha o ref usado como âncora de posicionamento
├── menu-mobile.tsx    # + novo: <Menu.Positioner><Menu.Content> com <Menu.ItemGroup>/
│                      #   <Menu.ItemGroupLabel> por seção e <Menu.Item asChild><Link>
│                      #   por destino — só renderizado abaixo de `lg`
└── sidebar-nav.tsx    # ~ volta a ser exclusivamente a coluna desktop (`hidden lg:flex`
                       #   incondicional); remove a variante/props de gaveta mobile
```

**Structure Decision**: nenhuma pasta nova — a mudança continua inteiramente dentro de `src/shared/ui/shell/`, mesma pasta tocada por `004-sticky-topbar`.

As três escolhas que importam:

1. **Componente novo, não adaptação de `Menu` ou `Drawer` existentes.** Ver research.md D1 — cada um dos dois componentes já existentes tem um contrato pensado para um uso diferente; misturar um terceiro uso neles reduziria a clareza dos dois já em produção.
2. **Ancoragem ao `<header>` inteiro, não ao botão.** Ver research.md D2 — é a diferença entre um painel de largura cheia "abaixo do topbar" (o que a spec pede, FR-001) e um dropdown estreito preso ao botão de hambúrguer.
3. **Um único `useMenu` controlado, compartilhado via `Menu.RootProvider`.** Ver research.md D3 — permite que o gatilho (no `Topbar`) e o conteúdo (no `MenuMobile`) fiquem em componentes-irmãos sem fundir os dois arquivos.

## Complexity Tracking

> Preenchido apenas se o Constitution Check tiver violações a justificar.

Sem violações. Um arquivo novo pequeno e simplificação de `sidebar-nav.tsx` (perde uma responsabilidade) equilibram o total de superfície.

## Constitution Re-Check (pós Phase 1)

- **III** — `contracts/mobile-menu-panel.md` (M-01..M-09) isola exatamente o que passa a ser garantido, sem exigir teste de componente novo; carve-out de apresentação fina do Princípio III cobre a lacuna. ✅
- **VI** — `data-model.md` confirma zero entidade nova; nenhum artefato introduziu dependência nova ou breakpoint novo. ✅

Gate mantido: **PASS**.

## Riscos e Pontos de Atenção

1. **Timing do `getAnchorElement`.** A função de ancoragem lê `topbarRef.current`, populado só depois do primeiro render do `Topbar`. Como o menu começa fechado (`menuAberto` inicial `false`) e o Ark só calcula posição quando o menu abre/reposiciona, isso não deveria ser um problema na prática — mas é o primeiro ponto a verificar se o painel aparecer na posição errada na primeira abertura de uma sessão.
2. **`Menu.Item asChild` com `<Link>` do Next.js.** O primitivo Ark intercepta teclado/clique para navegação por setas e `closeOnSelect`; é preciso confirmar na implementação que o `<Link>` continua navegando via App Router (client-side) em vez de um reload de página — mesmo padrão que `sidebar-nav.tsx` já usa hoje, então o risco é baixo, mas vale um teste manual dedicado no roteiro (`quickstart.md`, passo 4).
3. **Overlap com o trabalho pendente de `004-sticky-topbar`.** Esta feature assume que o `Topbar` já é fixo (`shrink-0`, nunca dentro de área que rola) — se `T005`–`T011` de `004-sticky-topbar` ainda não foram validados em um ambiente com banco funcionando, vale confirmá-los antes ou junto desta implementação, já que o painel mobile/tablet se ancora visualmente ao topbar.
