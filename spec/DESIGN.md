# Documento de Design Técnico (DESIGN.md)

## Projeto: SOS Jaraguá — Gestão e Mobilização em Situações de Emergência

Este documento traduz o `REQUISITOS_NEGOCIO.md` (BRD) e o `REQUISITOS_NAO_FUNCIONAIS.md`
(NFR) em decisões técnicas concretas: módulos, camadas, estrutura de pastas, estratégias de
cache/autenticação/auditoria e o desenho de cada fluxo de negócio. É a referência que guia
a implementação — toda decisão arquitetural relevante deve estar documentada aqui antes de
virar código. O modelo de dados correspondente está em `DB_SCHEMA.md`.

---

## 1. Visão Geral

O SOS Jaraguá é construído como um **monolito modular Next.js 16 (App Router)**, unificando
frontend e backend em uma única aplicação, hospedado na Vercel. A organização interna segue
**Domain-Driven Design (DDD)** e **Clean Architecture**, isolando os domínios críticos
(Voluntariado e Assistência Humanitária/Estoque) em módulos independentes — mandato do NFR
§1, não uma escolha em aberto.

Stack confirmada: Next.js 16.3.0 (App Router, Turbopack), React 19.1.1, TypeScript estrito,
**Drizzle ORM** sobre **Neon Postgres**, **MongoDB Atlas** dedicado a auditoria imutável,
**better-auth** para autenticação, **TanStack Query** + Server Actions para dados
client-side, **TanStack Table** com paginação server-side, **Ark UI + Tailwind CSS v4** para
o design system, **Resend** para e-mail transacional, **xlsx (SheetJS)** para geração de
planilhas.

---

## 2. Contexto Arquitetural

- **Monolito Modular**: uma única aplicação deployável, sem microsserviços — adequado ao
  porte da equipe e à necessidade de baixa complexidade operacional em cenário de crise.
- **DDD**: o domínio é dividido em _bounded contexts_ (§3) com linguagem ubíqua própria
  (`Candidatura`, `Turno`, `Kit`, `Receita`, `Saldo`); um contexto não acessa tabelas de
  outro diretamente, apenas via _ports_ (interfaces) expostas por seus casos de uso.
- **Clean Architecture**: dependências apontam sempre para dentro — `domain` não conhece
  Next.js, Drizzle ou Mongo; `infrastructure` implementa interfaces definidas em
  `application`; `presentation` (Server Actions/Route Handlers) é a camada mais externa e a
  mais fina (§4).

---

## 3. Bounded Contexts (Módulos DDD)

| Módulo                      | Responsabilidade                                       | Entidades-chave                                 | Tabelas Postgres                                                                                         | Depende de (via ports)                                                           |
| --------------------------- | ------------------------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Identidade**              | Autenticação, sessão, roles, perfil de voluntário      | `Usuario`, `PerfilVoluntario`, `Habilidade`     | `user`, `session`, `account`, `verification`, `voluntario_perfil`, `habilidade`, `voluntario_habilidade` | — (módulo base)                                                                  |
| **Voluntariado**            | Candidatura, triagem, atividades, turnos, alocação     | `Candidatura`, `Atividade`, `Turno`, `Alocacao` | `atividade_categoria`, `atividade`, `turno`, `alocacao`                                                  | Identidade (perfil/habilidades)                                                  |
| **Estoque/Doações**         | Entrada, kits, saída, descarte, saldo                  | `Item`, `Entrada`, `Kit`, `Saida`, `Descarte`   | `item`, `entrada`, `kit`, `kit_receita_item`, `saida`, `saida_item`, `descarte`, `saldo_estoque`         | Identidade (autor da operação)                                                   |
| **Logística/Inteligência**  | Variáveis de crise, projeção de demanda vs. capacidade | `CriseVariaveis`, `MetricaKit`                  | `crise_variaveis`, `metrica_kit`                                                                         | Estoque (saldo/receitas), Voluntariado — somente leitura via ports               |
| **Notificações**            | Disparo e registro de eventos de comunicação           | `Notificacao`, `NotificacaoEnvio`               | `notificacao`, `notificacao_envio`                                                                       | Identidade (destinatário); cross-cutting, assinado pelos demais módulos          |
| **Auditoria**               | Log imutável de CRUD em entidades críticas             | `AuditLog` (Mongo)                              | — (Mongo `audit_logs`)                                                                                   | Identidade (ator); cross-cutting, invocado como wrapper pelos módulos de escrita |
| **Contingência/Relatórios** | Exportação CSV/XLSX e pacote offline                   | — (sem entidades próprias)                      | —                                                                                                        | Estoque, Voluntariado — orquestrador read-only                                   |

**Regra de dependência**: Logística e Contingência nunca importam repositórios internos de
Estoque/Voluntariado — apenas os _ports_ (`EstoqueQueryPort`, `VoluntariadoQueryPort`) que
esses módulos expõem. Isso preserva o isolamento mesmo com tabelas fisicamente no mesmo
banco Postgres.

---

## 4. Camadas Clean Architecture

Cada módulo em `src/modules/<modulo>/` segue quatro camadas:

- **`domain/`** — entidades, value objects, erros de domínio, regras de negócio puras (ex.:
  validação de maioridade, cálculo de 4h por turno, verificação de dígito do CPF). **Zero**
  import de Next.js, Drizzle ou Mongo.
- **`application/`** — casos de uso (uma transação de negócio por classe/função, ex.:
  `AprovarCandidaturaUseCase`, `RegistrarSaidaKitUseCase`) e as interfaces de repositório
  (`ports/`) que a infraestrutura implementa.
