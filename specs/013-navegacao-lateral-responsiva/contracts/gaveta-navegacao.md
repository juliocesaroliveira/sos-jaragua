# Contrato — Gaveta de navegação (telas pequenas)

**Feature**: `013-navegacao-lateral-responsiva` | Cobre FR-007 a FR-014

## G-01 — Reuso do primitivo existente

A gaveta MUST ser construída sobre o `Drawer` de `src/shared/ui/drawer/drawer.tsx`, que já é o
primitivo `Dialog` do Ark e já serve o sino de notificações.

`DrawerProps.lado` MUST ganhar o valor `'left'`, ao lado de `'bottom'` e `'right'`
(`drawer.tsx:28-31`). Acrescentar uma entrada ao mapa de posição é menor que duplicar backdrop,
portal, cabeçalho, botão de fechar e área rolável — Princípio VI.

Um componente de painel lateral próprio MUST NOT ser criado.

## G-02 — Semântica

A gaveta MUST apresentar os destinos como **links**, dentro de um landmark de **navegação**.

MUST NOT usar semântica de menu de ações (`role="menu"` / `role="menuitem"`), que é o defeito
atual (`menu-mobile.tsx`, construído sobre o `Menu` do Ark).

O diálogo em si continua sendo anunciado como diálogo, com título "Navegação" — o que a spec
rejeita é a semântica de menu aplicada aos destinos, não a existência do diálogo.

## G-03 — Comportamentos herdados do primitivo

MUST NOT ser reimplementados — são padrões do `Dialog`, verificados em
`node_modules/@zag-js/dialog/dist/dialog.types.d.mts:33-56`:

| Comportamento | Opção | Default | Requisito |
| --- | --- | --- | --- |
| Foco contido | `trapFocus` | `true` | FR-009 |
| Fundo não rola | `preventScroll` | `true` | FR-003 |
| Foco volta ao gatilho | `restoreFocus` | `true` | FR-009 |
| Conteúdo abaixo oculto a leitores | `modal` | `true` | — |
| Fecha com Esc | `closeOnEscape` | `true` | FR-008 |
| Fecha ao tocar fora | `closeOnInteractOutside` | `true` | FR-008 |

**`preventScroll` age sobre o documento.** Enquanto o conteúdo rolar num contêiner interno, ele
não tem efeito — é por isso que o fundo rola hoje, mesmo com o travamento ativo. **A gaveta só
atende FR-003 depois de R-01 do contrato de rolagem.**

## G-04 — Fechamento pelo gesto de voltar

Abrir a gaveta MUST empilhar uma entrada no histórico do navegador; um ouvinte de `popstate`
fecha a gaveta (FR-008).

Fechar por qualquer outro caminho — destino, fundo, Esc — MUST desempilhar a entrada.

**O par é obrigatório**: empilhar sem desempilhar acumula entradas, e o usuário passa a precisar
apertar voltar duas vezes para sair da tela.

A documentação do Next instalado autoriza o uso da API nativa e afirma que ela se integra ao
roteador (`docs/01-app/01-getting-started/04-linking-and-navigating.md:345-347`).

**Degradação aceitável**: se o comportamento se mostrar instável na integração com o roteador,
perde-se **apenas** o fechamento por voltar; os outros três caminhos permanecem e nenhum outro
requisito depende disso.

## G-05 — Conteúdo e dimensões

- Todos os destinos visíveis ao perfil MUST estar presentes, inclusive nos 16 do perfil máximo
  (FR-011).
- Os grupos MUST permanecer identificáveis, com os mesmos rótulos de hoje.
- A altura ocupada pelo conteúdo MUST acompanhar a quantidade de destinos — um perfil com 3 itens
  não pode gerar grande área vazia (FR-012).
- A largura MUST deixar visível parte do fundo escurecido, para que o toque fora seja
  descobrível.
- Nenhum destino MUST ficar sob a área de gestos do sistema operacional (FR-013).
- Alvos de toque MUST manter a altura mínima já adotada no projeto (FR-026).

## G-06 — Movimento

O deslize de abertura e fechamento MUST respeitar a preferência de movimento reduzido do sistema
(FR-014).

## G-07 — O que é removido

- `src/shared/ui/shell/menu-mobile.tsx` — arquivo inteiro.
- `useMenu` e `Ark.RootProvider` em `app-shell.tsx:43-52,63`, e o `topbarRef`.
- `Ark.Trigger` e o encaminhamento de `ref` em `topbar.tsx:33-39,47-58`.
- `TopbarProps.menuAberto`.

A fiação de âncora existia só para posicionar um menu suspenso na largura do `<header>`
(`app-shell.tsx:40-42`). Uma gaveta se posiciona pela borda da viewport; âncora deixa de fazer
sentido. O botão de navegação vira um botão comum com `onClick`.
