# Feature Specification: Notificações também pelo WhatsApp

**Feature Branch**: `024-notificacoes-whatsapp`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "preciso fazer uma integracao com a API da META para fazer o uso do Whatsapp. Quero enviar as notificacoes do sistema atravez do Whatsapp alem de fazer o envio dos emails."

## Resumo

Hoje o sistema avisa as pessoas por dois caminhos: o **sino da plataforma** (a cópia durável de
toda notificação) e o **e-mail**, usado para os avisos que o voluntário precisa receber mesmo fora
do sistema — cadastro aprovado, atividade atribuída, atividade alterada e broadcast de urgência.

O problema é de alcance. Em operação de campo, o voluntário raramente abre o e-mail e quase sempre
olha o WhatsApp. O próprio cadastro já reconhece isso: o campo de telefone obrigatório é chamado
de "Telefone (WhatsApp)" desde o documento de requisitos. A informação existe, mas o sistema não
usa esse canal — e num chamado de urgência a diferença entre "chegou no e-mail" e "chegou no
celular" é a diferença entre o voluntário aparecer ou não.

Esta feature acrescenta o **WhatsApp como terceiro canal de entrega**, em paralelo ao e-mail, pelo
número oficial da operação na plataforma de mensagens da Meta.

O que **não** muda: o sino continua sendo a fonte de verdade de toda notificação (lido/não-lido);
o e-mail continua sendo enviado como hoje; o catálogo de eventos e o texto-base de cada aviso
permanecem os mesmos.

### Decisões de escopo

**Canal adicional, não substituto.** O WhatsApp soma ao e-mail; não substitui nem vira
"plano B" dele. Um aviso que hoje vai por e-mail continua indo por e-mail, com ou sem WhatsApp.

**Comunicação de mão única.** O número da operação **avisa**, não conversa. Mensagens recebidas
de volta não viram atendimento nem comandos de negócio (não é possível, por exemplo, confirmar
presença respondendo ao WhatsApp). A única resposta que o sistema reconhece é o pedido de parar de
receber mensagens (User Story 4).

**Textos fixos, previamente aprovados.** A plataforma da Meta só permite que uma empresa inicie
conversa com uma pessoa usando modelos de mensagem aprovados previamente por ela. Na prática:
cada tipo de aviso tem um texto fixo com campos variáveis (nome, data, local, etc.), e o texto
livre do broadcast de urgência precisa caber num campo variável de tamanho limitado. Criar um
tipo de aviso novo no futuro passa a exigir a aprovação do modelo correspondente antes de ele
funcionar no WhatsApp.

**Custo por mensagem.** Ao contrário do e-mail, cada mensagem iniciada pela empresa no WhatsApp é
cobrada pela Meta. Por isso todo envio fica registrado e contável, e o canal pode ser desligado
inteiro sem afetar o resto do sistema.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Receber no WhatsApp os avisos importantes (Priority: P1)

Como voluntário, quero receber no meu WhatsApp os avisos que hoje só chegam por e-mail, para
saber na hora que fui aprovado, que recebi uma atividade, que ela mudou, ou que há uma convocação
de urgência — sem precisar abrir o e-mail nem o sistema.

**Why this priority**: é a razão de existir da feature. Entregue sozinha (com o consentimento
mínimo da User Story 2), já resolve o problema de alcance.

**Independent Test**: com um voluntário de teste que tenha número válido e o canal habilitado,
disparar cada evento coberto (aprovar o cadastro, atribuir uma atividade, alterá-la, enviar um
broadcast, rodar o lembrete de turno) e verificar que a mensagem chega ao WhatsApp, que o e-mail também chega, e que o sino
registra a notificação normalmente.

**Acceptance Scenarios**:

1. **Given** um voluntário com o canal WhatsApp habilitado e telefone celular válido, **When** um
   evento coberto pelo canal é disparado para ele, **Then** ele recebe a mensagem no WhatsApp com
   o título, o conteúdo do aviso e a indicação de que vem do SOS Jaraguá.
