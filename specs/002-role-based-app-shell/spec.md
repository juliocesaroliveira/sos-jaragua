# Feature Specification: Shell de Navegação por Perfil (Topbar + Sidebar)

**Feature Branch**: `002-role-based-app-shell`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "preciso que a aplicacao tenha visivel em todas as paginas autenticadas a renderizacao do topbar juntamente com o sidebar menu. Os itens do sidebar devem ser carregados por perfil de acesso, respeitando as roles de usuario, coordenador, defesa civil e admin."

## Resumo

Hoje o shell de navegação (barra superior + menu lateral) existe apenas na área interna de staff. Usuários autenticados que não são staff — quem acabou de se cadastrar e ainda não é voluntário, e o voluntário aprovado — acessam páginas autenticadas sem qualquer barra de navegação, sem identificação de quem está logado e sem uma forma visível de sair da aplicação.

Esta feature torna o shell (topbar + sidebar) presente em **todas** as páginas autenticadas da aplicação e faz com que o conjunto de itens do menu seja determinado pelo perfil de acesso de quem está logado, de forma consistente com as regras de autorização já vigentes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navegação presente em toda página autenticada (Priority: P1)

Qualquer pessoa autenticada, ao abrir qualquer página que exija sessão, vê a barra superior (identificação da aplicação, seu nome e perfil, alternância de tema, notificações quando aplicável, e a ação de sair) e o menu lateral com os destinos disponíveis para ela. A navegação não desaparece ao trocar de página.

**Why this priority**: É a lacuna funcional central. Sem ela, perfis não-staff ficam presos em páginas isoladas, sem meio visível de navegar ou encerrar a sessão — um beco sem saída na experiência.

**Independent Test**: Autenticar com cada perfil e percorrer todas as páginas autenticadas acessíveis àquele perfil, confirmando presença e funcionamento da topbar e do menu em cada uma. Entrega valor mesmo se os itens de menu ainda não estiverem totalmente diferenciados por perfil.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado com perfil "Usuário", **When** ele acessa a página de candidatura a voluntariado, **Then** a topbar e o menu lateral são exibidos, com seu nome e o rótulo do seu perfil visíveis.
2. **Given** um voluntário autenticado, **When** ele acessa "Minhas atividades", **Then** a topbar e o menu lateral são exibidos.
3. **Given** qualquer usuário autenticado, **When** ele é levado à página de acesso negado por tentar uma rota fora do seu perfil, **Then** a topbar e o menu lateral continuam visíveis, permitindo que ele navegue para um destino permitido sem usar o botão "voltar" do navegador.
4. **Given** qualquer usuário autenticado, **When** ele navega entre páginas, **Then** o item de menu correspondente à página atual é indicado visualmente e comunicado à tecnologia assistiva.
5. **Given** um visitante não autenticado, **When** ele acessa a tela de login ou a página inicial pública, **Then** o shell autenticado **não** é exibido.

---

### User Story 2 - Itens de menu carregados por perfil de acesso (Priority: P1)

O conjunto de itens do menu lateral é montado a partir do perfil de quem está logado. Cada perfil vê apenas os destinos a que tem direito — nada além, nada a menos.

**Why this priority**: É o segundo pilar do pedido e a diferença entre um menu útil e um menu que oferece caminhos que resultam em acesso negado. Sem ele, a User Story 1 entrega navegação, mas com destinos quebrados para perfis restritos.

**Independent Test**: Autenticar com cada um dos cinco perfis e comparar a lista de itens renderizados contra a matriz de destinos por perfil definida nos requisitos, verificando ausência de itens não permitidos e presença de todos os permitidos.

**Acceptance Scenarios**:

1. **Given** um usuário com perfil "Usuário", **When** o menu é renderizado, **Then** ele contém apenas destinos da sua área pessoal (candidatura a voluntariado e perfil/conta) e nenhum destino de operação interna.
2. **Given** um voluntário, **When** o menu é renderizado, **Then** ele contém "Minhas atividades" e destinos pessoais, e nenhum destino de gestão (estoque, triagem, convocação, relatórios).
3. **Given** um Membro da Defesa Civil, **When** o menu é renderizado, **Then** ele contém painel, cadastros pendentes, voluntários, atividades, variáveis da crise e as operações de estoque permitidas ao seu perfil, mas **não** contém descarte, kits, convocação, relatórios nem administração.
4. **Given** um Coordenador, **When** o menu é renderizado, **Then** ele contém todos os destinos operacionais e de coordenação (incluindo descarte, kits, convocação e relatórios), mas **não** contém administração.
5. **Given** um Administrador, **When** o menu é renderizado, **Then** ele contém tudo que o Coordenador vê, acrescido dos destinos de administração.
6. **Given** qualquer perfil, **When** um item de menu é exibido para ele, **Then** clicar nesse item leva à página correspondente sem resultar em negativa de acesso.

---

### User Story 3 - Agrupamento e legibilidade do menu (Priority: P2)

Para perfis com muitos destinos (Coordenador, Administrador), os itens são agrupados por área — de forma que a lista permaneça escaneável em vez de virar uma coluna longa e indiferenciada. Grupos sem nenhum item visível para o perfil atual não aparecem.

