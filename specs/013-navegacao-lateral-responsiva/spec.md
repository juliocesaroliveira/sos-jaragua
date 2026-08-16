# Feature Specification: Navegação lateral responsiva

**Feature Branch**: `013-navegacao-lateral-responsiva`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "preciso que o sidebar menu para dispositivos moveis seja refatorado, pois o componente atual esta causando varios problemas com as barras de rolagem, alem de nao ter uma experiencia de usuario boa. Sujira formas de menu lateral tanto para desktop quanto para dispositivos moveis modernos e atuais, que visam uma melhor experiencia para o usuario."

## Resumo

A navegação do sistema tem hoje duas formas: uma coluna lateral fixa em telas grandes e, em
celular e tablet, um painel que desce preso à barra superior. As duas foram construídas em cima
de decisões que se acumularam e hoje produzem os problemas relatados.

**O problema de rolagem é estrutural, não um ajuste de altura.** A tela é montada como uma caixa
de altura travada na altura da janela, com a área de conteúdo rolando por dentro. Isso cria
**três regiões de rolagem independentes** — a coluna lateral, a área de conteúdo e o painel de
menu — e nenhuma delas é a rolagem da página. As consequências são concretas:

- No celular, a barra de endereço do navegador **nunca se recolhe**, porque quem rola é uma caixa
  interna e não a página. O usuário perde permanentemente uma faixa de tela num aparelho onde
  ela já é escassa.
- Com o menu aberto, o conteúdo atrás dele continua rolando, porque o travamento de rolagem que
  o menu aplica age sobre a página — que não é quem rola.
- Em telas grandes, conteúdo longo pode exibir mais de uma barra de rolagem ao mesmo tempo.

**A experiência ruim no celular tem uma causa identificável**: o painel de navegação foi
construído sobre um componente de **menu de ações** (o tipo de menu que abre ao clicar em "…"),
não sobre um componente de navegação. A diferença não é estética — muda como leitores de tela
anunciam o painel, como o teclado se comporta dentro dele e como os destinos são tratados. O
resultado é um painel que se comporta como um menu suspenso quando deveria se comportar como uma
gaveta de navegação.

Esta feature reconstrói as duas formas de navegação sobre uma base correta: **uma única região de
rolagem por tela**, e um padrão de navegação adequado a cada tamanho de tela. O conjunto de
destinos, os grupos, os rótulos, os ícones e as regras de quem vê o quê **não mudam**.

### Amplitude que a solução precisa cobrir

O sistema tem **16 destinos distribuídos em 7 grupos**. Quanto cada pessoa enxerga depende do
seu papel, e a diferença é grande:

| Perfil | Destinos visíveis (ordem de grandeza) |
| --- | --- |
| Usuário comum | 2 |
| Voluntário | 3 |
| Membro da Defesa Civil | 12 |
| Coordenador / Administrador | 16 |

Qualquer padrão escolhido precisa funcionar tanto para quem vê 2 itens quanto para quem vê 16 —
uma navegação desenhada só para o caso pequeno deixa a coordenação sem hierarquia legível, e uma
desenhada só para o caso grande dá a um voluntário uma estrutura vazia e pesada.

### Decisões de escopo

**Telas pequenas: gaveta de navegação lateral.** O painel passa a deslizar a partir da borda
esquerda, sobre um fundo escurecido, ocupando parte da largura da tela. É o padrão consensual
para aplicações com muitos destinos agrupados, e é o único dos avaliados que escala de 2 a 16
itens sem mudar de forma. Foram descartados: *bottom sheet*, que com 16 itens em 7 grupos vira
uma folha quase de tela cheia e perde a vantagem ergonômica, além de disputar espaço com a área
de gestos do sistema; e *barra de abas inferior*, que exigiria eleger destinos primários por
perfil — uma decisão de produto que hoje não existe — e seria redundante para quem tem 3 itens.

**Telas grandes: coluna recolhível para trilha de ícones.** A coluna passa a alternar entre duas
apresentações: expandida, com ícone e rótulo (o estado atual), e recolhida, como uma trilha
estreita só de ícones. A escolha é do usuário e é lembrada. Foi descartado: *manter fixa
expandida*, que não devolve largura às telas de listagem; e *trilha sempre recolhida com
expansão ao passar o cursor*, porque navegação por hover é frágil em notebooks com tela sensível
ao toque e obrigaria a reconhecer 16 destinos por ícone — custoso para o voluntário, que usa o
sistema esporadicamente.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Rolar a tela sem brigar com o aplicativo (Priority: P1)

Como pessoa usando o sistema no celular durante uma operação, quero rolar uma tela longa — a fila
de triagem, a lista de estoque — e ter a barra de endereço do navegador se recolher para ganhar
espaço, como acontece em qualquer outro site.

