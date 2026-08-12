# Phase 1 Data Model: Fluxo Único de Login

Esta feature não introduz novas tabelas. As entidades relevantes já são definidas em
`spec/DB_SCHEMA.md` §4.1 (tabelas core do better-auth) e são apenas consumidas/lidas
pelo gate de rota e pela página de login.

## Usuário (`user`, better-auth)

| Campo    | Tipo                                                                     | Relevância para esta feature                                          |
| -------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `id`     | uuid/string, pk                                                          | identifica a sessão autenticada                                        |
| `email`  | text, único                                                              | usado no formulário de credenciais                                     |
| `role`   | enum(`usuario,voluntario,membro_defesa_civil,coordenador,administrador`) | determina a área de destino pós-login (FR-010) e o mapa rota→role do gate |
| `ativo`  | boolean, default `true`                                                 | usuário inativo não deve manter sessão válida (tratado como sessão inválida no gate) |

Sem alteração de schema. Nenhum campo novo requerido pela spec.

## Sessão (`session`, better-auth)

| Campo             | Tipo                  | Relevância para esta feature                                                     |
| ----------------- | --------------------- | ----------------------------------------------------------------------------------- |
| `id`               | uuid/string, pk       | —                                                                                    |
| `userId`           | fk → `user.id`        | resolve o `role` para a decisão de redirecionamento                                 |
| `expiresAt`        | timestamptz           | sessão expirada → gate trata como sem sessão válida (FR-003)                        |
| `lastActivityAt`   | timestamptz, nullable | usado pelo gate para aplicar timeout de inatividade de staff (`spec/DESIGN.md` §6.3) |

Sem alteração de schema.

## Estado de UI (não persistido): `LoginViewState`

Estado local, client-side, da página de login — não é uma entidade de domínio/banco,
mas documentado aqui por ser o "modelo" central desta feature de UI.

- **`view`**: `'options' | 'credentials'`
  - `'options'` (estado inicial): exibe os três botões (Google, Facebook, "Usar usuário
    e senha").
  - `'credentials'`: exibe campos de e-mail/senha + botões "Voltar"/"Acessar".
  - Transições: `options --(clica "Usar usuário e senha")--> credentials`;
    `credentials --(clica "Voltar")--> options` (campos digitados são descartados).
- **`error`**: mensagem de erro exibida na view `'credentials'` quando a submissão
  falha (FR-009); limpa ao reentrar em `'credentials'` a partir de `'options'`.

Nenhuma persistência: o estado é perdido ao recarregar a página, o que é aceitável pois
não há requisito de preservar a escolha entre navegações.
