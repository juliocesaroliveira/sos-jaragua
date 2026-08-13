# Implementation Plan: Página Padrão de Endereço Não Encontrado (404)

**Branch**: `003-not-found-page` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-not-found-page/spec.md`

## Summary

Hoje não existe nenhum `not-found.tsx` no projeto — toda situação de endereço não encontrado cai na tela padrão em inglês, sem shell e sem saída.

A abordagem usa **duas fronteiras**, cada uma na posição em que o Next resolve o caso, e **um único componente de conteúdo** compartilhado entre elas:

- `app/not-found.tsx` (raiz) — captura URLs desconhecidas de toda a aplicação. Nenhum layout de área se aplica aqui, então este arquivo lê a sessão e decide, ele próprio, envolver o conteúdo no shell ou não.
- `app/(interno)/not-found.tsx` — captura `notFound()` lançado dentro da área autenticada. O shell já vem de `(interno)/layout.tsx`, então este arquivo renderiza só o conteúdo.

Para o shell não ser montado em dois lugares, a montagem que hoje vive em `(interno)/layout.tsx` é extraída para um Server Component reutilizável.

## Technical Context

**Language/Version**: TypeScript estrito, React 19.1, Next.js 16.3 (App Router, Turbopack, Cache Components habilitado)

**Primary Dependencies**: Ark UI 5 + Tailwind v4 (`src/shared/ui`), better-auth 1.6 (sessão), lucide-react. Nenhuma dependência nova.

**Storage**: N/A — a feature não persiste nada e não introduz consulta nova. Reaproveita a leitura de sessão já memoizada por request.

**Testing**: Vitest (`npm test`) para a única lógica pura da feature — o destino do botão de retorno conforme a sessão. Sem testes de integração: não há fluxo transacional.

**Target Platform**: Web responsivo (mobile-first, 360px+), Vercel

**Project Type**: Monolito modular Next.js — camada de apresentação

**Performance Goals**: Sem consulta adicional no caminho de render. A variante com shell paga o mesmo custo de qualquer página autenticada; a variante sem sessão não faz I/O algum.

**Constraints**: pt-BR; tema claro/escuro; operável por teclado; alvo de toque ≥44px; **nenhuma alteração no modelo de acesso** (`rotas.ts`/`proxy.ts` permanecem intactos).

**Scale/Scope**: 2 fronteiras de not-found, 1 componente de conteúdo, 1 extração de shell, 1 função pura.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Veredito |
|-----------|-----------|----------|
| **I. Clean Architecture por Módulo** | Feature puramente de apresentação, transversal — não pertence a bounded context algum. Vive em `app/` e `src/shared/ui`. Não toca `domain/` nem `application/` de nenhum módulo, e não cria acesso de um módulo a dados de outro. | ✅ PASS |
| **II. Tipagem Estrita e Qualidade** | Sem `any`. Texto 100% pt-BR — é metade do motivo da feature existir, já que a tela padrão é em inglês. | ✅ PASS |
| **III. Testes em Regras de Negócio** | Não há regra de domínio nova. A única lógica pura é a escolha do destino de retorno conforme a sessão (FR-012/FR-013) — vira função pura em `rotas.ts` com teste em `npm test`. O resto é apresentação, que por desenho é fina e recebe validação de contrato, conforme o próprio princípio. | ✅ PASS |
| **IV. Segurança e Defesa em Profundidade** | Ponto de maior atenção, por dois motivos. (1) A variante sem sessão **não pode** vazar estrutura interna — daí FR-009/FR-015. (2) A página **não** substitui a resposta de acesso negado: `/sem-permissao` continua sendo o destino de quem não tem role (FR-016), para não confundir "não existe" com "você não pode". Nenhuma regra de `rotas.ts` ou `proxy.ts` é alterada. | ✅ PASS |
| **V. Auditoria Não Bloqueante** | Nenhuma escrita de domínio. Sem interação com `withAudit`. | ✅ N/A |
| **VI. Simplicidade Operacional** | Zero dependência nova, zero infraestrutura. A extração do shell **remove** duplicação em vez de criar abstração — sem ela, a montagem existiria em dois arquivos. `global-not-found.js` foi avaliado e rejeitado (research.md D2). | ✅ PASS |

**Gate pós-desenho (Phase 1)**: reavaliado ao fim deste documento — sem violações, `Complexity Tracking` vazio.

## Project Structure

### Documentation (this feature)

```text
specs/003-not-found-page/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões D1..D6
├── data-model.md        # Phase 1 — estados de apresentação (não há dados persistidos)
├── quickstart.md        # Phase 1 — roteiro de validação
├── contracts/
│   └── nao-encontrado.md # Contrato das fronteiras e do conteúdo compartilhado
├── checklists/
│   └── requirements.md  # Já gerado por /speckit-specify
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

