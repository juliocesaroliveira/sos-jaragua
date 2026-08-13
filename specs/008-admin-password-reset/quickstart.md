# Quickstart: validar a redefinição de senha em `/admin`

**Feature**: 008-admin-password-reset

Guia de validação ponta a ponta. Contratos em [contracts/](./contracts/); tipos e regras em [data-model.md](./data-model.md).

## Pré-requisitos

- `.env.local` com `DATABASE_URL` (Neon) e `BETTER_AUTH_SECRET`.
- Para os cenários de provedor externo, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` configurados.
- **Três contas de teste**:
    1. **Credencial** — criada manualmente em `/admin` (tem senha própria).
    2. **Social** — criada entrando com Google pela tela de login (sem senha).
    3. **Administradora** — sua conta, com papel `administrador` e senha própria.

Sem a conta social, os cenários 3 e 4 não são verificáveis — e são justamente a metade do pedido.

## Subir e verificar automaticamente

```bash
npm run dev
npm test             # unitários — inclui os casos novos de EditarUsuarioUseCase
npm run lint
npx tsc --noEmit
```

Os testes novos vivem em `src/modules/identidade/application/use-cases/editar-usuario.test.ts` e cobrem: sem `novaSenha` a senha não é tocada; com conta sem senha própria a operação falha inteira; a senha é definida antes do papel.

## Cenário 1 — E-mail somente leitura (US1)

1. Em `/admin`, clicar em editar uma conta qualquer.
2. **Esperado**: o campo "E-mail" exibe o e-mail correto e não aceita digitação.
3. Alterar o nome e salvar.
4. **Esperado**: o nome muda na listagem; o e-mail permanece o mesmo.
5. Abrir "Nova conta".
6. **Esperado**: o campo de e-mail volta a ser editável e obrigatório.

**Verificação de FR-002/SC-004**: com o DevTools aberto, salvar a edição e conferir que o payload da Server Action não contém `email`.

## Cenário 2 — Redefinir senha de conta com senha própria (US2)

1. Editar a **conta credencial**.
2. **Esperado**: o rodapé mostra "Trocar Senha"; nenhum campo de senha visível.
3. Acionar "Trocar Senha".
4. **Esperado**: um campo de senha aparece, vazio e mascarado.
5. Digitar uma senha nova válida e salvar.
6. **Esperado**: confirmação de sucesso e diálogo fechado.
7. Sair, e tentar entrar com a senha **antiga**.
8. **Esperado**: acesso negado.
9. Entrar com a senha **nova**.
10. **Esperado**: acesso permitido.

## Cenário 3 — Conta de provedor externo não oferece a ação (US3)

1. Editar a **conta social** (criada via Google).
2. **Esperado**: o rodapé mostra apenas Cancelar e Salvar — **sem** "Trocar Senha".
3. Alterar o papel dessa conta e salvar.
4. **Esperado**: funciona normalmente; nada relacionado a senha acontece.

## Cenário 4 — A proteção não é só o botão (FR-013)

Enviar manualmente à Server Action `editarUsuario` um payload com `novaSenha` e o `id` da **conta social** (via console do navegador, na sessão da administradora).

**Esperado**: a operação é recusada com mensagem em pt-BR; conferir no banco que a conta continua sem linha `credential` em `account` e que o papel **não** mudou.

## Cenário 5 — Validação e desistência

| Ação                                                                       | Esperado                                             |
| -------------------------------------------------------------------------- | ---------------------------------------------------- |
| revelar o campo e salvar vazio                                             | erro no campo; nada gravado (FR-011)                 |
| digitar 5 caracteres e salvar                                              | mensagem de mínimo 8; nada gravado (FR-010)          |
| revelar, digitar, recolher a troca e salvar                                | só nome e papel são gravados; senha intacta (FR-012) |
| não revelar o campo e salvar                                               | só nome e papel; senha intacta (FR-008)              |
| reabrir a edição após um sucesso                                           | campo recolhido e vazio (FR-020)                     |
| editar a conta A, revelar, digitar, e sem fechar passar a editar a conta B | a troca recolhe; a senha de A não vai para B         |

## Cenário 6 — Sessões (FR-016)

1. Entrar com a **conta credencial** em um segundo navegador (ou aba anônima) e deixar a sessão aberta.
2. Como administradora, redefinir a senha dessa conta.
3. Recarregar a página no segundo navegador.
4. **Esperado**: a sessão foi encerrada e a tela de login é apresentada.
5. Agora redefinir a **própria** senha da administradora.
6. **Esperado**: a sessão de quem executou **permanece** ativa; nenhum logout surpresa.

## Cenário 7 — Auditoria (FR-019, SC-006, SC-007)

Após uma redefinição bem-sucedida, consultar o log de auditoria no MongoDB.

**Esperado**: um registro `entidade: 'Usuario'`, `acao: 'update'`, `tabela: 'user'`, com o `userId` de quem executou, o `entidadeId` da conta afetada e `dadosNovos.senhaRedefinida: true`. **A senha não aparece em nenhum campo** — conferir explicitamente.

## Cenário 8 — Conta com senha _e_ provedor externo

1. Com a conta credencial, entrar uma vez pelo Google usando o mesmo e-mail (vinculando o provedor).
2. Editar essa conta em `/admin`.
3. **Esperado**: "Trocar Senha" continua sendo exibida.
4. Redefinir a senha e verificar que **ambos** os acessos funcionam: a senha nova e o login pelo Google.
