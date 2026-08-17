# Feature Specification: Redesign da Tela de Login

**Feature Branch**: `014-redesign-tela-login`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "preciso que a pagina de login seja completamente refatorada. Atualmente a pagina de login esta muito simploria e pouco chamativa, ela esta funcional mas nao condiz com a modernidade que a aplicacao eh. Quero que a pagina de login seja moderna e visualmente atrativa, contemplando uma otima pagina de login tanto para desktop quanto para mobile."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Primeira impressão que transmite credibilidade (Priority: P1)

Um voluntário, coordenador ou membro da Defesa Civil abre o endereço do sistema e cai na tela
de login. Hoje ele encontra uma coluna estreita com um título, um parágrafo e três botões
empilhados — indistinguível de um formulário improvisado. Depois desta mudança ele encontra
uma tela imersiva: uma fotografia do contexto da Defesa Civil ocupando o fundo, a marca de
Jaraguá do Sul apresentada com peso visual, uma mensagem que diz que sistema é aquele e para
que serve, e o bloco de acesso sobreposto como um cartão translúcido com hierarquia clara. A
pessoa reconhece o sistema como oficial e sabe imediatamente onde clicar para entrar.

**Why this priority**: é a razão declarada da mudança e o único momento em que 100% dos
usuários — de todos os papéis — passam pela mesma tela. É também a única tela pública do
sistema, então é ela que estabelece a percepção de que a ferramenta é confiável para operar
uma emergência. Sozinha, entrega o valor pedido.

**Independent Test**: abrir `/login` sem sessão em um navegador de desktop e comparar com a
versão anterior — a tela apresenta marca, mensagem de contexto e bloco de acesso
hierarquizados, e todas as opções de entrada continuam funcionando.

**Acceptance Scenarios**:

1. **Given** um visitante sem sessão, **When** acessa a página de login em um desktop,
   **Then** vê a fotografia de fundo, a marca da Defesa Civil, uma mensagem de contexto sobre
   o sistema e as opções de acesso agrupadas em um cartão sobreposto, sem rolagem vertical em
   uma tela de altura padrão.
2. **Given** um visitante sem sessão, **When** acessa a página de login, **Then** o elemento
   de acesso primário é identificável em menos de dois segundos, por contraste e posição, sem
   competir com os elementos decorativos.
3. **Given** um visitante que já usava o sistema, **When** acessa a nova tela de login,
   **Then** encontra as mesmas três opções de entrada com os mesmos rótulos de antes, na mesma
   ordem — a mudança é de apresentação, não de fluxo.
4. **Given** um visitante em desktop com a fotografia de fundo ainda não carregada, **When** a
   tela é exibida, **Then** todos os textos e botões já estão legíveis e acionáveis, e a
   chegada da imagem não desloca nenhum elemento de posição.

---

### User Story 2 - Entrar pelo celular em campo (Priority: P1)

Um voluntário precisa registrar uma saída de estoque no meio de uma ocorrência, no celular,
possivelmente sob sol forte, com uma mão só e conectividade instável. Ele abre o atalho da
tela inicial, cai no login e precisa entrar sem ampliar a tela, sem errar o alvo de toque e
sem esperar por elementos decorativos pesados.

**Why this priority**: a constituição do projeto trata responsividade mobile e clareza sob
estresse como requisito de aceitação, não refinamento posterior. Um redesign que fique bonito
apenas no desktop falha no cenário de uso real. Empata em prioridade com a US1 porque as duas
são a mesma tela em dois contextos, e entregar uma sem a outra não é aceitável.

**Independent Test**: abrir `/login` em um aparelho (ou emulação) de 360px de largura e
concluir a entrada por e-mail e senha usando apenas o polegar, sem zoom.

**Acceptance Scenarios**:

1. **Given** um visitante em tela de 360px de largura, **When** abre a página de login,
   **Then** o conteúdo se ajusta em coluna única sem rolagem horizontal e sem que nenhum texto
   fique abaixo do tamanho legível padrão.
2. **Given** um visitante em celular, **When** toca em qualquer botão ou campo da tela,
   **Then** o alvo de toque tem no mínimo 44px na menor dimensão.
3. **Given** um visitante em celular, **When** toca no campo de e-mail, **Then** o teclado
   virtual abre no modo de e-mail e o campo permanece visível acima do teclado.
4. **Given** um visitante em celular no modo paisagem, **When** abre a página de login,
   **Then** consegue alcançar todas as opções de acesso rolando no máximo uma tela.

