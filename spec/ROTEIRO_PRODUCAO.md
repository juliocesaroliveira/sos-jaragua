# ROTEIRO_PRODUCAO.md — Passos de console para colocar em produção

Passos que **nenhum código resolve**: dependem de console externo (Vercel, Neon,
MongoDB Atlas, Resend, Google Cloud, Meta for Developers) ou de uma decisão da Defesa
Civil. Correspondem aos itens 1 a 6 do `PENDENCIAS.md` (numeração da revisão de
2026-10-01) e foram reunidos pela feature `specs/020-resolver-pendencias` (FR-018).

**Como usar.** Siga na ordem: cada passo depende dos anteriores. Quando um passo estiver
feito **e verificado**, preencha "Feito em" e remova o item correspondente do
`PENDENCIAS.md`. Um passo sem verificação não está feito.

| #   | Passo                                 | Origem                    | Feito em |
| --- | ------------------------------------- | ------------------------- | -------- |
| 1   | Variáveis no projeto Vercel           | PENDENCIAS §5 / DEPLOY-01 | —        |
| 2   | Banco de produção e administrador     | PENDENCIAS §1             | —        |
| 3   | Aplicações OAuth (Google e Facebook)  | PENDENCIAS §2             | —        |
| 4   | E-mail transacional (Resend)          | PENDENCIAS §3             | —        |
| 5   | Usuário restrito do Atlas             | PENDENCIAS §4 / AUD-02    | —        |
| 6   | Cron em produção                      | PENDENCIAS §5 / DEPLOY-02 | —        |
| 7   | Limiares de alerta com a Defesa Civil | PENDENCIAS §6             | —        |

---

## 1. Variáveis no projeto Vercel

- **Pré-requisito:** projeto criado na Vercel e ligado ao repositório.
- **Ação:** cadastrar **todas** as variáveis do `.env.example` nos ambientes _Production_ e
  _Preview_. Atenção especial a:
    - `BETTER_AUTH_URL`: a URL pública de produção, com `https://`. É a base dos callbacks
      OAuth do passo 3.
    - `BETTER_AUTH_SECRET`: gerar um valor novo para produção (`openssl rand -base64 32`).
      Nunca reaproveitar o de desenvolvimento.
    - `CRON_SECRET`: **obrigatória**. Sem ela, a rota do cron recusa **toda** requisição.
      Ela fecha por padrão, de propósito.
    - **Não** cadastrar `SEED_TESTE_PASSWORD` em nenhum ambiente da Vercel. É ela que libera
      as contas `@teste.local` no seed.
    - As variáveis do Google, do Facebook e do Resend podem ficar para os passos 3 e 4.
      Enquanto estiverem vazias, os botões sociais **não aparecem** (feature 020) e o e-mail
      degrada graciosamente.
- **Onde:** Vercel → projeto → _Settings_ → _Environment Variables_.
- **Como verificar:** comparar a lista do painel com o `.env.example`, sem faltar nenhuma.
  Fazer um deploy de _Preview_ e abrir `/login`: a página carrega sem erro 500.

## 2. Banco de produção e administrador

- **Pré-requisito:** passo 1. `DATABASE_URL`/`DATABASE_URL_UNPOOLED` apontando para o banco
  **de produção** do Neon, que é diferente do de desenvolvimento.
- **Ação:**
    1. Aplicar as migrations no banco de produção: `npx drizzle-kit migrate`, com
       `DATABASE_URL_UNPOOLED` de produção no ambiente. Inclui a `0005`, do estoque mínimo
       por item.
    2. Rodar o seed com `ADMIN_EMAIL`, `ADMIN_PASSWORD` (real, forte, fora de qualquer
       arquivo versionado) e `NODE_ENV=production`, **sem** `SEED_TESTE_PASSWORD`:
       `NODE_ENV=production npx tsx db/seed.ts`. O `npm run db:seed` lê o `.env.local`,
       então não serve para produção.
    3. Entrar em produção com o administrador e trocar a senha pela gestão de usuários
       (`/admin`).
    4. Remover `ADMIN_PASSWORD` do ambiente onde o seed rodou.
- **Onde:** terminal local com as credenciais de produção (Neon → _Connection Details_) e
  a aplicação em produção.
- **Como verificar:**
    - Login do administrador funciona em produção.
    - No Neon (SQL Editor de produção), `select email from "user" where email like '%@teste.local' or email = 'admin@sosjaragua.local';`
      retorna **zero linhas**.

## 3. Aplicações OAuth (Google e Facebook)

