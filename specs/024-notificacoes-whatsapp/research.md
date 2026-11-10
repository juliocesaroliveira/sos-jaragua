# Research: Notificações também pelo WhatsApp

**Feature**: 024-notificacoes-whatsapp | **Date**: 2026-10-14

As duas decisões de produto em aberto foram respondidas na spec (2026-10-14): eventos cobertos
(os 4 do e-mail + lembrete de turno) e consentimento (opt-in explícito, desligado para todos).
Nenhum item do Technical Context ficou como NEEDS CLARIFICATION. Esta pesquisa registra as
decisões técnicas, a partir da varredura do código e da documentação atual da plataforma da Meta.

---

## D1 — WhatsApp Cloud API oficial, chamada por `fetch`, sem SDK

- **Decision**: integrar diretamente com a **WhatsApp Cloud API** (Graph API, hospedada pela
  Meta) usando `fetch` nativo. Versão da Graph API configurável por variável de ambiente.
- **Rationale**: a Meta não mantém SDK oficial de Node para a Cloud API; os pacotes da comunidade
  cobrem a mesma meia dúzia de chamadas que o adapter precisa (enviar modelo, enviar texto,
  verificar assinatura) e trariam dependência nova sem capacidade nova — o que a constituição
  ("Stack e Convenções Técnicas") desaconselha. O adapter de e-mail usa o SDK do Resend porque ele
  existe e é oficial; aqui o equivalente é o próprio HTTP.
- **Alternatives considered**:
  - *BSP (Twilio, Zenvia, Gupshup…)*: mais uma camada de custo e de conta; o pedido foi explícito
    pela API da Meta.
  - *On-Premises API*: descontinuada pela Meta.
  - *Bibliotecas não oficiais que automatizam o WhatsApp Web*: violam os termos de uso e arriscam
    banimento do número (spec, Assumptions).

## D2 — O WhatsApp é mais um canal **dentro** de `notificacaoService`

- **Decision**: o despacho do WhatsApp entra em `notificacoes/infrastructure/index.ts`, ao lado de
  `despacharEmails`, como `despacharWhatsapp`. O port `NotificacaoService` ganha um método,
  `enviarEmLoteComResumo`, usado só pelo broadcast (FR-024); `enviar` e `enviarEmLote` não mudam.
  `CanalNotificacao` ganha `'whatsapp'`. A matriz de eventos fica numa função pura de `domain`
  (`eventoVaiPorWhatsapp`), espelhando `eventoVaiPorEmail`.
- **Rationale**: todos os eventos cobertos já passam pelo port — `aprovar-candidatura`,
  `alocar-voluntario`, `gerir-atividade`, `inscricao-turno` (injetado), `enviarBroadcast` e o cron
  de lembrete. Nenhum chamador muda. A ordem já estabelecida (sino primeiro, depois canais
  acessórios) continua valendo.
- **Alternatives considered**: um segundo serviço chamado pelos casos de uso — espalharia a
  decisão de canal por seis chamadores e quebraria o "um port, vários adapters" do DESIGN.md §12.

## D3 — Registro `pendente` síncrono, envio em `after()`

- **Decision**: dentro de `enviarEmLote`, o serviço (1) resolve a elegibilidade de cada
  destinatário, (2) insere **numa só instrução** as linhas de `notificacao_envio` do canal
  `whatsapp` — `pendente` para os elegíveis e `nao_enviado` com motivo para os demais — e
  (3) agenda o envio HTTP com `after()` do `next/server`. Fora de escopo de requisição (testes de
  integração, scripts), `after()` lança; o serviço captura e envia inline.
- **Rationale**: FR-017 exige que a operação de negócio não espere a Meta. Um broadcast para 200
  voluntários são 200 chamadas HTTP — mesmo com concorrência limitada, alguns segundos que hoje
  não existem no tempo de resposta. A documentação do Next instalado confirma que `after` vale em
  Server Functions e Route Handlers, aceita aninhamento e roda até o `maxDuration` da rota (300 s
  no Fluid Compute). Gravar `pendente` antes garante que nenhuma tentativa some sem rastro (FR-021)
  e permite ao broadcast devolver a contagem de elegíveis na hora (FR-024).
