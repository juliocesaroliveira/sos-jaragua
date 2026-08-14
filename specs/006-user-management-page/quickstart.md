# Quickstart: Validar Gestão de Usuários

**Feature**: [spec.md](./spec.md) · **Contrato**: [contracts/gestao-usuarios.md](./contracts/gestao-usuarios.md)

## Pré-requisitos

- Sessão autenticada com `role = 'administrador'` (para os roteiros de acesso permitido) e uma segunda sessão com outra role, ex. `coordenador` (para o roteiro de acesso negado).
- `npm run dev` com `DATABASE_URL` acessível (ver diagnóstico de conectividade em `004-sticky-topbar` se a conexão falhar).
- Banco com mais contas do que `pageSize` (ex.: ≥21 contas, se `pageSize = 20`), para exercitar a paginação de fato.

## Roteiro — Acesso

1. Acesse `/admin` autenticado como `administrador`.
    - **Esperado**: a página carrega, mostrando a listagem (A-01).
2. Acesse `/admin` autenticado como `coordenador` (ou outra role que não seja `administrador`).
    - **Esperado**: redirecionado para `/sem-permissao` (A-01, mesma regra de `REGRAS_DE_ROTA` que já existia).
3. Como `administrador`, abra o menu de navegação.
    - **Esperado**: existe um item (ex. "Usuários") no grupo "Administração" levando a `/admin` (A-02). Como `coordenador`, o mesmo item não aparece no menu.

## Roteiro — Listagem paginada (US1)

1. Em `/admin`, observe a primeira página da listagem.
    - **Esperado**: mostra nome, e-mail e papel de cada conta, limitada ao tamanho de página configurado (L-01).
2. Avance para a página seguinte e depois volte.
    - **Esperado**: os conjuntos de contas mudam corretamente, sem duplicar nem pular registros (Acceptance Scenario US1.2).

## Roteiro — Cadastro (US2)

1. Acione a ação de cadastrar uma nova conta.
    - **Esperado**: um formulário aparece (diálogo centralizado em desktop, folha ancorada na base em mobile — mesmo componente `Dialog`, responsivo por CSS) pedindo nome, e-mail, senha e papel (Acceptance Scenario US2.1).
2. Preencha com dados válidos (e-mail não usado por nenhuma conta) e confirme.
    - **Esperado**: o formulário fecha e a nova conta aparece na listagem com os dados informados, sem recarregar a página manualmente (Acceptance Scenario US2.2, FR-011).
3. Repita o cadastro usando um e-mail já existente.
    - **Esperado**: mensagem de erro específica sobre o e-mail, sem criar conta duplicada (Acceptance Scenario US2.3).
4. Tente confirmar o formulário com um campo obrigatório vazio, ou com uma senha muito curta.
    - **Esperado**: o formulário indica o problema e não envia (Acceptance Scenario US2.4).

## Roteiro — Edição (US3)

1. Na listagem, acione a ação de editar em uma conta qualquer.
    - **Esperado**: o mesmo formulário abre, já preenchido com o nome e o papel atuais dessa conta — sem campo de e-mail ou senha editável (Acceptance Scenario US3.1, US3.3).
2. Altere o nome e/ou o papel e confirme.
    - **Esperado**: a listagem reflete os novos valores imediatamente (Acceptance Scenario US3.2, FR-011).
3. Edite a própria conta (a conta com a qual você está logado) e altere o papel para um valor diferente de `administrador`.
    - **Esperado**: a alteração é aceita sem bloqueio (Assumptions da spec, Q2) — nenhuma restrição especial para autoedição.

## Roteiro — Cancelar sem salvar

1. Abra o formulário de cadastro ou edição, altere algum campo e cancele (feche sem confirmar).
    - **Esperado**: nada é salvo; a listagem permanece exatamente como estava antes (FR-012).

## Roteiro — Lista vazia

1. Em um ambiente sem nenhuma conta cadastrada (se aplicável ao ambiente de teste), acesse `/admin`.
    - **Esperado**: mensagem indicando que não há contas, sem erro de paginação.

## Critério de aceite geral

Todos os roteiros acima devem passar sem expor e-mail/senha como campos editáveis na edição, sem duplicar contas, e sem quebrar a paginação em nenhum extremo (primeira página, última página, lista vazia).
