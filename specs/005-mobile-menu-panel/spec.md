# Feature Specification: Menu Mobile/Tablet Abaixo do Topbar

**Feature Branch**: `005-mobile-menu-panel`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "preciso que o menu da aplicação no modo mobile/tablet seja renderizado abaixo do topbar, criando um sidebar especifico para estes dispositivos utilizando o componente Menu do ark-ui"

## Resumo

Hoje, em telas mobile/tablet, ao abrir o menu de navegação a partir do botão de hambúrguer, o painel de navegação aparece **acima** da barra superior (topbar) — a ordem visual fica invertida: primeiro o menu, depois a identificação da aplicação. Isso confunde a leitura da tela (a marca/identificação deveria vir primeiro) e destoa do padrão comum em aplicações mobile, em que o menu se abre "pendurado" logo abaixo da barra superior.

Esta feature reposiciona o painel de navegação mobile/tablet para que ele sempre apareça **abaixo** do topbar, nunca acima ou sobre ele, usando um componente de menu específico para esses tamanhos de tela (distinto da coluna de navegação fixa já usada em desktop, que não é afetada por esta mudança).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Abrir o menu em mobile/tablet (Priority: P1)

Uma pessoa usuária acessa o sistema em um celular ou tablet. Ela toca no botão de menu (hambúrguer) na barra superior para navegar para outra área do sistema.

**Why this priority**: É o fluxo de navegação mais básico em mobile/tablet — sem ele, a pessoa não consegue mudar de tela nesses dispositivos.

**Independent Test**: Pode ser testado acessando o sistema em uma viewport mobile ou tablet, tocando no botão de menu e verificando que o painel de navegação aparece abaixo da barra superior, com a barra permanecendo visível e no topo.

**Acceptance Scenarios**:

1. **Given** uma pessoa em viewport mobile ou tablet, **When** ela toca no botão de menu na barra superior, **Then** o painel de navegação aparece abaixo da barra superior, nunca sobre ou acima dela.
2. **Given** o painel de navegação aberto abaixo da barra superior, **When** a pessoa toca em um destino de navegação, **Then** ela é levada ao destino escolhido e o painel se fecha.

---

### User Story 2 - Fechar o menu sem navegar (Priority: P2)

Uma pessoa abre o menu mobile/tablet por engano, ou muda de ideia antes de escolher um destino.

**Why this priority**: Abrir e fechar o menu sem navegar é uma ação corretiva comum; sem uma forma clara de fechar, a pessoa pode ficar "presa" tentando entender como sair do menu.

**Independent Test**: Pode ser testado abrindo o menu mobile/tablet e fechando-o de mais de uma forma (tocando novamente no botão de menu, tocando fora do painel, ou pressionando a tecla de escape em um teclado externo), confirmando que o conteúdo da página volta a ficar visível sem navegar para lugar nenhum.

**Acceptance Scenarios**:

1. **Given** o painel de navegação mobile/tablet aberto, **When** a pessoa toca novamente no botão de menu, **Then** o painel se fecha e a página permanece na mesma tela.
2. **Given** o painel de navegação mobile/tablet aberto, **When** a pessoa toca em qualquer área fora do painel, **Then** o painel se fecha sem navegar.

---

### User Story 3 - Navegação acessível por teclado e leitor de tela (Priority: P2)

Uma pessoa que navega por teclado ou usa leitor de tela precisa conseguir abrir o menu mobile/tablet, percorrer os destinos e escolher um, sem depender do toque.

**Why this priority**: Acessibilidade é requisito de qualidade para qualquer tela de operação de campo (constituição do projeto), não um refinamento posterior — mas depende da User Story 1 já existir.

**Independent Test**: Pode ser testado navegando até o botão de menu apenas com teclado, abrindo o painel, movendo o foco entre os destinos e confirmando um deles com o teclado.

**Acceptance Scenarios**:

1. **Given** o foco do teclado no botão de menu, **When** a pessoa aciona o botão (Enter/Espaço), **Then** o painel abre abaixo da barra superior e o foco move para dentro do painel.
2. **Given** o painel aberto e o foco dentro dele, **When** a pessoa navega entre os destinos usando as setas ou Tab, **Then** cada destino recebe foco visível, e confirmá-lo com o teclado navega para lá e fecha o painel.
3. **Given** o painel aberto, **When** a pessoa pressiona a tecla Esc, **Then** o painel se fecha e o foco retorna ao botão de menu.

