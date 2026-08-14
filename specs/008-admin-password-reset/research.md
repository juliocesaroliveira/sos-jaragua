# Research: Redefinição de senha e e-mail somente leitura na edição de conta

**Feature**: 008-admin-password-reset | **Data**: 2026-08-13

Todas as NEEDS CLARIFICATION do Technical Context foram resolvidas aqui.

---

## D1 — Como definir a senha de **outra** conta: `auth.$context`, não o plugin `admin`

**Decisão**: estender o port `AutenticacaoService` com `definirSenha(userId, senha)` e implementá-lo em `infrastructure/better-auth/` usando o contexto interno do better-auth:

```
const ctx = await auth.$context
const hash = await ctx.password.hash(novaSenha)
await ctx.internalAdapter.updatePassword(userId, hash)
```

`auth.$context` é público e tipado (`node_modules/better-auth/dist/types/auth.d.mts:13`); `internalAdapter.updatePassword` já filtra por `providerId = 'credential'` (`dist/db/internal-adapter.mjs:540`), então uma conta sem senha própria simplesmente não é tocada.

**Rationale**: é literalmente o que o plugin oficial `admin` faz no endpoint `setUserPassword` (`dist/plugins/admin/routes.mjs:826-845`) — mesma sequência hash → `updatePassword`. Fazemos direto, sem o plugin, e o hash continua sendo responsabilidade do better-auth, nunca de código deste projeto (mesmo princípio já registrado em `autenticacao-service.ts` para `signUpEmail`).

**Alternativas rejeitadas**:

- **Plugin `admin` do better-auth**: traz seu próprio modelo de papéis (`user.role` precisa conter `"admin"`), que colide frontalmente com os papéis do projeto (`administrador`, `coordenador`, …) definidos em `src/shared/auth/roles.ts`, além de `ban`, `impersonate` e `listUsers` que não queremos expor. Custo de configuração e superfície muito maiores que o benefício (Princípio VI).
- **`auth.api.changePassword`**: exige a senha **atual**, que a administração não tem. Não serve.
- **Hash manual (bcrypt/argon2 no projeto)**: introduz dependência e uma segunda política de hash divergindo da do better-auth. Rejeitado.

**Nota de comportamento adotada de propósito**: o plugin `admin` **cria** uma conta `credential` quando não existe (o `else` da linha 839). Nós **não** fazemos isso — FR-005/FR-013 exigem o oposto: conta de provedor externo não ganha senha por esta tela.

---

## D2 — Como saber se a conta tem senha própria

**Decisão**: adicionar ao port `UsuarioRepository` um método `possuiSenhaPropria(userId): Promise<boolean>`, implementado em Drizzle como a existência de uma linha em `account` com `providerId = 'credential'` **e** `password` não nulo. O campo derivado `podeTrocarSenha: boolean` passa a integrar `LinhaUsuario`.

**Rationale**: a tabela `account` já guarda `providerId` e `password` por conta (`db/schema/identidade.ts:67-91`), com índice `account_user_id_idx` — nenhum dado novo é necessário. Expor um booleano derivado, e não o `providerId` cru, mantém a decisão "quem pode trocar senha" em um lugar só e evita que a tela reimplemente a regra.

Identidade é a dona de `user`/`account` (Princípio I), então este é o módulo correto para o método — o mesmo racional que já trouxe `atualizarRole` de `voluntariado` para cá em 006.

**Alternativas rejeitadas**:

- **Buscar o dado só ao abrir o diálogo** (uma consulta por clique em editar): evita carregar a coluna na listagem, mas adiciona um estado de carregamento dentro do formulário e um caminho de erro novo. Como a listagem já faz um `join`-friendly `select` sobre `user`, um `exists` correlacionado por linha é barato e serve as duas telas.
- **Inferir pelo `role`**: contas criadas em `/admin` não têm papel distinto de contas sociais. Não funciona.

---

## D3 — Onde a redefinição acontece: dentro de `EditarUsuarioUseCase`

**Decisão**: `EntradaEditarUsuario` ganha `novaSenha?: string`. O caso de uso, quando a senha vem preenchida:

1. valida que a conta existe (já faz) **e** que possui senha própria — senão devolve `DomainError` (`senha_nao_aplicavel`);
2. redefine a senha **antes** de gravar nome/papel;
3. encerra as demais sessões da conta.

**Rationale**: FR-015 exige tudo-ou-nada entre a alteração de papel e a redefinição. As duas escritas vivem em armazenamentos diferentes do ponto de vista do better-auth (a senha passa pelo adapter dele), então não há uma transação Postgres única trivial. Ordenar senha → papel torna a falha mais provável (a senha) a primeira: se ela falhar, nada foi alterado, que é exatamente o que FR-015 pede. O caso residual — senha gravada e papel falhando depois — deixa uma senha nova válida e o papel antigo, situação recuperável repetindo a operação, e não uma conta em estado inconsistente de acesso.

Manter isso no caso de uso, e não na Server Action, é o Princípio I: a `presentation` não decide ordem de escrita.

**Alternativas rejeitadas**:

- **Caso de uso separado `RedefinirSenhaUseCase`** chamado por uma segunda Server Action: quebraria FR-015 — o formulário salva uma vez e as duas mudanças precisam andar juntas.
- **Transação Postgres envolvendo o `internalAdapter`**: o adapter do better-auth não aceita um executor de transação externo; forçar isso significaria escrever em `account` por fora dele, contrariando D1.

