# Phase 0 — Pesquisa e Decisões

**Feature**: Shell de Navegação por Perfil (Topbar + Sidebar)
**Data**: 2026-08-12

Todas as `NEEDS CLARIFICATION` do Technical Context foram resolvidas — a stack, o alvo e as restrições vêm da constituição e do código já em produção, não de escolha nova. O que exigiu decisão foi **como** encaixar o shell na estrutura existente sem duplicar autorização.

---

## D1 — Fronteira entre páginas com e sem shell

**Decisão**: A fronteira é o route group, não uma lista de rotas. `(publico)/` = sem shell; `(interno)/` = com shell. Três páginas hoje pré-autenticação — landing `/`, `/login`, `/cadastro` — vão para `(publico)`. Todo o resto vai para `(interno)`.

**Rationale**: Uma lista de exceções ("estas rotas não têm shell") apodrece: a próxima página nasce fora dela e ninguém percebe. A estrutura de diretórios torna a fronteira visível no momento em que o arquivo é criado, e é exatamente o mesmo raciocínio _deny-by-default_ que `rotas.ts` já aplica à autorização — consistência de modelo mental entre as duas camadas.

**Ponto sensível descoberto durante a pesquisa**: `ehRotaPublica()` isenta **apenas** `/login`. Pelo `proxy.ts`, `/`, `/cadastro` e `/voluntariado/candidatura` exigem sessão. Mas o código dessas três páginas foi escrito para visitante deslogado — a landing afirma em comentário estar "excluída do matcher do `proxy.ts`" (não está: o matcher casa `/`), e `candidatura/page.tsx` tem um caminho que mostra "entre ou crie conta" a quem chega sem sessão, hoje inalcançável. `rotas.test.ts` confirma o comportamento atual como intencional (`'/'` e `'/cadastro'` asseridos como não-públicos).

Isso é um defeito ou uma decisão de 001 — **esta feature não resolve nem altera `rotas.ts`**. O plano foi construído para ficar correto sob as duas resoluções possíveis:

- Se o deny-by-default estiver correto, `/` e `/cadastro` são inalcançáveis por deslogados e o grupo `(publico)` simplesmente guarda páginas que ninguém alcança sem sessão — inofensivo, e pronto para o dia em que forem abertas.
- Se for defeito e `ROTA_PUBLICA` for ampliada depois, essas páginas já estão no grupo certo, sem shell, e nada precisa ser movido de novo.

O que **não** pode acontecer é o shell autenticado aparecer em uma tela de login — e a separação por grupo garante isso independentemente de como a inconsistência for resolvida.

**Alternativas consideradas**:

- _Um único layout raiz que decide renderizar o shell conforme o pathname_: rejeitado — coloca lógica de roteamento em tempo de render, quebra o mapeamento direto arquivo→layout do App Router e é fácil de errar em rota nova.
- _Adicionar o shell página a página_: rejeitado — viola FR-004 explicitamente e é o problema que a feature existe para eliminar.

---

## D2 — Aninhar `(staff)` dentro de `(interno)` vs. layouts irmãos

**Decisão**: `(interno)/layout.tsx` aplica `exigirSessao()` e renderiza o `AppShell`; `(interno)/(staff)/layout.tsx` fica reduzido a `exigirRoles(ROLES_STAFF)` e repassa `children`.

**Rationale**: Dois gates em camadas espelham exatamente os dois níveis de autorização que já existem — "tem sessão" e "tem role de staff". Aninhar significa que o shell é escrito uma vez e que o gate de role continua onde estava conceitualmente, sem que nenhum layout precise saber do outro. Uma página de staff nova continua herdando os dois gates; uma página autenticada não-staff herda só o primeiro.

O `exigirRoles` do layout de staff permanece porque a constituição (Princípio IV) exige defesa em profundidade — remover a checagem de role do render, confiando só no `proxy.ts`, seria o único jeito de esta feature _piorar_ a segurança. Não fazemos isso.

