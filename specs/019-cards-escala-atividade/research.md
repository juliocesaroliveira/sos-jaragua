# Research: Cards de Escala na Página da Atividade

**Feature**: 019-cards-escala-atividade | **Date**: 2026-10-01

O Technical Context não teve itens em aberto. As decisões abaixo cobrem as escolhas de layout e de componente que a spec deixa para o design.

## D1 — Grade com `auto-fill` em vez de faixa com rolagem horizontal

**Decision**: a área das escalas é uma lista em grade CSS com `grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr))`, `gap-3` e `items-start`. Em Tailwind v4, a classe fica `grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] items-start gap-3`.

**Rationale**:

- **Quebra de linha (FR-003, US2):** os cards quebram sozinhos conforme a largura, sem breakpoints fixos e sem rolagem horizontal.
- **Mesma largura (FR-005):** todas as trilhas medem `1fr`, então os cards de uma tela têm sempre a mesma largura.
- **Card único não estica (Edge Case):** com `auto-fill`, as trilhas vazias continuam existindo, e uma atividade com uma escala ocupa uma coluna só. `auto-fit` colapsaria as trilhas vazias e esticaria o card até a largura total.
- **Celular (FR-004):** abaixo de cerca de 588px de conteúdo (2 × 18rem + gap), cabe uma trilha só, e os cards ficam um por linha com a largura total.
- **Telas estreitas:** `min(100%, 18rem)` impede que a trilha mínima de 288px estoure a largura em telas de 320px descontado o gutter. É o que garante SC-003.
- **Alinhamento:** `items-start` mantém cada card com a altura do próprio conteúdo, alinhado no topo (US2 cenário 4). Um card com 20 voluntários não estica os vizinhos.
- **Desktop (SC-002):** em 1280px, descontada a navegação lateral, a largura útil passa de 3 × 18rem + 2 gaps (≈ 888px), então cabem pelo menos 3 cards por linha.

**Alternatives considered**:

- **Faixa com `flex-row` e `overflow-x-auto` (o layout atual em `md+`):** rejeitada. O pedido diz explicitamente para quebrar a linha, e não para rolar na horizontal.
- **`flex-wrap` com largura fixa:** rejeitada. Deixa sobra irregular no fim da linha e não garante largura igual sem cálculos por breakpoint.
- **Breakpoints fixos (`sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`):** é o idioma de `lista-atividades-abertas.tsx`, mas foi rejeitado aqui. A largura útil varia com a navegação lateral recolhida ou expandida, e a quantidade de colunas por largura de card resolve isso sem ajustes.

## D2 — Reaproveitar `KanbanCard` e tirar a `KanbanColumn` da página

**Decision**: cada escala continua sendo um `KanbanCard`, que já é "um por turno", com horário, ocupação, destaque de déficit, `acoes` e `detalhe`. A `KanbanColumn` deixa de ser usada no painel. No lugar dela entra uma `<section>` da própria página, com um título `h2` "Escalas" e a contagem ao lado, envolvendo um `<ul>` em grade.

**Rationale**:

- O `KanbanCard` já renderiza um `<li>` e já aplica o destaque de déficit exigido por FR-006. O único papel da coluna era agrupar os cards, e esse agrupamento é justamente o que a feature remove.
- Uma `<section>` com `<ul>` mantém a semântica de lista: o leitor de tela anuncia "lista, N itens", o que reforça FR-009.
- `KanbanColumn` continua existindo e sendo usada na galeria do design system. Removê-la sairia do escopo.

**Alternatives considered**:

- **Criar um componente `CardEscala` novo:** rejeitada. Duplicaria o destaque de déficit e a formatação de ocupação, que já são a fonte única em `KanbanCard`.
- **Uma `KanbanColumn` por escala:** rejeitada. A coluna tem fundo, borda e `md:w-80` fixo, pensados para conter cards. Usá-la como card criaria um card dentro de outro card.

## D3 — Nome acessível da ação "Alocar" identifica a escala

**Decision**: o rótulo deixa de ser a constante `ROTULO_ALOCAR` ("Alocar voluntário neste turno") e passa a ser calculado por card: `Alocar voluntário no turno de {data}, {início} – {fim}`. O mesmo texto continua servindo para `aria-label` e `Tooltip`, um rótulo só para os dois consumidores (C-04.3).

**Rationale**: com vários cards na tela, N botões com o mesmo nome acessível são indistinguíveis numa lista de controles do leitor de tela. Isso viola FR-014. O botão de remover já carrega o nome do voluntário ("Remover {nome} do turno") e continua igual.

**Alternatives considered**: `aria-describedby` apontando para o horário do card. Rejeitada: exigiria `id` no `KanbanCard` e um nome acessível composto é mais simples.

## D4 — Estado vazio do card e contagem de escalas

**Decision**:

- Quando `t.alocados.length === 0`, o `detalhe` do card mostra o texto `Nenhum voluntário escalado ainda.` (`text-sm text-neutral-500`).
- O cabeçalho da seção mostra `1 escala` ou `N escalas`, com o plural tratado.

**Rationale**:

- FR-008 pede o card visível com mensagem. Hoje o `detalhe` é `false` nesse caso, e o card fica só com o horário.
- A contagem já existia ("N turno(s)") e passa a usar o termo do pedido ("escala"), sem o plural com parênteses.

## D5 — Validação sem teste de componente

**Decision**: não adicionar testes automatizados para esta feature. A validação é feita por lint, typecheck, build e o roteiro manual/Playwright do `quickstart.md`.

**Rationale**:

- O `vitest.config.ts` roda em ambiente `node`, só com `src/**/*.test.ts`, e o projeto não tem infraestrutura de teste de componente.
- O Princípio III exige TDD para `domain`/`application`. Esta feature não toca essas camadas, e `presentation` é fina por design.
- Montar jsdom e Testing Library só para isso seria nova dependência sem valor proporcional (Princípio VI).

## D6 — Documentação do design system

**Decision**: atualizar `spec/DESIGN_SYSTEM.md` §4.16 para registrar o novo uso no painel de escala: cards em grade `auto-fill`, sem coluna. Também atualizar o comentário do topo de `painel-escala.tsx`, que hoje descreve a rolagem horizontal.

**Rationale**: o Princípio VI pede que decisões de UI relevantes fiquem documentadas. O texto atual (§4.16 e o comentário do componente) passaria a descrever um layout que não existe mais.