---

### User Story 3 - Entrar em condições adversas de leitura (Priority: P2)

Uma pessoa usa o sistema com o tema escuro ativo, ou com baixa visão, ou navegando apenas por
teclado, ou com leitor de tela. O redesign não pode trocar acessibilidade por estética: a nova
tela precisa continuar operável nesses modos, e o tema escuro precisa ser tratado como um
tema de primeira classe, não como uma inversão automática que estraga a composição.

**Why this priority**: o sistema já tem suporte nativo a tema claro/escuro e a base de
usuários inclui voluntários com perfis variados. É requisito de qualidade, mas depende da
composição definida nas US1 e US2 existir primeiro.

**Independent Test**: percorrer a tela inteira apenas com Tab/Enter no tema escuro e no tema
claro, concluindo a entrada em ambos.

**Acceptance Scenarios**:

1. **Given** o tema escuro ativo, **When** o visitante abre a página de login, **Then** todos
   os textos e elementos interativos mantêm contraste mínimo de 4.5:1 contra seu fundo, e a
   marca permanece legível.
2. **Given** um visitante navegando por teclado, **When** percorre a tela com Tab, **Then** a
   ordem de foco segue a ordem visual e cada elemento focado exibe indicador de foco visível.
3. **Given** um visitante com leitor de tela, **When** entra na página, **Then** ouve o nome
   do sistema, o propósito da tela e o rótulo de cada opção de acesso, sem elementos
   decorativos sendo anunciados.
4. **Given** um visitante com preferência de "movimento reduzido" ativa no sistema
   operacional, **When** abre a página, **Then** nenhuma animação de entrada ou movimento
   contínuo é executada.

---

### User Story 4 - Entender por que caiu no login (Priority: P2)

Uma coordenadora estava trabalhando e teve a sessão encerrada por inatividade; ou um voluntário
tentou entrar pelo Google e o provedor recusou porque o e-mail já tem conta com senha. Em
ambos os casos a pessoa é jogada na tela de login com uma mensagem explicando o que houve. Na
nova composição essas mensagens precisam ter lugar previsto — não podem quebrar o layout nem
serem empurradas para fora da área visível.

**Why this priority**: são os estados que mais geram chamado de suporte, e a tela nova
introduz uma composição mais rica onde um aviso mal posicionado passa despercebido. Depende da
composição existir, por isso P2.

**Independent Test**: acessar `/login?motivo=expirado` e `/login?error=account_not_linked` e
verificar que o aviso aparece com destaque, dentro do bloco de acesso, sem deslocar os botões
para fora da tela.

**Acceptance Scenarios**:

1. **Given** uma sessão encerrada por inatividade, **When** o usuário é levado ao login,
   **Then** vê o aviso correspondente posicionado acima das opções de acesso, visível sem
   rolagem em tela de 360×640px.
2. **Given** uma recusa do provedor social, **When** o usuário retorna ao login, **Then** vê a
   mensagem em pt-BR explicando o motivo e o caminho de saída, no mesmo lugar reservado aos
   avisos.
3. **Given** um aviso de sessão expirada visível, **When** o usuário aciona "Usar usuário e
   senha", **Then** o aviso permanece legível e o formulário aparece sem que o conteúdo salte
   de posição.

---

### User Story 5 - Conferir a senha antes de enviar (Priority: P2)

Um voluntário digita a senha no celular, com o polegar, e não tem como saber se acertou —
todos os caracteres estão mascarados. Ele erra, recebe "E-mail ou senha incorretos", e repete o
ciclo sem descobrir onde estava o problema. Com o novo campo de senha ele toca em um ícone,
confere o que digitou, corrige o caractere errado e entra na primeira tentativa.

**Why this priority**: é a causa mais provável de tentativa falha no cenário de campo descrito
na US2, e o remédio é barato. Fica em P2 porque a entrada continua possível sem ele — é
redução de atrito, não desbloqueio.

**Independent Test**: preencher o campo de senha, acionar o ícone de visibilidade e confirmar
que o texto aparece e volta a ser mascarado, sem que o valor ou a posição do cursor mudem.

**Acceptance Scenarios**:

1. **Given** um usuário no estado de e-mail e senha, **When** a tela é exibida, **Then** o
   campo de senha está mascarado e exibe um ícone que oferece revelar o conteúdo.
2. **Given** um usuário que digitou a senha, **When** aciona o ícone, **Then** o texto passa a
   ser exibido em claro, o ícone passa a oferecer ocultar, e o valor digitado permanece
   inalterado.