2. **Given** o mesmo voluntário, **When** o evento é disparado, **Then** o e-mail e a notificação
   no sino continuam sendo entregues exatamente como antes, independentemente do resultado do
   WhatsApp.
3. **Given** um coordenador disparando um broadcast de urgência para todos os voluntários,
   **When** o disparo é concluído, **Then** cada voluntário elegível recebe a convocação no
   WhatsApp, e o coordenador vê para quantos a convocação foi encaminhada pelo WhatsApp e
   quantos não puderam recebê-la por esse canal.
4. **Given** um evento que não está entre os cobertos pelo WhatsApp, **When** ele é disparado,
   **Then** nenhuma mensagem de WhatsApp é enviada.
5. **Given** a mensagem recebida no WhatsApp, **When** o voluntário a lê, **Then** ela contém um
   caminho para abrir o detalhe no sistema e não expõe dados além dos que a notificação no sino já
   mostra a ele.

6. **Given** um voluntário elegível com turno nas próximas horas, **When** o aviso diário de
   lembrete de turno é disparado, **Then** ele recebe o lembrete também no WhatsApp (o lembrete
   continua sem e-mail, como hoje).

Eventos cobertos pelo WhatsApp (decisão de 2026-10-14): os quatro que hoje vão por e-mail —
**triagem concluída**, **atividade atribuída**, **alteração de atividade** e **broadcast de
urgência** — mais o **lembrete de turno**, que o documento de requisitos previa como "push" e
que hoje só aparece no sino. Os alertas da gestão (cadastros acumulados, estoque crítico, déficit
de atendimento, inscrição em turno) ficam fora: seguem só na plataforma.

---

### User Story 2 - Decidir se quero receber pelo WhatsApp (Priority: P1)

Como voluntário, quero controlar se o sistema me manda mensagens no WhatsApp e saber para qual
número elas vão, para não receber mensagens que não pedi e para poder parar quando quiser.

**Why this priority**: é pré-requisito legal e de política da plataforma. Enviar mensagens a quem
não consentiu expõe a operação a reclamação com base na LGPD e a bloqueios do número pela Meta —
o que derrubaria o canal para todos justamente numa emergência.

**Independent Test**: com um voluntário de teste, alternar a preferência em Minha conta →
Notificações e disparar um
evento coberto em cada estado; verificar que a mensagem só chega quando o canal está habilitado e
que o e-mail chega nos dois casos.

**Acceptance Scenarios**:

1. **Given** um voluntário em Minha conta → Notificações, **When** ele consulta a página, **Then**
   vê se o WhatsApp está habilitado e para qual número as mensagens serão enviadas.
2. **Given** um voluntário com o canal habilitado, **When** ele o desabilita, **Then** nenhuma
   mensagem de WhatsApp é enviada a ele a partir dali, e e-mail e sino seguem normais.
3. **Given** um voluntário com o canal desabilitado, **When** ele o habilita, **Then** passa a
   receber os avisos cobertos a partir do próximo evento.
4. **Given** um voluntário que altera o telefone cadastrado, **When** um novo evento é disparado,
   **Then** a mensagem vai para o número novo.
5. **Given** um voluntário cujo telefone cadastrado é fixo (não pode receber WhatsApp), **When**
   ele consulta Minha conta → Notificações, **Then** é informado de que precisa de um celular para
   usar o canal.
6. **Given** uma pessoa preenchendo o cadastro de voluntário, **When** ela chega ao campo de
   telefone, **Then** vê uma opção **desmarcada** para receber avisos pelo WhatsApp, com
   explicação de quais avisos são e de como deixar de recebê-los; o cadastro pode ser concluído
   sem marcá-la.
7. **Given** um voluntário que já estava cadastrado antes desta feature, **When** a feature
   entra em produção, **Then** o canal está desligado para ele até que o ative em Minha conta →
   Notificações.

Regra de consentimento (decisão de 2026-10-14): **opt-in explícito**. O canal começa
**desligado** para todos — novos cadastros e voluntários já existentes — e só passa a valer
quando o próprio voluntário o ativa, no cadastro ou em Minha conta → Notificações. Ter telefone
cadastrado não
equivale a consentir.

---

