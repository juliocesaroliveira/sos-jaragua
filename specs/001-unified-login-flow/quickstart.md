# Quickstart: Validando o Fluxo Único de Login

Guia de validação manual — conforme a Constitution Principle III (Verified-Before-Done),
nenhum item de `spec/TASKS.md` relacionado a esta feature deve ser marcado `[x]` sem
passar por este roteiro rodando a aplicação de verdade.

## Pré-requisitos

- `.env.local` preenchido (ver `spec/DESIGN.md` §17 / `spec/TASKS.md` SETUP-02):
  `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET`.
- Migrations de Identidade aplicadas (tabelas `user`, `session`, `account`,
  `verification` do better-auth).
- Ao menos um usuário `administrador` de bootstrap existente (ver `spec/TASKS.md`
  ID-11), para testar login por senha sem depender do fluxo público de candidatura.

## Setup

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Cenários de validação (mapeados às Acceptance Scenarios da spec)

1. **Rota raiz sem sessão** → acessar `/` sem estar logado. Esperado: redirect para
   `/login`. (User Story 1, cenário 1)
2. **Rota interna sem sessão** → acessar diretamente uma URL de staff (ex.:
   `/dashboard`) sem sessão. Esperado: redirect para `/login`, nunca renderiza o
   conteúdo interno. (User Story 1, cenário 2)
3. **Estado inicial da página de login** → em `/login`, confirmar os três botões
   ("Acessar com Google", "Acessar com Facebook", "Usar usuário e senha") visíveis, sem
   campos de e-mail/senha ainda. (User Story 2, cenário 1)
4. **Login social Google** → clicar em "Acessar com Google", completar o fluxo OAuth no
   provedor, confirmar retorno autenticado e redirecionamento à área do papel do
   usuário. (User Story 2, cenário 2)
5. **Login social Facebook** → repetir o item 4 com Facebook. (User Story 2, cenário 3)
6. **Alternar para credenciais** → clicar em "Usar usuário e senha"; confirmar que os
   três botões somem e aparecem os campos de e-mail/senha com "Voltar"/"Acessar"
   abaixo, sem mudança de URL. (User Story 3, cenário 1)
7. **Voltar** → na tela de credenciais, digitar algo nos campos e clicar "Voltar";
   confirmar retorno à tela dos três botões e que os campos, se reaberta a tela de
   credenciais, estão vazios. (User Story 3, cenário 2)
8. **Login por senha bem-sucedido** → preencher e-mail/senha válidos do usuário de
   bootstrap e clicar "Acessar"; confirmar autenticação e redirecionamento por papel.
   (User Story 3, cenário 3)
9. **Login por senha inválido** → preencher credenciais inválidas e clicar "Acessar";
   confirmar mensagem de erro e permanência na tela de credenciais (não deve voltar
   sozinho para a tela de opções). (User Story 3, cenário 4)
10. **Sessão expirada/inatividade** → simular expiração (ajustar `expiresAt` ou aguardar
    `STAFF_INACTIVITY_TIMEOUT_MINUTES`) e navegar para uma rota protegida; confirmar
    redirect para `/login`. (Edge case / FR-003)
11. **Usuário já autenticado acessa `/login`** → com sessão ativa, navegar manualmente
    para `/login`; confirmar redirect imediato para a área do papel, sem exibir a tela
    de login. (Edge case / FR-010)
12. **Falha/cancelamento no provedor social** → iniciar login Google/Facebook e cancelar
    no provedor; confirmar retorno a `/login` na tela de opções com mensagem de erro,
    sem estado intermediário quebrado. (Edge case)

## Critério de aceite da validação

Todos os 12 cenários acima devem passar manualmente antes de marcar as tasks de login
relacionadas em `spec/TASKS.md` como `[x]`.
