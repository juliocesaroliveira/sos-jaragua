# PENDENCIAS.md — Decisões e ações em aberto

Pontos que **não se resolvem lendo `spec/` nem escrevendo código no repositório**: dependem
de console externo, de verificação num ambiente com banco ou de decisão de negócio. Cada
item traz o contexto, o estado atual conferido contra o repositório e o próximo passo.

**Responsável** indica quem destrava o item:

- **operação**: passo de console externo, descrito em ordem no
  [roteiro de produção](spec/ROTEIRO_PRODUCAO.md);
- **negócio**: decisão da Defesa Civil;
- **código (verificação)**: o código está pronto, mas falta exercitar o fluxo num ambiente
  com o banco de desenvolvimento.

Quando um item for resolvido, registre a decisão no documento de spec correspondente
(`spec/DESIGN.md` §19 é o lugar natural para decisões arquiteturais) e remova a entrada
daqui.

Última revisão completa: 2026-10-01, pela feature `specs/020-resolver-pendencias`. Os
itens resolvidos naquela revisão (planilhas com `exceljs`, rota pública de cadastro
fechada, botões sociais condicionados, estoque mínimo por item, gestão de usuários,
formato de data, DNS SRV, degradação da auditoria e vulnerabilidades de dependência)
estão registrados no `spec/DESIGN.md` §19.

---

## 1. Administrador de produção

**Responsável:** operação.

Definir a credencial real do administrador em produção e garantir que nenhuma conta de
desenvolvimento (`admin@sosjaragua.local`, `*@teste.local`) exista no banco de produção. O
seed só cria as contas `@teste.local` com `SEED_TESTE_PASSWORD` definido, e recusa essa
variável com `NODE_ENV=production`.

