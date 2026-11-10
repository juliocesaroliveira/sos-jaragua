# Implementation Plan: Notificações também pelo WhatsApp

**Branch**: `024-notificacoes-whatsapp` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/024-notificacoes-whatsapp/spec.md`

## Summary

O WhatsApp entra como **terceiro adapter** do `NotificacaoService` existente, ao lado do sino e do
e-mail. Nenhum caso de uso que dispara notificação muda: aprovação de candidatura, atribuição e
alteração de atividade, broadcast e o cron de lembrete já passam pelo port. Dentro de
`enviarEmLote`, depois do sino e do e-mail, o serviço avalia a elegibilidade de cada destinatário
(ativo + opt-in + celular), grava **na hora** uma linha `notificacao_envio` por notificação no
canal `whatsapp` (`pendente` ou `nao_enviado` com motivo) e agenda o envio HTTP para a Cloud API
da Meta com `after()`, para não atrasar a ação de quem disparou.

A entrega é feita por modelos de mensagem Utility (um por evento, texto fixo + título e mensagem
da notificação). Um webhook público, autenticado pela assinatura HMAC da Meta, atualiza a situação
(enviado → entregue → lido, sem regredir) e trata respostas: "SAIR" revoga o consentimento; o
resto recebe uma resposta automática limitada.

O consentimento é opt-in explícito: tabela de estado atual + histórico append-only, ativado numa
caixa do formulário de candidatura ou na nova tela **Minha conta → Notificações**. O relatório R-16
passa a mostrar o canal WhatsApp com motivo e destino mascarado.

Sem SDK novo (só `fetch`), sem fila, sem infraestrutura nova. Uma migração.

## Technical Context

**Language/Version**: TypeScript 5.9 (estrito), Node.js 24 (Vercel Fluid Compute)

**Primary Dependencies**: Next.js 16.3.8 (App Router; `after` de `next/server`), React 19.1,
Drizzle ORM 0.45, Zod 4, React Hook Form 7, Ark UI 5.38, Tailwind v4. **WhatsApp Cloud API**
(Graph API da Meta) via `fetch` nativo — sem pacote novo (research D1). `node:crypto` para HMAC.

**Storage**: Neon Postgres via Drizzle — 1 migração: 3 valores novos em enums, 1 enum de motivo,
4 colunas em `notificacao_envio`, 3 tabelas novas (`preferencia_whatsapp`,
`consentimento_whatsapp`, `whatsapp_resposta_automatica`). Ver [data-model.md](./data-model.md).

**Testing**: Vitest — `npm test` (domínio puro + contrato do webhook, sem rede);
`npm run test:integracao` (idempotência por índice único, histórico de consentimento,
transições de situação no Neon real)

**Target Platform**: Vercel (funções sob demanda, `maxDuration` padrão 300 s); celulares Android/iOS
dos voluntários com WhatsApp

**Project Type**: Monolito modular Next.js com bounded contexts em `src/modules/<modulo>/`

**Performance Goals**: zero acréscimo perceptível no tempo das ações que notificam (envio em
`after`); broadcast de 200 destinatários concluído e registrado em < 10 s de envio (concorrência
10) — SC-002 pede < 10 min; entrega ao celular < 2 min (SC-001)

**Constraints**: opt-in explícito (FR-013); nenhum efeito sem assinatura válida (FR-016); falha do
WhatsApp nunca derruba a operação (FR-017); sem dependência nova; texto de variável sem quebra de
linha e corpo ≤ 1.024 caracteres (regras da Meta); limite inicial de 250 destinatários únicos/24 h
por portfólio; interface 100% pt-BR e responsiva

**Scale/Scope**: dezenas a poucas centenas de voluntários; 2 módulos tocados (`notificacoes`
principal, `voluntariado` para port de telefone e caixa da candidatura) + `contingencia`
(rótulos do R-16); 1 Route Handler novo (webhook); 1 página nova (`/conta/notificacoes`);
5 modelos de mensagem na Meta

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Princípio | Avaliação | Status |
| --- | --- | --- |
| **I. Clean Architecture por Módulo** | Regras puras (matriz de eventos, elegibilidade, destino E.164/9º dígito, parâmetros do modelo, transição de situação, classificação de erros, descadastro) em `notificacoes/domain/whatsapp.ts`, sem Next/Drizzle. Casos de uso em `application/` (`alterarPreferenciaWhatsapp`, `processarWebhookWhatsapp`). Adapter HTTP e repositórios em `infrastructure/`. Webhook e action são `presentation` finos. Telefone lido **via port** `ContatosWhatsapp` implementado pelo Voluntariado (D10); a candidatura grava o opt-in **via port** `ConsentimentoWhatsappPort` (D11) — nenhum módulo lê tabela do outro. | ✅ PASS |
| **II. Tipagem Estrita e Qualidade** | Sem `any`; payloads da Meta parseados com Zod no webhook. Nomes de domínio pt-BR (`preferencia`, `consentimento`, `motivo`). Textos de UI e mensagens em pt-BR. Conventional Commits. | ✅ PASS |
| **III. Testes Focados em Regras de Negócio** | TDD nas 9 funções de domínio e nos 2 casos de uso (com ports em memória). Integração: índice único `(notificacao_id, canal)` (envio duplo → 1 linha), histórico só em mudança de estado, `UPDATE` monotônico. Webhook e adapter HTTP: teste de contrato (assinatura, handshake, mapeamento), sem rede. | ✅ PASS |
| **IV. Segurança e Defesa em Profundidade** | Rota nova pública **por desenho** — a Meta não tem sessão. Autenticação = HMAC-SHA256 do corpo bruto com o app secret, comparação em tempo constante; sem segredo configurado a rota recusa tudo (mesmo padrão de `CRON_SECRET`). Isenção no matcher do `proxy.ts` documentada como a de `api/notificacoes`. A action de preferência deriva o `userId` da sessão. Mensagens não carregam CPF/saúde (FR-005); destino mascarado para não-admin (FR-025). Token da Meta só em variável de ambiente. | ✅ PASS (rota pública justificada) |
| **V. Auditoria Não Bloqueante** | Nenhuma escrita nova em Voluntariado, Estoque ou Atividade — preferência e envios são do módulo Notificações. O histórico `consentimento_whatsapp` é registro de LGPD do próprio módulo, não substitui `withAudit`. A candidatura continua passando pelo `withAudit` existente. O envio do WhatsApp herda o contrato "notificar nunca derruba a operação". | ✅ PASS |
| **VI. Simplicidade Operacional** | **Serviço externo novo** (Meta). Justificado: é o objetivo da feature, pedido explicitamente, sem alternativa interna. Mitigações: sem SDK, sem fila, sem worker — `after()` + concorrência fixa cabem no volume; ausência de credenciais = sistema como hoje. Exige decisão documentada **antes** do código: DESIGN.md §12/§6.2, DB_SCHEMA.md §8, BRD §6 e emenda PATCH da constituição em "Stack" (research D18). | ✅ PASS com ação obrigatória |

**Gate result**: aprovado. Duas ações obrigatórias antes da implementação, registradas como
primeiras tarefas: (1) atualizar `spec/DESIGN.md`, `spec/DB_SCHEMA.md` e `spec/REQUISITOS_NEGOCIO.md`;
(2) emenda da constituição via `/speckit-constitution` acrescentando "**Mensageria**: WhatsApp
Cloud API (Meta), via HTTP, sem SDK" em "Stack e Convenções Técnicas".

**Re-avaliação pós-Fase 1**: o design manteve o previsto — 1 adapter, 1 Route Handler, 1 página,
3 tabelas pequenas no próprio módulo, 2 ports entre módulos. Nenhuma infraestrutura além do
serviço da Meta. Gates permanecem aprovados.

## Project Structure

### Documentation (this feature)

```text
specs/024-notificacoes-whatsapp/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — D1..D18 e riscos residuais
├── data-model.md        # Fase 1 — enums, colunas, tabelas, funções de domínio, ports
├── quickstart.md        # Fase 1 — pré-requisitos na Meta e roteiro de validação
├── contracts/
│   ├── modelos-whatsapp.md      # 5 modelos Utility + mensagens livres + forma da chamada
│   ├── webhook-whatsapp.md      # GET handshake, POST assinado, statuses, respostas
│   └── canal-e-interfaces.md    # serviço, broadcast, tela /conta/notificacoes, candidatura, R-16
├── checklists/requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
db/schema/notificacoes.ts                         # enums + colunas + 3 tabelas (alterado)
db/migrations/0009_*.sql                          # gerada

