# Feature Specification: Notificações que chegam sozinhas à tela

**Feature Branch**: `012-notificacoes-tempo-real`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "preciso que seja implementado o uso do socketjs para controlar as notificacoes da aplicacao em tempo real"

## Resumo

Hoje o sino de notificações é preenchido **uma única vez, no carregamento da página**. A lista e o
contador de não-lidas são montados no servidor quando a tela é renderizada; a partir daí só
mudam se o usuário navegar para outra rota ou marcar algo como lido.

O efeito prático é que **quem fica parado numa tela não descobre nada**. Um voluntário na tela de
"Minhas atividades" não vê o aviso de que sua atividade mudou de horário. Um membro da Defesa
Civil na tela de Saída de estoque não vê o alerta de estoque crítico nem um broadcast de
urgência. A informação chega ao banco, mas não chega à pessoa — e num cenário de emergência a
diferença entre saber agora e saber na próxima navegação é operacionalmente relevante.

Esta feature faz a notificação **chegar sozinha à tela aberta**: o sino passa a se atualizar por
conta própria enquanto o usuário está com o sistema aberto, e imediatamente quando ele volta a
olhar para a aba.

O que **não** muda: o catálogo de eventos (`triagem_concluida`, `atividade_atribuida`,
`alteracao_atividade`, `lembrete_turno`, `broadcast_urgencia`, `cadastros_acumulados`,
`estoque_critico`, `deficit_atendimento`), quem recebe cada um, o texto das mensagens, o canal
de e-mail, e o banco continuar sendo a fonte de verdade do que foi lido.

### Decisões de escopo

**Sem conexão persistente.** O pedido original mencionava "socketjs" — conexão WebSocket entre
navegador e servidor. A decisão foi **não** usar conexão persistente: o sistema roda em
plataforma de execução sob demanda, e manter conexões abertas ali significa custo por tempo
ativo e um desvio do princípio de simplicidade operacional da constituição do projeto, que
proíbe infraestrutura nova sem decisão documentada. Em vez disso, a própria interface passa a
reconsultar o sino em intervalo curto e a reconsultar imediatamente quando a aba volta ao
primeiro plano.

O usuário percebe o mesmo resultado — o aviso aparece sem que ele faça nada — com uma latência
de dezenas de segundos em vez de instantânea, e sem nenhuma infraestrutura nova. Para o caso
mais sensível a tempo, o broadcast de urgência, o canal de e-mail já existente continua sendo o
caminho paralelo de alcance imediato.

**Sem notificação com a aba fechada.** Fica mantida a decisão de MVP já registrada no projeto de
não implementar push do navegador. Quem não está com o sistema aberto continua sendo alcançado
por e-mail. Esta feature age apenas sobre quem já está com a aplicação aberta.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Receber um aviso sem sair da tela (Priority: P1)

Como voluntário ou membro da Defesa Civil com o sistema aberto durante uma operação, quero que
avisos novos apareçam no sino sozinhos, para não precisar recarregar a página de tempos em
tempos só para verificar se perdi alguma coisa.

**Why this priority**: é a razão de existir da feature. Sem isso, nada muda para o usuário.
Entregue sozinha, já resolve o problema central.

**Independent Test**: pode ser testada isoladamente com duas sessões — deixar a tela de um
usuário aberta e parada, disparar um evento que gere notificação para ele a partir de outra
sessão, e verificar que o contador e a lista mudam sem nenhuma interação.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado com uma tela aberta e sem interagir, **When** uma
   notificação é criada para ele, **Then** o contador de não-lidas do sino aumenta e a
   notificação aparece na lista dentro do intervalo de atualização, sem recarregar a página.
2. **Given** o painel de notificações do sino aberto, **When** uma notificação nova chega,
   **Then** ela aparece na lista já aberta, no topo, sem fechar o painel nem perder a posição de
   rolagem.
3. **Given** um usuário com o sistema aberto, **When** uma notificação é criada para **outro**
   usuário, **Then** nada muda na tela dele — ninguém recebe aviso que não é seu.
4. **Given** um broadcast de urgência disparado para vários destinatários, **When** ele é criado,
   **Then** cada destinatário com sessão aberta passa a exibi-lo na própria tela.
5. **Given** um usuário que estava com a aba em segundo plano, **When** ele volta a ela, **Then**
   o sino reflete o estado atual imediatamente, sem esperar o próximo intervalo.

---

### User Story 2 - Manter o contador correto e não pesar no aparelho (Priority: P1)

Como usuário que lê uma notificação, quero que o contador reflita isso em todo lugar; e como
quem usa o sistema no celular em campo, quero que essa atualização automática não consuma bateria
e dados quando não estou olhando para a tela.

