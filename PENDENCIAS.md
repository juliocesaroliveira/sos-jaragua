# PENDENCIAS.md — Decisões em aberto

Pontos que **dependem de decisão do time** e que não podem ser resolvidos lendo
`spec/`. Cada item traz o contexto, o que foi feito por ora e as opções.

Quando um item for decidido, aplique a decisão no código, registre-a no
documento de spec correspondente (`DESIGN.md` §19 é o lugar natural para
decisões arquiteturais) e remova a entrada daqui.

---

## 1. `xlsx` (SheetJS) com vulnerabilidade alta conhecida

**Contexto.** `DESIGN.md` §16 e as tasks REL-01/REL-02/CON-01 fixam `xlsx`
(SheetJS) como biblioteca de planilhas. A versão publicada no npm
(`xlsx@0.18.5`) é a última do registro público e tem CVE de severidade alta
(prototype pollution / ReDoS). O SheetJS parou de publicar no npm: as versões
corrigidas saem apenas pelo CDN próprio (`https://cdn.sheetjs.com`).

**Estado atual (2026-10-01).** `xlsx@0.18.5` ainda instalado do npm, e o código de
exportação **já existe**: `src/modules/contingencia/infrastructure/planilha.ts`, usado
pelos relatórios e pelo pacote de contingência.

**Decidido: opção (b) `exceljs`**, contra a recomendação abaixo (decisão Q1 de
`specs/020-resolver-pendencias`, registrada no `DESIGN.md` §19 e na constituição 1.0.1).
A troca está sendo feita pela feature 020.

**Opções.**

| Opção                                            | Prós                                | Contras                                                                     |
| ------------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------- |
| a) Instalar do CDN do SheetJS (versão corrigida) | Mantém a decisão da spec; sem CVE   | Dependência fora do registro público; exige `.npmrc`/lockfile diferenciado  |
| b) Trocar por `exceljs`                          | Publicado no npm, mantido, API rica | Diverge da spec; pacote maior                                               |
| c) Manter `xlsx@0.18.5` como está                | Zero trabalho                       | Vulnerabilidade conhecida em código que processa arquivo gerado no servidor |

**Recomendação.** (a) — é a que respeita a spec e elimina o CVE. O vetor de
ataque é baixo aqui (só **geramos** planilhas, não lemos arquivo de terceiro),
mas o alerta de auditoria vai reaparecer em todo CI.

**Bloqueia:** REL-01, REL-02, CON-01.

---

## 2. Tela de criação de conta (`/cadastro`) não prevista no TASKS.md

**Contexto.** O `TASKS.md` prevê apenas a tela de login (ID-12). Mas
`voluntario_perfil.userId` é `NOT NULL` e o BRD §2 define "Usuário (Comum)" como
**conta autenticada** — sem uma forma de criar conta, ninguém chega ao formulário
de candidatura, e o fluxo BR-VOL-01 fica inalcançável na prática.

**Opções.**

- a) Manter `/cadastro` como está e registrar a tela na spec.
- b) Só login social (Google/Facebook) para o público, sem senha própria.
- c) Cadastro por convite/pré-aprovação da Defesa Civil.

**Recomendação original.** (a). (b) cria dependência dura de provedor externo em
cenário de crise; (c) contradiz o fluxo de candidatura pública do BRD §3.1.

## ✅ RESOLVIDO — opção (b), em 2026-08-16

`/cadastro` foi **removida da aplicação** por decisão do responsável, contra a
recomendação acima. O auto-cadastro público passa a ser exclusivamente o login
social de `specs/011-auto-cadastro-provedor`, que cria a conta na primeira
autenticação por Google ou Facebook. Contas com senha nascem apenas em `/admin`.

Removidos: `app/(publico)/cadastro/`, o botão "Criar conta" da candidatura
(`app/(interno)/voluntariado/candidatura/page.tsx`) e o convite ao cadastro na
tela de login.

