# Feature Specification: Inscrição Voluntária em Atividades

**Feature Branch**: `018-inscricao-atividades`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "atualmente um voluntario nao consegue se candidatar a uma atividade por conta propria, somente um membro da defesa civil ou um coordenador pode fazer essa acao. Agora quero disponibilizar aos voluntarios a possibilidade de se candidatarem as atividades por conta propria, mantendo a funcionalidade dos coordenadores e membros da defesa civil tambem poderem selecionar os voluntarios. Deve ser criado uma nova rota e nova interface que ficara disponivel para quase todos os papeis, menos para o usuario comum, onde deve ser listado todas as atividades que estao em aberto, de forma bem visual e clara, permitindo que o usuario logado se candidate a atividade."

## Resumo

Hoje a única forma de um voluntário entrar na escala de uma atividade é ser alocado por quem faz a gestão da atividade (BR-VOL-05): a pessoa da operação abre a atividade, escolhe um turno e seleciona o voluntário. O voluntário não tem como ver quais atividades precisam de gente nem se oferecer para um turno — depende de ser lembrado.

Esta feature cria uma tela nova, **"Atividades abertas"**, acessível a todos os papéis logados exceto o usuário comum, que mostra de forma visual as atividades em aberto e seus turnos futuros, com as vagas disponíveis em cada um, e permite que a própria pessoa logada se inscreva em um turno com um clique. A alocação feita pela gestão continua existindo exatamente como hoje; as duas formas resultam no mesmo vínculo na escala.

**Terminologia**: "Candidatura" já é o nome, na linguagem do domínio, do pedido de uma pessoa para se tornar voluntária (triagem). Para não confundir, esta spec chama a nova ação de **inscrição em turno**. O resultado de uma inscrição é uma **alocação** idêntica à criada pela gestão, diferenciada apenas pela origem (o próprio voluntário).

## Clarifications

### Session 2026-09-30

- Q: Quando um voluntário se inscreve em um turno, a inscrição deve valer na hora ou ficar aguardando aprovação da gestão? → A: Confirmada na hora; a vaga é ocupada imediatamente, a gestão é avisada e pode remover a alocação depois. Não existe estado "pendente" nem fila de aprovação.
- Q: O membro da Defesa Civil deve ganhar permissão para alocar voluntários manualmente pelo painel de escala? → A: Sim — passa a alocar e remover voluntários, com as mesmas regras do coordenador; criar/editar/alterar status de atividades continua restrito a coordenador e administrador.
- Q: Coordenador, administrador ou membro da Defesa Civil sem cadastro de voluntário aprovado pode se inscrever em turnos? → A: Sim. Além disso, sempre que essas pessoas aparecerem listadas nas atividades, o sistema exibe um ícone que indica o seu papel na aplicação, visível a todos.
- Q: Na tela "Atividades abertas", quem acessa deve ver os nomes dos inscritos em cada turno ou só a contagem de vagas? → A: Só a contagem; nomes e ícones de papel aparecem apenas no painel de escala da gestão.
- Q: Até quanto tempo antes do início do turno a pessoa pode desistir pela tela, sem falar com a coordenação? → A: Até 30 minutos antes; depois disso, a tela orienta a falar com a coordenação.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Ver as atividades em aberto e onde faltam pessoas (Priority: P1)

Um voluntário aprovado quer ajudar e precisa saber, rapidamente e pelo celular, quais atividades estão acontecendo, onde e quando, e em quais turnos ainda há vagas.

**Why this priority**: Sem a visualização não há como se inscrever. Sozinha, ela já entrega valor: o voluntário passa a saber onde é necessário e pode procurar a coordenação.

**Independent Test**: Entrar com um voluntário aprovado, abrir "Atividades abertas" pelo menu e conferir que aparecem só as atividades com status "aberta" que têm turnos futuros, cada uma com título, categoria, local e turnos (data, horário, vagas preenchidas/total).