- **`infrastructure/`** — implementações concretas: repositórios Drizzle, o escritor de
  auditoria Mongo, adapters de e-mail (Resend). Implementa as interfaces de `application`.
- **`presentation/`** — Server Actions (`actions/`) e leituras para Server Components
  (`queries/`). Camada fina: parse com Zod, checagem de sessão/role, chamada a **um** caso
  de uso, `revalidateTag`/`updateTag`. Nenhuma regra de negócio aqui.

**Regra de dependência**: `domain` ← `application` ← `infrastructure`/`presentation`. Nunca
o inverso.

### Exemplo de trace — Aprovar Candidatura (BR-VOL-03)

```
Server Action (presentation/actions/aprovarCandidatura.ts)
  → valida input (zod) + sessão + role (coordenador|membro_defesa_civil)
  → chama AprovarCandidaturaUseCase.executar({ candidaturaId, aprovadoPor })
      → (application) abre 1 transação Drizzle:
          - VoluntarioRepository.atualizarStatus(candidaturaId, 'aprovado', aprovadoPor)
          - UserRepository.atualizarRole(userId, 'voluntario')
      → AuditoriaService.registrar({ entidade: 'Voluntario', ... })  // best-effort, não bloqueia (§13)
      → NotificacaoService.enviar('triagem_concluida', voluntarioUserId)
  → revalidateTag('voluntariado:pendentes')
  → retorna resultado tipado (Result<Ok, DomainError>) para o cliente
```

---

## 5. Estrutura de Pastas

```
app/                                    # roteamento/composição — sem lógica de negócio
  (publico)/                            # pré-autenticação — SEM shell
    login/page.tsx
    cadastro/page.tsx
  (interno)/                            # TODA página autenticada — COM shell
    layout.tsx                          # exigirSessao() + <AppShell> + sino de notificações
    page.tsx                            # home: cards de acesso rápido por perfil
    sino-notificacoes.tsx
    sem-permissao/page.tsx
    design-system/page.tsx              # ferramenta de dev; exige sessão, fora do menu
    voluntariado/candidatura/page.tsx
    voluntariado/minhas-atividades/page.tsx
    (staff)/                            # grupo aninhado — só o gate de role
      layout.tsx                        # exigirRoles(ROLES_STAFF) (defesa em profundidade)
      cadastros-pendentes/page.tsx
      atividades/page.tsx
      atividades/[id]/page.tsx          # Kanban de turnos
      estoque/entrada/page.tsx
      estoque/saida/page.tsx
      estoque/descarte/page.tsx
      estoque/kits/page.tsx
      dashboard/page.tsx
      relatorios/page.tsx
  api/
    auth/[...all]/route.ts              # handler do better-auth
    cron/lembrete-turno/route.ts        # alvo do Vercel Cron
    contingencia/export/route.ts        # download binário (xlsx) — link simples, não Server Action
    relatorios/export/route.ts          # export CSV/XLSX de estoque/saídas
  layout.tsx
  globals.css

proxy.ts                                # gate de auth/role (Node-only, Next 16)

src/
  modules/
    identidade/       {domain, application/{use-cases,ports}, infrastructure/drizzle, presentation/{actions,queries}}
    voluntariado/      idem
    estoque/           idem
    logistica/         idem
    notificacoes/      idem
    auditoria/         idem
    contingencia/      idem (sem infrastructure/drizzle própria — só orquestra queries)
  shared/
    kernel/            # Result<T, E>, Entity base, UseCase base, DomainError
    db/postgres/       # cliente Drizzle (pooled), re-export do schema
    db/mongo/          # cliente Mongo singleton, acessor da coleção audit_logs
    auth/              # instância better-auth, enum de roles, helpers de sessão/inatividade
    cache/             # constantes de cacheTag e perfis de cacheLife
    ui/                # componentes Ark UI + Tailwind reutilizáveis (design system)

db/
  schema/
    identidade.ts
    voluntariado.ts
    estoque.ts
    logistica.ts
    notificacoes.ts
    index.ts                            # barrel — usado pelo drizzle.config.ts
  migrations/                           # saída do drizzle-kit
  drizzle.config.ts                     # aponta para DATABASE_URL_UNPOOLED
```

**Por que o schema físico é centralizado em `db/schema/`, mas a lógica de domínio é
modular em `src/modules/*`**: o `drizzle-kit` exige um único ponto de config apontando para
o schema completo do banco (para gerar migrations corretamente). O isolamento de módulo é
preservado no nível de _código de acesso_: cada `infrastructure/drizzle/*Repository.ts`
importa apenas a fatia de `db/schema/` referente ao seu próprio módulo — nunca a de outro.

---

## 6. Autenticação e Autorização

### 6.1. Configuração better-auth

- `emailAndPassword` habilitado (fallback sem dependência de provedor social).
- `socialProviders: { google, facebook }`. **Instagram fica fora do MVP** — a API atual do
  Instagram (Instagram API with Instagram Login) é voltada a contas business/creator, com
  viabilidade incerta para login pessoal de voluntários comuns; documentado como escopo
  futuro (v2), sem o plugin `genericOAuth` configurado agora.
- `role` como `additionalFields` **diretamente em `user`** (não em tabela separada), para
  que `session.user.role` esteja disponível sem query extra a cada checagem em `proxy.ts`.
  Valores: `usuario | voluntario | membro_defesa_civil | coordenador | administrador`,
  default `usuario`.
- `session.additionalFields.lastActivityAt` (timestamp) — suporte ao timeout de
  inatividade (§6.3).
- Adapter: Drizzle (schema gerado via `npx @better-auth/cli generate`, depois aumentado
  manualmente com os `additionalFields` acima).

### 6.2. `proxy.ts` — gate de autenticação/autorização

