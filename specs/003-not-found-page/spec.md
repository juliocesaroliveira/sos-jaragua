# Feature Specification: Página Padrão de Endereço Não Encontrado (404)

**Feature Branch**: `003-not-found-page`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "preciso que seja criado uma pagina padrao para paginas 404. Essa pagina caso exista sessao ativa, ela deve renderizar o topbar e sidebar junto com a pagina 404, porem se nao houver sessao valida nao deve ter o topbar e sidebar. Essa pagina deve ter um botao para voltar para a home."

## Resumo

Hoje, quem digita um endereço inexistente recebe a tela genérica padrão do framework: em inglês, sem identidade visual da aplicação, sem navegação e sem caminho de saída. Em uma operação de campo durante uma crise, isso é um beco sem saída — a pessoa precisa recorrer ao botão "voltar" do navegador ou reescrever a URL na mão.

Esta feature cria uma página própria para endereço não encontrado, em pt-BR, com duas apresentações conforme o estado da sessão:

- **Com sessão ativa**: dentro do shell da aplicação (barra superior + menu lateral do perfil), para que a pessoa continue navegando sem sair do lugar.
- **Sem sessão válida**: sozinha, sem barra superior nem menu — não faz sentido exibir navegação de uma área a que a pessoa não tem acesso, nem revelar sua estrutura.

Nos dois casos há um botão explícito de retorno.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Endereço inexistente com sessão ativa (Priority: P1)

Uma pessoa autenticada digita ou segue um endereço que não existe (link antigo, URL com erro de digitação, favorito desatualizado). Em vez de uma tela genérica, ela vê uma página da própria aplicação explicando que o endereço não existe, com a barra superior e o menu lateral do seu perfil ainda disponíveis, e um botão para voltar à página inicial.

**Why this priority**: É o caso majoritário — a maior parte do tráfego da aplicação é autenticada, e é onde o beco sem saída custa mais: alguém em operação de campo perde tempo tentando reencontrar o caminho.

**Independent Test**: Autenticar com qualquer perfil, acessar um endereço inventado e confirmar que a página aparece com shell completo, menu correspondente ao perfil e botão de retorno funcional.

**Acceptance Scenarios**:

1. **Given** uma pessoa autenticada, **When** ela acessa um endereço que não existe, **Then** vê uma página em pt-BR informando que o endereço não foi encontrado, com barra superior e menu lateral visíveis.
2. **Given** essa página exibida, **When** a pessoa aciona o botão de retorno, **Then** é levada à página inicial da aplicação.
3. **Given** essa página exibida, **When** a pessoa usa o menu lateral, **Then** navega normalmente para qualquer destino do seu perfil, sem precisar do botão "voltar" do navegador.
4. **Given** perfis diferentes acessando o mesmo endereço inexistente, **When** a página é exibida, **Then** cada um vê o menu correspondente ao seu próprio perfil.
5. **Given** essa página exibida, **When** o conteúdo é inspecionado, **Then** ele **não** revela quais endereços existem nem a estrutura de áreas restritas.

---

### User Story 2 - Endereço inexistente sem sessão (Priority: P1)

Alguém sem sessão válida chega a um endereço inexistente. Vê a mesma página, em pt-BR e com a identidade da aplicação, mas **sem** barra superior e **sem** menu lateral, e com um caminho de saída adequado a quem não está autenticado.

**Why this priority**: É a outra metade do comportamento pedido e a que carrega risco: exibir o menu a quem não tem sessão vazaria a estrutura interna da aplicação para qualquer visitante.

**Independent Test**: Sem sessão (ou após sair), acessar um endereço inexistente e confirmar ausência de barra superior e menu, presença do botão de saída e nenhuma menção a áreas internas.

**Acceptance Scenarios**:

1. **Given** um visitante sem sessão válida, **When** ele alcança a página de endereço não encontrado, **Then** ela é exibida sem barra superior e sem menu lateral.
2. **Given** essa página exibida sem sessão, **When** o conteúdo é inspecionado, **Then** não há nenhum nome de área interna, destino de menu ou identificação de usuário.
3. **Given** essa página exibida sem sessão, **When** a pessoa aciona o botão de retorno, **Then** é levada ao ponto de entrada disponível a quem não está autenticado.
4. **Given** uma pessoa cuja sessão expirou, **When** ela alcança a página, **Then** vê a apresentação sem shell — o estado de sessão vale no momento da exibição, não o anterior.