**Acceptance Scenarios**:

1. **Given** existem atividades abertas com turnos futuros, **When** o voluntário abre a tela, **Then** ele vê cada atividade como um cartão com título, categoria, local e a lista de turnos futuros, cada turno com data, horário de início e fim e indicação de vagas (ex.: "3 de 5 vagas preenchidas").
2. **Given** existem atividades encerradas ou canceladas, ou atividades abertas cujos turnos já terminaram, **When** o voluntário abre a tela, **Then** elas não aparecem.
3. **Given** um turno está lotado (preenchidas ≥ vagas), **When** o voluntário vê o turno, **Then** ele aparece claramente marcado como "Lotado" e sem a ação de se inscrever.
4. **Given** o voluntário já está alocado em um turno (por inscrição própria ou pela gestão), **When** ele vê esse turno, **Then** o turno aparece marcado como "Você está inscrito".
5. **Given** não existe nenhuma atividade aberta com turnos futuros, **When** o voluntário abre a tela, **Then** ele vê uma mensagem clara de que não há atividades abertas no momento.
6. **Given** um usuário comum (que ainda não é voluntário) está logado, **When** ele tenta acessar a tela pelo endereço, **Then** o acesso é negado e o item não aparece no menu dele.

---

### User Story 2 - Inscrever-se em um turno de uma atividade (Priority: P1)

O voluntário encontrou um turno com vaga em um horário que consegue cumprir e quer se comprometer com ele sem precisar falar com a coordenação.

**Why this priority**: É o objetivo central da feature — tirar a gestão do caminho crítico para preencher escalas.

**Independent Test**: Com um voluntário aprovado, inscrever-se em um turno com vaga, confirmar a mensagem de sucesso, ver o turno marcado como inscrito, ver a vaga preenchida no painel de escala da gestão e ver o turno em "Minhas atividades".

**Acceptance Scenarios**:

1. **Given** um turno futuro com vaga de uma atividade aberta, **When** o voluntário aciona "Quero participar" e confirma, **Then** ele é alocado ao turno, recebe confirmação de sucesso, o contador de vagas é atualizado e o turno passa a constar em "Minhas atividades".
2. **Given** a inscrição foi feita, **When** a gestão abre o painel de escala da atividade, **Then** o voluntário aparece no turno como qualquer outro alocado, identificado como inscrição própria.
3. **Given** o voluntário acionou a inscrição, **When** a tela pede confirmação, **Then** ela mostra a atividade, o local, a data e o horário do turno antes de efetivar, e cancelar não cria nada.
4. **Given** a última vaga foi preenchida por outra pessoa entre o carregamento da tela e a confirmação, **When** o voluntário confirma, **Then** a inscrição é recusada com a mensagem "Este turno acabou de ficar lotado" e a tela é atualizada.
5. **Given** o voluntário já está alocado em outro turno que se sobrepõe no horário, **When** ele tenta se inscrever, **Then** a inscrição é recusada informando o conflito de horário.
6. **Given** a atividade foi encerrada ou cancelada depois que a tela foi carregada, **When** o voluntário tenta se inscrever, **Then** a inscrição é recusada com mensagem clara e a atividade some da lista ao atualizar.

---

### User Story 3 - Desistir de um turno em que se inscreveu (Priority: P2)

O voluntário se inscreveu, mas surgiu um impedimento; ele precisa liberar a vaga para outra pessoa sem depender da coordenação.

**Why this priority**: Evita vagas "presas" por quem não vai comparecer e mantém o painel da gestão fiel à realidade, mas a feature já entrega valor sem isso (a gestão já pode remover alocações hoje).

**Independent Test**: Com um voluntário inscrito em um turno futuro, desistir pela tela, confirmar e verificar que a vaga voltou a ficar disponível e o turno saiu de "Minhas atividades".

**Acceptance Scenarios**:

