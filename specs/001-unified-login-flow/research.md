# Phase 0 Research: Fluxo Unificado de Login

Nenhum `NEEDS CLARIFICATION` restou no Technical Context do plano — a codebase existente
(`proxy.ts`, `src/shared/auth/rotas.ts`, `app/(auth)/login/*`, `spec/DESIGN.md`) já responde
às perguntas técnicas relevantes. Este documento registra as decisões de abordagem tomadas a
partir dessa análise.

## 1. Modelo de proteção de rotas: allowlist → deny-by-default

**Decision**: Inverter `src/shared/auth/rotas.ts` de "toda rota é pública, exceto as
listadas com roles exigidas" para "toda rota exige sessão válida, exceto `/login` e os
endpoints técnicos de auth (`/api/auth/*`)". A granularidade de roles por rota
(`REGRAS_DE_ROTA`) é preservada como uma segunda checagem, aplicada **depois** de confirmar
que existe sessão válida.

**Rationale**: É a única forma de satisfazer FR-001/FR-002 sem reintroduzir o risco atual —
hoje uma rota nova sob `app/` é pública por omissão, a menos que alguém lembre de adicioná-la
ao mapa. Deny-by-default elimina essa classe de erro (esquecimento = mais protegido, não
menos) e é consistente com Constitution Princípio IV (defesa em profundidade) e VI
(simplicidade — uma exceção nomeada em vez de uma lista de exclusões implícitas).

**Alternatives considered**:
- Manter o modelo de allowlist e apenas adicionar `/`, `/cadastro`, `/voluntariado/candidatura`
  etc. à lista de rotas que exigem sessão (sem role específica). Rejeitado: mantém o padrão
  fail-open para qualquer rota futura esquecida — resolve o sintoma da spec, não a causa.
- Mover fisicamente `app/(public)/*` para dentro de `(staff)` ou de um novo route group
  protegido. Rejeitado: route groups do Next.js não têm efeito na URL nem na proteção real
  (essa é decidida em `proxy.ts`); mover pastas seria apenas cosmético e adicionaria diffs
  desnecessários sem mudar o comportamento de segurança.

## 2. Alternância de estado na página de login (3 botões ↔ usuário/senha)

**Decision**: Estado local (`useState`) dentro de `login-form.tsx` (client component já
existente), sem nova rota, sem query param dedicado, sem chamada de rede na troca de estado.

**Rationale**: FR-011 exige explicitamente que a alternância não seja uma navegação para URL
diferente. `login-form.tsx` já é `'use client'` e já gerencia estado local
(`carregandoSocial`). Adicionar um segundo estado (`modo: 'opcoes' | 'credenciais'`) é a
menor mudança consistente com o componente existente, e atende SC-003 (resposta <1s) trivialmente
por não haver I/O na troca.

**Alternatives considered**: Duas rotas (`/login` e `/login/senha`) — rejeitado por FR-011 (a
alternância explicitamente não deve navegar) e por adicionar complexidade de roteamento sem
necessidade (Princípio VI).

## 3. Redirecionamento de usuário já autenticado que acessa `/login`

**Decision**: Em `app/(auth)/login/page.tsx` (Server Component), checar sessão via
`auth.api.getSession` (mesmo mecanismo já usado em `(staff)/layout.tsx`) e, se válida,
redirecionar (`redirect()`) para a área correspondente ao papel do usuário (ex.: `/dashboard`
para staff, `/voluntariado/minhas-atividades` para voluntário), antes de renderizar o
formulário.

**Rationale**: FR-003 exige esse comportamento. Reaproveita o padrão de checagem de sessão já
estabelecido no projeto (mesma função usada na defesa em profundidade de `(staff)/layout.tsx`),
sem introduzir um novo mecanismo de verificação de sessão.

**Alternatives considered**: Fazer esse redirecionamento em `proxy.ts` (excluir `/login` do
gate apenas quando há sessão). Rejeitado: `proxy.ts` é a barreira rápida baseada em cookie
signed cache (sem round-trip garantido ao banco); decidir o destino final por papel já é
responsabilidade do Server Component da página, mantendo `proxy.ts` simples (só decide
"tem sessão, sim/não" para rotas protegidas).

## 4. Escopo de "rota pública" — decisão confirmada com o usuário

**Decision**: A landing (`app/(public)/page.tsx`), o cadastro de conta
(`app/(auth)/cadastro`), a candidatura pública de voluntário
(`app/(public)/voluntariado/candidatura`), a galeria de design system
(`app/design-system`) e a página `app/sem-permissao` passam todas a exigir sessão válida.
`/login` é a única exceção de navegação; `/api/auth/*` (callback OAuth, endpoints internos do
better-auth) permanece isento por ser mecanismo técnico, não rota navegada pelo usuário.

**Rationale**: Confirmado explicitamente com o usuário durante o planejamento (ver Assumptions
em `spec.md`), mesmo sabendo que isso torna a submissão de candidatura de um novo voluntário
dependente de sessão prévia. Está fora do escopo desta feature redesenhar como um novo
voluntário obtém sua primeira conta — assume-se que o mecanismo de auth já existente
(criação de `user` na primeira autenticação social, ou `/cadastro` com sessão) cobre esse caso.

**Alternatives considered**: Manter candidatura/landing públicas e restringir a regra a
"única rota pública da área autenticada". Era a leitura inicial mais alinhada ao
`REQUISITOS_NEGOCIO.md` (BR-VOL-01 assume candidatura sem conta prévia), mas foi
explicitamente descartada pelo usuário ao confirmar o escopo mais amplo.