- **Alternatives considered**:
  - *Enviar inline, como o e-mail*: atrasa a ação do coordenador proporcionalmente ao lote.
  - *Vercel Queues*: resolveria broadcasts muito grandes, mas é infraestrutura nova (Princípio VI)
    para um volume de centenas, que cabe folgado em uma invocação.

## D4 — Idempotência por índice único

- **Decision**: índice único em `notificacao_envio (notificacao_id, canal)` (ver D4b); inserção com `ON CONFLICT DO NOTHING ... RETURNING`. Só as linhas efetivamente
  inseridas são despachadas. O envio HTTP só ocorre para linhas em `pendente`, e a transição para
  `enviado`/`falhou` é um `UPDATE ... WHERE status = 'pendente'`.
- **Rationale**: FR-008/SC-005. Como cada `notificacao` já é a cópia por destinatário, uma linha
  por notificação no canal é exatamente "a mesma notificação no máximo uma vez". O `WHERE status =
  'pendente'` impede que um reprocessamento reenvie algo já entregue.
- **Alternatives considered**: deduplicar em memória — não sobrevive a duas invocações.

## D4b — Índice único composto, não parcial

- **Decision**: `UNIQUE (notificacao_id, canal)` em `notificacao_envio`, substituindo o índice
  simples `notificacao_envio_notificacao_idx`.
- **Rationale**: a primeira versão era parcial (`WHERE canal = 'whatsapp'`) e falhou ao aplicar.
  O migrador do Drizzle roda todas as migrações pendentes numa só transação
  (`drizzle-orm/pg-core/dialect.js`), e o Postgres recusa usar um valor de enum criado na mesma
  transação ("unsafe use of new value"). O contorno `canal::text = 'whatsapp'` também falhou:
  "functions in index predicate must be marked IMMUTABLE" (a saída de enum é `STABLE`). O
  composto não tem predicado e vale para todos os canais. Conferido em 2026-10-14: nenhuma
  duplicata de `(notificacao_id, canal)` no banco, e o código grava uma linha por canal.
- **Alternatives considered**: duas migrações separadas (rodariam na mesma transação de
  qualquer forma); dois deploys (complica o fluxo sem ganho); índice parcial com `canal::text`
  (recusado pelo Postgres, acima).

## D5 — Concorrência e limites de envio da Meta

- **Decision**: envio com concorrência fixa de 10 requisições simultâneas. Erros de limite da
  Meta (limite de mensagens do portfólio, limite de taxa) são classificados como motivo
  `limite_envio` e **não** são repetidos automaticamente.
- **Rationale**: a Cloud API aceita dezenas de mensagens por segundo por número; 10 em paralelo
  conclui 200 envios em poucos segundos sem estourar a taxa. Desde out/2025 o limite de
  **destinatários únicos por 24 h** é por portfólio empresarial e começa em 250, subindo para
  2.000, 10.000, 100.000 e ilimitado conforme verificação e qualidade. Um broadcast para todos os
  voluntários pode exceder o limite inicial — FR-020 aceita alcance parcial, registrado.
  Retentativa automática de um erro de limite só gastaria o limite do dia seguinte com avisos
  vencidos.
- **Alternatives considered**: contar o consumo localmente e parar antes do limite — a contagem
  da Meta é por portfólio e inclui envios feitos fora do sistema; a fonte de verdade é a resposta
  da API.

## D6 — Modelos de mensagem: um por evento, categoria Utilidade, com texto fixo