**Why this priority**: Melhora a usabilidade sob estresse (requisito de aceitação do fluxo de desenvolvimento do projeto), mas o menu segue funcional sem agrupamento — por isso vem depois das duas primeiras histórias.

**Independent Test**: Autenticar como Coordenador e verificar que os itens aparecem sob rótulos de área; autenticar como Membro da Defesa Civil e verificar que nenhum grupo vazio é renderizado.

**Acceptance Scenarios**:

1. **Given** um Coordenador, **When** o menu é renderizado, **Then** os itens aparecem organizados sob rótulos de área em pt-BR.
2. **Given** um perfil cujo conjunto permitido esvazia completamente um grupo, **When** o menu é renderizado, **Then** o rótulo daquele grupo não é exibido.

---

### Edge Cases

- **Perfil sem nenhum destino além do padrão**: se o conjunto de itens permitidos a um perfil for vazio, o menu não é renderizado como uma coluna vazia; a topbar permanece, garantindo acesso a tema, identificação e saída.
- **Sessão expirada durante a navegação**: ao clicar em um item de menu com a sessão já expirada, a pessoa é levada ao login e, após reautenticar, ao destino pretendido — o shell não exibe estado autenticado obsoleto.
- **Mudança de perfil durante a sessão** (ex.: candidatura aprovada, promovendo "Usuário" a "Voluntário"): na próxima navegação após a mudança, o menu reflete o novo perfil, sem exigir logout manual.
- **Item de menu apontando para destino inexistente**: nenhum item é exibido para um destino que ainda não foi construído, evitando levar a pessoa a uma página de erro.
- **Telas estreitas**: em larguras pequenas o menu não ocupa espaço permanentemente; é acessível por um controle na topbar e fecha ao escolher um destino.
- **Notificações para perfis não-staff**: a área de notificações da topbar só é exibida para perfis que efetivamente recebem notificações; para os demais, a topbar não apresenta um controle vazio.
- **Divergência entre menu e autorização**: se um destino for exibido a um perfil que não pode acessá-lo, isso é tratado como defeito — a autorização continua sendo aplicada independentemente do que o menu mostra.

## Requirements *(mandatory)*

### Functional Requirements

#### Presença do shell

- **FR-001**: O sistema MUST exibir o shell de navegação (topbar + menu lateral) em todas as páginas que exijam sessão autenticada, independentemente do perfil da pessoa logada.
- **FR-002**: O sistema MUST NOT exibir o shell autenticado em páginas acessíveis sem sessão (login, cadastro e a página inicial pública).
- **FR-003**: O sistema MUST manter o shell visível e consistente ao navegar entre páginas autenticadas, sem que a navegação seja remontada ou perca estado a cada transição.
- **FR-004**: Uma página autenticada nova MUST herdar o shell por padrão, sem exigir que quem a cria adicione a navegação manualmente.

#### Conteúdo da topbar

- **FR-005**: A topbar MUST exibir a identificação da aplicação, o nome da pessoa autenticada e o rótulo do seu perfil em pt-BR.
- **FR-006**: A topbar MUST oferecer a ação de encerrar sessão, disponível a todos os perfis autenticados.
- **FR-007**: A topbar MUST oferecer a alternância entre tema claro e escuro.
- **FR-008**: A topbar MUST exibir o acesso a notificações apenas para perfis que recebem notificações no sistema.
- **FR-009**: Em larguras de tela pequenas, a topbar MUST oferecer o controle que abre e fecha o menu lateral.

#### Montagem do menu por perfil

- **FR-010**: O sistema MUST determinar o conjunto de itens do menu a partir do perfil da pessoa autenticada, obtido da sessão validada no servidor — nunca de valor informado pelo cliente.
- **FR-011**: O sistema MUST derivar a visibilidade de cada item da mesma fonte de verdade que governa a autorização de rotas, de modo que menu e controle de acesso não possam divergir.
- **FR-012**: O sistema MUST omitir do menu todo destino que o perfil atual não pode acessar.
- **FR-013**: O sistema MUST exibir no menu todos os destinos existentes que o perfil atual pode acessar, conforme a matriz abaixo.
- **FR-014**: O sistema MUST indicar visualmente e semanticamente qual item corresponde à página atualmente exibida.
- **FR-015**: O sistema MUST tratar a omissão de itens no menu como ergonomia, não como mecanismo de segurança — a autorização MUST continuar sendo aplicada em cada acesso, mesmo que o destino seja alcançado por URL direta.

#### Matriz de destinos por perfil

