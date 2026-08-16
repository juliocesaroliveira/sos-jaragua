# Contrato — Auto-cadastro por provedor externo

**Feature**: `011-auto-cadastro-provedor` | Cobre FR-001 a FR-010

Este contrato descreve o comportamento observável do fluxo de entrada por Google/Facebook. A
implementação é do better-auth; o que documentamos aqui é o que **não pode mudar** sem revisão
desta feature.

## C-01 — Configuração de provedor

| Item | Valor exigido | Verificação |
| --- | --- | --- |
| `socialProviders.google` / `.facebook` | sem `scope` customizado | nenhum escopo além do básico é solicitado (SC-008) |
| `socialProviders.*.mapProfileToUser` | **ausente** | não há parsing de data vinda de provedor (FR-004) |
| `user.additionalFields.dataNascimento.input` | `false` | endpoint do better-auth rejeita o campo vindo do cliente |
| `user.additionalFields.role.input` | `false` (já existente) | FR-006 — role nunca vem do cliente |
| `account.accountLinking.updateUserInfoOnLink` | **não definido** (default `false`) | FR-008 — nome não é sobrescrito |
| `account.accountLinking.requireLocalEmailVerified` | **não definido** (default `true`) | mantido estrito por decisão de segurança (D4) |

Qualquer PR que defina `updateUserInfoOnLink: true`, `overrideUserInfo: true` ou
`requireLocalEmailVerified: false` quebra este contrato e exige nova decisão documentada.

## C-02 — Criação de conta

**Entrada**: callback OAuth bem-sucedido, e-mail ainda não existente na base.

**Saída esperada**:

| Coluna de `user` | Valor |
| --- | --- |
| `name` | nome informado pelo provedor |
| `email` | e-mail informado pelo provedor |
| `emailVerified` | conforme o provedor |
| `role` | `usuario` |
| `ativo` | `true` |
| `dataNascimento` | `NULL` |

Sessão aberta, redirecionamento para o destino pós-login. Nenhum formulário de cadastro exibido.

## C-03 — Retorno pelo mesmo provedor

**Entrada**: callback OAuth, par (`providerId`, `accountId`) já existente em `account`.

**Saída esperada**: nenhuma linha nova em `user` nem em `account`; sessão aberta na conta
existente; `name` e `dataNascimento` **inalterados** (FR-008).

## C-04 — E-mail já pertence a outra credencial

**Entrada**: callback OAuth cujo e-mail já existe em `user`, sem `account` correspondente ao
provedor, e com `user.emailVerified = false`.

**Saída esperada**: **recusa**. Nenhuma conta criada, nenhuma vinculação feita.

A interface MUST traduzir a recusa para pt-BR, distinguindo-a de credencial inválida. Texto de
referência:

> Este e-mail já tem conta no sistema, criada com senha. Entre com e-mail e senha para continuar.

Erro interno correspondente do better-auth: `"account not linked"`
(`node_modules/better-auth/dist/oauth2/link-account.mjs:26`).

**Nota**: este é o caminho ativo hoje para **qualquer** segunda credencial no mesmo e-mail,
inclusive Google→Facebook, porque o sistema não verifica e-mail no cadastro por senha. Ver
[research.md](../research.md) D4.

## C-05 — Provedor sem e-mail

**Saída esperada**: recusa, sem criação de conta. Mensagem em pt-BR orientando outro meio de
acesso. Garantido estruturalmente por `email` ser `NOT NULL UNIQUE`.

## C-06 — Auditoria da criação

Disparada por `databaseHooks.user.create.after`. Formato do registro em
[data-model.md](../data-model.md) R4.

**Invariantes**:

- Registro emitido **uma vez** por conta criada, incluindo contas criadas por e-mail e senha
  (o hook não distingue; o campo `provedor` registra a origem).
- `dadosNovos` **não** contém `accessToken`, `refreshToken`, `idToken` nem `image`.
- Falha na escrita da auditoria **não** aborta a criação da conta nem o login (Princípio V).

## C-07 — Aviso na tela de login (FR-010)

Antes do redirecionamento ao provedor, a tela informa quais dados serão obtidos. Texto de
referência:

> Ao entrar com Google ou Facebook, recebemos apenas seu nome e e-mail para criar sua conta.

Deve ser verificável por teste de renderização da tela de login.