3. **Given** um usuário com a senha visível, **When** aciona o ícone novamente, **Then** o
   texto volta a ser mascarado.
4. **Given** um usuário navegando por teclado, **When** chega ao ícone com Tab e aciona com
   Enter ou Espaço, **Then** a visibilidade alterna e o formulário **não** é submetido.
5. **Given** um usuário com leitor de tela, **When** o foco chega ao ícone, **Then** ouve a
   ação disponível em pt-BR ("Mostrar senha" ou "Ocultar senha") conforme o estado atual.
6. **Given** um usuário que revelou a senha, **When** aciona "Voltar" e retorna ao estado de
   credenciais, **Then** o campo está novamente mascarado.

---

### User Story 6 - Descobrir como se tornar voluntário (Priority: P3)

Alguém que ouviu falar do sistema chega à tela de login sem ter conta. A tela precisa oferecer
um caminho visível para o cadastro, em vez de deixar a pessoa presa em um formulário para o
qual ela não tem credenciais.

**Why this priority**: é o único caminho de entrada de novos voluntários pela web, mas atende
um público menor que os quatro cenários acima e não bloqueia nenhum deles.

**Independent Test**: abrir `/login` sem sessão e alcançar a página de cadastro em um clique.

**Acceptance Scenarios**:

1. **Given** um visitante sem conta, **When** abre a página de login, **Then** encontra um
   convite explícito para se candidatar a voluntário, com link para a página de cadastro.
2. **Given** o visitante no estado de e-mail e senha, **When** olha a tela, **Then** o convite
   ao cadastro continua acessível sem precisar voltar ao estado inicial.

---

### Edge Cases

- **Aviso de erro e aviso de sessão expirada simultâneos**: a área reservada a avisos precisa
  comportar mais de uma mensagem sem empurrar o bloco de acesso para fora da tela.
- **Nome de erro de provedor desconhecido**: a tela recebe um código de erro fora do conjunto
  mapeado e ainda assim precisa exibir uma mensagem compreensível, não o código cru.
- **Tela muito baixa** (celular em paisagem, ~360×400px): a composição precisa degradar para
  rolagem vertical em vez de cortar ou sobrepor conteúdo.
- **Tela muito larga** (monitor ultrawide, 2560px+): o conteúdo não pode se esticar
  indefinidamente nem ficar perdido no canto.
- **Fonte ampliada pelo usuário** (zoom de 200% ou fonte grande do sistema): o conteúdo
  precisa reflowar sem sobreposição nem perda de elementos interativos.
- **Elementos visuais pesados indisponíveis**: se a fotografia de fundo ou a marca não
  carregar, a tela permanece utilizável e com contraste adequado — não pode haver texto que
  dependa da imagem de fundo para ser legível.
- **Região clara da fotografia atrás de texto claro**: o tratamento de contraste precisa
  garantir o mínimo independentemente do que a foto tenha naquele ponto (céu, parede branca,
  reflexo), não apenas na média da imagem.
- **Proporção da fotografia muito diferente da viewport** (paisagem 16:9 em tela retrato
  estreita e alta): o enquadramento precisa preservar o assunto sem esticar a imagem.
- **Senha revelada e a pessoa se afasta do aparelho**: revelar a senha é ação explícita do
  usuário e não persiste entre montagens do campo (FR-031), mas vale registrar o risco de
  exposição por observação em uso de campo.
- **Retorno pelo botão "Voltar" do navegador** após a troca para o estado de credenciais: a
  tela não pode ficar em estado inconsistente.
- **Preenchimento automático do navegador** (gerenciador de senhas): os campos precisam ser
  reconhecidos e o estilo aplicado pelo navegador não pode tornar o texto ilegível — em
  especial no tema escuro.

## Requirements _(mandatory)_

### Functional Requirements

#### Composição e identidade visual

- **FR-001**: A tela de login MUST apresentar a marca oficial da Defesa Civil de Jaraguá do
  Sul como elemento de destaque, com peso visual superior ao do texto de apoio.
- **FR-002**: A tela MUST apresentar o nome do sistema e uma mensagem curta identificando seu
  propósito, de modo que um visitante que nunca o usou entenda a que se destina.
- **FR-003**: As opções de acesso MUST estar agrupadas em um bloco visualmente delimitado e
  distinto do restante da composição.