Roda em Node.js (Next 16 não suporta Edge em `proxy.ts`). Modelo **deny-by-default**: toda
rota exige sessão válida, exceto `/login` (`ROTA_PUBLICA`/`ehRotaPublica` em
`src/shared/auth/rotas.ts`) — uma rota nova sob `app/` nasce protegida, sem precisar de
entrada explícita em nenhum mapa. Responsabilidades:

1. Se a rota é `/login` → segue sem nenhuma checagem.
2. Checagem rápida de presença de sessão via cookie (`getSessionCookie`) para toda outra
   rota — redireciona para `/login` se ausente, sem hit ao banco.
3. Mapa rota → roles adicionalmente permitidas (aplicado **depois** de confirmada a sessão),
   espelhando a matriz de atores do BRD §2. Rotas ausentes deste mapa exigem apenas sessão
   válida (qualquer role):

    | Prefixo de rota                                                             | Roles permitidas                                      |
    | --------------------------------------------------------------------------- | ----------------------------------------------------- |
    | `/(staff)/cadastros-pendentes`, `/(staff)/atividades` (alocação)            | `membro_defesa_civil`, `coordenador`, `administrador` |
    | `/(staff)/estoque/entrada`, `/(staff)/estoque/saida`                        | `membro_defesa_civil`, `coordenador`, `administrador` |
    | `/(staff)/estoque/descarte`, `/(staff)/estoque/kits` (CRUD receita)         | `coordenador`, `administrador`                        |
    | `/(staff)/dashboard`                                                        | `membro_defesa_civil`, `coordenador`, `administrador` |
    | `/(staff)/relatorios`, `/api/contingencia/export`, `/api/relatorios/export` | `coordenador`, `administrador`                        |
    | `/(staff)/admin/*` (gestão de usuários/permissões)                          | `administrador`                                       |
    | `/voluntariado/minhas-atividades`                                           | `voluntario` e acima                                  |

    Rotas como `/`, `/voluntariado/candidatura`, `/design-system` e `/sem-permissao` não têm
    entrada no mapa — exigem apenas sessão válida, sem role específica. A candidatura pública
    de voluntário deixou de ser acessível sem conta (ver
    `specs/001-unified-login-flow/spec.md`, decisão de escopo): o pré-requisito passou a ser
    entrar antes de candidatar-se.

    **A tela `/cadastro` foi removida da aplicação.** Criar conta com e-mail e senha pelo
    público deixou de existir — o único auto-cadastro é o login por Google ou Facebook
    (`specs/011-auto-cadastro-provedor`), que cria a conta na primeira autenticação. Contas com
    senha passam a nascer apenas em `/admin`. Ver `PENDENCIAS.md` §2, resolvido pela opção (b).

4. Para roles `membro_defesa_civil`/`coordenador`, atualiza `session.lastActivityAt` a cada
   requisição autenticada (§6.3).
5. `config.matcher` exclui `/api/auth/*` e assets estáticos — não exclui mais nenhuma rota de
   navegação; a landing (`/`) passou a exigir sessão junto com o restante da aplicação.

Um usuário já autenticado que acessa `/login` diretamente é redirecionado para a área padrão
do seu papel (`areaPadraoPorRole`, `app/(auth)/login/page.tsx`) em vez de ver o formulário.

A checagem de role em `proxy.ts` é a **barreira rápida**; a fonte de verdade fica em cada
`(staff)/layout.tsx`, que re-valida via `auth.api.getSession` no servidor (defesa em
profundidade — cookies podem ser forjados/expirados entre o proxy e o render).

### 6.3. Timeout de inatividade (staff)

Requisito do NFR §3: sessões de Coordenador/Membro Defesa Civil devem encerrar
automaticamente por inatividade (mitiga risco em computadores compartilhados da central de
operações). better-auth **não tem** timeout de sessão por role nativamente — mecanismo
customizado, implementado em `src/shared/auth/`:

- Cada requisição autenticada de um usuário com role `membro_defesa_civil` ou `coordenador`
  atualiza `session.lastActivityAt = now()` em `proxy.ts`.
- A sessão é tratada como expirada quando `now() - lastActivityAt > STAFF_INACTIVITY_TIMEOUT_MINUTES`
  (variável de ambiente, default sugerido: 15 minutos) — o próximo request autenticado
  detecta isso e força novo login (invalida a sessão via `auth.api.signOut` server-side).
- Roles `voluntario`/`usuario`/`administrador` não são afetadas por esse timeout (apenas
  pela expiração normal de sessão do better-auth).
- Não se aplica ao `administrador` propositalmente fora do escopo do NFR — mas pode ser
  reavaliado se a operação exigir.

### 6.4.1. Rotas com regra granular exigem checagem na página

O `proxy.ts` **não** é enforcement suficiente para rotas cuja regra é mais estrita que
`ROLES_STAFF`. Ele decide a partir do cache de sessão em cookie e, quando esse cache não está
disponível, deixa passar de propósito (`if (!cache) return NextResponse.next()`) — apostando que
"o layout faz a checagem autoritativa em seguida".

Essa aposta vale para `/dashboard` e afins, onde `(staff)/layout.tsx` exige `ROLES_STAFF`. **Não
valia** para `/crise`, `/relatorios`, `/estoque/kits`, `/estoque/descarte` e `/convocacao`: um
perfil de staff sem direito à rota específica passava, porque nenhuma segunda checagem existia.
Verificado em execução — um `coordenador` abria `/crise` e `/relatorios` mesmo com a regra já
alterada em `REGRAS_DE_ROTA`.

Correção: cada uma dessas páginas chama `exigirAcessoA('<rota>')`, que deriva de `rolesExigidas`
e redireciona para `/sem-permissao`. **Toda rota nova com regra granular precisa dessa chamada** —
o proxy sozinho não a protege.