**Efeito colateral positivo**: as páginas de `usuario`/`voluntario` hoje **não têm nenhuma checagem no render** — dependem só do proxy. Sob `(interno)`, passam a ter `exigirSessao()`. A feature fecha essa lacuna de defesa em profundidade de graça.

**Alternativas consideradas**:

- _Grupos irmãos `(staff)` e `(voluntario)`, cada um com seu layout renderizando o shell_: rejeitado — duplica a montagem do shell e a busca de notificações em dois lugares, que é a origem do problema atual.
- _Um `(interno)` plano, sem `(staff)` aninhado, com o gate de role movido para cada página_: rejeitado — espalha a checagem por ~12 páginas em vez de concentrá-la em um layout; contraria "presentation é a camada mais fina" (Princípio I).

---

## D3 — Fonte de verdade da visibilidade dos itens

**Decisão**: Cada item de navegação declara suas roles explicitamente no registro. Um **teste unitário** trava a consistência contra `rolesExigidas()`: para todo item cujo `href` case com uma regra em `REGRAS_DE_ROTA`, o conjunto de roles do item deve ser **idêntico** ao da regra.

**Rationale**: A tentação era derivar a visibilidade puramente de `podeAcessar(href, role)` — que é o que `staff-shell.tsx` faz hoje. Isso não funciona para o escopo ampliado: `podeAcessar` retorna `true` para qualquer rota **ausente** de `REGRAS_DE_ROTA`, e `/voluntariado/candidatura` está ausente. Derivar assim mostraria "Quero ser voluntário" para o coordenador e o administrador. O bug já existiria hoje se o menu incluísse rotas fora do mapa.

Declaração explícita + trava por teste dá o melhor dos dois: satisfaz FR-021 (destino novo obriga decisão consciente de visibilidade) e FR-011 (impossível divergir da autorização sem quebrar o build de testes). É o mesmo padrão que `roles.ts` já usa — a trava `_rolesEmSincronia` que quebra o `tsc` se o enum da aplicação divergir do enum do banco. Estamos repetindo um idioma que o projeto já escolheu, não inventando um.

**Por que igualdade e não subconjunto**: exigir apenas `roles do item ⊆ roles da regra` deixaria passar um item invisível para quem tem direito a ele — FR-013 exige mostrar **todos** os destinos permitidos, não apenas alguns. Igualdade pega os dois erros de uma vez.

**Alternativas consideradas**:

- _Derivar tudo de `podeAcessar`_: rejeitado pelo motivo acima — silenciosamente errado para rotas fora do mapa.
- _Adicionar `/voluntariado/candidatura` e os demais a `REGRAS_DE_ROTA` e derivar_: rejeitado — mudaria regra de autorização (endurecendo o acesso ao formulário de candidatura) para resolver um problema de menu. A spec é explícita: nenhuma regra de autorização é alterada por esta feature.

---

## D4 — Destinos ainda inexistentes (administração, conta/perfil)

**Decisão**: `/admin` e uma futura área de conta **não** entram no registro agora. O contrato do registro exige que todo `href` corresponda a uma página existente, e um teste verifica isso.

**Rationale**: `REGRAS_DE_ROTA` já reserva `/admin` para `administrador`, mas não existe `app/**/admin/`. Incluir o item exibiria ao administrador um link para 404 — violando SC-004 ("0% dos itens exibidos resultam em negativa de acesso") e o caso de borda "item apontando para destino inexistente". A spec já delimitou isso nas Assumptions: os itens aparecem quando as páginas existirem.

**Consequência a registrar**: com essa decisão, o menu do Administrador é hoje **idêntico** ao do Coordenador. Isso é correto e esperado — reflete que a área de administração ainda não foi construída, não que a distinção de perfis falhou. FR-020 fica satisfeito na estrutura (o registro suporta o grupo "Administração" e a role `administrador`), e passa a ser satisfeito na prática assim que a primeira página de admin existir, adicionando uma linha ao registro.

