---
description: 'Task list for 024-notificacoes-whatsapp'
---

# Tasks: Notificações também pelo WhatsApp

**Input**: Design documents from `specs/024-notificacoes-whatsapp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Incluídos. A constituição (Princípio III) exige TDD em `domain/` e `application/` e
testes de integração para fluxos que tocam o banco real. Unitários: `*.test.ts` (`npm test`, sem
rede). Integração: `*.integracao.test.ts` (`npm run test:integracao`, Neon real). O `vitest` só
enxerga `src/**` — testes de Route Handler ficam em `src/modules/notificacoes/presentation/http/`.
Escreva cada teste antes da implementação correspondente e confirme que falha.

**Organization**: Tarefas agrupadas por user story da spec (US1–US4) para entrega incremental.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência de tarefa incompleta)
- **[Story]**: user story atendida (US1…US4)

## Convenções para quem implementa

- Ler `AGENTS.md`: Next.js 16 tem APIs diferentes — consultar `node_modules/next/dist/docs/`
  antes de usar `after()`, Route Handlers e Server Actions
  (`01-app/03-api-reference/04-functions/after.md`).
- Textos de interface e mensagens em pt-BR; comentários no estilo do código vizinho (explicam o
  *porquê*, citando research Dn / FR-nnn).
- Notificar **nunca** derruba a operação de negócio: todo erro do canal vira `console.error`
  com prefixo `[notificacoes] whatsapp` e retorno normal (FR-017).
- Notificações não lê tabelas do Voluntariado; usa os ports `ContatosWhatsapp` e
  `ConsentimentoWhatsappPort` (research D10, D11).
- Sem pacote npm novo: Cloud API via `fetch`, HMAC via `node:crypto` (research D1).
- Referências: regras de domínio = data-model.md §6; tabelas = §2–§5; modelos =
  contracts/modelos-whatsapp.md; webhook = contracts/webhook-whatsapp.md; serviço/telas/R-16 =
  contracts/canal-e-interfaces.md.

---

## Phase 1: Setup (Documentação e esquema)

**Purpose**: Registrar a decisão antes do código (Princípio VI) e criar o esquema que todas as
stories usam.

- [X] T001 Atualizar `spec/DESIGN.md` §12: WhatsApp como terceiro canal (Cloud API da Meta, sem SDK), matriz de eventos (4 do e-mail + lembrete de turno), opt-in explícito, envio em `after()`, webhook assinado, motivos de não entrega; em §6.2 registrar a isenção de `api/webhooks` no matcher do `proxy.ts`; substituir a linha "Notificações push … Somente in-app + e-mail" da tabela de decisões para mencionar o WhatsApp (research D18)
- [X] T002 [P] Atualizar `spec/DB_SCHEMA.md` §8: novos valores de `canal_envio`/`status_envio`, enum `motivo_nao_entrega`, colunas `motivo`, `destino`, `idExterno`, `atualizadoEm` em `notificacao_envio`, tabelas `preferencia_whatsapp`, `consentimento_whatsapp`, `whatsapp_resposta_automatica` e os índices parciais (copiar de data-model.md §1–§5)
- [X] T003 [P] Atualizar a coluna "Canal" da matriz §6 em `spec/REQUISITOS_NEGOCIO.md`: "E-mail / Plataforma / WhatsApp" para Triagem Concluída, Atividade Atribuída, Alteração de Atividade e Broadcast; "Plataforma / WhatsApp" para Lembrete de Turno; nota com link para `specs/024-notificacoes-whatsapp`
- [X] T004 [P] Acrescentar as variáveis `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_GRAPH_VERSION`, `WHATSAPP_TEMPLATE_LANG=pt_BR` (vazias, com comentário de uma linha cada) em `.env.example` (o `.env.local.example` só traz `MONGODB_URI` e não recebe as demais variáveis)
- [X] T005 Em `db/schema/notificacoes.ts`: acrescentar `'whatsapp'` a `canalEnvioEnum`; `'entregue'`, `'lido'`, `'nao_enviado'` a `statusEnvioEnum` (atualizar o comentário "Sem push real no MVP"); criar `motivoNaoEntregaEnum`, `acaoConsentimentoEnum`, `origemConsentimentoEnum`; colunas `motivo`, `destino`, `idExterno`, `atualizadoEm` em `notificacaoEnvio`; índice único `notificacao_envio_notificacao_canal_unico` em `(notificacaoId, canal)` substituindo `notificacao_envio_notificacao_idx` (research D4b) e `notificacao_envio_id_externo_idx` (`id_externo` where not null); tabelas `preferenciaWhatsapp`, `consentimentoWhatsapp` (índice `(userId, criadoEm)`) e `whatsappRespostaAutomatica` com relations — conforme data-model.md §1–§5
- [X] T006 Gerar a migration com `npm run db:generate` (deve sair como `db/migrations/0009_*.sql`), revisar o SQL (nenhum índice com predicado sobre os valores novos de enum — research D4b) e conferir que não há duplicatas de `(notificacao_id, canal)` no banco. Aplicar com `npm run db:migrate` num branch do Neon antes do principal
- [X] T007 Propor a emenda PATCH da constituição com `/speckit-constitution`: em "Stack e Convenções Técnicas" acrescentar "**Mensageria**: WhatsApp Cloud API (Meta), via HTTP, sem SDK" em `.specify/memory/constitution.md` (versão 1.0.1 → 1.0.2, Sync Impact Report citando esta feature)

**Checkpoint**: decisão documentada, banco migrado.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Regras puras de domínio, ports e o adapter HTTP — usados por todas as stories.

**⚠️ CRITICAL**: Nenhuma user story começa antes desta fase terminar.

### Testes primeiro

- [X] T008 Escrever `src/modules/notificacoes/domain/whatsapp.test.ts` cobrindo data-model.md §6: `eventoVaiPorWhatsapp` verdadeiro só para `triagem_concluida`, `atividade_atribuida`, `alteracao_atividade`, `broadcast_urgencia`, `lembrete_turno`; `destinoWhatsapp('47999998888')` = `'5547999998888'`, 10 dígitos → `null`, 11 dígitos sem 9 no 3º → `null`; `variantesDeWaId('554799998888')` (sem o 9º) e `variantesDeWaId('5547999998888')` devolvem ambas as formas locais de 11 e 10 dígitos; `avaliarElegibilidade` → `usuario_inativo` / `canal_desativado` (opt-in ausente ou falso) / `sem_celular` (telefone nulo ou fixo) / elegível com destino; `parametrosDoModelo` troca `\n`, `\t` e 5+ espaços por " — "/um espaço, mantém mensagem ≤ 700 e acima disso devolve 680 caracteres + "… (continua no SOS Jaraguá)" com `encurtada: true`; `proximaSituacao` aceita pendente→enviado→entregue→lido, ignora regressões e repetições, aceita `falhou` só a partir de `pendente`/`enviado`, nunca sai de `nao_enviado`; `classificarErroMeta` (131026→`numero_sem_whatsapp`, 130429/131048/131056→`limite_envio`, 132001/132015/132016→`modelo_indisponivel`, 190/10/200→`nao_configurado`, outro/nulo→`falha`); `ehPedidoDeDescadastro` para "SAIR", " Parar! ", "stop", "Cancelar", "descadastrar" e falso para "quero sair do grupo", "oi"; `mascararTelefone('5547999998888')` = `'(47) 9****-8888'`

### Implementação

- [X] T009 Implementar `src/modules/notificacoes/domain/whatsapp.ts` (puro, sem Next/Drizzle) até T008 passar; exportar `LIMITE_MENSAGEM_WHATSAPP`, os tipos `MotivoNaoEntrega`, `SituacaoEnvio`, `OrigemConsentimento`, `NomeModelo` e o mapa `MODELO_POR_EVENTO` (nomes de contracts/modelos-whatsapp.md). `CAMINHO_POR_EVENTO` não foi criado: os links ficam fixos nos botões dos modelos (análise U5)
- [X] T010 [P] Em `src/modules/notificacoes/application/ports/notificacao-service.ts`: `CanalNotificacao = 'email' | 'plataforma' | 'whatsapp'`; acrescentar ao port o método `enviarEmLoteComResumo(notificacoes): Promise<{ whatsapp: { elegiveis: number; naoAlcancaveis: number } }>` (contracts/canal-e-interfaces.md §1)
- [X] T011 [P] Criar os ports `src/modules/notificacoes/application/ports/contatos-whatsapp.ts`, `consentimento-whatsapp.ts` e `mensageria-whatsapp.ts` com as interfaces de data-model.md §7
- [X] T012 [P] Escrever `src/modules/notificacoes/infrastructure/whatsapp-cloud-api.test.ts` com `fetch` simulado (`vi.stubGlobal`): sem `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` → `configurado()` falso; `enviarModelo` faz `POST https://graph.facebook.com/{versão}/{phoneId}/messages` com `Bearer`, corpo do contrato (contracts/modelos-whatsapp.md "Chamada de envio"), idioma de `WHATSAPP_TEMPLATE_LANG` (padrão `pt_BR`); 200 → `{ ok: true, idExterno: messages[0].id }`; 400 com `error.code` → `{ ok: false, codigo, erro }`; exceção de rede → `{ ok: false, codigo: null }`; `enviarTexto` usa `type: 'text'`
- [X] T013 Implementar `src/modules/notificacoes/infrastructure/whatsapp-cloud-api.ts` (`import 'server-only'`, objeto que satisfaz `MensageriaWhatsapp`, timeout de 10 s por chamada com `AbortSignal.timeout`) até T012 passar
- [X] T014 [P] Implementar `src/modules/voluntariado/infrastructure/drizzle/contatos-whatsapp.ts` (`import 'server-only'`) satisfazendo `ContatosWhatsapp`: `telefonesDe(userIds)` lê `voluntario_perfil.telefone` em uma consulta `inArray`; `usuariosPorTelefone(digitos)` devolve os `userId` cujo telefone está na lista

**Checkpoint**: domínio testado; adapter HTTP e ports prontos.

---

## Phase 3: User Story 1 - Receber no WhatsApp os avisos importantes (Priority: P1) 🎯 MVP

**Goal**: os 5 eventos cobertos chegam ao WhatsApp de quem tem opt-in e celular, sem alterar
sino/e-mail nem atrasar a ação; broadcast informa o alcance.

**Independent Test**: com um voluntário de teste com `preferencia_whatsapp.ativo = true` inserida
direto no banco e celular válido, aprovar o cadastro, atribuir atividade, alterá-la, rodar o cron
de lembrete e enviar broadcast — cada um chega ao WhatsApp, o e-mail continua chegando e o sino
registra (quickstart passos 1, 2, 4, 6, 7, 8).

### Testes primeiro

- [X] T015 [P] [US1] Escrever `src/modules/notificacoes/infrastructure/whatsapp-repositorio.integracao.test.ts` (parte de envios): `registrarTentativas` com 2 elegíveis e 1 `canal_desativado` insere 2 `pendente` com `destino` e 1 `nao_enviado` com `motivo`; chamar de novo para as mesmas notificações não insere nada e devolve lista vazia (FR-008); `marcarEnviado`/`marcarFalha` só alteram linha em `pendente`; `lerPreferencias(userIds)` devolve só `preferencia_whatsapp.ativo` por usuário (ausente = falso) — o `ativo` do usuário vem de `buscarContatos` (research D10)
- [X] T016 [P] [US1] Escrever `src/modules/notificacoes/infrastructure/despacho-whatsapp.test.ts` com repositório, `ContatosWhatsapp` e `MensageriaWhatsapp` em memória: evento fora da matriz não gera tentativa; canal não configurado → todas `nao_enviado`/`nao_configurado` e zero chamadas HTTP; elegíveis recebem `enviarModelo` com `MODELO_POR_EVENTO[evento]` e `parametrosDoModelo(titulo, mensagem)`; erro 131026 grava `falhou`/`numero_sem_whatsapp`; no máximo 10 envios simultâneos; exceção do repositório é capturada (não propaga); resumo `{ elegiveis, naoAlcancaveis }` correto; depois de um `falhou`, nenhuma nova chamada para a mesma notificação (FR-019); o telefone é lido do port a cada despacho, então uma troca de número vale a partir do próximo envio (US2 cenário 4)

### Implementação

- [X] T017 [US1] Criar `src/modules/notificacoes/infrastructure/whatsapp-repositorio.ts` (`import 'server-only'`) com `lerPreferencias` (lê só `preferencia_whatsapp`), `registrarTentativas` (insert único com `onConflictDoNothing` no índice `(notificacaoId, canal)` + `returning`), `marcarEnviado(id, idExterno)` e `marcarFalha(id, motivo, erro)` com `WHERE status = 'pendente'`, até a parte de envios de T015 passar
- [X] T018 [US1] Criar `src/modules/notificacoes/infrastructure/despacho-whatsapp.ts` com `despacharWhatsapp(chunk, gravadas, deps)`: filtra por `eventoVaiPorWhatsapp` (ou `canais` explícito), avalia elegibilidade combinando `buscarContatos` (situação do usuário), `lerPreferencias` e `ContatosWhatsapp.telefonesDe` — sem importar `db/schema/identidade` nem `db/schema/voluntariado` (Princípio I, research D10) —, registra tentativas, e agenda `enviarPendentes` com `after()` de `next/server` — envolvido em `try/catch` que envia inline quando fora de escopo de requisição (research D3); concorrência 10; devolve o resumo — até T016 passar
- [X] T019 [US1] Em `src/modules/notificacoes/infrastructure/index.ts`: chamar `despacharWhatsapp` depois de `despacharEmails` em cada chunk (dentro do mesmo `try`, sem impedir o e-mail se falhar), injetando `whatsapp-cloud-api`, `whatsapp-repositorio` e `contatos-whatsapp` do Voluntariado; implementar `enviarEmLoteComResumo` somando os resumos dos chunks; atualizar o comentário de ordem de canais
- [X] T020 [US1] Em `src/modules/notificacoes/presentation/actions/notificacoes.ts`: `enviarBroadcast` usa `enviarEmLoteComResumo` e devolve `{ destinatarios, whatsapp: { elegiveis, naoAlcancaveis } }` (contracts/canal-e-interfaces.md §2)
- [X] T021 [US1] Em `app/(interno)/(staff)/convocacao/convocacao-form.tsx`: contador "WhatsApp: N/700" sob o campo de mensagem usando `LIMITE_MENSAGEM_WHATSAPP`; acima do limite, `Alert` de aviso com o texto de contracts/canal-e-interfaces.md §2 (não bloqueia o envio); toast de sucesso "X voluntários convocados — Y pelo WhatsApp" + "Z sem WhatsApp habilitado" quando houver
- [X] T022 [US1] Conferir que os chamadores do port não precisam mudar (`aprovar-candidatura.ts`, `alocar-voluntario.ts`, `gerir-atividade.ts`, `inscricao-turno.ts`, `app/api/cron/lembrete-turno/route.ts`, `alertas-coordenador.ts`) e que dublês do `NotificacaoService` em testes existentes (`grep -rn "enviarEmLote" src --include=*.test.ts`) implementam o novo método `enviarEmLoteComResumo`; rodar `npm test`
- [X] T023 [US1] Escrever `src/modules/notificacoes/infrastructure/despacho-whatsapp.integracao.test.ts`: 200 destinatários elegíveis no Neon real e `MensageriaWhatsapp` falsa com 300 ms de latência por chamada. Verificar que (a) `enviarEmLoteComResumo` devolve em menos de 2 s, porque o envio fica para depois da resposta; (b) depois de rodar o envio, as 200 linhas saem de `pendente` em menos de 60 s; (c) nunca há mais de 10 chamadas simultâneas (SC-002, FR-017)

**Checkpoint**: MVP entregável — com opt-in gravado manualmente, os avisos chegam ao WhatsApp.

---

## Phase 4: User Story 2 - Decidir se quero receber pelo WhatsApp (Priority: P1)

**Goal**: opt-in explícito pelo cadastro e pela tela Minha conta → Notificações, com histórico.

**Independent Test**: ativar/desativar na tela e disparar um evento em cada estado; marcar a caixa
numa candidatura nova (quickstart passos 2, 3, 12, 14).

### Testes primeiro

- [X] T024 [P] [US2] Escrever `src/modules/notificacoes/application/use-cases/alterar-preferencia-whatsapp.test.ts` com repositório em memória: ativar sem linha prévia grava estado e 1 evento `concedido` com origem e telefone E.164 vigente; ativar já ativo não gera evento; desativar gera `revogado`; usuário sem perfil ou com telefone fixo não pode **ativar** (erro `sem_celular`), mas pode desativar
- [X] T025 [P] [US2] Acrescentar a `whatsapp-repositorio.integracao.test.ts` (parte de consentimento): `salvarPreferencia` faz upsert em `preferencia_whatsapp` e insere em `consentimento_whatsapp` na mesma transação; histórico nunca é atualizado
- [X] T026 [P] [US2] Acrescentar a `src/modules/voluntariado/application/use-cases/submeter-candidatura.test.ts`: com `aceitaWhatsapp: true` e candidatura aceita, o `ConsentimentoWhatsappPort` falso recebe `registrar(userId, true, 'cadastro')`; com `false` ou candidatura rejeitada pela validação, não é chamado (e `false` nunca revoga)

### Implementação

- [X] T027 [US2] Acrescentar a `whatsapp-repositorio.ts` `lerPreferencia(userId)` (estado + data da última concessão) e `salvarPreferencia(userId, ativo, origem, telefone)` transacional, até T025 passar
- [X] T028 [US2] Implementar `src/modules/notificacoes/application/use-cases/alterar-preferencia-whatsapp.ts` (depende de um port de repositório de preferência e de `ContatosWhatsapp`) até T024 passar; exportar também uma implementação de `ConsentimentoWhatsappPort` em `src/modules/notificacoes/infrastructure/consentimento-whatsapp.ts` que delega ao caso de uso
- [X] T029 [US2] Em `src/modules/voluntariado/application/use-cases/submeter-candidatura.ts`: aceitar `aceitaWhatsapp?: boolean` na entrada (fora de `dados`, que é o tipo de domínio da candidatura) e um `ConsentimentoWhatsappPort` opcional no construtor; registrar a concessão depois do sucesso; falha do port é logada e não derruba a candidatura — até T026 passar
- [X] T030 [US2] Em `src/modules/voluntariado/presentation/actions/candidatura.ts`: `aceitaWhatsapp: z.boolean().default(false)` no esquema; injetar `consentimentoWhatsapp` no `SubmeterCandidaturaUseCase`
- [X] T031 [US2] Em `app/(interno)/voluntariado/candidatura/candidatura-form.tsx`: checkbox desmarcado logo abaixo do telefone, com rótulo e texto de apoio de contracts/canal-e-interfaces.md §4, integrado ao esquema RHF/Zod do formulário; alvo de toque ≥ 44 px
- [X] T032 [P] [US2] Criar `src/modules/notificacoes/presentation/queries/preferencia-whatsapp.ts` (`import 'server-only'`): para o `userId` da sessão devolve `{ temPerfil, celular: boolean, telefoneMascarado, ativo, ativoDesde }`. O telefone e a existência de perfil vêm de `ContatosWhatsapp.telefonesDe([userId])` (sem telefone = sem perfil); a query não importa `db/schema/voluntariado` (Princípio I)
- [X] T033 [US2] Criar `src/modules/notificacoes/presentation/actions/preferencia-whatsapp.ts` (`'use server'`): `alterarPreferenciaWhatsapp({ ativo })` — sessão obrigatória, `userId` da sessão, Zod, chama o caso de uso com origem `perfil`, `revalidatePath('/conta/notificacoes')`, `ResultadoAction<{ ativo: boolean }>` com mensagens pt-BR
- [X] T034 [US2] Criar `app/(interno)/conta/notificacoes/page.tsx` (Server Component com `Suspense` e skeleton, metadata "Notificações — SOS Jaraguá") e `app/(interno)/conta/notificacoes/preferencia-whatsapp.tsx` (client: botão ativar/desativar com `useTransition` + toast) cobrindo os 4 estados da tabela de contracts/canal-e-interfaces.md §3; layout mobile-first
- [X] T035 [US2] Em `src/shared/auth/navegacao.ts`: item `{ href: '/conta/notificacoes', rotulo: 'Notificações', icone: 'BellRing', grupo: 'pessoal', roles: [...ROLES] }` (comentário: sem regra em `REGRAS_DE_ROTA`, só sessão; visível a todos os papéis porque há equipe com perfil de voluntário que recebe convocação — quem não tem perfil vê o estado "disponível depois do cadastro"); registrar `BellRing` em `src/shared/ui/shell/icones.ts`; rodar `navegacao.test.ts`

**Checkpoint**: US1 + US2 = canal completo e conforme (opt-in real).

---

## Phase 5: User Story 3 - Acompanhar se as mensagens chegaram (Priority: P2)

**Goal**: webhook assinado atualiza a situação; R-16 mostra WhatsApp com motivo e destino
mascarado.

**Independent Test**: com o webhook cadastrado na Meta, ler uma mensagem e ver Enviado → Entregue →
Lido no R-16; número sem WhatsApp aparece como falha com motivo; `curl` sem assinatura → 401
(quickstart passos 5, 11, 13).

### Testes primeiro

- [X] T036 [P] [US3] Escrever `src/modules/notificacoes/presentation/http/webhook-whatsapp.test.ts` (contrato, sem rede, repositório simulado): `GET` com `hub.verify_token` certo → 200 com o challenge em texto; errado ou sem `WHATSAPP_VERIFY_TOKEN` → 403; `POST` sem `X-Hub-Signature-256`, com assinatura de outro corpo ou sem `WHATSAPP_APP_SECRET` → 401 e nenhum repositório chamado; `POST` assinado com `statuses` `delivered` → atualização com `entregue`; `failed` com `errors[0].code = 131026` → `falhou`/`numero_sem_whatsapp`; JSON inválido assinado → 200 sem efeito; exceção do repositório → 500
- [X] T037 [P] [US3] Escrever `src/modules/notificacoes/application/use-cases/processar-webhook-whatsapp.test.ts` (parte de situações): aplica `proximaSituacao` à situação lida por `idExterno`; `wamid` desconhecido é ignorado; `read` antes de `delivered` → `lido` e o `delivered` posterior não regride; um `status: read` não altera `notificacao.lida` — o repositório falso de notificações não recebe nenhuma chamada (FR-027)
- [X] T038 [P] [US3] Acrescentar a `whatsapp-repositorio.integracao.test.ts` (parte de situações): `atualizarSituacao(idExterno, de, para, motivo?)` grava só quando a situação atual é `de` (concorrência), atualiza `atualizadoEm` e `enviadoEm` na transição para `enviado`

### Implementação

- [X] T039 [US3] Acrescentar a `whatsapp-repositorio.ts` `buscarPorIdExterno` e `atualizarSituacao` até T038 passar
- [X] T040 [US3] Implementar `src/modules/notificacoes/application/use-cases/processar-webhook-whatsapp.ts` (parte de `statuses`, payload já validado por Zod) até T037 passar
- [X] T041 [US3] Implementar `src/modules/notificacoes/presentation/http/webhook-whatsapp.ts` (handlers `verificar(request)` e `receber(request)`: corpo bruto, HMAC-SHA256 com `timingSafeEqual`, esquema Zod do payload da Meta, chamada ao caso de uso) até T036 passar; criar `app/api/webhooks/whatsapp/route.ts` exportando `GET`/`POST` que delegam a ele
- [X] T042 [US3] Em `proxy.ts`: acrescentar `api/webhooks` ao lookahead negativo do `matcher`, com comentário no estilo do de `api/notificacoes` explicando por que (sem sessão; autenticação pela assinatura; redirect para `/login` quebraria a Meta)
- [X] T043 [US3] Em `src/modules/notificacoes/presentation/queries/relatorios.ts`: incluir `motivo` e `destino` em `LinhaEnvio` e na seleção; aceitar os novos valores de `StatusEnvio`
- [X] T044 [US3] Em `src/modules/contingencia/application/definicoes/consolidados.ts`: `CANAIS` e `ROTULO_CANAL` com `whatsapp: 'WhatsApp'`; `SITUACOES_FILTRO`/rótulos com `entregue`, `lido`, `nao_enviado`; constante `ROTULO_MOTIVO` (pt-BR para os 8 motivos); colunas "Motivo" e "Destino" no R-16, com `mascararTelefone` para quem não é `administrador` (FR-025); atualizar o teste do relatório existente se houver (`grep -rn "Envio de notificações\|ROTULO_CANAL" src --include=*.test.ts`)

**Checkpoint**: canal observável; custo e falhas conciliáveis pelo R-16.

---

## Phase 6: User Story 4 - Parar de receber respondendo à mensagem (Priority: P3)

**Goal**: "SAIR" revoga o opt-in; outras mensagens recebem resposta automática limitada.

**Independent Test**: responder "Sair" e conferir preferência desativada, confirmação recebida e
próximo evento sem WhatsApp; responder "oi" duas vezes e receber uma única resposta automática
(quickstart passos 9, 10).

### Testes primeiro

- [X] T045 [P] [US4] Acrescentar a `processar-webhook-whatsapp.test.ts` (parte de mensagens): "Sair" de número com 2 usuários (casado por `variantesDeWaId`, incluindo `wa_id` sem o 9º dígito) revoga ambos com origem `resposta_whatsapp` e envia 1 confirmação; "Sair" de número desconhecido não revoga nada; "oi" → `enviarTexto` com a resposta automática só quando o limitador devolve verdadeiro; mensagem não-texto segue a regra de "qualquer outra"; nenhuma ação de negócio é chamada
- [X] T046 [P] [US4] Acrescentar a `whatsapp-repositorio.integracao.test.ts` (parte de resposta automática): `podeResponderAutomaticamente(telefone)` devolve verdadeiro na 1ª chamada e falso na 2ª dentro de 24 h (upsert condicional de data-model.md §5)
- [X] T047 [P] [US4] Acrescentar a `webhook-whatsapp.test.ts`: `POST` assinado com `messages` de texto "Parar" → caso de uso chamado com a mensagem

### Implementação

- [X] T048 [US4] Acrescentar a `whatsapp-repositorio.ts` `podeResponderAutomaticamente` até T046 passar
- [X] T049 [US4] Completar `processar-webhook-whatsapp.ts` com o tratamento de `messages` (revogação via `alterar-preferencia-whatsapp` com origem `resposta_whatsapp` para cada usuário de `ContatosWhatsapp.usuariosPorTelefone`, confirmação e resposta automática com os textos de contracts/modelos-whatsapp.md "Mensagens livres", links a partir de `BETTER_AUTH_URL`) até T045 e T047 passarem

**Checkpoint**: todas as stories funcionais.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T050 [P] Revisar que nenhuma mensagem enviada contém CPF, restrições de saúde ou dados de terceiros (FR-005): inspecionar os textos de notificação dos 5 eventos em `aprovar-candidatura.ts`, `alocar-voluntario.ts`, `gerir-atividade.ts`, `inscricao-turno.ts`, `app/api/cron/lembrete-turno/route.ts`
- [X] T051 [P] Documentar em `README.md` (seção de variáveis de ambiente) as variáveis `WHATSAPP_*`, os 5 modelos a aprovar e o cadastro do webhook (`/api/webhooks/whatsapp`, campo `messages`), apontando para `specs/024-notificacoes-whatsapp/quickstart.md`
- [X] T052 Rodar `npm run lint`, `npx tsc --noEmit`, `npm test` e `npm run test:integracao`; corrigir o que falhar
- [ ] T053 Executar o roteiro manual de `specs/024-notificacoes-whatsapp/quickstart.md` (passos 1–15) com o número de teste da Meta e registrar o resultado

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências. T005 → T006. T007 pode correr em paralelo ao resto, mas
  precisa estar aprovado antes do merge.
- **Foundational (Phase 2)**: depende de T006. T008 → T009; T012 → T013. Bloqueia todas as stories.
- **US1 (Phase 3)**: depende da Fase 2. É o MVP.
- **US2 (Phase 4)**: depende da Fase 2; usa `whatsapp-repositorio.ts` criado em T017 (US1). Pode
  começar em paralelo a US1 se T017 for feito primeiro.
- **US3 (Phase 5)**: depende de US1 (só há situações a atualizar depois de envios com `idExterno`).
- **US4 (Phase 6)**: depende de US3 (rota do webhook, caso de uso) e de US2 (caso de uso de
  preferência para revogar).
- **Polish (Phase 7)**: depois das stories desejadas.

### User Story Dependencies

```text
Setup ─► Foundational ─► US1 ─┬─► US3 ─┐
                       └► US2 ─┴────────┴─► US4 ─► Polish
```

### Within Each User Story

- Testes escritos e falhando antes da implementação.
- Repositório → caso de uso/despacho → presentation → UI.

### Parallel Opportunities

- Setup: T002, T003, T004 juntos (arquivos distintos); T001 em paralelo a eles.
- Foundational: depois de T009, T010, T011, T012 e T014 juntos.
- US1: T015 e T016 juntos.
- US2: T024, T025 e T026 juntos; T032 em paralelo a T027–T031.
- US3: T036, T037 e T038 juntos; T043/T044 em paralelo a T039–T042.
- US4: T045, T046 e T047 juntos.

---

## Parallel Example: User Story 2

```bash
# Testes primeiro, em paralelo:
Task: "T024 alterar-preferencia-whatsapp.test.ts"
Task: "T025 whatsapp-repositorio.integracao.test.ts (consentimento)"
Task: "T026 submeter-candidatura.test.ts (aceitaWhatsapp)"

# Depois, em paralelo à cadeia T027→T031:
Task: "T032 presentation/queries/preferencia-whatsapp.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T036 webhook-whatsapp.test.ts (contrato)"
Task: "T037 processar-webhook-whatsapp.test.ts (situações)"
Task: "T038 whatsapp-repositorio.integracao.test.ts (situações)"
# Em paralelo à cadeia do webhook:
Task: "T043 queries/relatorios.ts"
Task: "T044 consolidados.ts (R-16)"
```

---

## Implementation Strategy

### MVP First (US1)

1. Fase 1 (docs + esquema) e Fase 2 (domínio + adapter).
2. Fase 3 (US1). Validar com opt-in inserido direto no banco e o número de teste da Meta.
3. **Não liberar em produção só com US1**: sem US2 ninguém consegue dar opt-in pela interface —
   o canal ficaria efetivamente desligado. US1 é o MVP de **desenvolvimento**; o MVP de
   **produção** é US1 + US2.

### Incremental Delivery

1. US1 + US2 → produção (canal útil e conforme a LGPD/política da Meta).
2. US3 → observabilidade e conciliação de custo.
3. US4 → descadastro por resposta (reduz risco de bloqueio do número).

### Antes de ativar em produção (fora do código)

- Portfólio verificado, número dedicado, token permanente, 5 modelos aprovados
  (contracts/modelos-whatsapp.md), webhook cadastrado — quickstart.md "Pré-requisitos".