**Why this priority**: sem isso a feature cria dois problemas novos em vez de resolver um. Um
contador que diverge entre abas confunde; e uma tela que consulta o servidor indefinidamente em
segundo plano gasta a bateria e o plano de dados justamente de quem está em operação de campo,
onde os dois são escassos.

**Independent Test**: pode ser testada isoladamente marcando uma notificação como lida em uma
aba e conferindo a outra; e observando que a atividade de rede cessa quando a aba deixa de estar
visível e retoma quando ela volta.

**Acceptance Scenarios**:

1. **Given** a mesma conta aberta em duas abas visíveis, **When** o usuário marca uma
   notificação como lida em uma delas, **Then** o contador da outra diminui sem recarregar.
2. **Given** uma aba que deixou de estar visível, **When** ela permanece em segundo plano,
   **Then** a atualização automática é suspensa enquanto isso durar.
3. **Given** uma aba com a atualização suspensa, **When** ela volta a ficar visível, **Then** o
   estado é reconsultado imediatamente e volta a bater com o do banco.
4. **Given** um usuário sem conexão de rede, **When** a atualização automática falha, **Then**
   nenhum erro é exibido, a interface segue utilizável, e as tentativas se espaçam em vez de
   insistirem em laço.
5. **Given** a conexão restabelecida, **When** o usuário volta a ter rede, **Then** lista e
   contador voltam a refletir o estado do banco sem intervenção.
6. **Given** um usuário que faz logout ou cuja sessão expira por inatividade, **When** isso
   ocorre, **Then** a atualização automática cessa naquela aba.

---

### Edge Cases

- **Sem rede**: a aplicação continua utilizável com o que já está carregado; as tentativas se
  espaçam e nenhum erro técnico chega ao usuário.
- **Aba em segundo plano por horas**: nenhuma consulta é feita nesse período; ao voltar ao
  primeiro plano, o estado é reconsultado uma vez e fica correto.
- **Usuário com muitas abas abertas**: apenas as abas visíveis consultam. Dez abas em segundo
  plano não custam dez vezes mais que uma.
- **Notificação já exibida**: uma reconsulta não pode duplicar itens na lista nem contar a mesma
  notificação duas vezes.
- **Rajada de notificações** (broadcast de urgência para todos os voluntários): a lista absorve
  o volume sem travar a interface.
- **Sessão expirada por inatividade** (regra já existente para coordenador e membro da Defesa
  Civil): a atualização automática para junto, e não fica consultando um endpoint que já não
  autoriza.
- **Conta desativada por administrador**: mesma coisa — a atualização cessa e a sessão termina
  pelo caminho já existente.
- **Notificação criada por processo sem usuário na tela** (lembrete de turno agendado): fica no
  banco e aparece na próxima atualização de quem estiver com o sistema aberto.
- **Relógio do dispositivo errado**: a ordenação da lista não pode depender do relógio do
  cliente.
- **Usuário lendo a lista no exato momento da atualização**: a chegada de itens novos não pode
  fazer a lista "pular" sob o dedo nem desfazer uma marcação de leitura em andamento.

## Requirements _(mandatory)_

### Functional Requirements

#### Atualização automática

- **FR-001**: O sino MUST se atualizar sozinho enquanto a aba estiver visível, sem interação do
  usuário e sem recarga de página.
- **FR-002**: O contador de não-lidas MUST refletir a chegada de notificações novas na mesma
  atualização em que a lista as recebe.
- **FR-003**: A lista MUST incorporar notificações novas mesmo com o painel do sino já aberto,
  sem fechá-lo nem alterar a posição de rolagem.
- **FR-004**: O sistema MUST reconsultar o estado imediatamente quando a aba volta a ficar
  visível, sem esperar o próximo intervalo.
- **FR-005**: O sistema MUST entregar a cada usuário **apenas** as suas próprias notificações,
  derivando o destinatário da sessão autenticada no servidor e nunca de identificador informado
  pelo cliente.
- **FR-006**: A marcação de leitura MUST se refletir nas demais abas visíveis do mesmo usuário
  dentro do intervalo de atualização.

#### Economia de recursos

- **FR-007**: O sistema MUST suspender a atualização automática enquanto a aba não estiver
  visível.
- **FR-008**: O sistema MUST NOT manter conexão persistente aberta com o servidor.
- **FR-009**: O sistema MUST espaçar progressivamente as tentativas após falhas consecutivas, em
  vez de repetir em intervalo fixo indefinidamente.
- **FR-010**: O sistema MUST cessar a atualização automática quando a sessão termina por logout,
  expiração por inatividade ou desativação da conta.
