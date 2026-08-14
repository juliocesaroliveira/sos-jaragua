# Feature Specification: Rodapé de paginação server-side no DataTable

**Feature Branch**: `007-datatable-server-pagination`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "na pagina /admin o DataTable deve exibir uma barra no footer onde mostre quantos registros existem, em qual pagina está, um dropdown que permita o usuario a selecionar a quantidade de registros por pagina (5, 10, 20 e 50) e o uso de um componente Pagination. Deve ser criado o componente Pagination usando como base o componente Pagination do ark-ui. Os registros devem ser paginados no lado do servidor, ou seja, cada página carregada deve ir ao bff para buscar os registros a serem apresentados no DataTable. Todas as paginas existentes na aplicação devem seguir essa mesma implementação de DataTable com paginação server-side, usando o tanstack-query junto com server functions para obter os dados."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Rodapé de paginação em /admin (Priority: P1)

Uma pessoa administradora abre a lista de contas em `/admin`. Abaixo da tabela ela vê uma barra fixa de rodapé que informa quantos registros existem no total, qual a faixa de registros exibida e em que página está. Pelos controles de página ela navega entre as páginas, e a tabela é recarregada com os registros da nova página vindos do servidor.

**Why this priority**: É o pedido central e entrega valor sozinho — sem ele a pessoa não sabe o tamanho da lista nem consegue navegar com previsibilidade.

**Independent Test**: Com mais registros do que cabem numa página, abrir `/admin`, conferir os totais no rodapé, clicar em "próxima página" e verificar que outro conjunto de linhas aparece e o indicador de página acompanha.

**Acceptance Scenarios**:

1. **Given** existem 47 contas e a página exibe 20 por vez, **When** a pessoa abre `/admin`, **Then** o rodapé informa o total de 47 registros, a faixa exibida (1–20) e a página atual (1 de 3).
2. **Given** a pessoa está na página 1, **When** ela aciona a próxima página, **Then** a tabela mostra os registros 21–40 e o rodapé passa a indicar página 2 de 3.
3. **Given** a pessoa está na última página, **When** ela observa os controles, **Then** o controle de avançar está desabilitado e o de voltar está disponível.
4. **Given** a pessoa está numa página qualquer, **When** ela copia a URL e reabre em outra aba, **Then** a mesma página é exibida.

---

### User Story 2 - Escolher registros por página (Priority: P2)

Na mesma barra de rodapé há um seletor com as opções 5, 10, 20 e 50 registros por página. Ao escolher outro valor, a tabela recarrega com a nova quantidade de linhas e os totais do rodapé se ajustam.

**Why this priority**: Aumenta o controle da pessoa sobre a densidade da lista, mas depende do rodapé da US1 existir.

**Independent Test**: Com o rodapé disponível, trocar o seletor de 20 para 5 e verificar que a tabela passa a exibir 5 linhas e que o número total de páginas aumenta proporcionalmente.

**Acceptance Scenarios**:

1. **Given** a lista está em 20 registros por página, **When** a pessoa seleciona 5, **Then** a tabela exibe 5 linhas, o rodapé recalcula o total de páginas e a visualização volta para a página 1.
2. **Given** a pessoa está na página 3 com 5 por página, **When** ela seleciona 50, **Then** a visualização volta para a página 1 sem exibir estado vazio indevido.
3. **Given** a pessoa escolheu 50 por página, **When** ela recarrega a URL atual, **Then** a escolha de 50 é preservada.

---

### User Story 3 - Mesmo comportamento em todas as listagens (Priority: P3)

Todas as telas da aplicação que exibem uma tabela de registros (usuários, voluntários, estoque, relatórios e as demais listagens existentes) apresentam o mesmo rodapé, o mesmo seletor de registros por página e o mesmo comportamento de carregamento por página.

**Why this priority**: Consistência em toda a aplicação; entrega valor, mas só depois do padrão estar validado em `/admin`.

**Independent Test**: Percorrer cada tela de listagem e verificar presença do rodapé, dos mesmos rótulos e do mesmo comportamento de navegação e de troca de tamanho de página.

**Acceptance Scenarios**:

1. **Given** qualquer tela de listagem da aplicação, **When** a pessoa a abre, **Then** o rodapé de paginação aparece com os mesmos elementos e rótulos de `/admin`.
2. **Given** uma listagem com muitos registros, **When** a pessoa navega para outra página, **Then** apenas os registros daquela página são carregados do servidor.

---

### Edge Cases