1. **Given** o voluntário está alocado em um turno que começa daqui a mais de 30 minutos, **When** ele aciona "Desistir" e confirma, **Then** a alocação é cancelada, a vaga é liberada e ele recebe confirmação.
2. **Given** faltam 30 minutos ou menos para o início do turno (ou ele já começou), **When** o voluntário vê o turno, **Then** a ação de desistir não está disponível e a tela orienta a falar com a coordenação para desistir.
3. **Given** o voluntário foi alocado pela gestão (e não por inscrição própria), **When** ele quer desistir, **Then** ele também pode desistir pela mesma ação, e a gestão é avisada.

---

### User Story 4 - Gestão é avisada e continua alocando, agora também pelo membro da Defesa Civil (Priority: P2)

A gestão (coordenador, administrador e, a partir desta feature, membro da Defesa Civil) precisa saber quando voluntários entram ou saem dos turnos por conta própria e continuar podendo alocar e remover voluntários manualmente.

**Why this priority**: Garante que a novidade não quebre o fluxo atual (pedido explícito), que a gestão não seja surpreendida e que o membro da Defesa Civil consiga selecionar voluntários como a descrição da feature pressupõe.

**Independent Test**: Alocar e remover um voluntário pelo painel de escala com um coordenador e depois com um membro da Defesa Civil, confirmando que ambos conseguem; inscrever outro voluntário pela nova tela e confirmar que quem criou a atividade recebe uma notificação na plataforma.

**Acceptance Scenarios**:

1. **Given** a nova tela existe, **When** coordenador ou administrador aloca ou remove um voluntário pelo painel de escala, **Then** o comportamento é o mesmo de hoje (incluindo a possibilidade de exceder as vagas por decisão da gestão).
2. **Given** um membro da Defesa Civil abre o painel de escala de uma atividade aberta, **When** ele aloca um voluntário aprovado em um turno ou remove uma alocação, **Then** a operação é concluída com as mesmas regras, notificações e auditoria aplicadas ao coordenador.
3. **Given** um membro da Defesa Civil está logado, **When** ele tenta criar, editar ou mudar o status de uma atividade, **Then** a ação continua indisponível para ele (apenas alocação e remoção foram ampliadas).
4. **Given** um voluntário se inscreveu ou desistiu de um turno, **When** a ação é concluída, **Then** a pessoa que criou a atividade recebe uma notificação na plataforma com o nome do voluntário, a atividade e o turno.
5. **Given** um voluntário se inscreveu, **When** a operação é concluída, **Then** o próprio voluntário recebe a mesma notificação de "atividade atribuída" que já recebe quando é alocado pela gestão (incluindo o lembrete de turno já existente).

---

### User Story 5 - Filtrar a lista para achar o turno certo (Priority: P3)

Com muitas atividades abertas, o voluntário quer ver só o que lhe interessa: por categoria, por dia, ou só turnos que ainda têm vaga.

**Why this priority**: Melhora a usabilidade em cenários de grande volume, mas a lista ordenada por data já atende o caso comum.

**Independent Test**: Com atividades de categorias e datas diferentes, aplicar cada filtro e confirmar que a lista mostra só o que corresponde.

**Acceptance Scenarios**:

1. **Given** a lista tem atividades de várias categorias, **When** o voluntário filtra por uma categoria, **Then** só atividades dessa categoria aparecem.
2. **Given** a lista tem turnos lotados e com vaga, **When** o voluntário ativa "Somente com vagas", **Then** turnos lotados e atividades sem nenhum turno com vaga são ocultados.
3. **Given** a lista tem turnos em vários dias, **When** o voluntário escolhe um dia, **Then** só turnos daquele dia aparecem.

---

### Edge Cases

