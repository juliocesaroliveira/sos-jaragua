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

**Estado atual.** `xlsx@0.18.5` instalado do npm. `npm audit` acusa 1
vulnerabilidade alta. Nenhum código de exportação foi escrito ainda — a decisão
ainda não custa retrabalho.

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

**Estado atual.** `/cadastro` implementado (e-mail + senha, `role = 'usuario'`
forçado no servidor). A candidatura pública mostra "Entrar / Criar conta" para
quem chega deslogado.

**Opções.**

- a) Manter `/cadastro` como está e registrar a tela na spec.
- b) Só login social (Google/Facebook) para o público, sem senha própria.
- c) Cadastro por convite/pré-aprovação da Defesa Civil.

**Recomendação.** (a). (b) cria dependência dura de provedor externo em cenário
de crise; (c) contradiz o fluxo de candidatura pública do BRD §3.1.

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
`obterSessao`). **Não marcado `[x]`** no TASKS.md porque a regra do arquivo é só
marcar após exercitar o fluxo, e verificar exige um usuário `coordenador` e
esperar a janela de inatividade.

**Ação necessária.** Criar um usuário `coordenador` de teste, reduzir
`STAFF_INACTIVITY_TIMEOUT_MINUTES` temporariamente (ex.: `1`), confirmar o
redirecionamento para `/login?motivo=expirado` e então marcar ID-06.

---

## 5. Formato do campo `datetime-local` segue o locale do navegador

**Contexto.** DEPLOY-05 exige interface toda em pt-BR. O campo "Início do
primeiro turno" usa `<input type="datetime-local">`, cujo formato de exibição é
definido pelo **locale do sistema/navegador**, não pelo HTML — em um navegador
en-US ele aparece como `mm/dd/yyyy`.

**Estado atual.** Campo nativo, sem controle de formato. Em navegador pt-BR
exibe `dd/mm/aaaa` corretamente.

**Opções.**

- a) Aceitar — o público-alvo usa navegador em pt-BR.
- b) Trocar por `DatePicker` (Ark, já em pt-BR) + um seletor de hora separado.

**Recomendação.** (a) por ora; (b) se aparecer relato de confusão em campo.

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

---

## 9. Não há gestão de usuários/permissões (`/admin`)

**Contexto.** BRD §2 dá ao Administrador "Gestão de usuários e permissões", e
`DESIGN.md` §6.2 reserva o prefixo `/(staff)/admin/*` para isso.

**Estado atual.** A rota está protegida no mapa de roles do `proxy.ts`, mas
**não existe tela**. Hoje só é possível promover alguém a
`membro_defesa_civil`/`coordenador` por SQL direto no banco.

**Ação necessária.** Confirmar se a gestão de usuários entra no MVP. Não há task
correspondente no `TASKS.md` — se entrar, precisa ser adicionada.

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

## 11. Resolução DNS SRV bloqueada na rede de desenvolvimento

**Contexto.** `MONGODB_URI` usa o formato `mongodb+srv://`, que exige consulta
DNS do tipo SRV.

**Estado atual.** O resolvedor DNS desta máquina **recusa** consultas SRV
(`ECONNREFUSED`), embora o registro exista e resolva normalmente por um DNS
público (8.8.8.8). Consequência: em desenvolvimento local a auditoria falha e
degrada graciosamente — as operações de negócio funcionam, mas nada é gravado em
`audit_logs`.

Não afeta produção (a Vercel resolve SRV normalmente).

**Ação necessária.** Para desenvolver com auditoria funcionando, uma das opções:

- trocar o DNS da máquina/roteador para um que responda SRV (8.8.8.8, 1.1.1.1);
- ou usar em `.env.local` a connection string **não-SRV** do Atlas (a mesma
  credencial, com os três hosts do shard explícitos) — equivalente, e é assim
  que a verificação desta seção foi feita.

---

## 12. ~~Degradação graciosa da auditoria~~ — RESOLVIDO

Coberto por teste automatizado na Seção 11
(`src/modules/auditoria/auditoria.test.ts`): o escritor é injetado e falha de
verdade, provando que a operação de negócio prossegue. O teste cobre falha na
escrita do log, falha na leitura de `dadosAnteriores`, falha em `extrair` e —
importante — que um erro da **própria operação** continua subindo, para a
auditoria não virar um `try/catch` geral que engole falhas de negócio.

Pode ser removido deste arquivo.

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
`administrador` menos a área `/admin` (que não existe — ver §9); `voluntario` e
`usuario` só alcançam `/voluntariado/*` e a candidatura pública.

**Ação necessária.** Criar um usuário de cada role restante e repetir o roteiro,
principalmente para confirmar que o timeout de inatividade (§4) se aplica a
`coordenador` e **não** a `voluntario`.