### 6.4. Segurança

- Cookies httpOnly, secure, sameSite=lax.
- HTTPS/TLS 1.2+ obrigatório — garantido pela Vercel em produção.
- Dados sensíveis (`cpf`, `restricoesSaude`): protegidos por criptografia **at-rest nativa
  do Neon Postgres** + TLS em trânsito. **Sem pgcrypto/criptografia a nível de campo** —
  decisão final, para manter `cpf` indexável/buscável sem complexidade extra de key
  management, já que o at-rest do Neon atende literalmente o requisito NFR "criptografia em
  repouso".

### 6.5. Shell de navegação por perfil

Decisão registrada em `specs/002-role-based-app-shell/`.

**Estrutura de route groups** — a fronteira "tem shell / não tem shell" é o diretório, não uma
lista de rotas, para que uma página nova nasça do lado certo sem ninguém precisar lembrar:

- `(publico)/` — pré-autenticação, sem shell.
- `(interno)/` — o layout aplica `exigirSessao()` e renderiza `<AppShell>`. Toda página
  autenticada herda gate e navegação por construção.
- `(interno)/(staff)/` — grupo aninhado que só acrescenta `exigirRoles(ROLES_STAFF)`.

Isto fechou uma lacuna de defesa em profundidade: as páginas de `usuario`/`voluntario` não
tinham **nenhuma** re-checagem no render, dependendo apenas do `proxy.ts`.

Ambos os layouts declaram `instant = false` — o segmento que lê a sessão precisa declarar por
si, não herda do pai. E `obterSessao` é **memoizada por request** (`cache` do React): com dois
níveis de gate no mesmo render, sem a memoização cada página de staff dispararia dois
`auth.api.getSession` por navegação. A checagem em camadas é decisão de autorização; pagar dois
hits ao banco por isso não é.

**Registro de navegação** (`src/shared/auth/navegacao.ts`) — fonte única dos itens do menu,
co-locado com `rotas.ts` porque os dois descrevem a mesma matriz de atores. Cada item declara
suas roles explicitamente, e `navegacao.test.ts` trava a **igualdade** entre `item.roles` e
`rolesExigidas(href)` sempre que houver regra em `REGRAS_DE_ROTA` — divergir quebra `npm test`.

Declaração explícita, e não derivação de `podeAcessar`, porque `podeAcessar` retorna `true`
para rota ausente do mapa: derivar mostraria "Quero ser voluntário" a coordenador e
administrador. Igualdade e não subconjunto porque subconjunto esconderia um destino de quem
tem direito a ele, sem quebrar nada.

**Esconder um item não é autorização.** O menu é ergonomia; o acesso continua barrado pelo
`proxy.ts` e pelos gates de layout, inclusive por URL direta.

O grupo `administracao` existe e está vazio: `/admin` tem regra de rota mas ainda não tem
página, e exibir link para 404 violaria o critério de "nenhum item leva a negativa de acesso".

**Home (`/`)** — página autenticada com cards de acesso rápido por perfil. Os cards saem de
`atalhosDeNavegacao(role)`, que filtra `itensDeNavegacao(role)` — derivar da mesma lista já
filtrada é o que impede um card de apontar para destino que a pessoa não pode abrir. É um
subconjunto curado (`atalho`), não todos os destinos: acesso rápido com 13 cards não é rápido.

**Variáveis da crise pertencem à Defesa Civil** — `membro_defesa_civil` e `administrador`. As
três Server Actions de `logistica.ts` (`atualizarVariaveisCrise`, `definirMetricaKit`,
`removerMetricaKit`) só existem dentro de `/crise` e por isso derivam de `rolesExigidas('/crise')`
em vez de repetir a lista: separá-las deixaria a coordenação alterando os números sem poder abrir
a tela — permissão de escrita sem tela é pior que nenhuma.

`/dashboard` **continua** com toda a staff: o coordenador acompanha os números da crise, só não
os altera. Como o painel tem atalhos para `/crise`, eles são renderizados condicionalmente
(`podeAcessar('/crise', role)`) — do contrário o coordenador veria links que devolvem
`/sem-permissao`.

**Relatórios e contingência pertencem à Defesa Civil** — `membro_defesa_civil` e
`administrador`; `coordenador` **não** tem acesso. São três regras que precisam andar juntas,
porque descrevem uma tela e os downloads que só existem dentro dela:

- `/relatorios` — a tela
- `/api/relatorios/export` — exportação de inventário e saídas (BR-REL-01)
- `/api/contingencia/export` — pacote de contingência (BR-CON-01)

Separá-las produz um de dois defeitos: a tela abre com botões em 403, ou os dados ficam
alcançáveis por URL direta para quem já não pode abrir a tela — e, no caso da contingência,
uma permissão órfã, já que não há outro caminho na UI até ela. `rotas.test.ts` trava a
igualdade entre as três.

Os dois Route Handlers derivam as roles de `rolesExigidas()` em vez de redigitá-las. Antes cada
um mantinha sua própria cópia literal — três lugares para lembrar de mudar, e nenhum aviso ao
esquecer um.

A seção de contingência na tela de relatórios continua renderizada condicionalmente
(`podeAcessar('/api/contingencia/export', role)`). Hoje a condição é sempre verdadeira para quem
alcança a tela, já que as regras coincidem; ela permanece porque são autorizações independentes
por natureza, e a checagem é o que impede o botão-que-dá-403 de voltar se elas divergirem.

### 6.6. Endereço não encontrado (404)

Decisão registrada em `specs/003-not-found-page/`.