- **Decision**: 5 modelos `utility` em `pt_BR` (ver contracts/modelos-whatsapp.md), cada um com
  texto fixo próprio do evento + 2 variáveis (título e mensagem da notificação) + botão de URL
  estática "Abrir no SOS Jaraguá". Nomes dos modelos em código, idioma e URL base por ambiente.
- **Rationale**: a Meta exige modelo aprovado para mensagens iniciadas pela empresa. Um modelo
  único genérico ("{{1}}: {{2}}") tende a ser rejeitado ou reclassificado como Marketing (mais
  caro) por ter mais variável que texto. Texto fixo por evento mantém a categoria Utilidade. Usar
  título e mensagem que **já** existem na notificação cumpre FR-004/FR-005 sem um segundo
  conjunto de textos para manter.
- **Restrições dos parâmetros** (regras da Meta): variável não pode conter quebra de linha,
  tabulação nem mais de 4 espaços seguidos; o corpo inteiro tem até 1.024 caracteres. O domínio
  normaliza (quebras viram " — ") e limita a mensagem a **700 caracteres** (folga para o texto
  fixo e um título de até 120).
- **Alternatives considered**: botão com URL dinâmica (sufixo variável) — permitiria abrir a
  atividade exata, mas as telas do voluntário (`/voluntariado/minhas-atividades`) não têm rota
  por atividade; URL estática por evento basta.

## D7 — Broadcast acima de 700 caracteres: aviso explícito e versão encurtada

- **Decision**: o formulário de convocação mostra um contador para o WhatsApp. Acima de 700
  caracteres, mostra um aviso de que o WhatsApp levará os primeiros ~680 caracteres seguidos de
  "… (continua no SOS Jaraguá)", e que e-mail e sino levam o texto completo. O envio não é
  bloqueado.
- **Rationale**: FR-007 proíbe **cortar em silêncio**, não cortar com aviso prévio. Bloquear
  obrigaria a encurtar também o e-mail numa emergência; o botão do modelo leva ao texto completo.
- **Alternatives considered**: bloquear acima do limite; dividir em várias mensagens (multiplica
  custo e chega fora de ordem).

## D8 — Destino: só celular, em E.164, e o problema do 9º dígito

- **Decision**: destino = `55` + 11 dígitos normalizados, aceito apenas quando o 3º dígito é `9`
  (celular — `telefoneEhValido` já impõe isso para 11 dígitos). Telefones de 10 dígitos são fixos
  → `nao_enviado` / `sem_celular`. Para **respostas recebidas**, o `wa_id` informado pela Meta pode
  vir **sem** o 9º dígito (contas antigas); a busca do usuário tenta as duas formas.
- **Rationale**: FR-003; edge case "telefone fixo". O descasamento do 9º dígito em números
  brasileiros é comportamento conhecido da plataforma; sem a dupla forma, o "SAIR" de parte dos
  voluntários não seria reconhecido.
- **Alternatives considered**: chamar a API de verificação de contatos antes de enviar — a Cloud
  API não oferece mais esse endpoint; o erro de "número sem WhatsApp" na resposta é o sinal.

## D9 — Consentimento: estado atual + histórico, no módulo Notificações

- **Decision**: tabela `preferencia_whatsapp` (estado atual, 1 linha por usuário) e tabela
  append-only `consentimento_whatsapp` (cada concessão/revogação com origem e número da época),
  ambas em `db/schema/notificacoes.ts`. Ausência de linha = desabilitado (FR-013 sem migração de
  dados para os voluntários existentes).
- **Rationale**: o consentimento é sobre um **canal de notificação**, não sobre o perfil de
  voluntário — pertence ao bounded context Notificações. Estado atual separado do histórico mantém
  a consulta de elegibilidade (200 destinatários) em uma leitura indexada simples; o histórico
  atende FR-011 e serve de evidência de LGPD.
- **Alternatives considered**: coluna em `voluntario_perfil` — misturaria contextos e perderia o
  histórico; derivar o estado do último evento do histórico — `DISTINCT ON` em todo envio, sem
  ganho.

