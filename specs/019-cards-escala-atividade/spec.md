# Feature Specification: Cards de Escala na Página da Atividade

**Feature Branch**: `019-cards-escala-atividade`

**Created**: 2026-10-01

**Status**: Draft

**Input**: User description: "preciso que seja alterado o layout da página de detalhamento de uma atividade. Quero que cada escala tenha seu próprio espaço, listando os voluntários que estão escalados em cada escala. Esses cards das escalas devem preencher de forma horizontal, com os voluntários sendo listados dentro deles na vertical. Caso não couber na horizontal devido o tamanho da tela, ele deve quebrar o layout para ficar logo abaixo e se for em um celular, os cards devem ficar um abaixo do outro. Dessa forma ficará mais visual quantas escalas aquela atividade tem, e quais voluntários estão fazendo parte daquela escala."

## Resumo

Hoje a página de detalhamento de uma atividade (painel de escala da gestão) mostra todos os turnos empilhados dentro de uma única coluna chamada "Escala". Com várias escalas, a coluna fica longa, e é difícil perceber de relance quantas escalas a atividade tem e quem está em cada uma.

Esta feature reorganiza a página: **cada escala (turno) ganha seu próprio card**. Os cards ficam lado a lado na horizontal e, quando não cabem na largura da tela, quebram para a linha de baixo. No celular, ficam um abaixo do outro. Dentro de cada card, os voluntários escalados aparecem em lista vertical.

A mudança é só de apresentação. As ações que existem hoje continuam com as mesmas regras: alocar voluntário em uma escala, remover voluntário, filtrar voluntários por habilidade e ver o aviso de atividade não aberta.

**Terminologia**: o pedido usa "escala" no sentido de um turno da atividade (data, horário de início e fim, número de vagas). Esta spec usa "escala" com esse sentido. O conjunto de todas as escalas de uma atividade é chamado de "escalas da atividade".

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Ver de relance as escalas da atividade e quem está em cada uma (Priority: P1)

A pessoa da gestão (coordenador, administrador ou membro da Defesa Civil) abre o detalhamento de uma atividade e quer entender rapidamente quantas escalas existem, quando cada uma acontece, quantas vagas estão preenchidas e quais voluntários estão em cada escala.

**Why this priority**: É o objetivo central do pedido. Sozinha, essa história já entrega o ganho de leitura.

**Independent Test**: Abrir o detalhamento de uma atividade com 3 ou mais escalas, cada uma com alguns voluntários, em uma tela de computador. Conferir que cada escala aparece em um card próprio, lado a lado, e que cada card lista seus voluntários um abaixo do outro.

**Acceptance Scenarios**:

1. **Given** uma atividade com várias escalas, **When** a pessoa da gestão abre o detalhamento em uma tela larga, **Then** cada escala aparece em um card separado, e os cards ficam dispostos lado a lado na horizontal.
2. **Given** um card de escala, **When** a pessoa olha para ele, **Then** o card mostra no cabeçalho a data e os horários de início e fim da escala e a ocupação (vagas preenchidas de vagas totais, ex.: "3 de 5"). Abaixo do cabeçalho, mostra a lista vertical dos voluntários escalados.
3. **Given** cada voluntário listado em um card, **When** a pessoa olha para ele, **Then** vê as mesmas informações de hoje: nome, ícone do papel na aplicação e a marca "Inscrição própria" quando a pessoa se inscreveu sozinha.
4. **Given** uma escala sem nenhum voluntário escalado, **When** a pessoa vê o card dessa escala, **Then** o card continua aparecendo, com uma mensagem curta de que ninguém está escalado ainda.
5. **Given** a página de detalhamento, **When** a pessoa olha a área das escalas, **Then** vê o total de escalas da atividade (ex.: "4 escalas").
6. **Given** uma atividade sem nenhuma escala, **When** a pessoa abre o detalhamento, **Then** vê a mesma mensagem de hoje informando que a atividade ainda não tem turnos.

---

### User Story 2 - Layout se adapta ao tamanho da tela (Priority: P1)

A pessoa da gestão usa a página em computadores, tablets e celulares, muitas vezes em campo. Os cards precisam se reorganizar para continuar legíveis em qualquer largura, sem rolagem horizontal da página.