### User Story 3 - Acompanhar se as mensagens chegaram e quanto o canal está sendo usado (Priority: P2)

Como administrador ou coordenador, quero saber quais mensagens de WhatsApp saíram, quais
chegaram e quais falharam (e por quê), para identificar voluntários inalcançáveis, conferir o
alcance de uma convocação e acompanhar o volume — que tem custo.

**Why this priority**: sem isso o canal é uma caixa-preta. Mas a entrega em si (US1/US2) já gera
valor antes de existir acompanhamento detalhado.

**Independent Test**: disparar eventos para um conjunto de teste com números válidos, um número
sem WhatsApp e um voluntário com o canal desligado; gerar o relatório de envio de notificações do
período e verificar que cada caso aparece com o canal WhatsApp e a situação correta.

**Acceptance Scenarios**:

1. **Given** envios de WhatsApp em um período, **When** o usuário gera o relatório de envio de
   notificações já existente, **Then** o WhatsApp aparece como canal, com totais por situação e
   por tipo de notificação.
2. **Given** uma mensagem que a plataforma confirma ter entregue, **When** a confirmação chega,
   **Then** a situação daquele envio passa a "entregue".
3. **Given** uma mensagem que falhou (número sem WhatsApp, canal não configurado, limite de envio
   atingido, modelo de mensagem indisponível), **When** o usuário consulta as falhas, **Then** vê
   o motivo em linguagem compreensível.
4. **Given** um voluntário que não recebeu por estar com o canal desligado ou sem celular,
   **When** o relatório é gerado, **Then** esse caso aparece como "não enviado" com o motivo, e
   não como falha técnica.
5. **Given** um broadcast de urgência concluído, **When** o coordenador consulta o resultado,
   **Then** vê, no relatório de envio de notificações filtrado pelo período da convocação, quantos
   voluntários receberam por WhatsApp (entregue ou lido), quantos por e-mail e quantos não
   puderam receber pelo WhatsApp.

---

### User Story 4 - Parar de receber respondendo à mensagem (Priority: P3)

Como voluntário que recebeu uma mensagem no WhatsApp, quero poder responder "SAIR" ou "PARAR"
para deixar de receber, sem precisar entrar no sistema.

**Why this priority**: é o caminho de descadastro que as pessoas esperam num canal de mensagens e
reduz o risco de bloqueios e denúncias do número. O descadastro em Minha conta → Notificações
(US2) já cobre o
requisito mínimo, por isso esta é P3.

**Independent Test**: com um voluntário de teste com o canal habilitado, responder "SAIR" à
mensagem recebida e verificar que a preferência em Minha conta → Notificações passa a
"desabilitado", que uma
confirmação é enviada, e que o próximo evento não gera mensagem de WhatsApp.

**Acceptance Scenarios**:

1. **Given** um voluntário com o canal habilitado, **When** ele responde com uma palavra de
   descadastro reconhecida, **Then** o canal é desabilitado para ele e ele recebe uma única
   confirmação informando como reativar em Minha conta → Notificações.
2. **Given** um voluntário que responde qualquer outra coisa, **When** a mensagem chega ao número
   da operação, **Then** ele recebe uma resposta automática informando que o número só envia
   avisos e indicando o caminho de contato com a operação — e nenhuma ação de negócio é
   executada.
3. **Given** uma resposta vinda de um número que não pertence a nenhum usuário ativo, **When**
   ela chega, **Then** nada é alterado no sistema.

---

### Edge Cases

- **Telefone fixo ou inválido**: o voluntário não recebe por WhatsApp; o envio é registrado como
  "não enviado — sem celular válido"; e-mail e sino seguem normais.
- **Número sem conta de WhatsApp**: a tentativa é registrada como falha com esse motivo; nenhuma
  nova tentativa automática para o mesmo aviso; o voluntário segue recebendo por e-mail.
- **Canal não configurado** (ambiente de desenvolvimento, credenciais ausentes ou revogadas): o
  sistema funciona como hoje, com sino e e-mail; os envios de WhatsApp são registrados como não
  enviados por canal não configurado, sem erro visível ao usuário.