- **FR-004**: A tela MUST estabelecer hierarquia visual explícita entre a ação de acesso
  primária, as ações secundárias e o conteúdo informativo.
- **FR-005**: A tela MUST usar exclusivamente as cores, tipografia, espaçamentos, raios e
  sombras já definidos no sistema de design da aplicação — nenhum valor visual avulso
  introduzido só para esta tela.
- **FR-006**: A tela MUST reutilizar os componentes compartilhados de interface já existentes
  (botão, campo, aviso, marca) em vez de recriar equivalentes locais.

#### Composição imersiva com imagem de fundo

- **FR-006a**: A tela MUST apresentar, em telas largas, uma imagem de fundo em tela cheia
  retratando o contexto da Defesa Civil de Jaraguá do Sul, com o bloco de acesso sobreposto a
  ela como um cartão translúcido destacado do fundo.
- **FR-006b**: A imagem de fundo MUST ser decorativa: nenhuma informação da tela pode depender
  dela para ser compreendida, e sua ausência não pode degradar a legibilidade de nenhum texto.
- **FR-006c**: A tela MUST aplicar um tratamento de contraste entre a imagem e o conteúdo
  sobreposto (escurecimento, desfoque ou equivalente) suficiente para que os mínimos de
  contraste da FR-012 sejam atingidos **independentemente da região da foto** que ficar atrás
  de cada elemento.
- **FR-006d**: A tela MUST ser plenamente utilizável antes de a imagem de fundo carregar — o
  bloco de acesso, seus textos e seus contrastes não podem esperar pela imagem.
- **FR-006e**: A tela MUST NOT transferir a imagem de fundo em tamanho de desktop para
  aparelhos móveis; em telas estreitas a composição usa uma variante de custo reduzido ou
  dispensa a fotografia, preservando a meta de carregamento da SC-006.
- **FR-006f**: O tratamento da imagem MUST ser definido separadamente para tema claro e tema
  escuro, de modo que o cartão translúcido permaneça distinguível do fundo em ambos.
- **FR-006g**: A imagem de fundo MUST ter origem e direito de uso documentados — fotografia
  própria da Defesa Civil ou material com licença compatível com uso institucional.

#### Comportamento responsivo

- **FR-007**: A tela MUST se adaptar a larguras de 320px até 2560px sem rolagem horizontal em
  nenhum ponto do intervalo.
- **FR-008**: Em telas estreitas, a tela MUST apresentar o conteúdo em coluna única com o
  bloco de acesso priorizado — o visitante não pode precisar rolar para alcançar a primeira
  opção de entrada em uma tela de 360×640px.
- **FR-009**: Em telas largas, a tela MUST usar o espaço horizontal disponível de forma
  deliberada, limitando a largura do conteúdo de leitura para que não se estique
  indefinidamente.
- **FR-010**: Todos os alvos de toque MUST ter no mínimo 44×44px de área acionável.
- **FR-011**: A tela MUST permanecer utilizável com zoom de 200% e com a fonte do sistema
  ampliada, sem sobreposição nem perda de elementos interativos.

#### Acessibilidade

- **FR-012**: Todos os pares texto/fundo MUST atingir contraste mínimo de 4.5:1 (3:1 para
  texto grande) nos temas claro e escuro.
- **FR-013**: A tela MUST ser inteiramente operável por teclado, com ordem de foco coerente
  com a ordem visual e indicador de foco visível em todos os elementos interativos.
- **FR-014**: Elementos puramente decorativos MUST ser ocultados de tecnologias assistivas.
- **FR-015**: A tela MUST respeitar a preferência de movimento reduzido do sistema
  operacional, suprimindo animações quando ativa.
- **FR-016**: A tela MUST apresentar exatamente um cabeçalho de primeiro nível, identificando
  a finalidade da página.

#### Estados e mensagens

- **FR-017**: A tela MUST reservar posição fixa e previsível para avisos (sessão expirada,
  erro de credenciais, recusa de provedor), acima das opções de acesso e dentro da área
  visível sem rolagem em tela de 360×640px.
- **FR-018**: A exibição de um ou mais avisos MUST NOT deslocar as opções de acesso para fora
  da área visível nem provocar salto de layout perceptível.
- **FR-019**: A tela MUST indicar visualmente o estado de carregamento da opção de acesso
  acionada, mantendo as demais opções inertes enquanto isso.
- **FR-020**: A alternância entre o estado inicial e o estado de e-mail e senha MUST ocorrer
  sem salto de posição do bloco de acesso.

#### Preservação do comportamento existente

