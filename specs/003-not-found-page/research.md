# Phase 0 — Pesquisa e Decisões

**Feature**: Página Padrão de Endereço Não Encontrado (404)
**Data**: 2026-08-12

Fonte primária: documentação do Next.js **instalado** (`node_modules/next/dist/docs/01-app/03-api-reference/`), conforme exige o `AGENTS.md` — as convenções de `not-found` mudaram entre versões, e memória de versões antigas levaria a decisões erradas aqui.

Nenhuma `NEEDS CLARIFICATION` restou no Technical Context: a stack e as restrições vêm da constituição e do código em produção.

---

## D1 — Duas fronteiras de `not-found`, não uma

**Decisão**: criar `app/not-found.tsx` (raiz) **e** `app/(interno)/not-found.tsx`.

**Rationale**: a documentação instalada é explícita em dois pontos que, juntos, obrigam a esta divisão:

- _"the root `app/not-found.js` … handle any unmatched URLs for your whole application"_ — a raiz é a única fronteira que pega URL desconhecida.
- _"`not-found.js` renders between `loading.js` and `page.js`"_, e a exceção _"propagates to the nearest not-found boundary"_ — uma fronteira aninhada renderiza **dentro** dos layouts do seu segmento.

São posições diferentes da árvore para casos diferentes:

| Caso                               | Fronteira que resolve         | Layout aplicável                             |
| ---------------------------------- | ----------------------------- | -------------------------------------------- |
| URL desconhecida (`/xyz`)          | `app/not-found.tsx`           | apenas o root layout — nenhum segmento casou |
| `notFound()` em `/atividades/[id]` | `app/(interno)/not-found.tsx` | root + `(interno)` (traz o shell)            |

Com **só a raiz**, o `notFound()` da área autenticada renderizaria fora de `(interno)/layout.tsx`; o shell teria de ser remontado do zero, perdendo o layout real que já estava na tela. Com **só a aninhada**, URL desconhecida não seria capturada — nenhum segmento casa, então nenhuma fronteira aninhada é alcançada.

**Alternativas consideradas**:

- _Uma fronteira aninhada por área_: rejeitado — multiplicaria arquivos sem ganho; o conteúdo é o mesmo.
- _Só a raiz, remontando o shell sempre_: rejeitado pelo motivo acima; além disso faria o `notFound()` de dentro da área autenticada re-executar a montagem do shell em vez de reaproveitar a que já está renderizada.

---

## D2 — `not-found.js` e não `global-not-found.js`

**Decisão**: usar a convenção `not-found.js`. **Não** habilitar `experimental.globalNotFound`.

**Rationale**: a documentação instalada descreve `global-not-found.js` como **experimental** e, mais decisivo, diz que ele _"bypasses your app's normal rendering"_ e exige devolver um documento HTML completo, com `<html>` e `<body>` próprios, reimportando estilos globais, fontes **e o tema**.

Isso significaria duplicar `app/layout.tsx` — `ThemeProvider`, script de tema, fonte Inter, `Toaster` — só para a tela de 404. FR-005 (respeitar tema claro/escuro) sairia de graça pela convenção normal e passaria a ser trabalho manual sujeito a divergir do layout real.

A própria documentação delimita quando `global-not-found` vale a pena: múltiplos root layouts, ou root layout com segmento dinâmico de topo. Este projeto tem **um** root layout e nenhum segmento dinâmico na raiz — nenhum dos dois casos se aplica.

Habilitar uma flag experimental que contraria o Princípio VI, para resolver um problema que não temos, seria complexidade sem valor comprovado.

---

## D3 — Leitura de sessão na fronteira raiz

**Decisão**: `app/not-found.tsx` é um Server Component `async` que chama `obterSessao()` e escolhe a apresentação. Sem sessão, nenhum I/O acontece.

**Rationale**: era o principal risco técnico da feature — em versões anteriores do Next, o `not-found` de URL desconhecida era estático e quebrava ao usar APIs dinâmicas. A documentação instalada resolve: _"By default, `not-found` is a Server Component. You can mark it as `async` to fetch and display data"_, com exemplo usando `headers()` — exatamente o que `obterSessao()` faz por baixo.

A decisão também satisfaz FR-010 (a escolha é feita no servidor, a partir da sessão validada) sem nenhum mecanismo novo: `obterSessao()` já é memoizada por request, então a variante com shell não paga leitura extra em relação a qualquer página autenticada.

**Risco residual e contorno**: Cache Components está habilitado neste projeto. Ler cookies torna o segmento dinâmico, e não é possível declarar configuração de segmento em `not-found`. Se a combinação reclamar em build, o contorno é isolar a leitura de sessão em um componente sob `<Suspense>`, deixando a casca do 404 estática e o shell chegando por streaming — o texto e o botão, que são o essencial, aparecem de imediato. Verificar isto é a primeira tarefa da implementação.