- **Plataforma da Meta fora do ar ou lenta**: a operação de negócio que disparou o aviso (aprovar
  cadastro, atribuir atividade, disparar broadcast) conclui normalmente e no mesmo tempo de hoje.
- **Broadcast maior que o limite diário de envios do número**: os voluntários além do limite não
  recebem pelo WhatsApp; os envios recusados pela plataforma ficam registrados como falha, com o
  motivo "limite de envio"; o
  coordenador vê o alcance parcial; e-mail e sino alcançam todos.
- **Texto de broadcast longo demais para o modelo de mensagem**: o coordenador é avisado do
  limite antes de disparar; o sistema nunca corta a mensagem silenciosamente.
- **Modelo de mensagem pausado ou rejeitado pela Meta**: as mensagens daquele tipo falham com
  motivo explícito; os outros tipos seguem funcionando.
- **Usuário desativado**: não recebe WhatsApp, do mesmo modo que hoje não recebe e-mail.
- **Mesmo aviso processado duas vezes** (repetição de execução, reenvio após falha parcial): o
  destinatário não recebe a mesma notificação duas vezes pelo WhatsApp.
- **Dois usuários com o mesmo telefone**: cada um recebe os seus próprios avisos; um
  descadastro por resposta (US4) desabilita o canal para todos os usuários daquele número.
- **Voluntário troca de número**: os avisos seguintes vão para o novo número; confirmações de
  entrega de mensagens antigas continuam associadas ao envio original.
- **Confirmação de entrega que chega fora de ordem ou repetida**: a situação final de um envio
  nunca regride (ex.: de "entregue" para "enviado").
- **Mensagem recebida que não veio da Meta** (tentativa de forjar confirmação ou descadastro):
  é descartada sem efeito.

## Requirements _(mandatory)_

### Functional Requirements

#### Entrega

- **FR-001**: O sistema MUST enviar pelo WhatsApp, ao destinatário elegível, cada notificação dos
  eventos cobertos: triagem concluída, atividade atribuída, alteração de atividade, broadcast de
  urgência e lembrete de turno. Os demais eventos MUST NOT gerar mensagem de WhatsApp.
- **FR-002**: O envio pelo WhatsApp MUST ocorrer **em adição** aos canais que cada evento já usa
  hoje (sino, e e-mail quando aplicável), nunca no lugar deles; o resultado do WhatsApp MUST NOT
  alterar se e como o e-mail e o sino são entregues.
- **FR-003**: É elegível ao WhatsApp o destinatário que está ativo, tem telefone celular
  brasileiro válido cadastrado e ativou o canal (opt-in explícito).
- **FR-004**: Cada tipo de aviso MUST ter um texto fixo para o WhatsApp, equivalente ao texto-base
  já usado no sino e no e-mail, com os campos variáveis do evento e a identificação do SOS
  Jaraguá.
- **FR-005**: A mensagem MUST NOT conter dados além dos que a notificação no sino já exibe ao
  próprio destinatário; em particular, MUST NOT conter CPF, restrições de saúde ou dados de
  outros voluntários.
- **FR-006**: A mensagem MUST oferecer um caminho para abrir o sistema na tela relacionada ao
  aviso, quando houver uma.
- **FR-007**: No broadcast de urgência, o sistema MUST informar ao coordenador o tamanho máximo do
  texto aceito pelo WhatsApp antes do disparo e MUST NOT truncar a mensagem sem avisá-lo.
- **FR-008**: O sistema MUST NOT enviar a mesma notificação mais de uma vez pelo WhatsApp ao mesmo
  destinatário.

#### Consentimento e controle do usuário

- **FR-009**: O voluntário MUST poder ver, em Minha conta → Notificações, se o canal WhatsApp está habilitado
  e para qual número as mensagens vão.
- **FR-010**: O voluntário MUST poder habilitar e desabilitar o canal a qualquer momento, com
  efeito a partir do próximo envio.
- **FR-011**: O sistema MUST registrar quando e por qual caminho (cadastro, perfil, resposta no
  WhatsApp) o consentimento foi dado ou revogado.