**Why this priority**: é a queixa de origem e afeta **todas** as telas, não só o menu. É também a
base sobre a qual o resto se apoia: enquanto houver múltiplas regiões de rolagem, qualquer painel
novo herda os mesmos defeitos. **Não depende de nenhuma das outras duas histórias** e pode ser
entregue sozinha.

**Independent Test**: pode ser testada isoladamente abrindo qualquer tela com conteúdo longo em
um celular real e rolando — sem tocar no menu.

**Acceptance Scenarios**:

1. **Given** uma tela com conteúdo mais alto que a janela em um celular, **When** o usuário rola
   para baixo, **Then** a barra de endereço do navegador se recolhe, como em qualquer página.
2. **Given** a mesma tela, **When** o usuário rola, **Then** existe **uma única** barra de
   rolagem visível — nunca duas ao mesmo tempo.
3. **Given** uma tela em desktop com conteúdo longo, **When** o usuário rola, **Then** o
   comportamento é o de uma página normal, sem regiões internas competindo pela rolagem.
4. **Given** qualquer tela, **When** o usuário usa a rolagem por teclado (Page Down, Home, End),
   **Then** ela age sobre o conteúdo da página sem exigir que ele clique antes numa região
   específica.

---

### User Story 2 - Navegar no celular por uma gaveta de navegação (Priority: P1)

Como pessoa em campo com o celular, quero abrir a navegação, encontrar meu destino e ir — com uma
gaveta que abre pela lateral, cobre o que precisa cobrir, fecha por toque fora, por Esc ou pelo
botão de voltar, e não deixa a página atrás dela deslizando.

**Why this priority**: é o pedido explícito. Junto com a US1 forma o MVP — sem a US1 a gaveta
herdaria o mesmo problema de rolagem de fundo.

**Independent Test**: pode ser testada isoladamente abrindo e fechando a navegação em um celular,
com o conteúdo atrás propositalmente longo, verificando cada forma de fechamento.

**Acceptance Scenarios**:

1. **Given** um usuário em celular, **When** ele aciona o botão de navegação, **Then** a gaveta
   desliza a partir da borda esquerda sobre um fundo escurecido, e a identificação da aplicação
   permanece visível dentro dela.
2. **Given** a gaveta aberta sobre uma tela longa, **When** o usuário arrasta sobre o conteúdo
   atrás dela, **Then** o conteúdo de trás **não** rola.
3. **Given** a gaveta aberta, **When** o usuário escolhe um destino, **Then** ele é levado ao
   destino e a gaveta fecha.
4. **Given** a gaveta aberta, **When** o usuário toca no fundo escurecido, pressiona Esc, ou usa
   o gesto de voltar do sistema, **Then** ela fecha sem navegar para lugar nenhum.
5. **Given** um coordenador, cuja gaveta tem 16 destinos em 7 grupos, **When** ele a abre,
   **Then** consegue rolar a lista dentro da gaveta e identificar os grupos, sem que a rolagem
   escape para a página ao chegar ao fim.
6. **Given** um voluntário, cuja gaveta tem 3 destinos, **When** ele a abre, **Then** a gaveta
   não apresenta grande área vazia.
7. **Given** a gaveta aberta, **When** o usuário navega por leitor de tela, **Then** ela é
   anunciada como navegação e os destinos como links, não como um menu de ações.
8. **Given** a gaveta aberta, **When** o usuário navega por teclado, **Then** o foco fica contido
   nela enquanto estiver aberta e retorna ao botão de navegação quando ela fecha.

---

### User Story 3 - Recolher a navegação em telas grandes (Priority: P2)

Como membro da coordenação em um notebook, quero poder recolher a coluna de navegação para uma
trilha de ícones quando estiver trabalhando numa tela larga, e voltar a expandi-la quando quiser
ler os rótulos — sem ter que refazer essa escolha a cada tela.

**Why this priority**: não bloqueia o MVP — a navegação de desktop funciona hoje. Mas é metade do
pedido, e a coluna atual ocupa uma faixa fixa de largura em todas as telas, inclusive nas
tabelas largas de estoque e voluntários, que são exatamente onde a largura falta.

**Independent Test**: pode ser testada isoladamente em uma janela de notebook, alternando entre
os dois estados e recarregando a página para confirmar que a escolha foi lembrada.

**Acceptance Scenarios**:

1. **Given** um usuário em tela grande com a coluna expandida, **When** ele aciona o controle de
   recolher, **Then** a coluna passa a exibir apenas ícones e o conteúdo ganha a largura liberada.
2. **Given** a coluna recolhida, **When** o usuário navega para outra tela ou recarrega a página
   em outro dia, **Then** ela continua recolhida.
