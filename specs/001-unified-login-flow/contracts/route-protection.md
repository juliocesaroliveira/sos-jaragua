# Contract: Gate de Rotas (proxy.ts)

Esta feature não expõe uma API pública nova; o "contrato" relevante é o comportamento
observável do gate de navegação aplicado a toda a árvore de rotas da aplicação.

## Classificação de rotas

| Categoria                              | Exemplos                                                        | Exige sessão válida? |
| --------------------------------------- | ----------------------------------------------------------------- | --------------------- |
| Página de login                         | `/login`                                                          | Não                    |
| Endpoints técnicos de autenticação      | `/api/auth/*` (handler better-auth, incl. callbacks OAuth)       | Não                    |
| Assets estáticos                        | `/_next/*`, `favicon.ico`, etc.                                  | Não (fora do escopo de conteúdo navegável) |
| Qualquer outra rota de conteúdo         | `/`, `/dashboard`, `/estoque/*`, `/atividades/*`, etc.            | Sim                    |

## Comportamento do gate

1. **Requisição sem sessão válida para rota protegida** → redirect 302 para `/login`.
   (FR-002)
2. **Sessão com `expiresAt` no passado, ou inatividade de staff acima de
   `STAFF_INACTIVITY_TIMEOUT_MINUTES`** → tratada como sessão inválida; mesmo
   redirecionamento do item 1. (FR-003)
3. **Requisição para `/login` com sessão válida já presente** → redirect para a área
   correspondente ao `role` do usuário (não renderiza a página de login). (FR-010)
4. **Requisição para `/login` sem sessão** → renderiza a página de login normalmente.
5. **Requisição para endpoints técnicos de auth (`/api/auth/*`)** → sempre passa,
   independente de sessão — são parte do próprio mecanismo de login.

## Contrato da página `/login` (client-side)

| Evento                                            | Resultado esperado                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Carregamento inicial (sem sessão)                  | `view = 'options'`; três botões visíveis                                            |
| Clique em "Acessar com Google"                     | Inicia fluxo OAuth do better-auth para `google` (redireciona ao provedor)           |
| Clique em "Acessar com Facebook"                   | Inicia fluxo OAuth do better-auth para `facebook` (redireciona ao provedor)          |
| Clique em "Usar usuário e senha"                   | `view = 'credentials'`; exibe campos e-mail/senha + botões "Voltar"/"Acessar"       |
| Clique em "Voltar" (a partir de `'credentials'`)   | `view = 'options'`; descarta valores digitados e qualquer `error` exibido            |
| Submissão de "Acessar" com credenciais válidas     | Autentica via better-auth (`emailAndPassword`); em sucesso, redireciona por `role`   |
| Submissão de "Acessar" com credenciais inválidas   | Permanece em `view = 'credentials'`; exibe mensagem de erro (FR-009)                |
| Retorno de provedor social com erro/cancelamento   | Volta para `/login` com `view = 'options'` e mensagem de erro (edge case)            |