**Duas fronteiras**, porque o Next resolve os dois casos em posições diferentes da árvore:

- `app/not-found.tsx` — URLs desconhecidas de toda a aplicação. Nenhum segmento casou, então
  nenhum layout de área se aplica: é esta página que lê a sessão (`obterSessao`, **nunca**
  `exigirSessao` — página de erro que redireciona é defeito) e decide envolver no shell ou não.
- `app/(interno)/not-found.tsx` — `notFound()` lançado sob a área autenticada. O shell já vem
  do layout, que continua na árvore; montá-lo de novo duplicaria topbar e menu.

O conteúdo é um só (`src/shared/ui/nao-encontrado/`), e **não recebe ator nem itens de menu** —
a ausência de vazamento na variante anônima é propriedade do tipo, não disciplina de quem edita.

`app/not-found.tsx` declara `instant = false`: a apresentação depende de cookies e, com Cache
Components, o build falha ao tentar prerenderizar. Das três saídas do Next (cachear, isolar sob
`<Suspense>`, declarar bloqueante), esta é a coerente com o projeto — todo segmento que lê sessão
já faz assim. `<Suspense>` renderia casca estática, mas o destino do botão também depende da
sessão: o link trocaria sob o cursor.

**404 não é 403.** Endereço restrito continua produzindo `/sem-permissao`. Dizer "não existe"
sobre uma área que existe seria vazamento invertido e confundiria quem tem permissão parcial.

**Status HTTP**: URL desconhecida devolve `404` real (decidido no roteamento, antes de qualquer
streaming). Já `notFound()` chamado dentro de um `<Suspense>` — o caso de `/atividades/[id]` —
devolve `200` com `<meta robots="noindex">`, porque o cabeçalho já foi enviado. É comportamento
documentado do Next; o `noindex` preserva o efeito que importa. Obter status real ali exigiria
eliminar o streaming da tela ou consultar o banco no `proxy.ts`, ambos piores que o problema.

`experimental.globalNotFound` foi avaliado e rejeitado: exigiria devolver um documento HTML
completo, duplicando o root layout inteiro — tema, fonte e estilos globais — para uma única tela.

A landing pública anterior deixou de existir. Ela já era inalcançável na prática — o
deny-by-default do `proxy.ts` exige sessão em `/` desde a feature 001, então o conteúdo escrito
para visitante deslogado nunca chegava a ser exibido.

---

## 7. Estratégia de Cache

Next.js 16 não cacheia nada por padrão — cada leitura abaixo declara explicitamente sua
estratégia via `'use cache'` (`cacheComponents: true` em `next.config.ts`).

| Read path                                            | `'use cache'`?                                                                       | `cacheLife`         | `cacheTag`(s)                    | Invalidado por                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| Autocomplete de itens (tela Entrada, BR-EST-01)      | Sim                                                                                  | curto (`'minutes'`) | `estoque:itens`                  | qualquer criação de `item`                                                                          |
| Listagem de itens avulsos (tela Saída) — NFR <300ms  | Sim                                                                                  | curto (`'minutes'`) | `estoque:itens`, `estoque:saldo` | entrada, saída, descarte                                                                            |
| Dashboard "Kits Possíveis"/"Kits Necessários"        | Sim                                                                                  | curto (`'minutes'`) | `dashboard:kits`                 | entrada, saída, descarte, alteração de receita de kit, alteração de `crise_variaveis`/`metrica_kit` |
| Fila de Cadastros Pendentes                          | Sim                                                                                  | curto (`'minutes'`) | `voluntariado:pendentes`         | submissão de candidatura, aprovação/rejeição                                                        |
| Kanban de Atividade/Turno                            | Sim, por atividade                                                                   | curto (`'minutes'`) | `atividades:{atividadeId}`       | criação/edição de turno, criação/cancelamento de alocação                                           |
| Listagem paginada de estoque (TanStack Table)        | Sim, por página+filtro                                                               | curto (`'minutes'`) | `estoque:listagem`               | toda mutação de estoque                                                                             |
| Listagem paginada de voluntários                     | Sim, por página+filtro                                                               | médio (`'hours'`)   | `voluntariado:listagem`          | aprovação/rejeição, edição de perfil                                                                |
| Shell estático do formulário de candidatura          | Sim                                                                                  | longo (`'days'`)    | —                                | raramente (deploy)                                                                                  |
| Dados derivados de sessão (`cookies()`/`headers()`)  | **Nunca**                                                                            | —                   | —                                | —                                                                                                   |
| Checagem final de saldo dentro da transação de saída | **Nunca** — `SELECT` (ou `FOR UPDATE`) fresco na mesma transação que deduz o estoque | —                   | —                                | correção > performance: evita corrida entre duas saídas concorrentes                                |

Invalidação: mutações que precisam refletir imediatamente na mesma resposta (ex.: aprovar
candidatura e já sumir da fila) usam `updateTag()` (read-your-writes, dentro da própria
Server Action). Mutações onde uma pequena defasagem é aceitável (ex.: recálculo do dashboard
após uma entrada em outro terminal) usam `revalidateTag(tag, 'minutes')` (stale-while-
revalidate, atualização em background).

---

## 8. Integração TanStack Query + Server Actions

- **Prefetch em Server Components**: cada página server-rendered chama diretamente o
  caso de uso (não via HTTP interno) para prefetch, popula um `QueryClient` e hidrata via
  `dehydrate`/`HydrationBoundary`, eliminando waterfalls no client.
- **Convenção de `queryKey`**: espelha o nome do `cacheTag` correspondente — ex.:
  `['estoque', 'itens', filtros]` ↔ tag `estoque:itens` — para que a invalidação de cache
  do Next.js e do TanStack Query aconteçam a partir da mesma mutação, sem duplicar lógica.
