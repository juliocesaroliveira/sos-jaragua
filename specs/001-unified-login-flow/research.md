# Phase 0 Research: Fluxo Único de Login

## Context

O repositório está no estado inicial do scaffold Next.js (`app/page.tsx`,
`app/layout.tsx` apenas) — nenhuma dependência de autenticação foi instalada e nenhum
código de `src/modules/identidade` existe ainda (`spec/TASKS.md` seções 1–2 seguem
`[ ]`). A especificação da feature (`spec.md`) assume que os fluxos sociais e de
usuário/senha "já existem hoje" — essa afirmação é sobre o *comportamento alvo* descrito
em `spec/DESIGN.md`/`spec/REQUISITOS_NAO_FUNCIONAIS.md`, não sobre código já escrito.
Portanto este plano cobre tanto (a) montar a base de autenticação conforme já decidido em
`spec/DESIGN.md` §6 quanto (b) a página de login unificada e o gate de rota pública
única pedidos nesta feature.

## Decisions

### Decision: Biblioteca e provedores de autenticação
- **Decision**: `better-auth`, com `emailAndPassword` habilitado e `socialProviders:
  { google, facebook }`.
- **Rationale**: Já é a decisão registrada em `spec/DESIGN.md` §1 e §6.1 e em
  `spec/REQUISITOS_NAO_FUNCIONAIS.md` §3; não há ambiguidade a resolver.
- **Alternatives considered**: NextAuth.js é citado como alternativa no NFR, mas
  `DESIGN.md` já fixou `better-auth` como a escolha confirmada — usar outra biblioteca
  quebraria a Constitution Principle I/II (estrutura já mandatada) sem motivo novo.

### Decision: Gate de rota pública única
- **Decision**: `proxy.ts` na raiz (Node runtime, Next 16) intercepta toda navegação;
  verifica cookie de sessão (`getSessionCookie`); se ausente/expirado, redireciona para
  `/login`. Único grupo de rota exposto sem sessão é `(auth)/login` mais os endpoints
  técnicos de auth (`/api/auth/*`, callbacks OAuth) e assets estáticos.
- **Rationale**: Consistente com `spec/DESIGN.md` §6.2 (mapa rota→role em `proxy.ts`) e
  com FR-001/FR-002 da spec. `spec/DESIGN.md` já usa `config.matcher` para excluir
  `/api/auth/*` e assets — mesmo padrão coberto pelo edge case "rotas técnicas do
  próprio fluxo de auth".
- **Alternatives considered**: checagem de sessão só em cada `page.tsx`/layout —
  rejeitado porque não impede exposição inicial de HTML/rota antes do check
  client-side, e diverge do que `spec/DESIGN.md` já define; `proxy.ts` é o único ponto
  central que garante a regra "única rota pública" para toda a árvore de rotas.

### Decision: Alternância de tela na página de login (sem navegação)
- **Decision**: `app/(auth)/login/page.tsx` é um componente com estado local
  (`useState`) alternando entre `view: 'options' | 'credentials'`; não há mudança de
  URL/rota ao clicar em "Usar usuário e senha" ou "Voltar".
- **Rationale**: A spec (User Story 3) exige que a alternância ocorra "sem navegar para
  uma URL diferente"; um único componente client-side com estado local é a forma mais
  simples de atender isso sem introduzir rotas extras que violariam FR-001 (única rota
  pública).
- **Alternatives considered**: duas rotas (`/login` e `/login/credenciais`) —
  rejeitado porque adicionaria uma segunda rota pública, contradizendo FR-001, e não traz
  benefício já que não há necessidade de deep-link direto para a tela de credenciais.

### Decision: Redirecionamento pós-login por papel
- **Decision**: Reaproveitar o mapa rota→role já previsto em `spec/DESIGN.md` §6.2 para
  decidir o destino pós-login (ex.: `administrador`/`coordenador`/`membro_defesa_civil`
  → área de staff; `voluntario` → área de voluntário).
- **Rationale**: FR-010 exige redirecionar usuário já autenticado para "a área
  correspondente ao seu papel" — a spec assume que essa segmentação de papéis já está
  definida no design, evitando reinventar a lógica de destino.
- **Alternatives considered**: redirecionar sempre para uma única home genérica —
  rejeitado por não atender à segmentação de papéis já estabelecida no NFR/DESIGN.

### Decision: Testes / verificação
- **Decision**: Não há framework de testes automatizados configurado no projeto
  (`package.json` não define `test`). A verificação desta feature segue a Constitution
  Principle III (Verified-Before-Done): rodar `next dev`, exercitar cada acceptance
  scenario manualmente (redirecionamento sem sessão, os três botões, alternância de
  tela, login social, login por senha, erro de credenciais, usuário já autenticado).
- **Rationale**: Consistente com o estado atual do repositório e com a constituição do
  projeto, que trata verificação manual como o gate de conclusão, não com a ausência de
  testes automatizados como lacuna desta feature especificamente.
- **Alternatives considered**: introduzir Vitest/Playwright agora — fora de escopo
  desta feature; não pedido pela spec nem pré-requisito registrado em `spec/TASKS.md`
  para as tasks de Identidade/Login.

## Resolved NEEDS CLARIFICATION

Nenhum marcador `[NEEDS CLARIFICATION]` estava presente na spec; nenhum surgiu durante o
research — todas as decisões técnicas acima já estavam fixadas em `spec/DESIGN.md` e
`spec/REQUISITOS_NAO_FUNCIONAIS.md`.
