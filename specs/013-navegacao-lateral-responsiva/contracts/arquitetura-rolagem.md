# Contrato — Arquitetura de rolagem

**Feature**: `013-navegacao-lateral-responsiva` | Cobre FR-001 a FR-006

## R-01 — Quem rola é o documento

O shell da área autenticada MUST NOT travar a altura da página na altura da janela, e MUST NOT
transformar a área de conteúdo em contêiner rolante.

**O que sai** (`src/shared/ui/shell/app-shell.tsx:64,78`):

- `h-dvh` + `overflow-hidden` no contêiner externo
- `overflow-y-auto` no `<main>`

**Por quê**: é a rolagem de documento que aciona o recolher da barra de endereço em navegadores
móveis (FR-002), e é sobre o documento que o travamento de rolagem do diálogo age (FR-003). Com a
caixa no lugar, nenhuma das duas funciona — que é a queixa de origem.

## R-02 — Barra superior e coluna acompanham a rolagem

A barra superior MUST permanecer visível durante a rolagem, fixada ao topo.
A coluna de navegação, em telas grandes, MUST permanecer visível durante a rolagem.

Ambas por posicionamento aderente (`sticky`), **não** por contêiner rolante — reintroduzir um
contêiner reintroduziria o problema.

## R-03 — Regiões de rolagem permitidas

| Região | Vertical | Horizontal | Observação |
| --- | --- | --- | --- |
| Documento | ✅ principal | — | FR-001, FR-002 |
| Coluna lateral | ✅ só se exceder a altura da janela | — | Landmark próprio |
| Gaveta aberta | ✅ com contenção | — | FR-005 |
| Tabelas largas | ❌ | ✅ preservado | `table.tsx:92`, eixo diferente |

O que FR-001 proíbe é **duas barras verticais disputando o mesmo conteúdo**. Coluna e gaveta têm
conteúdo próprio e não competem com o da página.

## R-04 — Contenção de rolagem na gaveta

A lista de destinos dentro da gaveta MUST conter a rolagem: atingir o fim da lista **não** pode
transferir o gesto para a página atrás (FR-005).

## R-05 — Rolagem por teclado

Page Down, Page Up, Home e End MUST agir sobre o conteúdo da página sem exigir clique prévio numa
região específica (FR-004).

Hoje isso falha porque o contêiner rolante precisa de foco para receber as teclas — com a rolagem
no documento, passa a funcionar sem código adicional.

## R-06 — Altura de janela variável

O layout MUST se comportar corretamente quando a altura visível muda — barra de endereço
recolhendo, teclado virtual abrindo — sem cortar conteúdo nem produzir saltos (FR-006).

Unidades de viewport dinâmicas devem ser usadas onde altura de janela for necessária; unidades
fixas produzem corte quando a barra de endereço está visível.

## R-07 — Nenhuma tela precisa de ajuste em cascata

A troca não MUST exigir alteração nas telas de conteúdo.

**Verificado** (research.md D3): busca por `overflow-y-auto`, `overflow-auto`, `sticky`, `h-full`,
`h-dvh` e `h-screen` em `app/` e nos componentes de tabela e kanban encontrou apenas
`app/(publico)/login/page.tsx` e `app/(publico)/cadastro/page.tsx` — ambas fora do shell
autenticado.

Se alguma tela apresentar conteúdo cortado após a mudança, é um resíduo não detectado por essa
busca e deve ser corrigido na própria tela, sem reintroduzir o contêiner rolante no shell.