**A ressalva da recomendação original continua valendo e vira risco aceito**: com
Google e Facebook fora do ar, ou com um voluntário que não tenha conta em nenhum
dos dois, não existe caminho de auto-cadastro — a entrada depende de um
administrador criar a conta manualmente. Em cenário de crise, com mobilização
súbita de voluntários novos, esse gargalo é uma pessoa.

**Resíduo em fechamento (2026-10-01)**: a feature 020 (`specs/020-resolver-pendencias`,
decisão Q2) fecha a rota pública com `disabledPaths`, mantendo a criação de contas pelo
`/admin`. O texto abaixo descreve o estado anterior.

**Também não fechado por esta remoção**: o endpoint `POST /api/auth/sign-up/email`
do better-auth continua ativo, porque `auth.api.signUpEmail` é o que `/admin` usa
para criar contas. Ou seja, a capacidade de auto-cadastro por senha ainda existe
via API, só não tem mais interface. Fechá-la exige separar o caminho do admin do
caminho público — decisão à parte, ainda não tomada.

---

## 3. Senha do administrador de bootstrap

**Contexto.** `DB_SCHEMA.md` §14 pede um usuário `administrador` inicial criado
fora do fluxo público. O seed (`npm run db:seed`) cria esse usuário a partir de
`ADMIN_EMAIL` / `ADMIN_PASSWORD`.

**Estado atual.** No banco de desenvolvimento existe
`admin@sosjaragua.local` com a senha `TrocarEssaSenha123`, usada para validar os
fluxos. Credenciais: e-mails usuario1@teste.local … defesa-civil1@teste.local (tabela completa no quickstart.md), senha SosJaragua@2026.

**Ação necessária.** Definir a credencial real do administrador em produção e
trocar/remover a de desenvolvimento. Não versionar a senha.

---

## 4. ID-06 — timeout de inatividade sem verificação prática

**Contexto.** `NFR` §3 / `DESIGN.md` §6.3: sessões de
`membro_defesa_civil`/`coordenador` expiram por inatividade.

**Estado atual.** Implementado (`session.lastActivityAt` atualizado no
`proxy.ts` com throttle de 1 min; expiração checada no proxy e em
`obterSessao`). **Corrigido em 2026-09-24:** antes o carimbo só era gravado no
primeiro minuto após o login — o cookie cache (60s) nunca era renovado, e o
proxy pulava o carimbo sem ele —, o que deslogava staff ativo ~15 min depois.
Agora o proxy renova o cookie cache e o reemite a cada carimbo
(DESIGN.md §6.2.1). **Não marcado `[x]`** no TASKS.md porque a regra do arquivo é só
marcar após exercitar o fluxo, e verificar exige um usuário `coordenador` e
esperar a janela de inatividade.

**Ação necessária.** Criar um usuário `coordenador` de teste, reduzir
`STAFF_INACTIVITY_TIMEOUT_MINUTES` temporariamente (ex.: `1`), confirmar o
redirecionamento para `/login?motivo=expirado` e então marcar ID-06.

---

## 6. Sem provedor de e-mail configurado

**Contexto.** `DESIGN.md` §12 define dois canais de notificação: in-plataforma e
e-mail (Resend). O catálogo de eventos (BRD §6) pressupõe e-mail para
`triagem_concluida`, `atividade_atribuida`, `alteracao_atividade` e
`broadcast_urgencia`.

**Estado atual.** Os **dois** adapters estão implementados (NOT-03). Sem
`RESEND_API_KEY` configurada, o canal de e-mail degrada graciosamente: a
notificação continua sendo gravada e aparece no sino, e `notificacao_envio`
registra `canal='email', status='falhou'` para reconciliação posterior —
comportamento já verificado em desenvolvimento.

Ou seja: **nada está quebrado**, mas hoje nenhum voluntário recebe e-mail.

**Ação necessária.** Criar a conta Resend, verificar o domínio remetente e
preencher `RESEND_API_KEY` / `RESEND_FROM`.