- **FR-012**: O formulário de cadastro de voluntário MUST oferecer, junto ao campo de telefone,
  uma opção desmarcada por padrão para receber avisos pelo WhatsApp, explicando quais avisos são
  e como deixar de recebê-los; o cadastro MUST poder ser concluído sem marcá-la.
- **FR-013**: O canal MUST começar desabilitado para todos os usuários, inclusive os já
  cadastrados antes desta feature, e o sistema MUST NOT enviar mensagem de WhatsApp a quem não o
  ativou ou revogou o consentimento.

#### Respostas recebidas (US4)

- **FR-014**: O sistema MUST desabilitar o canal quando o voluntário responder com uma palavra de
  descadastro reconhecida ("SAIR", "PARAR", "STOP", "CANCELAR", "DESCADASTRAR", sem distinção de
  maiúsculas e acentos), e
  MUST enviar uma única confirmação.
- **FR-015**: Qualquer outra resposta MUST receber uma resposta automática informando que o
  número apenas envia avisos, e MUST NOT disparar nenhuma ação de negócio.
- **FR-016**: O sistema MUST aceitar confirmações de entrega e respostas apenas quando
  comprovadamente originadas da plataforma da Meta, descartando as demais.

#### Robustez

- **FR-017**: Falha, lentidão ou indisponibilidade do WhatsApp MUST NOT impedir, desfazer nem
  atrasar perceptivelmente a operação de negócio que gerou a notificação.
- **FR-018**: Com o canal não configurado, o sistema MUST funcionar exatamente como hoje (sino e
  e-mail), sem erro visível ao usuário.
- **FR-019**: O sistema MUST NOT repetir automaticamente envios para números que a plataforma
  informou não ter WhatsApp.
- **FR-020**: Um broadcast que exceda o limite de envio do número MUST alcançar pelo WhatsApp
  quantos destinatários o limite permitir, registrar os demais como falha com o motivo "limite de
  envio", e
  manter e-mail e sino para todos.

#### Registro e acompanhamento

- **FR-021**: Cada tentativa de envio por WhatsApp MUST ser registrada com destinatário, tipo de
  notificação, momento, situação (pendente, enviado, entregue, lido, falhou, não enviado) e
  motivo quando não entregue.
- **FR-022**: A situação de um envio MUST ser atualizada a partir das confirmações da plataforma,
  sem jamais regredir para uma situação anterior.
- **FR-023**: O relatório de envio de notificações já existente MUST incluir o WhatsApp como
  canal, com os mesmos filtros, totais e lista de falhas que já oferece para o e-mail.
- **FR-024**: Ao concluir um broadcast de urgência, o coordenador MUST ver quantos destinatários
  tiveram a convocação encaminhada ao WhatsApp e quantos não puderam recebê-la por esse canal
  (sem opt-in, sem celular, canal não configurado); a confirmação de entrega de cada um fica no
  relatório de envio de notificações.
- **FR-025**: O registro de envio MUST mostrar o telefone de forma parcialmente mascarada para
  quem consulta relatórios, exceto para administradores.

#### Preservação do comportamento existente

- **FR-026**: O sistema MUST preservar o catálogo de eventos, os destinatários de cada evento e o
  texto-base das notificações.
- **FR-027**: O sino MUST permanecer a fonte de verdade do estado lido/não-lido; a leitura de uma
  mensagem no WhatsApp MUST NOT marcar a notificação como lida no sistema.

### Key Entities

- **Preferência de canal WhatsApp**: decisão do usuário sobre receber avisos pelo WhatsApp —
  habilitado ou não, quando e por qual caminho foi dada ou revogada. Pertence ao usuário; vale
  para o número de telefone que estiver cadastrado no momento de cada envio.