3. **Given** a coluna recolhida, **When** o usuário aponta ou foca um ícone, **Then** o rótulo do
   destino é apresentado.
4. **Given** a coluna recolhida, **When** o usuário observa a trilha, **Then** consegue
   identificar em qual destino está.
5. **Given** a coluna recolhida, **When** o usuário navega por leitor de tela, **Then** cada
   destino é anunciado pelo seu rótulo, não apenas pelo ícone.
6. **Given** a coluna recolhida, **When** o usuário percorre os destinos, **Then** a separação
   entre grupos permanece perceptível.

---

### Edge Cases

- **Usuário sem nenhum destino visível**: nenhum botão de navegação é oferecido, nenhuma coluna e
  nenhuma trilha são reservadas — o comportamento atual, preservado.
- **Rotação do aparelho com a gaveta aberta**: ela permanece utilizável e não deixa o conteúdo de
  trás em estado inconsistente.
- **Teclado virtual aberto** (o usuário estava num formulário e abriu a navegação): a gaveta não
  fica cortada nem inacessível.
- **Redimensionar a janela cruzando o limiar entre telas pequenas e grandes** com a gaveta
  aberta: o sistema não pode ficar com as duas formas de navegação visíveis ao mesmo tempo, nem
  com nenhuma.
- **Navegação por gesto de voltar do sistema** com a gaveta aberta: fecha a gaveta em vez de sair
  da tela atual.
- **Aparelho com "reduzir movimento" ativado**: o deslize da gaveta e a transição da coluna
  respeitam a preferência.
- **Toque na área de gestos do sistema** (barra inferior do aparelho): os destinos da gaveta não
  ficam sob ela, onde o toque seria capturado pelo sistema operacional.
- **Conteúdo da gaveta maior que a tela** (coordenador, 16 destinos, aparelho pequeno na
  horizontal): a lista rola dentro da gaveta, com todos os destinos alcançáveis.
- **Primeira visita, sem preferência gravada**: a coluna abre expandida, como é hoje — ninguém
  encontra o sistema num estado que nunca escolheu.
- **Preferência gravada mas navegador em janela estreita**: a preferência de coluna só se aplica
  onde a coluna existe; em telas pequenas a navegação é sempre a gaveta.
- **Sessão expirada enquanto a gaveta está aberta**: o usuário é levado ao login pelo caminho já
  existente, sem ficar preso a uma gaveta aberta.

## Requirements _(mandatory)_

### Functional Requirements

#### Arquitetura de rolagem

- **FR-001**: O sistema MUST ter **uma única** região de rolagem principal por tela; nenhuma tela
  pode apresentar duas barras de rolagem simultâneas para o mesmo conteúdo.
- **FR-002**: A rolagem do conteúdo MUST ser a rolagem da página, de modo que o navegador
  aplique seu comportamento nativo de recolher a barra de endereço em dispositivos móveis.
- **FR-003**: O sistema MUST impedir que o conteúdo de fundo role enquanto a gaveta de navegação
  estiver aberta.
- **FR-004**: A rolagem por teclado MUST agir sobre o conteúdo da página sem exigir clique
  prévio numa região específica.
- **FR-005**: A lista de destinos dentro da gaveta MUST rolar dentro dela, sem transferir a
  rolagem para a página ao atingir o fim.
- **FR-006**: O sistema MUST se comportar corretamente quando a altura visível da janela muda
  (barra de endereço recolhendo, teclado virtual abrindo), sem cortar conteúdo nem criar saltos.

#### Gaveta de navegação (telas pequenas)

- **FR-007**: A navegação em telas pequenas MUST ser uma gaveta que desliza a partir da borda
  esquerda sobre um fundo escurecido, anunciada como navegação por leitores de tela e
  apresentando os destinos como links.
- **FR-008**: A gaveta MUST fechar por: escolha de um destino, toque no fundo escurecido, tecla
  Esc e gesto ou botão de voltar do sistema.
- **FR-009**: O foco de teclado MUST ficar contido na gaveta enquanto ela estiver aberta, e
  retornar ao controle que a abriu quando ela fechar.
- **FR-010**: A identificação da aplicação MUST permanecer visível com a gaveta aberta.
- **FR-011**: Todos os destinos visíveis ao perfil MUST ser alcançáveis pela gaveta, inclusive no
  perfil com o maior número de destinos.
- **FR-012**: A altura ocupada pelo conteúdo da gaveta MUST se adaptar à quantidade de destinos,
  sem deixar grande área vazia para perfis com poucos itens.
- **FR-013**: Nenhum destino MUST ficar posicionado sob a área de gestos do sistema operacional.
- **FR-014**: As transições de abertura e fechamento MUST respeitar a preferência de movimento
  reduzido do sistema.

#### Coluna recolhível (telas grandes)