## D10 — Telefone lido por port do Voluntariado

- **Decision**: o módulo Notificações declara o port `ContatosWhatsapp` (`telefonesDe(userIds)`,
  `usuariosPorTelefone(variantes)`); a implementação vive em
  `voluntariado/infrastructure/drizzle/` e é a única que lê `voluntario_perfil.telefone`. A
  situação "usuário ativo" é lida pelo `buscarContatos` que já existe em
  `notificacao-plataforma.ts`, o mesmo que o e-mail usa. Nenhuma leitura nova de tabela de outro
  módulo é criada.
- **Rationale**: Princípio I — um módulo não lê tabela de outro diretamente. (O código atual já
  tem exceções históricas, como `buscarContatos` lendo `user`; esta feature não as amplia.)
- **Alternatives considered**: ler `voluntario_perfil` a partir de `notificacoes/infrastructure` —
  viola o princípio sem necessidade.

## D11 — Opt-in no cadastro via o caso de uso da candidatura

- **Decision**: `SubmeterCandidaturaUseCase` recebe um campo `aceitaWhatsapp` e um port injetado
  `ConsentimentoWhatsappPort` (implementado por Notificações). Quando marcado, registra a concessão
  com origem `cadastro`. A Server Action continua chamando um único caso de uso.
- **Rationale**: Princípio I ("presentation chama exatamente um caso de uso"). A concessão só é
  gravada se a candidatura for aceita.
- **Alternatives considered**: a action chamar dois serviços em sequência.

## D12 — Tela "Minha conta → Notificações"

- **Decision**: nova rota `/conta/notificacoes` no grupo `pessoal` da navegação, visível para
  todos os papéis: o canal é de quem tem perfil de voluntário, e há equipe (coordenação, Defesa
  Civil) com perfil aprovado que recebe convocação (decisão de 2026-10-14, análise U2). Mostra o
  estado, o número mascarado e o botão de ativar/desativar. Sem perfil de voluntário ou com
  telefone fixo, explica por que o canal não está disponível.
- **Rationale**: não existe página de perfil hoje; a spec pede o controle em "Minha conta →
  Notificações".
  Uma página pequena em "Minha conta" é o lugar natural e já tem grupo de navegação.
  `navegacao.test.ts` trava a consistência com `rotas.ts` — a rota não precisa de regra de role
  (só sessão), como a candidatura.
- **Alternatives considered**: colocar o controle dentro de `/voluntariado/candidatura` — a tela é
  de candidatura/reenvio, e alterar a preferência não deve exigir reenviar dados à triagem.

## D13 — Webhook: rota pública com assinatura HMAC

- **Decision**: `app/api/webhooks/whatsapp/route.ts`:
  - `GET` — handshake de verificação (`hub.mode=subscribe`, `hub.verify_token` comparado com
    `WHATSAPP_VERIFY_TOKEN`, devolve `hub.challenge`).
  - `POST` — lê o corpo **bruto**, valida `X-Hub-Signature-256` (HMAC-SHA256 com
    `WHATSAPP_APP_SECRET`, comparação em tempo constante); só então faz o parse. Assinatura
    ausente/inválida → `401`, sem efeito (FR-016).
  - A rota é isenta do `proxy.ts` (matcher ganha `api/webhooks`), pela mesma razão documentada
    para `api/notificacoes`: o proxy redirecionaria a chamada sem sessão para `/login`.
- **Rationale**: Princípio IV — a autenticação desta rota é a assinatura, não a sessão. A Meta
  reenvia quando não recebe 2xx, então a rota responde `200` a todo payload **assinado**, inclusive
  os que ignora, e processa de forma idempotente.
- **Alternatives considered**: uma rota catch-all `api/webhooks/[provedor]` — generalização sem
  segundo provedor.

## D14 — Situação do envio é monotônica