- **Usuário de papel interno sem perfil de voluntário** (ex.: um coordenador que nunca preencheu o cadastro de voluntário): pode se inscrever normalmente, sujeito às mesmas regras de vaga, conflito de horário e desistência; na escala aparece com o ícone do seu papel.
- **Usuário de papel interno que também tem perfil de voluntário aprovado**: é tratado como uma única pessoa (nunca alocado duas vezes no mesmo turno) e aparece com o ícone do seu papel interno.
- **Usuário com papel voluntário cujo perfil não está aprovado** (situação anômala): vê as atividades, mas não consegue se inscrever e recebe orientação.
- **Duas pessoas disputando a última vaga ao mesmo tempo**: apenas uma inscrição é aceita; a outra recebe "Este turno acabou de ficar lotado". O número de alocações confirmadas por inscrição própria nunca ultrapassa as vagas do turno.
- **Turno já excedido pela gestão** (mais alocados do que vagas): aparece como lotado; ninguém se inscreve por conta própria nele.
- **Inscrição repetida** (duplo clique, duas abas): o voluntário nunca fica alocado duas vezes no mesmo turno; a segunda tentativa informa que ele já está inscrito.
- **Voluntário que desistiu e quer voltar ao mesmo turno**: pode se inscrever de novo, se ainda houver vaga.
- **Desistência em cima da hora**: a partir de 30 minutos antes do início, a desistência pela tela é bloqueada (inclusive se a tela foi carregada antes e o voluntário confirma depois do prazo), com orientação para falar com a coordenação.
- **Turno em andamento**: deixa de aceitar inscrições a partir do horário de início; continua visível até terminar, marcado como "Em andamento".
- **Atividade editada pela gestão** (local, turnos) depois da inscrição: segue o fluxo de aviso de alteração já existente para quem está alocado.
- **Conectividade instável**: se a inscrição falhar por erro de rede, a tela informa que a inscrição não foi concluída e permite tentar de novo, sem deixar o voluntário em dúvida sobre seu estado.

## Requirements _(mandatory)_

### Functional Requirements

**Acesso**

- **FR-001**: O sistema MUST disponibilizar uma tela nova e dedicada, "Atividades abertas", acessível a usuários logados com papel voluntário, membro da Defesa Civil, coordenador ou administrador.
- **FR-002**: O sistema MUST negar o acesso a essa tela ao usuário comum (papel padrão de quem ainda não é voluntário) e a visitantes não autenticados, tanto pelo menu quanto por acesso direto ao endereço.
- **FR-003**: O item "Atividades abertas" MUST aparecer no menu de navegação para exatamente os papéis que têm acesso à tela.

**Listagem**

- **FR-004**: A tela MUST listar somente atividades com status "aberta" que tenham ao menos um turno que ainda não terminou.
- **FR-005**: Para cada atividade, a tela MUST exibir título, categoria, local e seus turnos não terminados, em ordem cronológica.
- **FR-006**: Para cada turno, a tela MUST exibir data, horário de início e fim, vagas preenchidas e vagas totais, e um estado visual distinto entre: "Vagas abertas", "Últimas vagas" (restando 20% das vagas ou menos), "Lotado", "Em andamento" e "Você está inscrito".
- **FR-007**: As atividades MUST ser ordenadas pelo turno disponível mais próximo, de forma que o que começa antes apareça primeiro.
- **FR-008**: A tela MUST ser utilizável em celular sem rolagem horizontal, com áreas de toque de no mínimo 44px, e o estado de cada turno MUST ser identificável por texto, não apenas por cor.
- **FR-009**: A tela MUST mostrar uma mensagem de lista vazia quando não houver atividades abertas com turnos futuros (ou nenhuma correspondente aos filtros aplicados).
- **FR-010**: A tela MUST permitir filtrar por categoria, por dia e por "somente com vagas".
- **FR-010a**: A tela "Atividades abertas" MUST exibir apenas a contagem de vagas de cada turno, sem nomes nem identificação das pessoas alocadas (além do próprio estado "Você está inscrito" do usuário logado). Nomes e ícones de papel dos participantes ficam no painel de escala da gestão.

