# Feature Specification: Topbar Fixo Durante a Rolagem

**Feature Branch**: `004-sticky-topbar`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "preciso que o topbar fique fixo na pagina, fazendo com que as páginas que tiverem scroll façam o scroll mantendo sempre visível o topbar. Isso melhora muito a experiencia do usuário, principalmente quando acessado via dispositivo móvel."

## Resumo

Hoje, a barra superior (topbar) rola junto com o conteúdo da página: em páginas longas, ao rolar para baixo, ela desaparece da tela. Isso obriga a pessoa a rolar de volta ao topo sempre que precisa acessar o menu, o botão de navegação lateral ou identificar em qual área do sistema está — um atrito relevante em campo, especialmente em telas pequenas de celular, onde a rolagem é mais frequente e o espaço de toque é mais escasso.

Esta feature torna o topbar fixo (fica sempre visível, ancorado ao topo da viewport) em todas as páginas autenticadas que possuem rolagem, para desktop e mobile. O conteúdo da página passa a rolar por baixo do topbar, sem nunca cobri-lo ou escondê-lo.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Acessar o menu em qualquer ponto da rolagem (Priority: P1)

Uma pessoa usuária está em uma página longa (por exemplo, uma listagem extensa) e rolou bastante para baixo. Ela precisa abrir o menu de navegação lateral ou voltar para outra área do sistema.

**Why this priority**: É o cenário mais frequente de frustração atual — sem o topbar fixo, a navegação fica inacessível sem rolar manualmente até o topo, prejudicando qualquer fluxo de uso.

**Independent Test**: Pode ser testado abrindo qualquer página autenticada com conteúdo suficiente para gerar rolagem, rolando até o final e verificando que o topbar (e o botão de menu, se aplicável) permanece visível e utilizável.

**Acceptance Scenarios**:

1. **Given** uma página autenticada com conteúdo mais alto que a tela, **When** a pessoa rola a página para baixo, **Then** o topbar permanece fixo e visível no topo da tela durante toda a rolagem.
2. **Given** o topbar fixo visível, **When** a pessoa toca/clica em qualquer ação do topbar (ex.: abrir menu, navegar para a home), **Then** a ação funciona normalmente, independente da posição de rolagem no momento do clique.

---

### User Story 2 - Uso em dispositivo móvel (Priority: P1)

Uma pessoa acessa o sistema pelo celular, onde as telas são menores e a rolagem é mais comum. Ela precisa manter acesso fácil à navegação enquanto lê ou percorre listas longas.

**Why this priority**: O pedido original destaca explicitamente o ganho de experiência em mobile, onde o problema é mais sentido devido ao espaço de tela reduzido.

**Independent Test**: Pode ser testado acessando o sistema em uma viewport de largura mobile, abrindo uma página com rolagem e confirmando que o topbar permanece fixo e que o botão de menu (hambúrguer) continua acessível e funcional durante a rolagem.

**Acceptance Scenarios**:

1. **Given** a aplicação aberta em uma viewport mobile, **When** a pessoa rola uma página com conteúdo extenso, **Then** o topbar permanece fixo no topo e legível, sem ser sobreposto por outros elementos.
2. **Given** o menu lateral (drawer) aberto em uma viewport mobile, **When** a pessoa rola a página, **Then** o comportamento do topbar fixo não conflita com a exibição do drawer (não há sobreposição incorreta, corte visual ou duplicação de barras).

---

### User Story 3 - Consistência entre páginas autenticadas (Priority: P2)

Uma pessoa navega entre diferentes páginas do sistema (com e sem rolagem, com e sem o menu de staff) e espera que o topbar se comporte da mesma forma em todas elas.

**Why this priority**: Garante que a melhoria não fique restrita a uma tela específica, evitando uma experiência inconsistente entre áreas do sistema.

**Independent Test**: Pode ser testado navegando por pelo menos três páginas autenticadas distintas (incluindo uma sem rolagem e uma com rolagem longa) e confirmando que o topbar se comporta de forma fixa e idêntica em todas.

**Acceptance Scenarios**:

