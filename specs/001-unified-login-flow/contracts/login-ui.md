# Contract: UI da Página de Login (`app/(auth)/login/`)

Contrato de comportamento observável da página de login, incluindo o Server Component
(`page.tsx`) e o Client Component (`login-form.tsx`).

## `page.tsx` (Server Component)

| Situação                                           | Comportamento                                                                                                                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requisição chega com sessão válida já estabelecida | `redirect()` para a área correspondente ao papel do usuário (ex.: `/dashboard` para staff, `/voluntariado/minhas-atividades` para voluntário) — nunca renderiza o formulário (FR-003). |
| Requisição sem sessão válida                       | Renderiza `LoginForm` no estado inicial (`modo: 'opcoes'`).                                                                                                                            |

## `login-form.tsx` (Client Component) — estados

### Estado `opcoes` (inicial)

- Exibe exatamente 3 controles, nesta ordem: "Acessar com Google", "Acessar com Facebook",
  "Usar usuário e senha" (FR-004).
- Clique em "Acessar com Google" ou "Acessar com Facebook" → chama `signIn.social({ provider,
callbackURL })` — **inalterado** em relação ao comportamento atual (FR-005). Nenhuma
  mudança de código nesse caminho além de, se necessário, mover a chamada para dentro do novo
  componente sem alterar sua lógica.
- Clique em "Usar usuário e senha" → transição local para `modo: 'credenciais'`, sem
  navegação (FR-006, FR-011).

### Estado `credenciais`

- Exibe campos "E-mail" e "Senha" (já existentes) + dois botões: "Voltar" e "Acessar".
- "Voltar" → transição local para `modo: 'opcoes'`; campos do formulário são descartados
  (FR-007).
- "Acessar" com campo(s) obrigatório(s) vazio(s) → submissão bloqueada no client, mensagens
  de campo obrigatório exibidas (FR-010); nenhuma chamada de rede.
- "Acessar" com credenciais preenchidas e válidas → `signIn.email({ email, password })`,
  sucesso → navega para o destino pós-login (FR-008).
- "Acessar" com credenciais preenchidas e inválidas → mensagem de erro genérica exibida
  (`"E-mail ou senha incorretos."`, já existente), usuário permanece em `modo: 'credenciais'`
  (FR-009).

## Verificação

Ver `quickstart.md` para o roteiro de validação manual ponta a ponta (ambos os estados +
ambos os fluxos OAuth + fluxo de credenciais + edge cases de F5 e usuário já autenticado).