src/modules/notificacoes/
├── domain/
│   ├── whatsapp.ts                               # NOVO — regras puras (data-model §6)
│   └── whatsapp.test.ts                          # NOVO
├── application/
│   ├── ports/
│   │   ├── notificacao-service.ts                # CanalNotificacao += 'whatsapp' (alterado)
│   │   ├── contatos-whatsapp.ts                  # NOVO
│   │   ├── consentimento-whatsapp.ts             # NOVO
│   │   └── mensageria-whatsapp.ts                # NOVO
│   └── use-cases/
│       ├── alterar-preferencia-whatsapp.ts (+ .test.ts)   # NOVO
│       └── processar-webhook-whatsapp.ts (+ .test.ts)     # NOVO
├── infrastructure/
│   ├── index.ts                                  # + despacharWhatsapp, enviarEmLoteComResumo (alterado)
│   ├── whatsapp-cloud-api.ts                     # NOVO — adapter fetch (MensageriaWhatsapp)
│   ├── whatsapp-repositorio.ts                   # NOVO — envios, preferência, histórico, resposta automática
│   └── whatsapp-repositorio.integracao.test.ts   # NOVO
└── presentation/
    ├── actions/notificacoes.ts                   # enviarBroadcast retorna resumo (alterado)
    ├── actions/preferencia-whatsapp.ts           # NOVO — alterarPreferenciaWhatsapp
    ├── queries/preferencia-whatsapp.ts           # NOVO — estado para a tela
    ├── queries/relatorios.ts                     # motivo + destino (alterado)
    └── http/webhook-whatsapp.ts (+ .test.ts)     # NOVO — verificação de assinatura + roteamento