---

### User Story 3 - Recurso inexistente dentro de uma área autenticada (Priority: P2)

Uma pessoa autenticada abre o endereço de um registro específico que não existe mais ou nunca existiu (por exemplo, uma atividade removida, ou um identificador inválido em um link compartilhado). Ela vê a mesma página de endereço não encontrado, com o shell do seu perfil.

**Why this priority**: O endereço é válido em forma, mas o recurso não existe — situação real em links compartilhados entre a equipe. Menos frequente que a US1, e já coberta pela mesma página, por isso vem depois.

**Independent Test**: Autenticar como perfil interno, acessar o endereço de uma atividade com identificador inexistente e confirmar que a página aparece com shell, em vez de erro genérico.

**Acceptance Scenarios**:

1. **Given** uma pessoa autenticada com acesso à área de atividades, **When** ela acessa o endereço de uma atividade que não existe, **Then** vê a página de endereço não encontrado com o shell do seu perfil.
2. **Given** esse caso, **When** a página é exibida, **Then** ela **não** informa se o registro já existiu — apenas que não foi encontrado.

---

### Edge Cases

- **Sem permissão ≠ não encontrado**: quem acessa um endereço que existe mas é restrito ao seu perfil continua recebendo a resposta de acesso não permitido, **não** esta página. As duas situações não podem ser confundidas.
- **Perfil sem destinos no menu**: se o perfil da pessoa não tiver nenhum item de menu visível, a página continua exibindo a barra superior e o botão de retorno, sem uma coluna de menu vazia.
- **Sessão encerrada entre a navegação e a exibição**: a apresentação escolhida reflete o estado da sessão no momento em que a página é montada.
- **Endereço inexistente com caminho muito longo ou com caracteres inesperados**: a página é exibida normalmente e não ecoa o endereço digitado de volta na tela.
- **Retorno quando a página inicial não é acessível**: se a pessoa não tiver sessão, o botão a leva ao ponto de entrada de quem não está autenticado, e não a um destino que a rejeitaria em seguida.
- **Chamadas que não são de página** (integrações e downloads): permanecem respondendo em seu próprio formato; esta página é para navegação, não para respostas de integração.

## Requirements *(mandatory)*

### Functional Requirements

#### Comportamento geral

- **FR-001**: O sistema MUST exibir uma página própria da aplicação quando o endereço solicitado não corresponder a nenhuma página existente, substituindo a tela genérica padrão.
- **FR-002**: A página MUST sinalizar aos navegadores e mecanismos de busca que o endereço não existe, e não que a solicitação teve sucesso.
- **FR-003**: A mesma página MUST atender tanto endereços desconhecidos quanto recursos inexistentes dentro de áreas válidas — não devem existir duas telas diferentes para a mesma ideia.
- **FR-004**: Todo o texto da página MUST estar em pt-BR.
- **FR-005**: A página MUST respeitar a preferência de tema claro/escuro em vigor.

#### Apresentação conforme a sessão

- **FR-006**: Quando houver sessão válida, a página MUST ser exibida dentro do shell da aplicação, com barra superior e menu lateral.
- **FR-007**: O menu exibido MUST conter exatamente os destinos do perfil de quem está autenticado, seguindo a mesma regra de visibilidade das demais páginas autenticadas.
- **FR-008**: Quando não houver sessão válida, a página MUST ser exibida **sem** barra superior e **sem** menu lateral.
- **FR-009**: Sem sessão válida, a página MUST NOT exibir nome de usuário, perfil de acesso, notificações, nem qualquer destino de área interna.
- **FR-010**: A escolha entre as duas apresentações MUST ser feita no servidor, a partir da sessão validada — nunca a partir de informação fornecida pelo cliente.

#### Retorno

- **FR-011**: A página MUST oferecer um botão explícito de retorno, identificado em pt-BR.
- **FR-012**: Com sessão válida, o botão MUST levar à página inicial da aplicação.
- **FR-013**: Sem sessão válida, o botão MUST levar ao ponto de entrada de quem não está autenticado, de modo que acioná-lo nunca resulte em nova negativa.
- **FR-014**: Com sessão válida, a pessoa MUST conseguir alcançar qualquer destino do seu perfil a partir desta página, sem usar o botão "voltar" do navegador.

#### Segurança e privacidade