- **FR-021**: A tela MUST manter o estado inicial com exatamente as três opções de acesso
  atuais — "Acessar com Google", "Acessar com Facebook" e "Usar usuário e senha" — nos mesmos
  rótulos (preserva FR-004 de `001-unified-login-flow`).
- **FR-022**: A tela MUST manter a alternância entre estado inicial e estado de credenciais
  dentro da mesma rota, sem navegação, com o botão "Voltar" descartando os valores preenchidos
  (preserva FR-006, FR-007 e FR-011 de `001-unified-login-flow`).
- **FR-023**: A tela MUST manter o aviso de transparência informando quais dados são obtidos
  do provedor externo, visível antes do redirecionamento (preserva FR-010 de
  `011-auto-cadastro-provedor`).
- **FR-024**: A tela MUST manter a mensagem genérica de credenciais inválidas, sem revelar se
  o e-mail existe.
- **FR-025**: A tela MUST manter o redirecionamento de usuário já autenticado para a área
  correspondente, sem exibir o formulário (preserva FR-003 de `001-unified-login-flow`).
- **FR-026**: A tela MUST manter o respeito ao destino de redirecionamento informado na URL
  após a autenticação bem-sucedida.
- **FR-027**: A tela MUST manter a tradução em pt-BR das recusas do provedor social, incluindo
  o texto genérico para códigos não mapeados.

#### Caminho para o cadastro

- **FR-028**: A tela MUST oferecer um convite visível ao cadastro de voluntário, com link para
  a página de cadastro, acessível a partir de ambos os estados da tela.

#### Campo de senha com alternância de visibilidade

- **FR-029**: O sistema MUST oferecer um componente compartilhado de campo de senha,
  disponível a todas as telas do sistema de design — não uma solução local da tela de login.
- **FR-030**: O campo de senha MUST oferecer um controle que alterne entre ocultar e exibir o
  texto digitado, representado por ícone.
- **FR-031**: O campo de senha MUST iniciar sempre no estado oculto, em qualquer tela e em
  qualquer montagem.
