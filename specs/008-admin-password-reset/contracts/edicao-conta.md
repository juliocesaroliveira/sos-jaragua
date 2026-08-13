# Contrato de servidor: edição de conta com redefinição de senha

**Feature**: 008-admin-password-reset

Superfície: a Server Action `editarUsuario` já existente. **Nenhuma action nova, nenhum Route Handler, nenhuma migração.**

---

## S-01 — `editarUsuario`

```ts
editarUsuario(entrada: unknown): Promise<ResultadoAction<{ id: string }>>
```

- **S-01.1**: `esquemaEditar` ganha `novaSenha: z.string().min(8, …).optional()`. Continua **sem** `email` — mesmo um payload forjado com e-mail é descartado pelo Zod (FR-002, SC-004).
- **S-01.2**: `novaSenha` ausente ou `undefined` significa "não mexer na senha". String vazia é entrada **inválida**, não sinônimo de ausente (FR-011).
- **S-01.3**: a action mantém a revalidação de sessão e a exigência de `administrador` que já faz hoje — Server Actions não herdam o gate da página (FR-014, Princípio IV).
- **S-01.4**: em caso de sucesso, mantém `updateTag(CACHE_TAGS.identidadeListagem)` + `revalidateTag(...)` já existentes, para que a listagem reflita a mudança de nome/papel.
- **S-01.5**: a senha **não** aparece na resposta, em `avisar`, em log ou em qualquer mensagem de erro (FR-018).

## S-02 — `EditarUsuarioUseCase`

```ts
executar({ id, nome, role, novaSenha? }): Promise<Result<{ id }, DomainError>>
```

Ordem de execução, quando `novaSenha` está presente:

1. `buscarRole(id)` — conta inexistente → `NaoEncontradoError` (comportamento atual, preservado).
2. `possuiSenhaPropria(id)` — `false` → `DomainError('senha_nao_aplicavel', 'Esta conta acessa o sistema por Google ou Facebook e não possui senha para trocar.')`.
3. `definirSenha(id, novaSenha)`.
4. `atualizarNomeERole(id, { nome, role })`, dentro do `withAudit` já existente.
5. `encerrarSessoes(id, exceto: <sessão de quem executa>)`.

- **S-02.1**: a validação de S-02.2 acontece **antes** de qualquer escrita — nada é alterado quando a conta não pode ter senha (FR-013, FR-015).
- **S-02.2**: senha antes de papel é deliberado: a escrita mais sujeita a falhar vem primeiro, então uma falha dela deixa a conta exatamente como estava (research D3).
- **S-02.3**: sem `novaSenha`, o caminho é idêntico ao de hoje — nem `possuiSenhaPropria` nem `definirSenha` são chamados (FR-008).
- **S-02.4**: falha em `encerrarSessoes` **não** desfaz nem falha a operação; é registrada em log estruturado (research D5, mesmo racional do Princípio V).
- **S-02.5**: `dadosNovos` da auditoria recebe `senhaRedefinida: true` quando houve troca — nunca o valor da senha (FR-019).

## S-03 — Port `AutenticacaoService`

```ts
definirSenha(userId: string, senha: string): Promise<void>
encerrarSessoes(userId: string, exceto?: string): Promise<void>
```

- **S-03.1**: `definirSenha` atualiza a senha de uma conta `credential` existente e **não** cria uma quando não há. Diverge de propósito do plugin `admin` do better-auth, que cria — aqui, criar seria violar FR-005.
- **S-03.2**: o hash é produzido pelo better-auth (`ctx.password.hash`), nunca por código deste projeto — mesma regra já registrada para `criarConta`.
- **S-03.3**: `encerrarSessoes` remove as sessões da conta, preservando o token passado em `exceto`. Sem `exceto`, remove todas.
- **S-03.4**: `application` não conhece better-auth — só este contrato (Princípio I).

## S-04 — Port `UsuarioRepository`

```ts
possuiSenhaPropria(userId: string): Promise<boolean>
```

- **S-04.1**: `true` quando existe linha em `account` com `providerId = 'credential'` e `password` não nulo.
- **S-04.2**: conta com senha **e** provedor externo devolve `true` — a redefinição afeta só a senha, e o login social continua funcionando (edge case do spec).
- **S-04.3**: `listar` passa a projetar `podeTrocarSenha` por linha, com o mesmo predicado, sem consulta adicional por linha (subconsulta correlacionada, como já é feito para habilidades em `voluntariado`).
- **S-04.4**: nenhum outro módulo lê `account` — Identidade é a dona (Princípio I).

## S-05 — Erros

| Situação                              | Resposta                                                |
| ------------------------------------- | ------------------------------------------------------- |
| sem sessão ou papel ≠ `administrador` | `erroAction('nao_autorizado', …)` — comportamento atual |
| `novaSenha` com menos de 8 caracteres | erro de validação, mensagem no campo, nada gravado      |
| `novaSenha` vazia com a troca ativa   | erro de validação, nunca "sem troca"                    |
| conta inexistente                     | `NaoEncontradoError`, mensagem pt-BR                    |
| conta sem senha própria               | `senha_nao_aplicavel`, mensagem pt-BR, nada gravado     |
| falha ao gravar a senha               | operação falha; nome e papel permanecem como estavam    |
| falha ao encerrar sessões             | operação **sucede**; falha registrada em log            |