- **Telefone de contato**: já existe no perfil do voluntário (campo obrigatório "Telefone
  (WhatsApp)"). Esta feature passa a usá-lo como destino; só celulares são elegíveis.
- **Modelo de mensagem**: texto fixo de cada tipo de aviso no WhatsApp, com seus campos
  variáveis, previamente aprovado pela Meta. Um por evento coberto, mais as mensagens de
  confirmação de descadastro e de resposta automática.
- **Registro de envio por canal**: já existe para e-mail e plataforma. Passa a ter o canal
  WhatsApp e as situações "entregue", "lido" e "não enviado", com o motivo.
- **Notificação**: já existe; não muda de estrutura nem de ciclo de vida.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Para destinatários elegíveis, ao menos 95% das notificações cobertas chegam ao
  WhatsApp em até 2 minutos após o evento, excluídos os números sem WhatsApp.
- **SC-002**: Um broadcast de urgência para 200 voluntários tem todas as tentativas de WhatsApp
  concluídas e registradas em até 10 minutos, sem atrasar a entrega de e-mail e sino.
- **SC-003**: Com o WhatsApp indisponível ou não configurado, 100% das operações que geram
  notificações concluem normalmente e 100% dos e-mails e avisos no sino continuam sendo
  entregues.
- **SC-004**: Zero mensagens de WhatsApp são enviadas a quem não consentiu ou revogou o
  consentimento.
- **SC-005**: Zero destinatários recebem a mesma notificação duas vezes pelo WhatsApp.
- **SC-006**: 100% das tentativas de envio por WhatsApp aparecem no relatório de envio de
  notificações com situação final e, quando não entregues, motivo.
- **SC-007**: Um voluntário consegue habilitar ou desabilitar o canal em Minha conta → Notificações
  em menos de 30
  segundos, e o descadastro por resposta (US4) tem efeito antes do próximo envio.
- **SC-008**: Em convocações de urgência, a proporção de voluntários que tomam conhecimento do
  aviso em até 1 hora (leitura confirmada no WhatsApp ou no sino) é maior do que a observada hoje
  apenas com e-mail e sino.

## Assumptions

- **Plataforma oficial da Meta**: a integração usa a plataforma oficial de mensagens para empresas
  da Meta (WhatsApp Business), não soluções não oficiais que automatizam um celular comum — estas
  violam os termos de uso do WhatsApp e arriscam o banimento do número.
- **Pré-requisitos fora do sistema** (responsabilidade da operação, antes de ir a produção): conta
  empresarial verificada na Meta, um número de telefone dedicado à operação e os modelos de
  mensagem aprovados. Sem eles o canal fica "não configurado" e o sistema funciona como hoje.
- **Custo**: a operação aceita o custo por mensagem cobrado pela Meta; o volume esperado (dezenas
  a poucas centenas de voluntários, picos em broadcasts de urgência) é compatível com isso.
- **Limite de envio**: o número começa com o limite diário de destinatários de uma conta nova, que
  a Meta aumenta com o uso e a boa qualidade. Até lá, broadcasts maiores que o limite terão
  alcance parcial pelo WhatsApp (o e-mail continua alcançando todos).
- **Destinatários**: todos os eventos cobertos têm voluntários como destinatários, e só quem tem
  perfil de voluntário tem telefone no sistema. Usuários da gestão (coordenadores, Defesa Civil,
  administradores) **com** perfil de voluntário são tratados como voluntários: recebem os avisos
  cobertos e podem ativar o canal em Minha conta → Notificações, visível a todos os papéis. Quem
  não tem perfil não recebe WhatsApp, e nenhum campo de telefone novo é criado.
- **Alcance inicial**: com opt-in explícito, o alcance do canal no lançamento depende de os
  voluntários o ativarem; uma campanha de divulgação para isso é responsabilidade da operação e
  está fora do escopo do sistema.
- **Sem horário de silêncio**: avisos saem quando o evento acontece, como o e-mail hoje; o
  lembrete de turno já é agendado para a manhã.
- **Sem conversa**: não há atendimento humano pelo número; o contato com a operação continua
  pelos canais atuais.
- **Escopo do texto**: os textos no WhatsApp seguem o texto-base atual de cada aviso; uma revisão
  editorial dos avisos está fora do escopo.
- A interface permanece 100% em pt-BR e responsiva no celular, e a decisão de não usar push do
  navegador continua válida — o WhatsApp é o canal que alcança o voluntário com o sistema
  fechado.