- **FR-032**: O controle de alternância MUST comunicar o estado atual a tecnologias
  assistivas, com rótulo em pt-BR que descreva a ação disponível ("Mostrar senha" / "Ocultar
  senha").
- **FR-033**: O controle de alternância MUST ser alcançável e acionável por teclado, e MUST
  NOT submeter o formulário quando acionado.
- **FR-034**: Alternar a visibilidade MUST NOT alterar o valor digitado nem a posição do
  cursor no campo.
- **FR-035**: O campo de senha MUST preservar todo o comportamento do campo de texto atual do
  sistema de design: rótulo, marcação de obrigatório, exibição de erro, texto de apoio,
  associação de rótulo e mensagens ao campo, e reconhecimento por gerenciadores de senha.
- **FR-036**: O controle de alternância MUST NOT se sobrepor ao texto digitado nem reduzir a
  área acionável do campo abaixo dos mínimos da FR-010.
- **FR-037**: A tela de login MUST usar esse componente compartilhado em seu campo de senha.

### Key Entities

Esta feature não introduz nem altera entidades de dados. Ela consome a sessão existente e os
parâmetros de URL já em uso pela tela de login (`redirecionar`, `motivo`, `error`).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Um visitante que nunca usou o sistema identifica corretamente de que organização
  é a ferramenta em até 5 segundos de exposição à tela, em teste com pelo menos 5 pessoas.
- **SC-002**: Um usuário com credenciais válidas conclui a entrada em até 30 segundos a partir
  do carregamento da tela, tanto em celular quanto em desktop.
- **SC-003**: 100% dos usuários de teste em celular concluem a entrada sem precisar ampliar a
  tela e sem errar o alvo de toque na primeira tentativa.
- **SC-004**: A tela é percorrida e operada integralmente por teclado, do primeiro elemento
  focável até a conclusão da entrada, sem armadilhas de foco — verificado nos temas claro e
  escuro.
- **SC-005**: A auditoria de acessibilidade automatizada da tela não aponta nenhuma violação
  de nível A ou AA, nos temas claro e escuro.
- **SC-006**: A tela apresenta conteúdo utilizável em até 2 segundos em conexão móvel de 3G,
  e o deslocamento cumulativo de layout durante o carregamento é imperceptível. A fotografia
  de fundo não conta para esse limite: a tela precisa estar operável antes dela.
- **SC-006a**: Em conexão móvel de 3G, o total transferido para exibir a tela operável (antes
  da fotografia) permanece abaixo do que a versão anterior transferia — o redesign não pode
  tornar o login mais lento em campo.
- **SC-007**: A tela renderiza sem rolagem horizontal e sem sobreposição em todas as larguras
  entre 320px e 2560px, verificado em pelo menos 5 pontos do intervalo.
- **SC-008**: Todas as 11 verificações funcionais herdadas de `001-unified-login-flow` e a
  FR-010 de `011-auto-cadastro-provedor` continuam passando após a mudança.
- **SC-009**: Nenhum valor visual (cor, espaçamento, tipografia, raio, sombra) fora do sistema
  de design é introduzido — verificado por inspeção do código da tela.
- **SC-010**: O contraste mínimo da FR-012 é verificado em pelo menos 5 pontos distintos da
  fotografia de fundo (incluindo a região mais clara e a mais escura), nos temas claro e
  escuro.
- **SC-011**: Um usuário de teste em celular que erra a senha na primeira tentativa consegue
  identificar e corrigir o erro usando a alternância de visibilidade, sem uma terceira
  tentativa.

## Assumptions

- **Escopo é apresentação, não fluxo**: a mudança pedida é de aparência e ergonomia. Todo o
  comportamento de autenticação (provedores, validação, redirecionamentos, mensagens de erro,
  regras de sessão) é preservado exatamente como está. Alterar o fluxo exigiria emendar
  `001-unified-login-flow`.
- **O fluxo em duas etapas é mantido**: o estado inicial com três opções seguido do estado de
  credenciais foi decidido em `001-unified-login-flow` (FR-011). Um redesign moderno poderia
  argumentar por mostrar tudo de uma vez, mas revogar um requisito aceito não é decisão desta
  spec.
- **Nenhuma capacidade nova de autenticação**: "esqueci minha senha", "lembrar-me" e
  autenticação em duas etapas estão **fora de escopo** — são features próprias, com requisitos
  de segurança e fluxos de backend próprios, e incluí-las aqui transformaria um redesign em um
  projeto de autenticação. A alternância de visibilidade da senha (FR-029 a FR-037) é a única
  exceção admitida: é puramente de interface e não toca o backend.
- **O campo de senha é componente do sistema de design, não da tela**: decisão do usuário —
  construir um componente `Password` compartilhado sobre a base de componentes headless já
  adotada pelo projeto (que oferece primitiva pronta para entrada de senha), e não uma
  adaptação local na tela de login. Isso o torna disponível às demais telas que pedem senha
  (cadastro, redefinição de senha no admin) e evita divergência de comportamento entre elas.
  Migrar essas outras telas para o componente novo é trabalho de acompanhamento, fora desta
  feature — aqui só a tela de login o adota (FR-037).
- **A marca já existe como ativo**: `public/sos-logo.png` e o componente compartilhado de
  marca já estão disponíveis e são a fonte da identidade visual — esta feature não produz
  arte nova de marca.
- **Composição imersiva com fotografia**: decisão do usuário. Levantei três reservas ao
  recomendar essa direção e elas foram mantidas como restrições da spec, não como impedimento:
  (1) exige fotografia licenciada em alta resolução — FR-006g; (2) o contraste sobre imagem é
  mais frágil que sobre cor sólida — FR-006c e SC-010; (3) o peso da imagem conflita com o uso
  em campo sob 3G — FR-006d, FR-006e e SC-006a. Se a fotografia adequada não existir no momento
  do planejamento, o caminho é adiar a feature ou reabrir a decisão, não entregar com uma
  imagem de banco genérica.
- **Origem da fotografia a definir no planejamento**: a spec não escolhe a imagem. Presume-se
  que a Defesa Civil de Jaraguá do Sul tenha acervo próprio de fotos de operação, equipe ou
  cidade; a seleção e o registro do direito de uso são tarefa do `/speckit-plan`.
- **Sem mudança em rota ou metadados**: a tela permanece em `/login`, com o mesmo título e o
  mesmo comportamento de renderização por requisição.
- **A tela de cadastro não é redesenhada nesta feature**: ela compartilha o contexto público,
  mas está fora do pedido. Uma inconsistência temporária entre as duas é aceita e deve ser
  registrada como trabalho de acompanhamento.
- **Ambiente de verificação**: os critérios de contraste, alvo de toque e acessibilidade são
  verificados nos navegadores atuais de desktop e nos navegadores móveis padrão de Android e
  iOS.