---

## D4 — Encerrar as demais sessões sem derrubar quem executa (FR-016)

**Decisão**: listar os tokens de sessão da conta afetada e chamar `internalAdapter.deleteSessions(tokens)`, **excluindo** o token da sessão de quem executa a operação quando a pessoa redefine a própria senha.

**Rationale**: `internalAdapter.deleteUserSessions(userId)` (`dist/db/internal-adapter.mjs:417`) apaga **todas** as sessões, inclusive a da administradora quando ela redefine a própria senha — o que contraria a assumption explícita do spec ("a sessão de quem executou a ação não é encerrada") e produziria um logout surpresa logo após um sucesso. `deleteSessions(sessionTokens)` (linha 421) permite a exclusão precisa.

**Alternativas rejeitadas**:

- **`deleteUserSessions` sempre**: mais simples, mas derruba a própria administradora no caso de autoatendimento.
- **Não encerrar sessão alguma**: uma senha comprometida continuaria valendo na sessão já aberta — é o cenário que motiva a redefinição.

---

## D5 — Falha ao encerrar sessões não desfaz a redefinição

**Decisão**: a limpeza de sessões roda depois da troca de senha e, se falhar, registra erro estruturado sem reverter a operação nem falhar a resposta ao usuário.

**Rationale**: mesmo racional do Princípio V (auditoria não bloqueante): a senha nova já é o efeito que a administração pediu; recusar a operação inteira porque a limpeza de sessão falhou deixaria a pessoa sem acesso durante uma emergência. A janela residual é limitada pelo tempo de vida da sessão.

---

## D6 — E-mail somente leitura: campo desabilitado, fora do formulário

**Decisão**: no modo edição, exibir o e-mail em um `Input` com `disabled` e **fora** do `register` do react-hook-form (valor vindo direto de `usuario.email`).

**Rationale**: FR-002 e SC-004 — o e-mail não pode chegar à Server Action. Campo desabilitado não é submetido pelo navegador e, não estando registrado no formulário, também não entra no payload do react-hook-form. `esquemaEditar` no servidor continua sem `email`, então mesmo um payload forjado é descartado pelo Zod (defesa em profundidade, Princípio IV). O modo cadastro segue como está (FR-003).

**Alternativas rejeitadas**:

- **`readOnly` em vez de `disabled`**: o valor seria submetido, exigindo confiar no schema como única barreira. O pedido do usuário é explicitamente "campo disabled".
- **Texto simples, sem campo**: perderia o alinhamento visual com os demais campos do formulário e o rótulo associado.

---

## D7 — Revelar o campo de senha: estado local no diálogo

**Decisão**: estado booleano local no `UsuarioFormDialog` (`trocandoSenha`), resetado junto com o `reset()` que já roda ao abrir. A ação "Trocar Senha" entra no slot `acoes` do `Dialog`, à esquerda de Cancelar/Salvar, e alterna para uma ação de cancelar a troca (FR-012). Ao recolher, o valor do campo é limpo.

**Rationale**: FR-007, FR-012 e FR-020. O `Dialog` do design system já expõe `acoes` como rodapé (é onde Cancelar/Salvar vivem hoje), então o pedido "botão no rodapé do dialog/drawer" é atendido sem componente novo. O `useEffect` de `reset` existente já é o ponto natural para zerar o estado a cada abertura — inclusive ao alternar entre duas contas sem fechar o diálogo (edge case do spec).

Validação condicional: o resolver passa a ser escolhido por `modoEdicao` **e** `trocandoSenha`, reusando o mesmo `min(8)` do cadastro (FR-010), com a mensagem já existente.

---

## D8 — Superfície da action e mensagens

**Decisão**: `editarUsuario` continua sendo a única Server Action da edição; `esquemaEditar` ganha `novaSenha: z.string().min(8).optional()`. Nenhuma action nova.

**Rationale**: o formulário salva uma vez (FR-015). A action já revalida sessão e exige `administrador` (FR-014) e já invalida `CACHE_TAGS.identidadeListagem`. Erros de domínio novos (`senha_nao_aplicavel`, conta inexistente) atravessam pelo `ResultadoAction` já em pt-BR, e o diálogo já os exibe via `avisar.erro` + `camposComErro`.

**FR-018 (não vazar a senha)**: a senha não entra em `dadosNovos` da auditoria, não é devolvida pela action e não aparece em log — o único log de erro possível é o de falha de sessão (D5), que não recebe o valor.

---

## D9 — Auditoria da redefinição (FR-019)

**Decisão**: reusar o `withAudit` já presente em `EditarUsuarioUseCase`, acrescentando ao `dadosNovos` a marca `senhaRedefinida: true` (booleano, nunca o valor) quando houve troca.

**Rationale**: Princípio V — nada de chamada de log ad-hoc. `entidade: 'Usuario'`, `acao: 'update'` e `tabela: 'user'` já estão corretos; o registro já carrega `userId`/`userRole` de quem executou (SC-007) e o `entidadeId` da conta afetada. Não é preciso nova `AcaoAuditada` nem nova `EntidadeAuditada`.
