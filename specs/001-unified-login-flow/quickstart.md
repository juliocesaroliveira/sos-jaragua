# Quickstart: Validação do Fluxo Unificado de Login

## Pré-requisitos

- `.env.local` configurado com `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET`
  (ver DESIGN.md §17).
- Dependências instaladas (`npm install`) e servidor rodando (`npm run dev`).
- Ao menos um usuário de teste com senha (`email`/`senha`) cadastrado via `/cadastro`, e
  acesso a uma conta Google e/ou Facebook de teste para validar o fluxo social.

## Cenário 1 — Redirecionamento sem sessão (User Story 1)

1. Limpe cookies do navegador (ou use uma aba anônima).
2. Acesse a URL raiz (`/`).
3. **Esperado**: redirecionamento automático para `/login`, exibindo o estado inicial (3
   botões).
4. Repita o passo 2–3 acessando diretamente uma rota interna, ex. `/dashboard` ou
   `/voluntariado/candidatura`.
5. **Esperado**: mesmo redirecionamento para `/login`, sem qualquer conteúdo da rota
   solicitada visível a qualquer momento (nem um flash de conteúdo protegido).

## Cenário 2 — Login social (User Story 2)

1. Na página de login (estado inicial), clique em "Acessar com Google".
2. **Esperado**: início do fluxo OAuth do Google, idêntico ao comportamento anterior a esta
   mudança.
3. Conclua a autenticação com uma conta de teste.
4. **Esperado**: retorno à aplicação com sessão válida, direcionado à área correspondente ao
   papel do usuário.
5. Repita 1–4 com "Acessar com Facebook".

## Cenário 3 — Login com usuário e senha (User Story 3)

1. Na página de login (estado inicial), clique em "Usar usuário e senha".
2. **Esperado**: os 3 botões somem; aparecem os campos de e-mail/senha e os botões "Voltar"
   e "Acessar" — sem mudança de URL.
3. Clique em "Voltar".
4. **Esperado**: retorno ao estado inicial (3 botões); campos limpos.
5. Clique novamente em "Usar usuário e senha", preencha credenciais válidas, clique em
   "Acessar".
6. **Esperado**: autenticação bem-sucedida, redirecionado à área correspondente ao papel do
   usuário.
7. Repita 5 com credenciais inválidas.
8. **Esperado**: mensagem de erro "E-mail ou senha incorretos.", permanece na tela de
   usuário/senha.
9. Repita 5 deixando e-mail ou senha vazios e clicando em "Acessar".
10. **Esperado**: submissão bloqueada, mensagem indicando campo obrigatório, sem chamada de
    rede.

## Cenário 4 — Edge cases

1. Com sessão válida ativa, acesse `/login` diretamente pela URL.
   **Esperado**: redirecionado para a área autenticada correspondente ao papel, sem ver o
   formulário.
2. Na tela de usuário/senha (estado `credenciais`), pressione F5.
   **Esperado**: página recarrega no estado inicial (3 botões) — a alternância é apenas
   estado de UI, não sobrevive a reload.
3. Inicie o fluxo OAuth do Google e cancele/negue permissão na tela do provedor.
   **Esperado**: retorno à página de login no estado inicial, sem sessão criada, sem erro
   travando a navegação.
4. Com sessão staff expirada por inatividade, tente acessar qualquer rota protegida.
   **Esperado**: redirecionado a `/login?motivo=expirado`, com aviso de sessão encerrada por
   inatividade (comportamento já existente, não deve regredir).

## Automação

- Testes unitários cobrindo a classificação de rota (`src/shared/auth/rotas.ts` ou função
  equivalente extraída) para os paths do Cenário 1 e do contrato `routing-gate.md`.
- Teste de componente/interação para `login-form.tsx` cobrindo as transições de `modo`
  descritas em `contracts/login-ui.md` (rodar com `npm test`).