- **Mutações client**: `useMutation` chamando a Server Action; `onSettled` (não
  `onSuccess`) dispara `queryClient.invalidateQueries` para o `queryKey` afetado — garante
  invalidação mesmo em caso de erro parcial.
- **TanStack Table**: paginação **obrigatoriamente server-side** (NFR §2.1) — a Server
  Action/query de listagem recebe `{ page, pageSize, filtros, sort }` e retorna
  `{ rows, totalCount }`; nunca carrega a tabela inteira no cliente.
- **Restrição de Server Actions**: o Next.js despacha Server Actions **sequencialmente por
  cliente** (não em paralelo). Uma saída de kit com múltiplos componentes é **uma única**
  Server Action recebendo um payload em lote — nunca `Promise.all` de várias actions a
  partir do client.

---

## 9. Módulo de Estoque — Fluxos

### 9.1. Entrada (BR-EST-01)

- Campo "Nome do Item" com autocomplete consultando `item.nome` via índice trigram
  (`pg_trgm`), evitando duplicidade de cadastro.
- Campos: categoria, condição, quantidade, unidade, perecível (habilita `dataValidade`
  obrigatória, validação de não-passado no `domain`), destinação (kit) — **campo
  informativo**, não reserva estoque (decisão confirmada com o usuário: uma Entrada
  destinada a um Kit entra no saldo geral normalmente e pode sair tanto avulsa quanto via
  kit).
- Ao salvar: cria linha em `entrada`, incrementa `saldo_estoque.quantidadeAtual` do item na
  mesma transação.

### 9.2. Kits e Receitas (BR-EST-02, BR-EST-03)

- CRUD de `kit` (nome, descrição, ativo).
- Composição via `kit_receita_item` (kit + item + quantidade necessária por unidade de
  kit).

### 9.3. Saída (BR-EST-04)

Pseudocódigo da transação (executada inteiramente dentro de **uma** Server Action):

```
RegistrarSaidaUseCase.executar({ tipo, itens[], destino, responsavelTransporte, registradoPor })
  abrir transação Drizzle
    se tipo == 'kit':
      para cada kit solicitado:
        expandir receita (kit_receita_item) × quantidade de kits → lista de (item, quantidadeNecessaria)
      consolidar por item (soma entre kits, se múltiplos kits na mesma saída)
    ler saldo_estoque FOR UPDATE para cada item envolvido (evita corrida)
    validar: saldo_estoque.quantidadeAtual >= quantidadeNecessaria, para cada item
    se algum item insuficiente:
      abortar transação
      retornar erro: "Saída bloqueada. Faltam {déficit} {unidade} de {item} para montar esta quantidade de kits."
      (uma mensagem por item deficitário, conforme BR-EST-04 cenário B)
    senão:
      inserir saida + saida_item (um por item deduzido)
      decrementar saldo_estoque.quantidadeAtual de cada item
      commit
  auditoria (best-effort) + revalidateTag('estoque:*', 'dashboard:kits')
```

### 9.4. Descarte (BR-EST-05)

Tela e tabela dedicadas (`descarte`) — nunca uma flag em `saida`. Decrementa
`saldo_estoque` como uma saída, mas é **estruturalmente excluído** de qualquer relatório de
"itens entregues à população" por estar em tabela separada (não precisa de filtro
condicional que possa ser esquecido em um novo relatório).

---

## 10. Módulo de Voluntariado — Fluxos

### 10.1. Candidatura → Triagem → Aprovação (BR-VOL-01 a BR-VOL-03)

- Submissão pública cria/atualiza `voluntario_perfil` com `status = 'pendente'`. Reenvio de
  candidatura previamente rejeitada é permitido: a mesma linha é atualizada (dados
  substituídos, `status` volta a `pendente`, `aprovadoPor`/`aprovadoEm`/`motivoRejeicao`
  são sobrescritos na próxima decisão).
- Validações de domínio: maioridade (≥18 anos a partir de `dataNascimento`), dígito
  verificador do CPF, formato de e-mail/telefone.
- Coordenador/Membro Defesa Civil aprova ou rejeita. Aprovação: `status = 'aprovado'` +
  troca de `user.role` de `usuario` para `voluntario`, **na mesma transação** Postgres +
  notificação (§12) + auditoria best-effort (§13).

### 10.2. Atividades e Turnos (BR-VOL-04, BR-VOL-05)

- Coordenador cria `atividade` (título, `categoriaId` → `atividade_categoria`, local,
  status).
- Fragmentação em `turno`s de 4 horas — validada no **domínio** (não via `CHECK` de banco,
  para permitir mensagens de erro específicas e futura flexibilização sem migration).
- Alocação: Coordenador seleciona voluntário (filtrável por `habilidade` via
  `voluntario_habilidade`) e cria `alocacao` vinculando a um `turno`.
- Painel Kanban: colunas/lista por `atividade`, cada `turno` mostra vagas preenchidas
  (`count(alocacao where status='confirmado')`) vs. `turno.vagas`; destaque vermelho quando
  `preenchidas < vagas` (déficit).

---

## 11. Módulo de Logística/Dashboard (BR-INT-01, BR-INT-02)

- **Kits Necessários (Demanda)** = `crise_variaveis.totalFamiliasAfetadas` ×
  `metrica_kit.proporcao` (para kits com `baseDemanda = 'por_familia'`), ou
  `totalPessoasAfetadas` × proporção (para `'por_pessoa_desabrigada'`).
- **Kits Possíveis (Capacidade)** = para cada kit, `min` sobre todos os seus componentes de
  `floor(saldo_estoque[componente].quantidadeAtual / kit_receita_item.quantidade)`.
