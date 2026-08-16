# Contrato — Coluna recolhível (telas grandes)

**Feature**: `013-navegacao-lateral-responsiva` | Cobre FR-015 a FR-022

## C-01 — Dois estados

A coluna MUST oferecer exatamente dois estados de apresentação:

| Estado | Conteúdo por destino | Largura |
| --- | --- | --- |
| `expandida` | ícone + rótulo | a atual (`lg:w-72`) |
| `recolhida` | ícone apenas | trilha estreita |

Um controle visível MUST alternar entre eles (FR-015). O controle precisa de nome acessível que
diga o que fará ("Recolher navegação" / "Expandir navegação").

## C-02 — Persistência sem salto visual

A preferência MUST ser gravada no navegador e aplicada ao documento por **script inline no
`<head>`**, antes de qualquer JavaScript de aplicação.

**Padrão a espelhar**: `themeInitScript` em `src/shared/ui/theme/theme-provider.tsx:19-30`,
injetado em `app/layout.tsx:49`. Mesmo formato: leitura defensiva em `try/catch`, normalização e
gravação de um atributo no elemento raiz.

**Sem o script**, a coluna renderiza expandida no HTML do servidor e salta para recolhida após a
hidratação — um salto de largura em toda navegação, pior que não ter a funcionalidade.

**Corolário obrigatório**: o estado inicial no React MUST NOT ser lido do armazenamento no
inicializador do estado — causaria divergência de hidratação. O documento já carrega a
preferência aplicada; o estado do React sincroniza depois. O `theme-provider.tsx:39-46` documenta
exatamente esse cuidado, com o mesmo motivo.

## C-03 — Normalização da leitura

Qualquer valor que não seja exatamente `expandida` ou `recolhida` — ausente, corrompido, gravado
por versão futura — MUST resolver para `expandida` (FR-017).

Esta é a **única lógica pura da feature** e MUST ter teste unitário.

## C-04 — Rótulo na coluna recolhida

Dois requisitos distintos, que não se substituem:

| Requisito | Mecanismo | Alcança |
| --- | --- | --- |
| FR-018 — rótulo apresentado ao apontar ou focar | Dica visual (`Tooltip`, `src/shared/ui/tooltip/tooltip.tsx`) | Cursor e teclado |
| FR-019 — destino anunciado pelo rótulo | Texto acessível **sempre presente** | Leitores de tela |

Dica visual **não** é nome acessível e não aparece em toque. Um ícone sem texto associado é
anunciado como link sem nome. Ambos são obrigatórios.

## C-05 — Identificação da aplicação nos dois estados

A identificação da aplicação MUST permanecer visível com a coluna recolhida.

**Atenção — regressão fácil de introduzir**: `topbar.tsx:61` esconde a identificação em `lg+`
(`lg:hidden`), porque hoje a coluna expandida a exibe (`sidebar-nav.tsx:36`). Com a coluna
recolhida, **nenhuma das duas** a mostraria. A solução (marca reduzida na trilha, ou revelar a
identificação na topbar quando recolhida) fica a critério da implementação, mas o estado sem
identificação alguma é inaceitável.

## C-06 — Preservação nos dois estados

- Indicação do destino atual MUST permanecer perceptível (FR-020).
- Separação entre grupos MUST permanecer perceptível (FR-021) — sem rótulos de grupo visíveis na
  trilha, a separação precisa de outro recurso visual.
- Alvos de toque MUST manter a altura mínima já adotada (FR-026).
- Contraste MUST ser adequado nos temas claro e escuro (FR-027).

## C-07 — Escopo da preferência

A preferência MUST valer **apenas** onde a coluna existe (`lg+`). Em telas pequenas a navegação é
sempre a gaveta, independentemente do valor gravado.

Trocar a largura da janela MUST NOT apagar nem inverter a preferência gravada.

## C-08 — Ganho de largura verificável

Com a coluna recolhida, o conteúdo MUST dispor de ao menos 200 px a mais de largura útil que
dispõe hoje (SC-008).

A coluna atual é `lg:w-72` (288 px, `sidebar-nav.tsx:34`); uma trilha de ícones fica em torno de
64 px — a diferença satisfaz o critério com folga, mas o número está aqui para ser medido, não
presumido.