- **Zero registros**: o rodapé informa "0 registros" e os controles de navegação ficam desabilitados; a tabela mostra a mensagem de lista vazia.
- **Uma única página**: os controles de avançar/voltar ficam desabilitados, mas o rodapé com totais e o seletor de registros por página continuam visíveis.
- **Página inexistente na URL** (ex.: `page=999` com 3 páginas, `page=0`, `page=abc`): a aplicação exibe a primeira página em vez de erro ou tela em branco.
- **Tamanho de página inválido na URL** (ex.: `pageSize=7`): a aplicação usa o tamanho padrão.
- **Registros removidos entre carregamentos**, deixando a página atual além do fim: a aplicação exibe a última página válida.
- **Falha ao carregar uma página**: a pessoa vê mensagem de erro e pode tentar novamente; a tabela não fica presa em carregamento indefinido.
- **Carregamento em andamento**: a tabela indica que está buscando dados; a barra de rodapé permanece visível para não deslocar o conteúdo da página.
- **Cliques rápidos e sucessivos** em avançar: prevalece o resultado da última página solicitada.
- **Telas estreitas (mobile)**: os elementos do rodapé se reorganizam sem provocar rolagem horizontal da página.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: A tabela de `/admin` MUST exibir uma barra de rodapé fixa ao componente de tabela, sempre visível quando a tabela é renderizada.
- **FR-002**: A barra de rodapé MUST informar o total de registros existentes no servidor (não apenas os da página atual).
- **FR-003**: A barra de rodapé MUST informar a página atual e o total de páginas, além da faixa de registros exibida.
- **FR-004**: A barra de rodapé MUST oferecer um seletor de registros por página com exatamente as opções 5, 10, 20 e 50.
- **FR-005**: Ao alterar o número de registros por página, o sistema MUST recarregar a listagem a partir da primeira página.
- **FR-006**: A barra de rodapé MUST incluir controles de navegação entre páginas com números de página, avançar e voltar, e indicação visual da página ativa.
- **FR-007**: Os controles de navegação MUST estar desabilitados quando não houver página anterior ou seguinte correspondente.
- **FR-008**: O sistema MUST buscar do servidor somente os registros da página solicitada; nunca carregar a lista completa para paginar no navegador.
- **FR-009**: Cada mudança de página ou de tamanho de página MUST resultar em uma nova busca de dados no servidor com os parâmetros de paginação correspondentes.
- **FR-010**: O servidor MUST devolver, junto com os registros da página, o total de registros disponíveis para os filtros vigentes.
- **FR-011**: A página atual e o tamanho de página MUST ser refletidos na URL, de modo que a visualização seja compartilhável e sobreviva a recarregamentos.
- **FR-012**: O sistema MUST tratar valores de página e tamanho de página inválidos ou fora do intervalo aplicando os valores padrão/válidos mais próximos, sem exibir erro.
- **FR-013**: Enquanto uma página está sendo carregada, o sistema MUST comunicar o estado de carregamento sem remover a barra de rodapé.
- **FR-014**: Em caso de falha na busca, o sistema MUST exibir mensagem de erro compreensível e permitir nova tentativa.
- **FR-015**: Os controles do rodapé MUST ser operáveis por teclado e anunciados corretamente por leitores de tela, incluindo a indicação de página ativa.
- **FR-016**: Todas as telas de listagem já existentes na aplicação MUST adotar o mesmo rodapé, o mesmo seletor de registros por página e o mesmo modelo de carregamento por página.
- **FR-017**: O componente de paginação MUST ser um componente compartilhado único, reutilizado por todas as listagens, sem cópias por tela.
- **FR-018**: O tamanho de página padrão MUST ser 20 quando a pessoa ainda não tiver escolhido outro valor.
- **FR-019**: Navegar entre páginas MUST preservar os demais parâmetros de visualização já presentes na URL (filtros, busca, ordenação, quando existirem).
- **FR-020**: A troca de páginas já visitadas MUST reaproveitar dados recentes quando disponíveis, evitando um estado de carregamento vazio a cada retorno.

### Key Entities

- **Página de resultados**: conjunto de registros correspondente a uma combinação de número de página e tamanho de página, acompanhado do total de registros disponíveis.
- **Parâmetros de listagem**: número da página, quantidade de registros por página e demais critérios da visualização (filtros/ordenação existentes), usados para solicitar uma página de resultados.
- **Registro de listagem**: linha exibida na tabela; seu conteúdo varia por tela (contas, voluntários, itens de estoque, etc.) e não é alterado por esta feature.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em qualquer tela de listagem, a pessoa identifica o total de registros e a página atual sem precisar rolar além do rodapé da tabela.
- **SC-002**: Trocar de página exibe o novo conjunto de registros em até 1 segundo em condições normais de rede.
- **SC-003**: O volume de registros trazidos por carregamento nunca excede o tamanho de página selecionado, independentemente de a lista ter 50 ou 50.000 registros.
- **SC-004**: 100% das telas de listagem existentes exibem o mesmo rodapé com os mesmos elementos e rótulos.
- **SC-005**: Todos os controles do rodapé são alcançáveis e acionáveis apenas pelo teclado, sem armadilhas de foco.
- **SC-006**: Compartilhar a URL de uma listagem reproduz exatamente a mesma página e o mesmo tamanho de página para outra pessoa com acesso.
- **SC-007**: Nenhuma das telas de listagem apresenta rolagem horizontal da página em largura de 360 px.

## Assumptions

- O componente de paginação existente na biblioteca compartilhada será evoluído (e não substituído) para atender ao novo rodapé, mantendo a base de acessibilidade já adotada.
- O rodapé faz parte do componente de tabela compartilhado, de modo que cada tela o obtém sem reimplementar controles.
- As opções de registros por página são fixas em 5, 10, 20 e 50; não há entrada livre de valores.
- A escolha de registros por página é mantida na URL e não é persistida no perfil da pessoa entre sessões.
- Ordenação e filtros não fazem parte do escopo desta feature; onde já existirem, apenas precisam ser preservados ao paginar.
- As listagens já expõem, ou podem expor, a contagem total de registros no servidor.
- O comportamento vale para as telas de listagem em produção; a galeria do design system serve como vitrine do componente e não precisa de dados reais paginados.
- A aplicação passará a contar com um provedor de cache de dados no cliente, hoje inexistente, para atender ao reaproveitamento de páginas já visitadas (FR-020).

## Out of Scope

- Ordenação e filtragem server-side (podem vir em feature própria).
- Paginação por cursor/rolagem infinita.
- Exportação da listagem completa.
- Persistência da preferência de tamanho de página por usuário.