- Recalculado (via invalidação de `cacheTag('dashboard:kits')`) a cada entrada, saída,
  descarte, alteração de receita de kit ou atualização de `crise_variaveis`/`metrica_kit`.

---

## 12. Sistema de Notificações

- Interface `NotificacaoService` (em `application/ports`) com dois adapters em
  `infrastructure`: e-mail (Resend) e in-plataforma (grava em `notificacao`). **Sem push
  real no MVP** — decisão confirmada; lembretes/alertas são e-mail + sino in-app.
- Catálogo de eventos espelha 1:1 a matriz de comunicação do BRD §6: `triagem_concluida`,
  `atividade_atribuida`, `alteracao_atividade`, `lembrete_turno`, `broadcast_urgencia`,
  `cadastros_acumulados`, `estoque_critico`, `deficit_atendimento`.
- **Lembrete de turno** (aviso diário): não há trigger de evento natural (é baseado em
  tempo), então usa **Vercel Cron** — `vercel.json` agenda `GET /api/cron/lembrete-turno`
  **1x por dia** às 12:00 UTC (09:00 America/Sao_Paulo). O plano Hobby da Vercel só
  permite cron diário, então o lembrete "2h antes" do BRD §6 foi substituído por um aviso
  matinal cobrindo os turnos das próximas ~24h. A rota (protegida por header
  `Authorization: Bearer $CRON_SECRET`) busca `alocacao` join `turno` com `turno.inicio`
  entre 0 e 26 horas no futuro (folga acima de 24h para tolerar atraso do cron) e
  `alocacao.lembreteEnviadoEm IS NULL`, dispara a notificação e marca
  `lembreteEnviadoEm = now()` (evita duplicidade entre execuções).
- **Broadcast de Urgência**: uma única Server Action em lote, disparada pelo Coordenador
  para todos os voluntários (ou um subconjunto filtrado). Risco documentado: sem infra de
  fila, uma lista muito grande de destinatários pode se aproximar do limite de duração de
  função da Vercel — mitigar processando em chunks dentro da mesma invocação e, se
  necessário no futuro, migrar para um endpoint de fan-out; fora de escopo para o MVP.
- **Alertas para Coordenadores** (`cadastros_acumulados`, `estoque_critico`,
  `deficit_atendimento`): gerados por checagem em leitura (não por job separado) — ex.: ao
  carregar o dashboard/fila, se o contador ultrapassar o limiar configurado, a notificação
  é criada (idempotente, uma por "condição ativa").

---

## 13. Auditoria (BR-AUD-01)

- Wrapper centralizado `withAudit(actor, entidade, acao, fn)` (em
  `src/modules/auditoria/`), usado por **todo** caso de uso de escrita em
  Estoque/Voluntariado/Atividade — nunca chamadas ad-hoc espalhadas nas Server Actions.
- Identidade do ator (`userId`, `role`) é obtida da sessão autenticada e propagada via
  `AsyncLocalStorage`, populada uma vez por requisição — evita passar `actor` manualmente
  por toda a cadeia de chamadas.
- A escrita no Mongo captura `dadosAnteriores` (leitura antes da mutação) e `dadosNovos`
  (resultado da mutação).
- **Política de falha (decisão final): degradar graciosamente.** Se a escrita no
  `audit_logs` falhar (ex.: Mongo Atlas indisponível durante a crise), a operação original
  em Postgres **prossegue normalmente** — a falha de auditoria é registrada separadamente
  (log estruturado, visível no Vercel Log Stream) para reconciliação manual posterior.
  Motivo: disponibilidade das operações críticas de campo (aprovar voluntário, registrar
  saída de estoque) durante um desastre pesa mais do que o risco de uma lacuna pontual no
  log de auditoria — trade-off explícito, revisitável se a operação real mostrar que
  lacunas de auditoria são inaceitáveis.
- Retry: uma tentativa adicional automática antes de desistir e logar a falha (mitiga
  falhas transitórias de rede sem adicionar latência significativa).

---

## 14. Relatórios e Exportação (BR-REL-01)

- Export de Inventário Atual (a partir de `saldo_estoque` + `item`) e Histórico de Saídas
  (a partir de `saida`/`saida_item`) em CSV e XLSX.
- Biblioteca: `xlsx` (SheetJS).
- Implementado como **Route Handler** (`GET /api/relatorios/export?tipo=...&formato=...`),
  não Server Action — payload binário não é um bom fit para o modelo de retorno de Server
  Actions. Protegido pela mesma checagem de role de `(staff)/relatorios`.

---

## 15. Pacote de Contingência (BR-CON-01)

- Reusa os mesmos _ports_ de leitura de Estoque/Voluntariado usados no §14.
- `GET /api/contingencia/export` monta um workbook `xlsx` com 4 abas:
    1. Saldo exato do estoque no momento do download (`saldo_estoque` + `item`).
    2. Formulário em branco para anotação manual de Entradas (cabeçalhos pré-formatados).
    3. Formulário em branco para anotação manual de Saídas.
    4. Formulário em branco para gestão de turnos de voluntários.
- Servido via link simples (`<a href="/api/contingencia/export">`), **sempre live, nunca
  cacheado** — o objetivo é o snapshot mais atual possível antes de uma queda de conexão.

---

## 16. Dependências a Adicionar

| Pacote        | Uso                                                       |
| ------------- | --------------------------------------------------------- |
| `drizzle-orm` | ORM sobre Neon Postgres                                   |
| `drizzle-kit` | Migrations/introspecção                                   |
| `better-auth` | Autenticação/sessão/roles                                 |
| `xlsx`        | Geração de CSV/XLSX (relatórios + pacote de contingência) |
| `resend`      | Envio de e-mail transacional                              |