- **FR-011**: A consulta de atualização MUST ser leve o suficiente para rodar repetidamente sem
  degradar a resposta das operações críticas de campo.

#### Robustez

- **FR-012**: O sistema MUST continuar plenamente utilizável quando a atualização automática
  falhar, mantendo o comportamento atual de carregamento por navegação.
- **FR-013**: O sistema MUST NOT exibir erro técnico ao usuário quando uma atualização falhar.
- **FR-014**: O sistema MUST NOT exibir notificações duplicadas nem contar a mesma notificação
  mais de uma vez após sucessivas atualizações.
- **FR-015**: O sistema MUST absorver uma rajada de notificações sem travar a interface nem
  entrar em laço de atualização.
- **FR-016**: Uma atualização que chega durante uma marcação de leitura em andamento MUST NOT
  desfazer nem reverter visualmente essa marcação.

#### Preservação do comportamento existente

- **FR-017**: O banco MUST permanecer a fonte de verdade do estado lido/não-lido.
- **FR-018**: O sistema MUST preservar o catálogo de eventos, os destinatários e os textos das
  notificações existentes, sem alterações.
- **FR-019**: O sistema MUST preservar o canal de e-mail e o registro de tentativas de envio já
  existentes, que seguem sendo o caminho para alcançar quem não está com o sistema aberto.
- **FR-020**: O sistema MUST NOT introduzir um canal de notificação do navegador ou do sistema
  operacional — a decisão de manter push fora do escopo permanece válida.
- **FR-021**: O sistema MUST NOT transmitir na atualização dados além dos que a notificação já
  exibe hoje ao próprio destinatário (tipo, título, mensagem, estado de leitura, data e
  referência de contexto).

### Key Entities

- **Notificação**: aviso destinado a um usuário, com tipo, título, mensagem, estado de leitura,
  contexto e data de criação. Já existe; esta feature não altera sua estrutura nem seu ciclo de
  vida — apenas faz a interface reler o que já está lá.
- **Registro de envio por canal**: rastro de tentativa de entrega por canal (e-mail e
  plataforma). Já existe e **não muda**: a atualização automática é uma releitura da tela, não um
  envio novo, e portanto não gera registro de envio.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Com a aba visível, uma notificação criada aparece na tela do destinatário em até 30
  segundos, sem qualquer interação dele.
- **SC-002**: Ao voltar para uma aba que estava em segundo plano, o estado exibido fica correto
  em menos de 2 segundos.
- **SC-003**: 100% das notificações exibidas pertencem ao usuário autenticado da sessão.
- **SC-004**: Nenhuma requisição de atualização é emitida enquanto a aba permanece invisível.
- **SC-005**: Com a atualização automática indisponível, 100% dos fluxos do sistema continuam
  executáveis, sem erro visível ao usuário.
- **SC-006**: O contador de não-lidas exibido não diverge do valor real do banco por mais de 30
  segundos em condições normais de rede, com a aba visível.
- **SC-007**: Nenhuma notificação aparece duplicada após uma hora de aba aberta com atualizações
  sucessivas.
- **SC-008**: Um broadcast de urgência para 200 destinatários não degrada o tempo de resposta das
  telas de operação de campo além do limite já estabelecido para leituras críticas.
- **SC-009**: A quantidade de recarregamentos manuais de página feitos por usuários de campo
  durante uma operação cai de forma observável em relação ao comportamento atual.

## Assumptions

- O sistema roda em plataforma de execução sob demanda e permanece assim; nenhuma infraestrutura
  nova (servidor de processo longo, serviço gerenciado de tempo real, camada de mensageria) é
  introduzida por esta feature.
- Nenhuma dependência nova é necessária: a capacidade de reconsultar dados em intervalo e ao
  recuperar foco já existe na base de bibliotecas do projeto.
- Notificações continuam sendo criadas pelos mesmos fluxos de negócio de hoje; esta feature não
  cria eventos novos nem muda quem recebe o quê.
- O volume esperado é da ordem de dezenas a poucas centenas de usuários simultâneos em pico de
  crise, não milhares — o que torna o custo de reconsultas periódicas aceitável.
- A latência de até 30 segundos é adequada para todos os eventos do catálogo. O evento mais
  sensível a tempo, o broadcast de urgência, já conta com o e-mail como caminho paralelo.
- A atualização automática vale para **notificações**. Atualizar automaticamente outras telas
  (painel de crise, fila de triagem, saldo de estoque) está fora do escopo desta feature.
- A interface permanece 100% em pt-BR, e a responsividade mobile continua sendo requisito de
  aceitação.