**Inscrição**

- **FR-011**: O usuário logado MUST poder se inscrever em um turno se tiver perfil de voluntário com status "aprovado" OU se tiver papel membro da Defesa Civil, coordenador ou administrador (mesmo sem perfil de voluntário); caso contrário, a ação de inscrição MUST ser substituída por uma orientação explicando o motivo.
- **FR-012**: Antes de efetivar a inscrição, o sistema MUST pedir confirmação exibindo atividade, local, data e horário do turno.
- **FR-013**: Uma inscrição confirmada MUST criar imediatamente uma alocação confirmada do participante (o usuário logado) ao turno, a mesma usada pela alocação feita pela gestão, registrando que a origem foi inscrição própria. Não há etapa de aprovação: a vaga é ocupada no momento da confirmação.
- **FR-014**: O sistema MUST recusar a inscrição quando: a atividade não estiver mais aberta; o turno já tiver começado; o turno estiver lotado; o voluntário já estiver alocado nesse turno; ou o voluntário estiver alocado em outro turno com horário sobreposto. Cada caso MUST ter mensagem específica em pt-BR.
- **FR-015**: O sistema MUST garantir que inscrições próprias simultâneas nunca resultem em mais alocações confirmadas do que vagas no turno.
- **FR-016**: Após a inscrição, o turno MUST passar a constar em "Minhas atividades" do participante e no painel de escala da gestão.

**Desistência**

- **FR-017**: O participante MUST poder desistir, com confirmação, de qualquer turno em que esteja alocado até 30 minutos antes do início do turno, independentemente de ter sido alocado por inscrição própria ou pela gestão.
- **FR-018**: A desistência MUST cancelar a alocação e liberar a vaga imediatamente.
- **FR-018a**: Faltando 30 minutos ou menos para o início do turno, o sistema MUST recusar a desistência pela tela e exibir orientação para que o participante fale com a coordenação, que continua podendo remover a alocação pelo painel de escala.

**Gestão e notificações**

- **FR-019**: A alocação e a remoção de voluntários pela gestão MUST continuar funcionando como hoje, inclusive a permissão de exceder as vagas de um turno por decisão da gestão.
- **FR-019a**: A alocação e a remoção manual de voluntários pelo painel de escala MUST passar a ser permitida também ao membro da Defesa Civil, além de coordenador e administrador, com as mesmas regras, notificações e auditoria. Criar, editar e alterar o status de atividades MUST continuar restrito a coordenador e administrador.
- **FR-020**: O painel de escala da gestão MUST identificar quais alocações vieram de inscrição própria.
- **FR-021**: Ao se inscrever, o participante MUST receber a mesma notificação de "atividade atribuída" que já recebe quando é alocado pela gestão, e passa a receber o lembrete de turno já existente. Exceção: o lembrete sai da rotina diária (09:00, turnos das próximas 26 horas); quem se inscreve depois da execução do dia em um turno que começa antes da próxima execução não recebe lembrete — a notificação de atribuição acabou de ser recebida.
- **FR-022**: Inscrições e desistências feitas pelo próprio participante MUST gerar notificação na plataforma para a pessoa que criou a atividade.
- **FR-023**: Inscrições e desistências MUST ser registradas na auditoria, com quem se inscreveu como ator.

**Identificação visual de papel**

- **FR-024**: Sempre que pessoas alocadas em um turno forem listadas (painel de escala da gestão e demais listagens de participantes de atividades existentes ou futuras), o sistema MUST exibir, ao lado do nome de quem tem papel membro da Defesa Civil, coordenador ou administrador, um ícone distinto para cada um desses papéis, visível a todos que veem a listagem.
- **FR-025**: Cada ícone de papel MUST ter rótulo textual acessível (ex.: dica ao passar o mouse/tocar e texto para leitores de tela) com o nome do papel em pt-BR; voluntários sem papel interno não recebem ícone.