**Why this priority**: O pedido define explicitamente o comportamento de quebra e o empilhamento no celular. Sem isso, o novo layout fica inutilizável em telas menores.

**Independent Test**: Abrir a mesma atividade com 5 escalas e redimensionar a janela de larga para estreita (até a largura de um celular, 375px). Conferir que os cards quebram para as linhas de baixo conforme a largura diminui e que, no celular, ficam um card por linha.

**Acceptance Scenarios**:

1. **Given** uma tela em que não cabem todas as escalas em uma única linha, **When** a página é exibida, **Then** os cards que não cabem passam para a linha logo abaixo, preenchendo da esquerda para a direita. A página não ganha rolagem horizontal.
2. **Given** uma tela de celular, **When** a página é exibida, **Then** os cards ficam um abaixo do outro, cada um ocupando a largura disponível.
3. **Given** a janela é redimensionada com a página aberta, **When** a largura muda, **Then** a quantidade de cards por linha se ajusta sem recarregar a página.
4. **Given** cards na mesma linha com quantidades diferentes de voluntários, **When** a página é exibida, **Then** os cards continuam legíveis e alinhados no topo, sem que um card com muitos voluntários sobreponha os da linha de baixo.

---

### User Story 3 - Gerir a escala diretamente no card (Priority: P2)

A pessoa da gestão quer alocar ou remover voluntários sem perder o contexto: a ação fica no próprio card da escala correspondente.

**Why this priority**: As ações já existem. Esta história garante que continuem funcionando no novo layout, com o mesmo comportamento de hoje.

**Independent Test**: Em uma atividade aberta, alocar um voluntário pela ação do card de uma escala e confirmar que ele passa a aparecer na lista daquele card. Depois, removê-lo pelo próprio card e confirmar que some da lista.

**Acceptance Scenarios**:

1. **Given** uma atividade com status "aberta", **When** a pessoa aciona "Alocar voluntário" no card de uma escala, **Then** abre a mesma seleção de voluntário de hoje, já referente àquela escala. Após confirmar, o voluntário aparece na lista daquele card e a ocupação é atualizada.
2. **Given** um voluntário listado em um card, **When** a pessoa aciona a remoção ao lado do nome, **Then** a alocação é cancelada com as mesmas regras e avisos de hoje, e o voluntário sai da lista daquele card.
3. **Given** uma atividade que não está aberta, **When** a pessoa vê os cards, **Then** a ação de alocar não aparece em nenhum card e o aviso de atividade não aberta continua sendo exibido.
4. **Given** o filtro por habilidade, **When** a pessoa escolhe uma habilidade, **Then** o filtro continua afetando apenas a lista de voluntários disponíveis para alocar, como hoje, e não esconde nenhuma escala nem nenhum voluntário já escalado.

---

### Edge Cases

