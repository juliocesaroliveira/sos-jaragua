<!--
Sync Impact Report
- Version change: (none, template) → 1.0.0
- Rationale: initial ratification — first concrete constitution for the project (template
  previously left in placeholder form, no bracketed tokens filled).
- Modified principles: n/a (all six are new)
- Added sections:
  - Core Principles: I. Clean Architecture por Módulo (DDD); II. Tipagem Estrita e Qualidade
    de Código; III. Testes Focados em Regras de Negócio; IV. Segurança e Defesa em
    Profundidade; V. Auditoria Não Bloqueante; VI. Simplicidade Operacional
  - Stack e Convenções Técnicas (Section 2)
  - Fluxo de Desenvolvimento (Section 3)
  - Governance
- Removed sections: none (template placeholders only)
- Deferred/TODO placeholders: none — ratification date set to the date this constitution was
  first authored, since no earlier governance document exists to backdate against.
- Templates requiring follow-up: none checked in this run — this command only touches
  constitution.md; dependent templates (plan/spec/tasks) read this file at runtime and were
  not modified here.
-->

# SOS Jaraguá Constitution

## Core Principles

### I. Clean Architecture por Módulo (DDD)

O sistema é um monolito modular organizado em _bounded contexts_ (Identidade, Voluntariado,
Estoque/Doações, Logística/Inteligência, Notificações, Auditoria, Contingência/Relatórios),
cada um estruturado em quatro camadas sob `src/modules/<modulo>/`: `domain/`, `application/`,
`infrastructure/`, `presentation/`.

- A dependência é sempre unidirecional e para dentro: `domain` ← `application` ←
  `infrastructure`/`presentation`. Nunca o inverso.
- `domain/` NÃO PODE importar Next.js, Drizzle ou Mongo — regras de negócio puras e
  testáveis sem infraestrutura.
- `presentation/` (Server Actions, Route Handlers) é a camada mais fina: parse com Zod,
  checagem de sessão/role, chamada a exatamente um caso de uso, invalidação de cache. Nenhuma
  regra de negócio nessa camada.
- Um módulo não acessa tabelas ou repositórios internos de outro módulo diretamente — apenas
  via _ports_ (interfaces) expostos pelo módulo dono dos dados.

**Rationale**: o domínio (voluntariado e assistência humanitária em cenário de emergência)
exige que a lógica de negócio permaneça legível, testável e estável mesmo quando a
infraestrutura (ORM, provedor de auth, banco) muda. O isolamento por _ports_ preserva essa
propriedade mesmo com todas as tabelas no mesmo Postgres.

### II. Tipagem Estrita e Qualidade de Código

TypeScript estrito é obrigatório em toda a base (frontend e backend). Todo código novo
respeita a configuração de lint (`eslint.config.*`) e formatação (`prettier` do
`package.json`) já estabelecidas no repositório, sem exceções ad-hoc.