**Ação necessária:** [roteiro de produção, passo 2](spec/ROTEIRO_PRODUCAO.md#2-banco-de-produção-e-administrador).

---

## 2. Aplicações OAuth (Google e Facebook)

**Responsável:** operação.

`GOOGLE_CLIENT_ID/SECRET` e `FACEBOOK_CLIENT_ID/SECRET` continuam vazios. Desde a feature
020, os botões de um provedor sem credencial completa **não aparecem**, e a tela de login
abre direto no formulário de e-mail e senha. Mas o login social é o **único** auto-cadastro
público (DESIGN.md §19), então, até este passo ser feito, toda conta nova depende de um
administrador no `/admin`.

**Ação necessária:** [roteiro de produção, passo 3](spec/ROTEIRO_PRODUCAO.md#3-aplicações-oauth-google-e-facebook).

---

## 3. E-mail transacional (Resend)

**Responsável:** operação.

Nada está quebrado: sem `RESEND_API_KEY`, o canal de e-mail degrada graciosamente, a
notificação aparece no sino e `notificacao_envio` registra `canal='email', status='falhou'`
para reconciliação. Mas hoje nenhum voluntário recebe e-mail.

**Ação necessária:** [roteiro de produção, passo 4](spec/ROTEIRO_PRODUCAO.md#4-e-mail-transacional-resend).

---

## 4. AUD-02 — usuário restrito do Atlas

**Responsável:** operação.

BR-AUD-01 exige que o log de auditoria não seja apagável. A camada de código está pronta:
o repositório nunca expõe update/delete sobre `audit_logs`. Falta a camada de banco: o
usuário do Atlas usado pela aplicação ainda é administrativo e pode apagar documentos.

**Ação necessária:** [roteiro de produção, passo 5](spec/ROTEIRO_PRODUCAO.md#5-usuário-restrito-do-atlas).

---

## 5. DEPLOY-01 e DEPLOY-02 — variáveis e cron na Vercel

**Responsável:** operação.

O código está pronto: `.env.example` lista todas as variáveis, `vercel.json` agenda
`GET /api/cron/lembrete-turno` uma vez por dia (12:00 UTC = 09:00 BRT) e a rota foi
verificada localmente (401 sem token, 200 com token, dedupe correto). Falta configurar o
projeto Vercel e validar o cron em produção.

**Ação necessária:** [roteiro de produção, passos 1 e 6](spec/ROTEIRO_PRODUCAO.md#1-variáveis-no-projeto-vercel).

---

## 6. Valores dos limiares de alerta

**Responsável:** negócio (Defesa Civil).

A mecânica dos três alertas de coordenador (BRD §6, NOT-08) está implementada, e desde a
feature 020 o estoque mínimo é **por item**, com fallback para o padrão global. O que falta
é a Defesa Civil definir os **valores**, hoje provisórios:

| Variável                     | Default | Alerta                                           |
| ---------------------------- | ------- | ------------------------------------------------ |
| `ALERTA_CADASTROS_PENDENTES` | `10`    | `cadastros_acumulados`                           |
| `ALERTA_ESTOQUE_MINIMO`      | `5`     | `estoque_critico`, para itens sem mínimo próprio |
| `ALERTA_DEFICIT_PERCENTUAL`  | `80`    | `deficit_atendimento`                            |

Além disso, os mínimos próprios dos itens mais críticos (água, alimentação, higiene),
cadastrados pela tela de `/estoque`.

**Ação necessária:** [roteiro de produção, passo 7](spec/ROTEIRO_PRODUCAO.md#7-limiares-de-alerta-com-a-defesa-civil).

---

## 7. Verificações que exigem o banco de desenvolvimento

**Responsável:** código (verificação).

O código destes fluxos está pronto e coberto por testes unitários, mas falta exercitá-los
num ambiente com o banco de desenvolvimento (`.env.local`) e os usuários de teste por papel
(`npm run db:seed` com `SEED_TESTE_PASSWORD`; tabela em
`specs/002-role-based-app-shell/quickstart.md`). O roteiro detalhado de cada um está em
`specs/020-resolver-pendencias/quickstart.md`.

| Verificação                                                                      | Roteiro | Fecha                        |
| -------------------------------------------------------------------------------- | ------- | ---------------------------- |
| Aplicar a migration `0005` (estoque mínimo) com `npm run db:migrate`             | V4.1    | T025 da feature 020          |
| `npm run test:integracao` (inclui `cadastro-publico` e `criar-usuario`)          | V2      | T024 da feature 020          |
| Planilhas exportadas antes e depois da troca para `exceljs` têm o mesmo conteúdo | V1      | T017 da feature 020          |
| Estoque mínimo por item: tabela, Entrada, alerta no sino e auditoria             | V4      | T044 da feature 020          |
| `npm run build` completo (a pré-renderização consulta o banco)                   | V0      | T054 da feature 020          |
| **ID-06**: timeout de inatividade expira `coordenador` e **não** `voluntario`    | V5      | ID-06 no `spec/TASKS.md`     |
| **DEPLOY-06**: matriz de acesso com `coordenador`, `voluntario` e `usuario`      | V6      | DEPLOY-06 no `spec/TASKS.md` |

Sobre o ID-06: a implementação foi corrigida em 2026-09-24. Antes, o carimbo de
atividade só era gravado no primeiro minuto após o login e o staff ativo era deslogado
cerca de 15 minutos depois. Agora o proxy renova o cookie cache e o reemite a cada carimbo
(DESIGN.md §6.2.1).

Sobre o DEPLOY-06: já verificado com `administrador` (fluxos completos) e com
`membro_defesa_civil` (matriz das 13 rotas protegidas). Pelo código, `coordenador` tem as
permissões de `administrador` menos o `/admin`, e `voluntario`/`usuario` só alcançam
`/voluntariado/*` e a candidatura.

**Ação necessária:** executar o quickstart da feature 020 (V0–V6) num ambiente com
`.env.local`, marcar as tasks correspondentes e remover cada linha da tabela à medida que
for verificada.