- **Decision**: ordem `pendente < enviado < entregue < lido`; `falhou` só a partir de `pendente`
  ou `enviado`; `nao_enviado` é terminal e só nasce na inserção. Função pura
  `proximaSituacao(atual, recebida)` decide; o `UPDATE` grava apenas se ela devolver mudança.
- **Rationale**: FR-022 e o edge case de confirmações fora de ordem/repetidas — a Meta não garante
  ordem de entrega dos webhooks.

## D15 — Mensagens recebidas: descadastro e resposta automática com limite

- **Decision**: texto normalizado (minúsculas, sem acento, sem pontuação nas pontas) igual a
  `sair`, `parar`, `stop`, `cancelar` ou `descadastrar` → revoga a preferência de **todos** os
  usuários com aquele número (origem `resposta_whatsapp`) e envia uma confirmação. Qualquer outra
  mensagem → resposta automática fixa, no máximo **uma por número a cada 24 h** (tabela
  `whatsapp_resposta_automatica`). Número desconhecido → resposta automática apenas, sem efeito.
- **Rationale**: FR-014/FR-015. Respostas a uma mensagem recebida caem na janela de atendimento
  de 24 h e são texto livre gratuito. O limite evita laço com outro robô e o custo de responder a
  cada figurinha.
- **Alternatives considered**: não responder nada — o voluntário acharia que alguém leu.

## D16 — Configuração por ambiente; ausência = "não configurado"

- **Decision**: variáveis `WHATSAPP_ACCESS_TOKEN` (token permanente de usuário do sistema),
  `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`,
  `WHATSAPP_GRAPH_VERSION` e `WHATSAPP_TEMPLATE_LANG` (padrão `pt_BR`). Links usam
  `BETTER_AUTH_URL`, já existente. Sem token ou phone number id, todo envio vira
  `nao_enviado` / `nao_configurado` e um `console.warn`, exatamente como o e-mail sem
  `RESEND_API_KEY`.
- **Rationale**: FR-018 e o mesmo padrão já adotado para o Resend; desligar o canal em produção é
  remover a variável, sem deploy de código.

## D17 — Motivos de não entrega mapeados de códigos da Meta

- **Decision**: função pura `classificarErroMeta(codigo)` → `numero_sem_whatsapp` (131026),
  `limite_envio` (130429, 131048, 131056 e o erro de limite de portfólio), `modelo_indisponivel`
  (132000–132016, 132068), `nao_configurado` (190, 10, 200 — token/permissão), e `falha` para o
  resto, preservando código e texto originais em `erro`.
- **Rationale**: FR-021 e US3 cenário 3 ("motivo em linguagem compreensível"). A tabela de códigos
  fica isolada numa função testável, fácil de ajustar quando a Meta mudar a documentação.

## D18 — Atualizações de documentação e constituição

- **Decision**: antes do código (Princípio VI), atualizar `spec/DESIGN.md` §12 (terceiro canal,
  webhook, consentimento) e §6.2 (rota isenta do proxy), `spec/DB_SCHEMA.md` §8 (novos valores de
  enum, colunas e tabelas) e a matriz do BRD §6 (coluna Canal). Propor emenda PATCH da
  constituição em "Stack e Convenções Técnicas": "**Mensageria**: WhatsApp Cloud API (Meta), via
  HTTP, sem SDK" — via `/speckit-constitution`.

## Riscos residuais

- **Aprovação de modelos** depende da Meta e pode levar de minutos a dias; rejeição exige ajuste
  de texto (e `modelo_indisponivel` até lá).
- **Limite inicial de 250 destinatários/24 h** pode não cobrir um broadcast para todos os
  voluntários até o número ganhar histórico.
- **Qualidade do número**: muitos bloqueios/denúncias derrubam o limite; o opt-in explícito é a
  principal mitigação.
- **Custo**: cobrança por modelo entregue (Utilidade, tarifa do Brasil); o R-16 dá a contagem para
  conciliar com a fatura.