- **FR-016**: O perfil **Usuário** MUST ver, no menu, apenas destinos da sua área pessoal: candidatura a voluntariado e sua conta/perfil.
- **FR-017**: O perfil **Voluntário** MUST ver os destinos do perfil Usuário acrescidos de "Minhas atividades", e MUST NOT ver destinos de gestão.
- **FR-018**: O perfil **Membro da Defesa Civil** MUST ver: painel, cadastros pendentes, voluntários, atividades, variáveis da crise, consulta de estoque, entrada de doações e saída de itens. MUST NOT ver descarte, kits, convocação, relatórios ou administração.
- **FR-019**: O perfil **Coordenador** MUST ver tudo do Membro da Defesa Civil acrescido de descarte, kits, convocação e relatórios. MUST NOT ver administração.
- **FR-020**: O perfil **Administrador** MUST ver tudo do Coordenador acrescido dos destinos de administração.
- **FR-021**: Ao adicionar um destino novo à aplicação, o sistema MUST exigir a definição explícita dos perfis que o enxergam no menu, não assumindo visibilidade universal por omissão.

#### Comportamento e acessibilidade

- **FR-022**: Em larguras de tela pequenas o menu MUST permanecer recolhido por padrão e MUST fechar automaticamente após a escolha de um destino.
- **FR-023**: O menu MUST ser operável inteiramente por teclado, com foco visível e ordem de tabulação previsível.
- **FR-024**: Os alvos de toque dos itens de menu e dos controles da topbar MUST ter tamanho adequado para uso em campo com uma das mãos.
- **FR-025**: Todos os rótulos de itens, grupos e controles MUST estar em pt-BR.
- **FR-026**: Grupos de menu sem nenhum item visível ao perfil atual MUST NOT ser renderizados.
- **FR-027**: Quando a sessão expira, o sistema MUST levar a pessoa ao login e, após reautenticação bem-sucedida, ao destino que ela tentava alcançar.

### Key Entities

- **Perfil de acesso (Role)**: classificação da pessoa autenticada que determina o que ela pode acessar. Valores: Usuário, Voluntário, Membro da Defesa Civil, Coordenador, Administrador. Já existe no sistema e não é alterado por esta feature.
- **Item de navegação**: destino apresentável no menu. Atributos: rótulo em pt-BR, destino, representação visual, grupo ao qual pertence, e o conjunto de perfis que o enxergam.
- **Grupo de navegação**: agrupamento nomeado de itens por área (ex.: área pessoal, voluntariado, estoque, coordenação, administração). Existe apenas para legibilidade; não carrega autorização própria.
- **Sessão autenticada**: identidade validada no servidor que fornece nome e perfil exibidos na topbar e usados para montar o menu.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das páginas que exigem autenticação exibem topbar e menu lateral, verificado percorrendo cada página com cada um dos cinco perfis.
- **SC-002**: 0% das páginas acessíveis sem autenticação exibem o shell autenticado.
- **SC-003**: Para cada um dos cinco perfis, o conjunto de itens exibidos corresponde exatamente à matriz de destinos por perfil — nenhum item a mais, nenhum a menos.
- **SC-004**: 0% dos itens de menu exibidos resultam em negativa de acesso ao serem acionados, medido acionando todos os itens visíveis de cada perfil.
- **SC-005**: Qualquer pessoa autenticada consegue encerrar a sessão a partir de qualquer página autenticada em no máximo dois cliques.
- **SC-006**: Qualquer pessoa autenticada alcança qualquer destino permitido ao seu perfil a partir de qualquer página autenticada em no máximo dois cliques.
- **SC-007**: O menu é operável por teclado do início ao fim, sem armadilhas de foco, verificado em telas largas e estreitas.
- **SC-008**: Em telas de 360px de largura, o conteúdo principal permanece legível e utilizável com o menu recolhido, sem rolagem horizontal.
- **SC-009**: A adição do shell não introduz atraso perceptível: a primeira renderização útil das páginas autenticadas permanece dentro do padrão atual das telas de operação de campo.

## Assumptions

- **Perfis cobertos**: a descrição da feature cita quatro perfis ("usuario, coordenador, defesa civil e admin"). O sistema define cinco. Assumimos que **Voluntário** também está no escopo — é um perfil autenticado com páginas próprias e hoje sem navegação, exatamente o problema que a feature descreve.
- **Reaproveitamento do shell existente**: o shell já em uso na área interna é a base; esta feature o generaliza para os demais perfis em vez de criar uma segunda navegação paralela.
- **Fonte de verdade única**: a visibilidade dos itens deriva das mesmas regras de autorização de rota já existentes no projeto, evitando uma segunda tabela de permissões que possa divergir.
- **Escopo de páginas novas**: a feature entrega navegação para páginas autenticadas **existentes**. Destinos citados na matriz que ainda não tenham página construída (notadamente a área de administração e a página de conta/perfil) não são construídos aqui; seus itens de menu só aparecem quando a página correspondente existir.
- **Autorização inalterada**: nenhuma regra de quem pode acessar o quê é criada, afrouxada ou endurecida por esta feature. A matriz de menu espelha a autorização vigente.
- **Notificações**: o comportamento e o conteúdo das notificações não mudam; apenas sua exibição condicional na topbar por perfil é definida aqui.
- **Idioma e tema**: a interface permanece 100% pt-BR e mantém suporte a tema claro e escuro, conforme convenção do projeto.
- **Sem preferência persistida de menu**: o estado recolhido/expandido do menu em telas estreitas não é memorizado entre sessões; é comportamento de interação, não configuração de usuário.