- `any` implícito ou explícito exige justificativa comentada; não é o padrão.
- Commits seguem Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`,
  `test:`) para rastreabilidade e automação futura de changelog.
- Textos de interface e mensagens de sistema são estritamente em Português Brasileiro
  (pt-BR); nomes de domínio (`Candidatura`, `Turno`, `Kit`, `Saldo`) seguem a linguagem
  ubíqua definida em `spec/DESIGN.md`, não traduções ad-hoc em inglês.

**Rationale**: a equipe é pequena e o sistema opera decisões sensíveis (aprovação de
voluntários, saída de estoque em crise); tipagem estrita e convenções uniformes reduzem a
classe de erros que só apareceriam em produção durante uma emergência real.

### III. Testes Focados em Regras de Negócio

TDD é obrigatório para `domain/` e `application/`: essas são as camadas de maior valor de
teste, por concentrarem as regras de negócio puras e os casos de uso.

- Testes unitários (Vitest, `npm test`) cobrem `domain/` e `application/`, sem rede — devem
  permanecer rápidos (milissegundos) para rodar a cada save.
- Testes de integração (`npm run test:integracao`) cobrem fluxos transacionais críticos que
  tocam o Neon real (ex.: aprovação de candidatura com troca de role, saída de kit com
  dedução atômica de saldo).
- `infrastructure/` e `presentation/` são finas por design (Princípio I) e não exigem a
  mesma cobertura exaustiva — validação de contrato e dos casos de erro mais prováveis basta.
- Nenhuma mudança em regra de negócio (`domain`/`application`) é aceita sem teste que a
  exercite; testes que dependem de rede não podem ser adicionados ao conjunto padrão
  (`npm test`) sem mover para o config de integração.

**Rationale**: a separação em dois comandos (`test` vs. `test:integracao`) é intencional — o
laço rápido de feedback do desenvolvedor não pode depender da latência/disponibilidade do
Neon, mas os fluxos financeiros/de estoque exigem confirmação contra o banco real antes de ir
a produção.

### IV. Segurança e Defesa em Profundidade

A aplicação usa autenticação e controle de acesso em múltiplas camadas, nunca confiando em
uma única checagem.

- `proxy.ts` é a barreira rápida (checagem de cookie de sessão + mapa rota→roles); a fonte
  de verdade é a revalidação de sessão/role em cada `(staff)/layout.tsx` via
  `auth.api.getSession` no servidor.
- Rotas sob `(staff)` exigem role explícita da matriz de atores; nenhuma rota nova é
  adicionada a `(staff)` sem entrada correspondente no mapa de roles.
- Cookies são httpOnly, secure, sameSite=lax; HTTPS/TLS 1.2+ é obrigatório em todos os
  ambientes que não sejam localhost.
- Timeout de inatividade para `coordenador`/`membro_defesa_civil` é aplicado no fluxo de
  autenticação (não é opcional nem contornável por essas roles).
- Dados sensíveis (`cpf`, `restricoesSaude`) dependem da criptografia at-rest nativa do
  provedor de banco e TLS em trânsito — não introduzir criptografia a nível de campo sem
  decisão documentada, para não adicionar complexidade de key management sem necessidade
  comprovada.

**Rationale**: o sistema coordena resposta a desastres e dados de voluntários/beneficiários;
uma falha de autorização tem custo humano real, não apenas técnico. Defesa em profundidade
(proxy + layout) cobre o caso de cookies forjados/expirados entre as duas checagens.

### V. Auditoria Não Bloqueante

Toda escrita em Voluntariado, Estoque e Atividade passa pelo wrapper centralizado de
auditoria (`withAudit`) — nunca chamadas de log ad-hoc espalhadas pelas Server Actions.

- A identidade do ator é obtida da sessão e propagada de forma implícita (ex.:
  `AsyncLocalStorage`), sem exigir que cada função repasse `actor` manualmente.
- Falha na escrita de auditoria degrada graciosamente: a operação de negócio original
  prossegue; a falha é registrada em log estruturado separado para reconciliação manual.
  Disponibilidade das operações críticas de campo durante um desastre pesa mais que uma
  lacuna pontual no log de auditoria.
- Essa política de degradação é uma decisão final documentada — revertê-la (tornar a
  auditoria bloqueante) exige nova decisão explícita, não um ajuste incidental durante outra
  tarefa.

**Rationale**: auditoria imutável é um requisito de negócio (BR-AUD-01), mas não pode se
tornar um ponto único de falha que impeça aprovar um voluntário ou registrar saída de
estoque no meio de uma emergência.

### VI. Simplicidade Operacional

A arquitetura evita complexidade que não tem valor comprovado no porte atual da equipe e da
operação.

- Monolito modular na Vercel — sem microsserviços, sem banco de cache dedicado (Redis/
  Valkey), sem serviço externo de armazenamento de arquivos, salvo decisão documentada que
  justifique o desvio.
- Decisões arquiteturais relevantes são registradas em `spec/DESIGN.md` (ou documento
  equivalente da feature) antes de virar código — a implementação não é o lugar para decidir
  arquitetura implicitamente.
- Ambiguidades de requisito (BRD/NFR) são resolvidas e documentadas como decisão final antes
  da implementação, não deixadas como comportamento implícito do código.

**Rationale**: a equipe é pequena e o contexto de uso (crise, conectividade instável) pune
duramente qualquer complexidade operacional que não seja estritamente necessária.

## Stack e Convenções Técnicas

- **Framework**: Next.js 16 (App Router, Turbopack), React 19, TypeScript estrito.
- **Dados**: Drizzle ORM sobre Neon Postgres (dados relacionais/transacionais); MongoDB
  Atlas dedicado exclusivamente à auditoria imutável — não usar Mongo para dados de domínio
  que pertencem ao Postgres.
- **Autenticação**: better-auth com adapter Drizzle; roles como `additionalFields` em
  `user`, não em tabela separada.
- **Client-side data**: TanStack Query + Server Actions; TanStack Table com paginação
  obrigatoriamente server-side para listagens.
- **UI**: Ark UI + Tailwind CSS v4; suporte nativo a Dark/Light; interface 100% pt-BR.
- **E-mail**: Resend. **Planilhas**: `xlsx` (SheetJS).
- Novas dependências que dupliquem capacidade já coberta pela stack acima (outro ORM, outro
  client de query, outra lib de auth) exigem decisão documentada, não substituição silenciosa.

## Fluxo de Desenvolvimento

- Toda feature relevante passa por spec (`spec.md`), design técnico (quando altera
  arquitetura) e tasks antes da implementação — seguindo o fluxo Spec Kit já adotado no
  repositório (`.specify/`).
- Responsividade mobile e clareza sob estresse são requisitos de aceitação de qualquer tela
  nova de operação de campo (voluntariado, estoque), não um refinamento posterior.
- Operações de leitura críticas (ex.: listagem de itens na tela de Saída) têm meta de
  resposta abaixo de 300ms; regressões de performance nesses caminhos são tratadas como
  defeito, não como débito técnico aceitável.

## Governance

Esta constituição tem precedência sobre convenções informais, preferências individuais de
estilo, ou padrões de PRs anteriores que a contradigam.

- **Emendas**: qualquer alteração de princípio, remoção de seção ou mudança de regra de
  governança exige (1) registro da motivação, (2) atualização deste arquivo via
  `/speckit-constitution`, e (3) bump de versão conforme a política abaixo.
- **Versionamento semântico**:
  - MAJOR: remoção ou redefinição incompatível de um princípio existente.
  - MINOR: novo princípio ou seção, ou expansão material de orientação existente.
  - PATCH: esclarecimentos de texto, correções de redação, sem mudança de regra.
- **Revisão de conformidade**: mudanças de arquitetura (novo módulo, nova dependência de
  infraestrutura, alteração no fluxo de autenticação/autorização) devem ser verificadas
  contra os Princípios I, IV e VI antes do merge. Divergência exige justificativa explícita
  no PR/spec, não silêncio.
- Para orientação de execução no dia a dia (comandos, scripts, convenções de skill), usar os
  arquivos em `.claude/skills/` e `AGENTS.md` — este documento rege princípios, não mecânica
  de tooling.

**Version**: 1.0.0 | **Ratified**: 2026-08-12 | **Last Amended**: 2026-08-12