src/modules/voluntariado/
├── infrastructure/drizzle/contatos-whatsapp.ts   # NOVO — implementa ContatosWhatsapp
├── application/use-cases/submeter-candidatura.ts # + aceitaWhatsapp via ConsentimentoWhatsappPort (alterado)
└── presentation/actions/candidatura.ts           # esquema + injeção do port (alterado)

src/modules/contingencia/application/definicoes/consolidados.ts   # rótulos de canal/situação/motivo (alterado)
src/shared/auth/navegacao.ts                      # item "Notificações" em Minha conta (alterado)

app/api/webhooks/whatsapp/route.ts                # NOVO — GET/POST
app/(interno)/conta/notificacoes/page.tsx         # NOVO
app/(interno)/conta/notificacoes/preferencia-whatsapp.tsx   # NOVO — client, botão ativar/desativar
app/(interno)/voluntariado/candidatura/candidatura-form.tsx # caixa de opt-in (alterado)
app/(interno)/(staff)/convocacao/convocacao-form.tsx        # contador/aviso 700 + toast com resumo (alterado)
proxy.ts                                          # matcher isenta api/webhooks (alterado)

spec/DESIGN.md, spec/DB_SCHEMA.md, spec/REQUISITOS_NEGOCIO.md   # documentação (alterado)
.specify/memory/constitution.md                   # emenda PATCH via /speckit-constitution
```

**Structure Decision**: segue o monolito modular existente. Todo o canal vive no bounded context
`notificacoes`; o Voluntariado só implementa um port de leitura de telefone e consome o port de
consentimento na candidatura. Nenhum diretório novo de topo.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| Serviço externo novo (Meta) — Princípio VI | É a própria feature: alcançar o voluntário fora do sistema pelo canal que ele usa | Push do navegador: decisão do projeto de não usar; e-mail sozinho: o problema de alcance que motivou a feature |
| Rota pública sem sessão (webhook) — Princípio IV | A Meta precisa entregar confirmações e respostas sem sessão | Polling da API da Meta: a Cloud API não oferece consulta de situação por mensagem; sem webhook, US3/US4 seriam impossíveis |