`+` novo, `~` alterado.

```text
app/
├── not-found.tsx                          # + raiz: URLs desconhecidas de toda a aplicação;
│                                          #   lê a sessão e escolhe a apresentação
├── _shell/
│   └── shell-autenticado.tsx              # + Server Component extraído de (interno)/layout.tsx
│                                          #   (pasta `_` é privada: não vira rota)
├── (interno)/
│   ├── layout.tsx                         # ~ passa a compor <ShellAutenticado>
│   └── not-found.tsx                      # + notFound() na área autenticada — só conteúdo,
│                                          #   o shell vem do layout acima
└── (publico)/                             # inalterado

src/shared/
├── auth/
│   ├── rotas.ts                           # ~ + destinoDeRetorno(temSessao)
│   └── rotas.test.ts                      # ~ + testes do destino de retorno
└── ui/
    ├── index.ts                           # ~ exporta o conteúdo compartilhado
    └── nao-encontrado/
        └── nao-encontrado.tsx             # + conteúdo 404 (ilustração, texto, botão)
```

**Structure Decision**: mantida a convenção vigente — rotas em `app/`, compartilhado em `src/shared/`, design system em `src/shared/ui/`.

As duas escolhas que importam:

1. **Duas fronteiras, não uma.** O Next resolve URL desconhecida e `notFound()` em posições diferentes da árvore. Uma fronteira só forçaria um dos dois casos a se virar — ou o `notFound()` da área autenticada perderia o shell real, ou a URL desconhecida precisaria de um layout que não se aplica a ela.

2. **`app/_shell/`, não `src/shared/ui/`.** O componente extraído lê sessão e consulta notificações — é `server-only` e depende de módulos. Colocá-lo no barrel do design system, que as telas importam livremente, misturaria uma peça com I/O entre primitivos puros de UI. O prefixo `_` garante que a pasta não vire rota.

## Complexity Tracking

> Preenchido apenas se o Constitution Check tiver violações a justificar.

Sem violações. A feature adiciona três arquivos pequenos e uma função pura; a extração do shell reduz duplicação em vez de introduzir camada.

## Constitution Re-Check (pós Phase 1)

- **I** — os artefatos confirmam que nada desce a `domain`/`application`. ✅
- **III** — `contracts/nao-encontrado.md` isola `destinoDeRetorno` como a única unidade testável; o resto é contrato de apresentação. ✅
- **IV** — o contrato fixa que a variante sem sessão não recebe `ator`, então não tem como vazar identidade ou destinos; e reafirma a separação 404 ÷ `/sem-permissao`. ✅
- **VI** — nenhum artefato introduziu abstração adicional. ✅

Gate mantido: **PASS**.

## Riscos e Pontos de Atenção

1. **Cache Components + leitura de sessão na raiz.** `app/not-found.tsx` precisa ler cookies para decidir a apresentação. A documentação do Next instalado confirma que `not-found` pode ser `async` e usar `headers()` — mas com Cache Components habilitado essa leitura torna o segmento dinâmico. É o ponto a verificar primeiro na implementação; o plano de contorno está em research.md D3.

2. **Status HTTP real vs. soft 404 (afeta FR-002).** Para URL desconhecida, o 404 é decidido no roteamento e o status é real. Para `notFound()` dentro de `/atividades/[id]`, a chamada acontece **dentro de um `<Suspense>`** — o streaming já começou e o status não pode mais mudar, resultando em `200` com `<meta robots="noindex">`. É comportamento documentado do Next, não defeito; ver research.md D4 para por que não vamos reestruturar a rota agora.

3. **A variante sem sessão é quase inobservável** (já registrado na spec). O `proxy.ts` desvia o visitante anônimo para `/login` antes de a página ser alcançada. Ela é implementada mesmo assim — é o comportamento correto onde o gate não roda, e nenhuma linha de autorização é tocada para forçá-la a aparecer.

4. **Não confundir com `/sem-permissao`.** A tentação na implementação é reaproveitar uma tela para as duas coisas. FR-016 e SC-006 existem exatamente contra isso: endereço restrito continua produzindo acesso negado, não "não encontrado".