- **FR-015**: A coluna de navegação MUST oferecer um controle para alternar entre expandida
  (ícone e rótulo) e recolhida (apenas ícones).
- **FR-016**: A escolha entre expandida e recolhida MUST persistir entre telas e entre visitas,
  guardada no navegador da pessoa.
- **FR-017**: Na ausência de preferência gravada, a coluna MUST abrir expandida.
- **FR-018**: Com a coluna recolhida, o rótulo de cada destino MUST ser apresentado ao apontar ou
  focar o respectivo ícone.
- **FR-019**: Com a coluna recolhida, cada destino MUST continuar sendo anunciado pelo seu rótulo
  por leitores de tela.
- **FR-020**: A indicação do destino atual MUST permanecer perceptível nos dois estados.
- **FR-021**: A separação entre grupos MUST permanecer perceptível nos dois estados.
- **FR-022**: Com a coluna recolhida, as telas de listagem MUST dispor de mais largura útil do
  que dispõem hoje.

#### Preservação do que já existe

- **FR-023**: O sistema MUST preservar o conjunto de destinos, os grupos, os rótulos, os ícones e
  a ordem de exibição atuais.
- **FR-024**: O sistema MUST preservar a filtragem por perfil feita no servidor — nenhum destino
  fora do perfil pode ser enviado ao navegador.
- **FR-025**: O sistema MUST preservar o comportamento do restante da barra superior
  (identificação, sino de notificações, tema, sair).
- **FR-026**: Alvos de toque MUST manter a altura mínima confortável já adotada no projeto.
- **FR-027**: A navegação MUST continuar funcionando nos temas claro e escuro, com contraste
  adequado nos dois.

### Key Entities

- **Destino de navegação**: um item do menu — rótulo, ícone, endereço e grupo. Já existe e **não
  muda**.
- **Grupo de navegação**: agrupamento de destinos para legibilidade (Início, Minha conta,
  Voluntariado, Operação, Estoque, Coordenação, Administração). Já existe; não carrega
  permissões próprias e **não muda**.
- **Preferência de apresentação da coluna**: escolha do usuário entre coluna expandida e
  recolhida em telas grandes. **Nova**, com dois valores possíveis, guardada no navegador da
  pessoa — não é dado de negócio, não viaja entre dispositivos e não influencia autorização.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em nenhuma tela do sistema aparecem duas barras de rolagem simultâneas para o mesmo
  conteúdo.
- **SC-002**: Ao rolar qualquer tela longa em um celular, a barra de endereço do navegador se
  recolhe, liberando área útil de tela.
- **SC-003**: Com a gaveta de navegação aberta, o conteúdo de fundo não se move em 100% das
  tentativas de arrastar sobre ele.
- **SC-004**: Um coordenador alcança qualquer um dos seus 16 destinos em no máximo dois toques a
  partir de qualquer tela.
- **SC-005**: A gaveta abre e fica pronta para uso em menos de 300 ms em um aparelho de gama
  média.
- **SC-006**: 100% dos destinos são alcançáveis e operáveis apenas por teclado, com o foco
  contido na gaveta enquanto ela estiver aberta.
- **SC-007**: Leitores de tela anunciam a gaveta como navegação e cada destino como link, nos
  dois estados da coluna.
- **SC-008**: Com a coluna recolhida, as telas de listagem ganham ao menos 200 px de largura útil
  em uma janela de notebook.
- **SC-009**: A preferência de coluna sobrevive a recarga de página e a nova visita no mesmo
  navegador em 100% das tentativas.
- **SC-010**: Nenhuma regressão nos destinos exibidos por perfil — cada papel continua vendo
  exatamente os mesmos itens de hoje.

## Assumptions

- Os destinos, grupos, ícones e regras de visibilidade por perfil permanecem exatamente como
  estão; esta feature trata de **como** a navegação é apresentada, não de **o que** ela contém.
- A barra superior permanece, com identificação, sino de notificações, controle de tema e sair.
  Reorganizá-la está fora do escopo, salvo o que for necessário para acomodar a navegação nova.
- A rolagem passa a ser a da página; telas que hoje dependem de uma área interna rolável podem
  precisar de ajuste pontual, e isso faz parte do escopo.
- A preferência de coluna é guardada no navegador da pessoa, não no perfil — não é dado de
  negócio e não precisa acompanhar o usuário entre dispositivos. Perdê-la ao trocar de navegador
  é aceitável.
- O limiar entre "tela pequena" e "tela grande" permanece o mesmo já adotado hoje; ajustá-lo está
  fora do escopo.
- Não há mudança de banco de dados, de autorização ou de rotas.
- Os alvos de toque e o contraste seguem os padrões já adotados no design system do projeto.
- A interface permanece 100% em pt-BR.