(`@neondatabase/serverless`, `mongodb`, `@tanstack/react-query`, `@ark-ui/react`,
`react-hook-form`, `@hookform/resolvers`, `zod` já estão instalados.)

---

## 17. Variáveis de Ambiente

| Variável                                        | Uso                                                                   |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `DATABASE_URL`                                  | Conexão pooled (runtime da aplicação)                                 |
| `DATABASE_URL_UNPOOLED`                         | Conexão direta (migrations `drizzle-kit`, operações de sessão)        |
| `MONGODB_URI`                                   | Conexão com o cluster de auditoria (já existe)                        |
| `BETTER_AUTH_SECRET`                            | Chave de assinatura de sessão                                         |
| `BETTER_AUTH_URL`                               | URL base para callbacks OAuth                                         |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`     | Login social Google                                                   |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | Login social Facebook                                                 |
| `RESEND_API_KEY`                                | Envio de e-mail transacional                                          |
| `CRON_SECRET`                                   | Autenticação do Vercel Cron nas rotas `/api/cron/*`                   |
| `STAFF_INACTIVITY_TIMEOUT_MINUTES`              | Timeout de inatividade para Coordenador/Membro (default sugerido: 15) |

---

## 18. Testes

O skill de Vitest está disponível no ambiente, mas `vitest` ainda não é uma dependência do
projeto. Proposta: testes unitários co-localizados por módulo, focados nas camadas
`domain/` e `application/` (regras de negócio puras e casos de uso — os pontos de maior
valor de teste, já que `infrastructure`/`presentation` são finas por design). Testes de
integração (contra um banco Neon de desenvolvimento) cobrindo os fluxos transacionais
críticos: aprovação de candidatura (troca de role), saída de kit (validação + dedução
atômica).

---

## 19. Decisões de Design Consolidadas

Resumo das decisões que fecham pontos originalmente ambíguos no BRD/NFR — todas confirmadas
com o usuário, sem pendências para a implementação:

| Ponto                               | Decisão                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| ORM                                 | Drizzle (não Prisma)                                                               |
| Biblioteca de autenticação          | better-auth (não NextAuth.js)                                                      |
| Login social                        | Google + Facebook no MVP; Instagram adiado para v2                                 |
| Modelo de estoque                   | Ledger de movimentos + saldo materializado (não rastreamento por lote/FEFO)        |
| "Destinação (Kit)" na Entrada       | Apenas informativo, sem reserva rígida de saldo                                    |
| Notificações push                   | Somente in-app + e-mail no MVP (sem Web Push/VAPID)                                |
| Falha na escrita de auditoria       | Degrada graciosamente (operação original prossegue)                                |
| Categoria de Atividade / Habilidade | Tabelas lookup livres e extensíveis (sem enum fixo)                                |
| Provedor de e-mail                  | Resend                                                                             |
| Biblioteca XLSX                     | `xlsx` (SheetJS)                                                                   |
| Reenvio de candidatura rejeitada    | Permitido, reaproveitando a mesma linha                                            |
| Timeout de inatividade (staff)      | Mecanismo customizado `lastActivityAt`, escopado a Coordenador/Membro Defesa Civil |
| Criptografia de dados sensíveis     | At-rest nativa do Neon Postgres + TLS em trânsito (sem pgcrypto)                   |

---

## 20. PWA — instalação em campo

A aplicação é instalável na tela inicial (`app/manifest.ts`, `display: standalone`). O caso de uso
justifica: a operação acontece no celular, em campo, e um atalho que abre em tela cheia encurta o
caminho de quem precisa registrar uma saída de estoque no meio de uma ocorrência.

**Ícones** são gerados por `scripts/gerar-icones-pwa.mjs` — sem dependência, escrevendo o PNG
sobre o `zlib` do Node. A escolha é por reprodutibilidade: mudar a cor da marca é editar o script
e rodar de novo, em vez de recriar binários num editor externo e commitá-los sem origem conhecida.
Há uma variante `maskable` full-bleed, porque o ícone `any` ganharia bordas brancas ao ser
recortado pela máscara do sistema.

**`webmanifest` precisou entrar na isenção do `proxy.ts`.** Sem isso o navegador recebia um
redirect para `/login` ao buscar o manifest, e a aplicação não era instalável — falha silenciosa,
porque nada na interface indica que o manifest não carregou. Está na mesma classe de
`favicon.ico`/`robots.txt`: metadata pública, sem dado de sessão.

**Cabeçalhos de segurança** (`next.config.ts`) valem para toda a aplicação, não só para a
instalação: rodando em tela cheia num dispositivo de campo, o custo de uma página embutida em
iframe hostil sobe. `Permissions-Policy` desliga câmera, microfone e geolocalização — se
georreferenciar uma ocorrência entrar no escopo, é ali que se libera conscientemente.

### O que deliberadamente **não** foi feito

**Sem service worker e sem cache offline.** A opção indicada pela documentação do Next é o
Serwist, uma dependência nova — e, mais importante, cachear respostas autenticadas gravaria `cpf`
e `restricoesSaude` no dispositivo, fora do alcance da criptografia at-rest do Neon (§6.4). Isso
inverte a decisão registrada ali e precisa ser escolha explícita, não efeito colateral de "virar
PWA".

Há uma alternativa sem dependência para o problema de conectividade: o `experimental.useOffline`
do Next 16, que dá interface ciente de conexão e repetição automática de navegações e Server
Actions falhadas. É experimental, então também merece decisão própria antes de entrar.

**Sem Web Push.** Continua valendo a decisão do MVP: notificações in-app + e-mail, sem VAPID.