---

## 7. Credenciais de login social ausentes

**Contexto.** `DESIGN.md` §6.1: Google + Facebook no MVP (Instagram adiado).

**Estado atual.** Os botões existem na tela de login e o better-auth está
configurado, mas `GOOGLE_CLIENT_ID/SECRET` e `FACEBOOK_CLIENT_ID/SECRET` estão
vazios — clicar nos botões falha.

**Ação necessária.** Criar as aplicações OAuth (Google Cloud Console / Meta for
Developers), cadastrar as URLs de callback
(`{BETTER_AUTH_URL}/api/auth/callback/{google,facebook}`) e preencher as
variáveis. Enquanto isso, considerar esconder os botões em produção.

---

## 8. Limiar dos alertas de coordenador ainda não definido

**Contexto.** BRD §6 prevê três alertas: `cadastros_acumulados` ("Existem X
cadastros aguardando"), `estoque_critico` ("O item [Nome] atingiu o estoque
mínimo de segurança") e `deficit_atendimento` ("capacidade X% abaixo da
demanda"). `DESIGN.md` §12 define que são gerados **em leitura**, de forma
idempotente.

**Estado atual.** A **mecânica está implementada e funcionando** (NOT-08): os
três alertas são gerados em leitura, são idempotentes (uma emissão por condição
ativa a cada 12h) e vão só pelo canal in-app. O que continua indefinido são os
**valores** — hoje lidos de variável de ambiente, com defaults provisórios:

| Variável                     | Default | Alerta                 |
| ---------------------------- | ------- | ---------------------- |
| `ALERTA_CADASTROS_PENDENTES` | `10`    | `cadastros_acumulados` |
| `ALERTA_ESTOQUE_MINIMO`      | `5`     | `estoque_critico`      |
| `ALERTA_DEFICIT_PERCENTUAL`  | `80`    | `deficit_atendimento`  |

**Ação necessária.** Definir, com a Defesa Civil:

- os três valores acima;
- principalmente: se "estoque mínimo de segurança" deve ser **por item** (o BRD
  diz "O item [Nome] atingiu o estoque mínimo"), o que exigiria uma coluna nova
  em `item` e uma migration. Hoje o limiar é **global** — 5 unidades de arroz e
  5 unidades de cobertor disparam o mesmo alerta, o que provavelmente não é o
  que a operação quer.

**Não bloqueia mais NOT-08**, mas o limiar global é a limitação conhecida.

**Atualização (2026-10-01).** A pergunta "por item ou global" foi decidida: **por item**,
com fallback para o limiar global (decisão Q3 de `specs/020-resolver-pendencias`,
implementada pela feature 020). Continua pendente com a Defesa Civil só a definição dos
**valores**: os três defaults acima e os mínimos dos itens mais críticos.

---

## 10. AUD-02 — grants do usuário do Atlas ainda não restritos

**Contexto.** BR-AUD-01 exige que o log de auditoria "não seja apagável".
`DB_SCHEMA.md` §9 garante isso em duas camadas: (1) o repositório da aplicação
nunca expõe update/delete sobre `audit_logs` — **implementado**; e (2) o usuário
do Atlas usado pela aplicação deve ter grant de insert/find, mas **não** de
update/delete. O RBAC do Postgres não tem jurisdição sobre o Mongo.

**Estado atual.** A camada (1) está pronta. A camada (2) **não** — o usuário
atual (`Vercel-Admin-atlas-sos-jrg`) é administrativo e pode apagar documentos.
`npm run mongo:setup` imprime o lembrete ao final.

**Ação necessária.** No Atlas: criar um usuário dedicado à aplicação com um
custom role que conceda apenas `find` e `insert` na coleção `audit_logs`, e
trocar o `MONGODB_URI` de produção para esse usuário. É um passo de console, não
de código.

---

## 13. DEPLOY-01 e DEPLOY-02 — dependem de um deploy real na Vercel

**Contexto.** DEPLOY-01 pede as variáveis de `DESIGN.md` §17 configuradas no
projeto Vercel (produção e preview); DEPLOY-02 pede a validação do cron de
lembrete de turno rodando em produção.

**Estado atual.** Nenhum dos dois foi feito — são ações no painel da Vercel, não
código. O que existe pronto:

- `.env.example` lista **todas** as variáveis necessárias, incluindo as três de
  limiar de alerta;
- `vercel.json` já agenda `GET /api/cron/lembrete-turno` 1x por dia (12:00 UTC =
  09:00 BRT) — o plano Hobby da Vercel não aceita mais de uma execução diária;
- a rota do cron foi verificada localmente (401 sem token, 200 com o token, e
  dedupe correto entre execuções).

**Ação necessária.**

1. Configurar no projeto Vercel todas as variáveis do `.env.example`. Atenção a
   `CRON_SECRET`: sem ela, a rota do cron recusa **toda** requisição (fecha por
   padrão, de propósito).
2. Após o primeiro deploy, conferir no painel de Cron Jobs da Vercel que a
   execução está retornando 200 e acompanhar o Log Stream na primeira janela em
   que houver turno começando em ~2h.

---

## 14. DEPLOY-06 — verificação end-to-end parcial

**Contexto.** DEPLOY-06 pede percorrer cada BR-code do BRD §3–§7 com um usuário
de cada role.

**Estado atual.** Verificado com **`administrador`** (fluxos completos de
candidatura, triagem, atividades, alocação, estoque, kits, saída com e sem
déficit, descarte, painel, notificações, relatórios e contingência) e com
**`membro_defesa_civil`** (matriz de acesso às 13 rotas protegidas, conferida
contra o BRD §2).

**Não verificados com usuário próprio:** `coordenador`, `voluntario` e `usuario`.
Pelo código, `coordenador` tem exatamente as permissões testadas com
`administrador` menos a área `/admin` (que existe desde a feature 006 e é exclusiva de
`administrador`); `voluntario` e
`usuario` só alcançam `/voluntariado/*` e a candidatura pública.

**Ação necessária.** Criar um usuário de cada role restante e repetir o roteiro,
principalmente para confirmar que o timeout de inatividade (§4) se aplica a
`coordenador` e **não** a `voluntario`.

---

## Vulnerabilidades de dependência

**Contexto.** Na validação de 2026-10-01 (`specs/020-resolver-pendencias`, research D5),
`npm audit --omit=dev` acusava, além do `xlsx` (§1):

| Pacote        | Severidade | Aplicabilidade à produção                                            | Situação                                     |
| ------------- | ---------- | -------------------------------------------------------------------- | -------------------------------------------- |
| `next`        | crítica    | RCE só em servidores **Windows**; a Vercel roda Linux, não se aplica | Corrigido: `16.3.0 → 16.3.8`                 |
| `sharp`       | alta       | libheif; imagens são estáticas do próprio projeto                    | Corrigido: `^0.35.3 → ^0.35.5`               |
| `vitest`      | moderada   | ferramenta de teste, sem caminho em runtime                          | Corrigido: `^4.1.10 → ^4.1.11`               |
| `better-auth` | moderada   | apontado só por declarar `vitest` como peer                          | Corrigido junto com o `vitest`               |
| `drizzle-kit` | moderada   | ferramenta de dev (`esbuild` antigo via `@esbuild-kit/*`)            | **Aceito**: a correção exige downgrade major |

**Estado atual.** Não há vulnerabilidade alta ou crítica com correção disponível, exceto o
`xlsx` (§1), em substituição. As moderadas do `drizzle-kit` ficam aceitas: não chegam ao
runtime da aplicação.

**Também corrigido**: o `package-lock.json` estava fora de sincronia com o `package.json`
(`npm ci` falhava com `Missing: esbuild@0.28.2 from lock file`). Ele foi regenerado e
validado com `npm ci` no npm 10 e no npm 11.