- **Pré-requisito:** passo 1 (`BETTER_AUTH_URL` definitiva).
- **Ação:**
    - **Google:** em _Google Cloud Console → APIs & Services → Credentials_, criar um _OAuth
      client ID_ do tipo _Web application_, com o redirect URI
      `{BETTER_AUTH_URL}/api/auth/callback/google`. Escopos básicos apenas (nome e e-mail).
      Ver `GOOGLE_AUTH_SETUP.md`.
    - **Facebook:** em _Meta for Developers_, criar o app com _Facebook Login_, com o redirect
      URI `{BETTER_AUTH_URL}/api/auth/callback/facebook`, e publicar o app (modo _Live_).
    - Preencher `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` e
      `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET` na Vercel e fazer novo deploy.
- **Onde:** consoles do Google e da Meta, e Vercel.
- **Como verificar:** em `/login` de produção aparecem os botões dos provedores configurados.
  Entrar com uma conta Google e uma Facebook de teste: a conta é criada com o papel `usuario`
  e cai na área inicial. Um provedor sem credencial completa **não** mostra botão.

## 4. E-mail transacional (Resend)

- **Pré-requisito:** passo 1; acesso ao DNS do domínio remetente.
- **Ação:** criar a conta no Resend, adicionar e **verificar** o domínio remetente
  (registros SPF/DKIM no DNS) e gerar a API key. Preencher `RESEND_API_KEY` e `RESEND_FROM`
  (endereço do domínio verificado) na Vercel e fazer novo deploy.
- **Onde:** painel do Resend, DNS do domínio e Vercel.
- **Como verificar:** disparar um evento que envia e-mail (por exemplo, aprovar uma
  candidatura de teste, que gera `triagem_concluida`). O e-mail chega, e a linha
  correspondente em `notificacao_envio` tem `canal = 'email'` e `status = 'enviado'`.

## 5. Usuário restrito do Atlas

- **Pré-requisito:** cluster de auditoria de produção; `npm run mongo:setup` já executado
  contra ele (cria `audit_logs` e os índices).
- **Ação:**
    1. Em _Atlas → Database Access → Custom Roles_, criar uma role com **apenas** `find` e
       `insert` na coleção `audit_logs` do banco da aplicação.
    2. Criar um usuário de banco dedicado à aplicação com **só** essa role.
    3. Trocar o `MONGODB_URI` de produção na Vercel para esse usuário e fazer novo deploy.
- **Onde:** MongoDB Atlas e Vercel.
- **Como verificar:** com a URI do usuário novo, um `insertOne` em `audit_logs` funciona e um
  `deleteOne`/`updateOne` é **recusado** (`not authorized`). Na aplicação, uma ação auditada
  (por exemplo, registrar uma entrada de estoque) grava o log normalmente.

## 6. Cron em produção

- **Pré-requisito:** passos 1 e 2 (`CRON_SECRET` definido e banco migrado).
- **Ação:** nenhuma configuração extra: o `vercel.json` já agenda
  `GET /api/cron/lembrete-turno` uma vez por dia, às 12:00 UTC (09:00 BRT). O plano Hobby da
  Vercel não aceita mais de uma execução diária.
- **Onde:** Vercel → projeto → _Settings_ → _Cron Jobs_ e _Logs_.
- **Como verificar:** no painel de Cron Jobs, a execução retorna **200**. Na primeira janela
  com um turno começando em cerca de 2h, o _Log Stream_ mostra o lembrete enviado, e os
  voluntários escalados recebem a notificação.

## 7. Limiares de alerta com a Defesa Civil

- **Pré-requisito:** passo 6 (o cron diário reavalia os alertas como rede de segurança).
- **Ação:** definir com a Defesa Civil:
    - `ALERTA_CADASTROS_PENDENTES` (hoje `10`), `ALERTA_ESTOQUE_MINIMO` (o **padrão** para
      itens sem mínimo próprio, hoje `5`) e `ALERTA_DEFICIT_PERCENTUAL` (hoje `80`), e
      atualizar os valores na Vercel;
    - o mínimo de segurança **por item** dos itens mais críticos (água, alimentação,
      higiene), cadastrado pela tabela de `/estoque` (ação "Definir estoque mínimo").
- **Onde:** reunião com a Defesa Civil, Vercel e a tela de estoque em produção.
- **Como verificar:** os valores na Vercel são os combinados. Na tabela de `/estoque`, os
  itens críticos mostram o mínimo próprio em vez de "Padrão (N)". Registrar os valores
  combinados e a data no `spec/DESIGN.md` §17 e retirar a marcação "provisório".