### Edge Cases

- O que acontece quando o perfil da pessoa não tem nenhum destino de navegação (ex.: perfil sem itens de menu)? O botão de menu não deve ser exibido, como já ocorre hoje.
- Como o painel se comporta ao rolar a página com o menu aberto? O painel permanece abaixo da barra superior (que é fixa, conforme `004-sticky-topbar`), sem se soltar da posição nem sobrepor a barra.
- O que acontece se a pessoa girar o dispositivo (retrato ↔ paisagem) ou redimensionar a janela enquanto o painel está aberto? O painel continua abaixo da barra superior na nova orientação; se o redimensionamento cruzar para o tamanho de desktop, o painel mobile/tablet some e a navegação passa a ser a coluna fixa de desktop (comportamento já existente, inalterado).
- O que acontece se a pessoa tocar em um destino de navegação e depois usar o botão "voltar" do navegador? O painel deve permanecer fechado (o estado de aberto/fechado não é uma página nova no histórico de navegação).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Em viewports mobile e tablet, o sistema DEVE renderizar o painel de navegação sempre abaixo da barra superior, nunca acima ou sobreposto a ela.
- **FR-002**: O sistema DEVE manter a barra superior completamente visível e utilizável enquanto o painel de navegação mobile/tablet estiver aberto.
- **FR-003**: O sistema DEVE permitir abrir e fechar o painel de navegação mobile/tablet a partir do botão de menu na barra superior, preservando o comportamento atual de alternância (abrir/fechar no mesmo botão).
- **FR-004**: O sistema DEVE fechar o painel de navegação mobile/tablet automaticamente ao escolher um destino, levando a pessoa ao destino selecionado.
- **FR-005**: O sistema DEVE permitir fechar o painel de navegação mobile/tablet sem navegar, tocando fora dele ou pressionando Esc, além de tocar novamente no botão de menu.
- **FR-006**: O sistema DEVE manter a navegação mobile/tablet totalmente operável por teclado, incluindo mover o foco para dentro do painel ao abrir e devolver o foco ao botão de menu ao fechar.
- **FR-007**: O sistema DEVE continuar ocultando o botão de menu quando o perfil não tiver nenhum destino de navegação, como ocorre hoje.
- **FR-008**: O sistema NÃO DEVE alterar o comportamento da navegação em viewports desktop (coluna fixa lateral), que permanece fora do escopo desta feature.
- **FR-009**: O sistema DEVE preservar a organização por seções/grupos dos destinos de navegação dentro do painel mobile/tablet, como já existe na navegação atual.

### Key Entities

*(Esta feature não introduz novas entidades de dados — reorganiza a apresentação de destinos de navegação já existentes.)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% das aberturas do menu em viewports mobile/tablet, o painel de navegação aparece abaixo da barra superior, nunca acima ou sobre ela.
- **SC-002**: Usuárias e usuários conseguem abrir o painel, escolher um destino e chegar lá em até 2 toques, sem precisar de instrução adicional.
- **SC-003**: 100% dos destinos de navegação continuam acessíveis e operáveis por teclado após a mudança, incluindo abrir, percorrer e fechar o painel.
- **SC-004**: Nenhuma regressão é observada na navegação de desktop (coluna fixa lateral) após a mudança.

## Assumptions

- O ponto de corte entre "mobile/tablet" e "desktop" é o mesmo já usado hoje na navegação (a coluna fixa lateral aparece a partir do breakpoint `lg`; abaixo disso é considerado mobile/tablet para efeito desta feature) — a feature não introduz um novo breakpoint intermediário específico para tablet.
- O pedido de usar "o componente Menu do ark-ui" é um requisito de padronização com o design system já adotado pelo projeto (Ark UI + Tailwind CSS, conforme a constituição do projeto) — registrado aqui como restrição de origem do stakeholder, a ser detalhado tecnicamente na fase de planejamento.
- Fechar o painel ao tocar fora dele ou pressionar Esc (FR-005) é um comportamento padrão de menus acessíveis e não é uma regressão em relação ao comportamento atual (que hoje só fecha via botão ou seleção de destino) — é um ganho decorrente da adoção de um componente de menu dedicado.
- A organização por seções/grupos de destinos, os rótulos, ícones e regras de quais destinos aparecem para cada perfil não mudam — apenas a posição e o componente usados para exibi-los em mobile/tablet.