### Key Entities

- **Atividade**: ação de campo organizada pela Defesa Civil (título, categoria, local, status aberta/encerrada/cancelada, criador). Só atividades "abertas" aceitam inscrições.
- **Turno**: bloco de 4 horas de uma atividade, com início, fim e número de vagas. É a unidade em que o voluntário se inscreve.
- **Alocação**: vínculo entre um participante e um turno, com status confirmado/cancelado. O participante pode ser um voluntário aprovado ou um membro da equipe interna (membro da Defesa Civil, coordenador, administrador) sem perfil de voluntário. Ganha a informação de **origem**: alocada pela gestão ou inscrição própria.
- **Perfil de voluntário**: cadastro do voluntário, com status pendente/aprovado/rejeitado. Entre os usuários com papel voluntário, só o perfil "aprovado" pode se inscrever; papéis internos não precisam de perfil.
- **Papel do usuário**: usuário comum, voluntário, membro da Defesa Civil, coordenador ou administrador. Os três últimos têm ícone próprio nas listagens de participantes.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Um voluntário aprovado consegue, a partir do menu, encontrar um turno com vaga e concluir a inscrição em menos de 1 minuto, em celular.
- **SC-002**: Em teste com voluntários, ao menos 90% concluem a primeira inscrição sem ajuda.
- **SC-003**: Em nenhum caso o número de alocações por inscrição própria ultrapassa as vagas de um turno, mesmo com várias pessoas tentando a última vaga ao mesmo tempo.
- **SC-004**: A tela de atividades abertas exibe a lista em até 2 segundos em conexão móvel comum.
- **SC-005**: 100% das tentativas de acesso por usuário comum ou visitante são bloqueadas.
- **SC-006**: Após a liberação, a proporção de vagas de turno preenchidas antes do início do turno aumenta em relação ao período anterior, quando só a gestão alocava.

## Assumptions

- **Unidade de inscrição é o turno**, não a atividade inteira: hoje a escala já é por turno de 4h (BR-VOL-04/05), e um voluntário raramente consegue cobrir todos os turnos de uma atividade.
- **Inscrição é confirmada na hora** (confirmado em Clarifications), sem etapa de aprovação pela gestão: o modelo atual de alocação não tem estado "pendente", e o contexto de emergência favorece preencher a escala rapidamente. A gestão mantém o controle podendo remover qualquer alocação, como já faz hoje.
- **Vagas são um limite rígido para a inscrição própria**, mas não para a gestão: a gestão continua podendo exceder as vagas conscientemente (comportamento atual), enquanto o voluntário só se inscreve onde há vaga.
- **Papéis internos (membro da Defesa Civil, coordenador, administrador) podem se inscrever mesmo sem perfil de voluntário** (confirmado em Clarifications), e são identificados por ícone do papel nas listagens de participantes.
- **A seleção manual da gestão no painel de escala continua listando apenas voluntários aprovados**; a equipe interna entra na escala por inscrição própria.
- **Permissão de alocação manual é ampliada só para alocar/remover** (confirmado em Clarifications): o membro da Defesa Civil passa a alocar e remover voluntários pelo painel de escala; a gestão do cadastro da atividade (criar, editar, mudar status) segue restrita a coordenador e administrador.
- **Habilidades não restringem a inscrição**: hoje as atividades não registram habilidades exigidas (as habilidades servem só como filtro para a gestão), então qualquer voluntário aprovado pode se inscrever em qualquer turno com vaga.
- **Disponibilidade declarada no cadastro não bloqueia a inscrição**: o voluntário escolhe o turno conscientemente.
- A notificação para a gestão é só na plataforma (sino); o envio de e-mail para a gestão a cada inscrição está fora do escopo, para não gerar volume.
- A tela "Minhas atividades" existente continua sendo o lugar para o voluntário ver todos os seus turnos; a nova tela foca em descobrir e se inscrever.
