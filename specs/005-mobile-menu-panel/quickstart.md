# Quickstart: Validar Menu Mobile/Tablet Abaixo do Topbar

**Feature**: [spec.md](./spec.md) · **Contrato**: [contracts/mobile-menu-panel.md](./contracts/mobile-menu-panel.md)

## Pré-requisitos

- Sessão autenticada em um perfil com pelo menos dois grupos de destinos visíveis (ex.: `coordenador` ou `administrador`, que veem várias seções).
- Servidor local rodando: `npm run dev`, com `DATABASE_URL` configurado (ver `004-sticky-topbar` para o roteiro de diagnóstico de conectividade, se necessário).

## Roteiro — Mobile/Tablet (viewport ≤ `lg`, ex. 375px e 800px via DevTools)

1. Acesse qualquer página autenticada em uma viewport mobile.
2. Toque no botão de menu (hambúrguer) na barra superior.
    - **Esperado**: o painel de navegação aparece **abaixo** da barra superior, nunca sobre ou acima dela (M-01). A barra superior continua completamente visível (M-02).
3. Repita o passo 2 em uma viewport tablet (~800px de largura, ainda abaixo de `lg`).
    - **Esperado**: mesmo comportamento — painel abaixo da barra.
4. Com o painel aberto, toque em um destino de uma seção qualquer.
    - **Esperado**: navega para o destino e o painel fecha automaticamente (M-04).
5. Abra o painel novamente e toque no próprio botão de menu.
    - **Esperado**: painel fecha, página permanece a mesma (M-05).
6. Abra o painel e toque em qualquer área fora dele (ex.: sobre o conteúdo da página).
    - **Esperado**: painel fecha sem navegar (M-05).

## Roteiro — Teclado

1. Usando apenas Tab, alcance o botão de menu na barra superior.
2. Pressione Enter ou Espaço.
    - **Esperado**: painel abre, foco move para dentro dele (M-06).
3. Use as setas (ou Tab) para percorrer os destinos.
    - **Esperado**: cada destino recebe destaque visível de foco.
4. Confirme um destino com Enter.
    - **Esperado**: navega para o destino e o painel fecha.
5. Repita a abertura e, em vez de confirmar um item, pressione Esc.
    - **Esperado**: painel fecha e o foco retorna ao botão de menu (M-06).

## Roteiro — Perfil sem itens de navegação

1. Acesse com um perfil que não tenha nenhum destino de navegação visível (`itens.length === 0`, se existir tal perfil no ambiente de teste).
    - **Esperado**: o botão de menu não aparece na barra superior (M-07).

## Roteiro — Desktop (regressão)

1. Acesse qualquer página autenticada em uma viewport desktop (`lg+`).
    - **Esperado**: a coluna de navegação lateral fixa aparece exatamente como antes desta feature — sem botão de hambúrguer, sem painel flutuante (M-08).

## Critério de aceite geral

Todos os roteiros acima devem passar sem sobreposição visual entre o painel e a barra superior, sem perda de foco inesperada, e sem nenhuma regressão observável na navegação de desktop.