**Alternativas consideradas**:

- _Decidir no cliente com `usePathname`/estado_: rejeitado — violaria FR-010 e a documentação alerta que hooks de cliente exigiriam buscar dados no cliente, expondo a estrutura de menu ao navegador de quem não tem sessão.
- _Sempre renderizar sem shell_: rejeitado — contraria o pedido central da feature.

---

## D4 — Status HTTP: real para URL desconhecida, soft 404 para recurso inexistente

**Decisão**: aceitar `200` + `<meta name="robots" content="noindex">` quando `notFound()` é chamado dentro de `<Suspense>` (US3). **Não** reestruturar `/atividades/[id]` nem mover a checagem para o `proxy.ts` nesta feature.

**Rationale**: verificado no código — `app/(interno)/(staff)/atividades/[id]/page.tsx` chama `notFound()` dentro do componente `<Painel>`, que está sob `<Suspense>`. A documentação instalada é direta sobre a consequência: _"Because the response headers have already been sent to the client, the status code of the response cannot be updated"_, e _"If you need a 404 status, for compliance or analytics, ensure the resource exists before the response body is streamed"_.

Três razões para aceitar:

1. **O efeito que importa está preservado.** A documentação registra que o `noindex` injetado impede indexação mesmo com status 200: _"this does not lead to indexation because the page is explicitly marked noindex"_. FR-002 pede que a aplicação sinalize que o endereço não existe — o `noindex` cumpre isso para buscadores.
2. **O caso principal já tem status real.** URL desconhecida é resolvida no roteamento, antes de qualquer streaming; ali o `404` é de verdade. É a US1, o caso majoritário.
3. **A alternativa custa caro e é regressiva.** Obter status real na US3 exigiria mover a existência da atividade para antes do `<Suspense>` — o que elimina o streaming da tela e o esqueleto de carregamento — ou consultar o banco dentro do `proxy.ts`, contrariando a orientação da própria documentação (_"Keep proxy checks fast, and avoid fetching full content there"_) e o desenho de `proxy.ts` como barreira que decide por cookie, sem hit ao banco no caminho feliz.

**Registrado como decisão consciente**, não como omissão: se algum dia houver exigência de conformidade ou métrica que dependa do status real na US3, o caminho é o descrito acima e passa a ser trabalho próprio.

---

## D5 — Extrair a montagem do shell

**Decisão**: extrair de `app/(interno)/layout.tsx` um Server Component `ShellAutenticado`, em `app/_shell/`, que recebe o ator e monta `<AppShell>` com itens de navegação e notificações.

**Rationale**: duas fronteiras (D1) precisam do shell em posições diferentes — `(interno)/layout.tsx` para toda a área autenticada, e `app/not-found.tsx` para a URL desconhecida de quem está logado. Sem extração, a mesma montagem (consulta de notificações, filtragem de itens por perfil, props do `AppShell`) existiria em dois arquivos, e divergiria no primeiro ajuste que alguém fizesse em um só.

**Por que `app/_shell/` e não o barrel do design system**: o componente é `server-only`, lê sessão e consulta o módulo de notificações. `src/shared/ui/index.ts` é importado livremente pelas telas, inclusive por Client Components; colocar ali uma peça com I/O de servidor convidaria ao erro. O prefixo `_` é a convenção do App Router para pasta que não vira rota.

**Nota de contrato**: `ShellAutenticado` recebe o `ator` por prop em vez de buscá-lo. Os dois chamadores obtêm a sessão de formas incompatíveis — o layout usa `exigirSessao()` (redireciona quem não tem), a página de 404 usa `obterSessao()` (aceita `null` e muda a apresentação). Uma página de erro que redireciona seria um defeito.

---

## D6 — Destino do botão de retorno

**Decisão**: função pura `destinoDeRetorno(temSessao: boolean)` em `src/shared/auth/rotas.ts` — `AREA_PADRAO` (`/`) com sessão, `ROTA_PUBLICA` (`/login`) sem.

**Rationale**: FR-013 exige que acionar o botão nunca produza nova negativa. Mandar um visitante sem sessão para `/` funcionaria por acidente — o `proxy.ts` o redirecionaria para `/login` —, mas seria um salto a mais e uma dependência silenciosa do gate. Apontar direto ao destino correto é honesto e sobrevive a mudanças no modelo de acesso.

Reaproveitar as constantes existentes, em vez de escrever `'/'` e `'/login'` literais, mantém a página alinhada ao que a feature 002 já estabeleceu: `AREA_PADRAO` é a home ciente de perfil, `ROTA_PUBLICA` é a única rota sem sessão.

É também a **única lógica pura** da feature, e por isso a única coisa que merece teste unitário (Princípio III) — SC-004 verifica justamente que o botão não leva a beco algum, em nenhum dos cinco perfis nem deslogado.