- **Nome de voluntário muito longo**: o nome é encurtado visualmente dentro do card, sem alargar o card nem empurrar o botão de remover para fora. O nome completo continua acessível pela dica da ação de remover, como hoje.
- **Escala com muitos voluntários (ex.: 20+)**: o card cresce na vertical para listar todos. Nenhum voluntário fica escondido.
- **Atividade com uma única escala**: aparece um único card, com a mesma largura de um card em uma linha com vários, sem esticar até a largura toda da tela em telas largas.
- **Atividade com muitas escalas (ex.: 15+)**: os cards continuam quebrando em linhas. A página rola apenas na vertical.
- **Escala lotada ou com mais alocados do que vagas**: a ocupação mostra os números reais (ex.: "6 de 5") com o mesmo destaque visual de lotação usado hoje.
- **Escalas de dias diferentes**: os cards seguem a ordem cronológica de início da escala, e cada card mostra a própria data. Não há agrupamento por dia nesta feature.
- **Ação em andamento**: enquanto uma alocação ou remoção está sendo processada, o comportamento de carregamento e bloqueio dos botões é o mesmo de hoje.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: A página de detalhamento da atividade MUST exibir cada escala da atividade em um card próprio e independente, substituindo a coluna única atual.
- **FR-002**: Os cards de escala MUST ser dispostos lado a lado na horizontal, na ordem cronológica de início da escala, preenchendo da esquerda para a direita.
- **FR-003**: Quando os cards não couberem na largura disponível, os excedentes MUST passar para a linha logo abaixo. A página MUST NOT apresentar rolagem horizontal em nenhuma largura de tela a partir de 320px.
- **FR-004**: Em telas de celular, os cards MUST ficar um abaixo do outro, um por linha, ocupando a largura disponível.
- **FR-005**: Todos os cards de escala MUST ter a mesma largura em uma mesma tela, independentemente do conteúdo, para manter a leitura em grade.
- **FR-006**: O cabeçalho de cada card MUST mostrar a data, o horário de início e fim e a ocupação da escala (vagas preenchidas de vagas totais), com o mesmo destaque de lotação usado hoje.
- **FR-007**: Cada card MUST listar, na vertical, todos os voluntários escalados naquela escala, mostrando para cada um o nome, o ícone do papel na aplicação e a marca "Inscrição própria" quando aplicável.
- **FR-008**: Um card de escala sem voluntários MUST continuar visível e exibir uma mensagem indicando que ainda não há voluntários escalados.
- **FR-009**: A área de escalas MUST exibir o total de escalas da atividade.
- **FR-010**: Quando a atividade estiver aberta, cada card MUST oferecer a ação de alocar voluntário naquela escala, com o mesmo fluxo, regras e mensagens de hoje.
- **FR-011**: Cada voluntário listado MUST ter, ao lado do nome, a ação de remover da escala, com o mesmo fluxo, regras e mensagens de hoje.
- **FR-012**: Quando a atividade não estiver aberta, a ação de alocar MUST NOT aparecer nos cards, e o aviso de atividade não aberta MUST continuar sendo exibido.
- **FR-013**: O cabeçalho da atividade (título, status, categoria e local), o filtro de voluntários por habilidade e a mensagem de atividade sem turnos MUST continuar presentes, com o mesmo comportamento de hoje.
- **FR-014**: As ações de cada card MUST ser utilizáveis por teclado e leitor de tela, com nomes acessíveis que identifiquem a escala ou o voluntário afetado, e com área de toque adequada para uso no celular (mínimo de 44×44px).

### Key Entities

- **Atividade**: ação de voluntariado com título, categoria, local e status. Possui zero ou mais escalas. Nenhuma mudança de dados.
- **Escala (turno)**: período de uma atividade, com data, horário de início e fim e número de vagas. Cada escala vira um card na página. Nenhuma mudança de dados.
- **Voluntário escalado (alocação)**: vínculo de uma pessoa com uma escala, com nome, papel na aplicação e origem (alocação pela gestão ou inscrição própria). Aparece como item da lista dentro do card da escala. Nenhuma mudança de dados.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em uma tela de computador (1280px ou mais), a pessoa da gestão consegue dizer quantas escalas uma atividade tem e quais voluntários estão em uma escala específica em até 5 segundos, sem rolar a página, para atividades com até 4 escalas.
- **SC-002**: Em uma tela de computador de 1280px, pelo menos 3 cards de escala aparecem lado a lado na mesma linha.
- **SC-003**: Em todas as larguras de tela entre 320px e 1920px, a página não apresenta rolagem horizontal e nenhum card ou nome de voluntário fica cortado de forma ilegível.
- **SC-004**: Em uma tela de celular (375px), 100% dos cards aparecem um abaixo do outro, cada um com a largura total disponível.
- **SC-005**: 100% das ações disponíveis hoje na página (alocar, remover, filtrar por habilidade) continuam funcionando no novo layout, com os mesmos resultados e mensagens.

## Assumptions

- "Escala", no pedido, se refere a cada turno da atividade (data, horário e vagas), que é a unidade em que os voluntários são alocados hoje.
- A página afetada é o detalhamento da atividade na área da gestão (painel de escala), acessível às mesmas pessoas que acessam hoje. A tela "Atividades abertas" e "Minhas atividades" ficam fora do escopo.
- Os cards são ordenados pela data e hora de início da escala, que já é a ordem usada hoje.
- Em uma linha, cada card tem uma largura mínima confortável para leitura (aproximadamente a de um cartão estreito de painel). A quantidade de cards por linha decorre disso e da largura da tela, sem um número fixo de colunas.
- A mudança é apenas de apresentação. Não há alteração em regras de negócio, permissões, dados armazenados, auditoria ou notificações.
- Todos os textos da interface permanecem em português brasileiro.