- **FR-015**: A página MUST NOT revelar quais endereços existem na aplicação, nem diferenciar visualmente "endereço inexistente" de "recurso removido".
- **FR-016**: A página MUST NOT ser usada como resposta para falta de permissão — endereço existente e restrito continua produzindo a resposta de acesso não permitido.
- **FR-017**: A página MUST NOT ecoar na tela o endereço solicitado.

#### Acessibilidade e responsividade

- **FR-018**: A página MUST ser operável por teclado, com foco visível e o botão de retorno alcançável na ordem de tabulação.
- **FR-019**: A página MUST ser legível e utilizável em telas a partir de 360px de largura, sem rolagem horizontal.
- **FR-020**: O botão de retorno MUST ter alvo de toque adequado ao uso em campo com uma das mãos.
- **FR-021**: A página MUST comunicar sua condição a tecnologias assistivas, e não apenas por cor ou ilustração.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos endereços inexistentes alcançados por pessoas autenticadas exibem a página com barra superior e menu lateral.
- **SC-002**: 0% das exibições sem sessão válida apresentam barra superior, menu lateral, identificação de usuário ou qualquer destino de área interna.
- **SC-003**: A partir desta página, uma pessoa autenticada alcança a página inicial em um clique, e qualquer destino do seu perfil em no máximo dois.
- **SC-004**: 0% dos acionamentos do botão de retorno resultam em nova negativa de acesso ou em outro endereço não encontrado, verificado nos cinco perfis e também sem sessão.
- **SC-005**: A tela genérica em inglês, sem identidade visual da aplicação, deixa de aparecer em qualquer navegação — verificado percorrendo endereços inexistentes com e sem sessão.
- **SC-006**: Endereços existentes porém restritos continuam produzindo a resposta de acesso não permitido em 100% dos casos, sem serem confundidos com endereço não encontrado.
- **SC-007**: A página é operável do início ao fim por teclado e legível em 360px, sem rolagem horizontal.
- **SC-008**: A página é exibida sem atraso perceptível, dentro do padrão das demais telas da aplicação.

## Assumptions

- **Página inicial como destino de retorno**: "voltar para a home" significa a página inicial autenticada da aplicação, que já monta atalhos conforme o perfil. Para quem não tem sessão, o equivalente é a tela de entrada — mandar um visitante à página inicial só o faria ser redirecionado em seguida.
- **Reaproveitamento do shell existente**: a apresentação com sessão usa o mesmo shell das demais páginas autenticadas, não uma barra ou menu próprios desta tela.
- **Alcance da variante sem sessão** *(restrição importante — ver nota abaixo)*: o modelo de acesso vigente exige sessão para praticamente toda rota de navegação, então um visitante sem sessão que digite um endereço desconhecido é enviado à tela de entrada **antes** de chegar a esta página. A variante sem shell permanece especificada e implementada porque é o comportamento correto onde a verificação de sessão não se aplica, e porque qualquer ampliação futura das rotas públicas passaria a exercitá-la.
- **Nenhuma mudança no modelo de acesso**: esta feature não altera quais endereços exigem sessão nem quais perfis acessam o quê.
- **Sem registro de ocorrências**: não é escopo desta feature contabilizar ou reportar endereços não encontrados; se isso for desejado, é trabalho próprio.
- **Sem sugestões de destino**: a página não tenta adivinhar o endereço pretendido nem oferecer busca — o menu lateral já cumpre esse papel para quem está autenticado.
- **Respostas de integração inalteradas**: chamadas que não renderizam página continuam respondendo em seu próprio formato.

### Nota sobre a variante sem sessão

O comportamento pedido — "sem sessão válida, sem barra superior e sem menu" — está integralmente especificado acima. Vale registrar, porém, que **na configuração atual ele quase não é observável na prática**: como toda rota de navegação exige sessão, o visitante anônimo é desviado para a tela de entrada antes de a página de endereço não encontrado ser alcançada.

Tornar essa variante plenamente visível exigiria permitir que endereços desconhecidos escapassem da verificação de sessão — o que deixaria qualquer visitante distinguir endereços que existem dos que não existem, revelando a estrutura interna da aplicação. Por isso o padrão adotado aqui é **preservar o modelo de acesso vigente**. Se a preferência for a oposta, trata-se de uma decisão de segurança a ser tomada explicitamente, e não um efeito colateral desta feature.
