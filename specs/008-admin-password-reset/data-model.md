# Data Model: Redefinição de senha e e-mail somente leitura

**Feature**: 008-admin-password-reset | **Data**: 2026-08-13

**Nenhuma migração.** Toda informação necessária já existe em `user` e `account` (`db/schema/identidade.ts`). O que muda são tipos de aplicação e um campo derivado.

---

## Tabelas existentes usadas (sem alteração)

### `user`

| Coluna  | Uso nesta feature                                        |
| ------- | -------------------------------------------------------- |
| `id`    | identifica a conta afetada                               |
| `name`  | editável (já era)                                        |
| `email` | **exibido somente leitura**; nunca escrito por esta tela |
| `role`  | editável (já era)                                        |

### `account`

| Coluna       | Uso nesta feature                                                                      |
| ------------ | -------------------------------------------------------------------------------------- |
| `userId`     | liga a conta ao usuário (índice `account_user_id_idx`)                                 |
| `providerId` | `'credential'` = senha própria; `'google'`/`'facebook'` = provedor externo             |
| `password`   | hash gravado pelo better-auth; **nunca lido nem escrito diretamente** por este projeto |

Uma conta pode ter **mais de uma** linha em `account` — é o caso da pessoa que criou senha e depois vinculou o Google. Por isso a regra é "existe linha `credential`", não "a única linha é `credential`" (edge case do spec).

---

## Campo derivado: `podeTrocarSenha`

**Definição**: existe em `account` uma linha com `userId = <conta>` **e** `providerId = 'credential'` **e** `password IS NOT NULL`.

| Onde aparece                          | Forma                                          |
| ------------------------------------- | ---------------------------------------------- |
| `LinhaUsuario` (listagem de `/admin`) | `podeTrocarSenha: boolean`                     |
| `UsuarioRepository`                   | `possuiSenhaPropria(userId): Promise<boolean>` |

Duas superfícies para o mesmo predicado, de propósito: a listagem precisa do booleano por linha para decidir a exibição do botão sem uma consulta por clique; o caso de uso precisa verificar de novo no servidor no momento da escrita (FR-013), porque o dado da tela pode estar defasado.

**Não expomos `providerId` cru para a tela.** Se amanhã surgir um terceiro provedor, a regra muda em um lugar só.

---

## Tipos de aplicação alterados

### `LinhaUsuario`

```
id, nome, email, role, criadoEm          (existentes)
podeTrocarSenha: boolean                  (novo)
```

`email` já existia no tipo e já viajava para o cliente — a mudança de US1 é de apresentação, não de dados.

### `EntradaEditarUsuario`

```
id: string
nome: string
role: Role
novaSenha?: string        (novo — ausente = senha intocada)
```

Regras:

| Situação                                          | Comportamento                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `novaSenha` ausente                               | nome e papel são gravados; a senha não é tocada (FR-008)                      |
| `novaSenha` presente, conta com senha própria     | senha redefinida e depois nome/papel gravados (FR-009)                        |
| `novaSenha` presente, conta **sem** senha própria | operação recusada por inteiro, erro de domínio `senha_nao_aplicavel` (FR-013) |
| `novaSenha` presente com menos de 8 caracteres    | recusada na validação, antes de qualquer escrita (FR-010)                     |
| `novaSenha` presente e vazia                      | tratada como inválida, nunca como "sem troca" (FR-011)                        |

O mínimo de 8 caracteres espelha `emailAndPassword.minPasswordLength` já configurado em `src/shared/auth/auth.ts` e o `esquemaCriar` do cadastro.

---

## Ports alterados

### `AutenticacaoService`

```
criarConta(...)                                    (existente)
definirSenha(userId, senha): Promise<void>          (novo)
encerrarSessoes(userId, exceto?: string): Promise<void>   (novo)
```

`definirSenha` **não** cria conta `credential` quando ela não existe — diferente do plugin `admin` do better-auth, que faz isso. Aqui, quem não tem senha própria não ganha uma por esta tela (FR-005/FR-013); a checagem antecede a chamada, no caso de uso.

`encerrarSessoes` recebe opcionalmente o token da sessão a preservar, para que a administradora que redefine a própria senha não seja deslogada (FR-016 + assumption do spec).

### `UsuarioRepository`

```
listar(...)                              (existente — passa a projetar podeTrocarSenha)
atualizarNomeERole(...)                  (existente)
atualizarRole(...)                       (existente)
buscarRole(...)                          (existente)
possuiSenhaPropria(userId): Promise<boolean>    (novo)
```

---

## Estado de UI (não persistido)

| Estado                   | Escopo              | Reset                                                                    |
| ------------------------ | ------------------- | ------------------------------------------------------------------------ |
| `trocandoSenha: boolean` | `UsuarioFormDialog` | volta a `false` a cada abertura e a cada troca de conta editada (FR-020) |
| valor do campo de senha  | formulário          | limpo junto com `trocandoSenha`, inclusive ao recolher a ação (FR-012)   |

Transições:

| Ação                                        | Efeito                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| abrir edição de conta com `podeTrocarSenha` | rodapé mostra "Trocar Senha"; campo oculto                                          |
| abrir edição de conta sem `podeTrocarSenha` | rodapé **não** mostra a ação                                                        |
| abrir cadastro                              | rodapé não mostra a ação; o campo de senha obrigatório do cadastro é outro (FR-006) |
| acionar "Trocar Senha"                      | campo revelado, vazio; validação de senha passa a valer                             |
| recolher a troca                            | campo oculto e limpo; validação de senha deixa de valer                             |
| salvar com sucesso                          | diálogo fecha; ao reabrir, estado recolhido                                         |

---

## Registro de auditoria

Reusa o `withAudit` já presente em `EditarUsuarioUseCase` — nenhuma `AcaoAuditada` ou `EntidadeAuditada` nova.

```
entidade: 'Usuario'   acao: 'update'   tabela: 'user'
entidadeId: <id da conta afetada>
userId/userRole: quem executou (vem do escopo de ator)
dadosAnteriores: { role: <role atual> }
dadosNovos: { nome, role, senhaRedefinida?: true }
```

`senhaRedefinida` é um booleano presente apenas quando houve troca. **A senha em si nunca entra** em nenhum dos snapshots (FR-018, SC-006).
