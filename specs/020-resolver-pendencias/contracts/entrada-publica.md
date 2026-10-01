# Contrato: Entrada pública (Q2 + item 7, FR-010 e FR-011)

## C-01. Rota de cadastro por senha fechada

| Requisição                                                                 | Antes                                         | Depois                                             |
| -------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| `POST /api/auth/sign-up/email` (qualquer corpo)                            | `200` + conta criada (+ sessão, `autoSignIn`) | `404 Not Found`, nenhuma linha em `user`/`account` |
| `POST /api/auth/sign-in/email`                                             | `200` / `401`                                 | **inalterado**                                     |
| `GET /api/auth/sign-in/social`, callbacks OAuth                            | inalterado                                    | inalterado (só provedores configurados, ver C-02)  |
| `auth.api.signUpEmail(...)` no servidor (`/admin` → `CriarUsuarioUseCase`) | cria conta                                    | **inalterado: continua criando**                   |

Configuração: `disabledPaths: ['/sign-up/email']` em `opcoesAuth`
(`src/shared/auth/opcoes.ts`), compartilhada por `auth` e `authProxy`. **Proibido**:
`emailAndPassword.disableSignUp: true`, que bloquearia também o `/admin` (research D2).

## C-02. Provedores sociais configurados

```ts
// src/shared/auth/provedores-sociais.ts
export type ProvedorSocial = 'google' | 'facebook'
export function provedoresSociaisConfigurados(
    env?: Record<string, string | undefined> // default: process.env
): ProvedorSocial[]
```

- Um provedor entra na lista só se `<P>_CLIENT_ID` **e** `<P>_CLIENT_SECRET` forem
  strings não vazias, depois de `trim()`.
- Ordem fixa: `google` antes de `facebook`.
- `opcoesAuth.socialProviders` contém só os provedores da lista.

### `LoginForm`

```ts
export function LoginForm({ provedores }: { provedores: ProvedorSocial[] })
```

| `provedores`            | Modo inicial    | Botões sociais | Divisor "ou" | Aviso de privacidade                |
| ----------------------- | --------------- | -------------- | ------------ | ----------------------------------- |
| `['google','facebook']` | `'opcoes'`      | os dois        | sim          | "Ao entrar com Google ou Facebook…" |
| `['google']`            | `'opcoes'`      | Google         | sim          | "Ao entrar com Google…"             |
| `[]`                    | `'credenciais'` | nenhum         | não          | não                                 |

Com `[]`, o botão "Voltar" do modo credenciais não aparece (não há para onde voltar).
O tratamento de `?error=` e `?motivo=expirado` não muda.