**Alternativas consideradas**:

- _Criar páginas-esqueleto de administração nesta feature_: rejeitado — expande o escopo para além do que a spec delimitou; construir a área de admin é uma feature própria.
- _Exibir o item desabilitado com "em breve"_: rejeitado — ruído na interface de operação de campo, sem valor para quem está usando o sistema durante uma crise.

---

## D5 — Sino de notificações por perfil

**Decisão**: O sino é exibido para **todos** os perfis autenticados, e não apenas para staff.

**Rationale**: FR-008 diz "apenas para perfis que recebem notificações". A pesquisa no código responde quem são: `notificacao.destinatarioUserId` referencia `user` sem qualquer restrição de role, e os eventos existentes incluem lembrete de turno (destinado a voluntários) além dos alertas de coordenação. Voluntários e usuários com candidatura em triagem **são** destinatários. Restringir o sino a staff esconderia notificações de quem tem notificações — o oposto do requisito.

`listarNotificacoes(userId)` e `contarNaoLidas(userId)` já são consultas por usuário, agnósticas a role, e o índice `notificacao(destinatarioUserId, lida)` já serve o contador. Nada muda no módulo de notificações.

**Efeito no custo de render**: duas consultas passam a rodar no layout de toda página autenticada, e não só nas de staff. São consultas indexadas por usuário, disparadas em paralelo, no mesmo layout que já faz `getSession` — sem consulta adicional no caminho crítico das telas de operação. A meta de performance (SC-009) permanece verificável no quickstart.

---

## D6 — Agrupamento dos itens (User Story 3)

**Decisão**: Grupos declarados como campo do item (`grupo: 'pessoal' | 'voluntariado' | 'operacao' | 'estoque' | 'coordenacao' | 'administracao'`), com rótulos pt-BR em um mapa à parte. A renderização deriva os grupos visíveis dos itens que sobraram após a filtragem por role — grupo sem item não é renderizado (FR-026).

**Rationale**: Derivar os grupos da lista já filtrada, em vez de declarar uma árvore grupo→itens, torna FR-026 uma consequência estrutural em vez de uma regra que alguém precisa lembrar de aplicar. Um perfil com um único item nunca produz um cabeçalho de grupo órfão.

**Alternativas consideradas**:

- _Estrutura aninhada `{ grupo, itens: [] }`_: rejeitado — obriga a filtrar em dois níveis e a podar grupos vazios manualmente, exatamente o passo que se esquece.
- _Sem agrupamento_: é o estado atual; aceitável para os 5 itens do voluntário, ruim para os 12+ do coordenador. A spec priorizou como P2, então entra, mas depois das duas histórias P1.

---

## D7 — Estado do menu e Server vs. Client Component

**Decisão**: `AppShell` permanece Client Component (precisa de `usePathname` para o item ativo e `useState` para a gaveta em telas estreitas). Recebe `role`, `nome`, `rotuloRole` e o slot de notificações **como props**, calculados no Server Component pai a partir da sessão validada. A filtragem por role é executada no servidor; o cliente recebe apenas os itens que já pode ver.

**Rationale**: Duas razões. Segurança: a role nunca é lida de estado do cliente (FR-010) — chega já validada por `auth.api.getSession`. Payload: filtrar no servidor evita enviar ao navegador do voluntário a lista completa de destinos internos, que seria vazamento de estrutura administrativa sem necessidade.

O estado recolhido/expandido não é persistido (Assumption da spec) — `useState` local basta, sem cookie nem localStorage, mantendo o Princípio VI.

**Nota de implementação**: os ícones (`lucide-react`) precisam ser criados no lado cliente ou passados como elementos serializáveis. O registro em `src/shared/auth/navegacao.ts` deve conter **identificadores** de ícone, não JSX — assim ele permanece uma estrutura de dados pura, importável por testes de nó sem renderizar React, e o mapeamento identificador→componente vive na camada de UI. É o que mantém o registro testável em `npm test` sem tocar em React.