1. **Given** qualquer página dentro da área autenticada do sistema, **When** a página é carregada, **Then** o topbar aparece fixo no topo, independentemente de a página ter ou não conteúdo rolável.
2. **Given** uma página curta que não gera rolagem, **When** a pessoa visualiza a página, **Then** o topbar continua fixo no topo sem causar espaço vazio ou comportamento visual diferente das páginas com rolagem.

### Edge Cases

- O que acontece quando a página não possui rolagem (conteúdo menor que a tela)? O topbar deve permanecer fixo no topo sem gerar espaçamento extra ou "salto" visual.
- Como o sistema se comporta quando o menu lateral mobile (drawer) está aberto simultaneamente ao topbar fixo? O drawer não deve ficar escondido atrás do topbar nem sobrepor conteúdo de forma que quebre a leitura.
- O que acontece na página de "não encontrado" (404) quando exibida dentro do shell autenticado? O topbar deve permanecer fixo da mesma forma que nas demais páginas autenticadas.
- Como o topbar fixo se comporta ao redimensionar a janela ou girar o dispositivo (retrato/paisagem)? Ele deve permanecer fixo e não deve haver sobreposição de conteúdo em nenhuma orientação.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema DEVE manter o topbar sempre visível, ancorado ao topo da viewport, em todas as páginas dentro da área autenticada, independentemente da posição de rolagem do conteúdo.
- **FR-002**: O sistema DEVE permitir que o conteúdo da página role de forma independente por baixo do topbar, sem que o topbar role junto ou desapareça.
- **FR-003**: O sistema DEVE garantir que nenhum elemento de conteúdo fique visualmente sobreposto ou escondido pelo topbar fixo (ex.: título ou botão cortado atrás da barra).
- **FR-004**: O sistema DEVE manter todos os controles do topbar (navegação, botão de menu/hambúrguer, ações) funcionais e clicáveis em qualquer momento da rolagem.
- **FR-005**: O sistema DEVE aplicar o comportamento de topbar fixo de forma consistente em desktop e em dispositivos móveis.
- **FR-006**: O sistema DEVE garantir que, ao abrir o menu de navegação lateral (drawer) em telas mobile, a combinação entre topbar fixo e drawer não produza sobreposição incorreta, corte de conteúdo ou duplicação visual da barra.
- **FR-007**: O sistema DEVE manter o comportamento de topbar fixo também em páginas sem rolagem, sem introduzir espaçamento indevido ou deslocamento de layout.

### Key Entities

_(Esta feature é puramente de comportamento visual/estrutural de layout; não introduz novas entidades de dados.)_

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em 100% das páginas autenticadas com rolagem, o topbar permanece visível na tela durante toda a extensão da rolagem, do topo ao final da página.
- **SC-002**: Usuárias e usuários conseguem acionar qualquer ação do topbar (ex.: abrir menu) em até 1 toque/clique, sem precisar rolar a página de volta ao topo.
- **SC-003**: O comportamento do topbar fixo é idêntico (mesma posição, mesma aparência, mesma acessibilidade dos controles) em telas mobile e desktop.
- **SC-004**: Nenhuma página autenticada apresenta sobreposição visual entre o topbar e o conteúdo após a mudança, verificado em pelo menos três tamanhos de tela representativos (mobile, tablet, desktop).

## Assumptions

- A mudança se aplica ao shell autenticado usado por todas as páginas internas (incluindo a página 404 exibida com sessão ativa, conforme especificado em `003-not-found-page`); páginas públicas/pré-autenticação, que hoje não utilizam esse topbar, estão fora do escopo.
- "Fixo" significa que o topbar permanece ancorado ao topo da viewport visível durante a rolagem, sem exigir rolagem adicional para revelá-lo (ex.: não some ao rolar para baixo e reaparece ao rolar para cima).
- O comportamento atual do menu lateral (sidebar em desktop, drawer em mobile) é preservado; esta feature ajusta apenas a fixação do topbar e sua relação de sobreposição com o restante do layout, não a lógica de abertura/fechamento do menu.
- Não há requisito de ocultar o topbar automaticamente ao rolar para baixo e reexibi-lo ao rolar para cima (padrão "auto-hide"); o comportamento esperado é de fixação simples e permanente.
