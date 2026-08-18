# Feature Specification: Gestão de Habilidades

**Feature Branch**: `017-gestao-habilidades`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "preciso que seja criado uma página específica para fazer a gestão do cadastro de habilidades. Essa interface deve ter uma lista paginada das habilidades cadastradas no sistema, além de possuir ações no datatable que possibilitam a exclusão e edição de habilidades, além de permitir a inclusão de novas habilidades. A edição e cadastro devem ser feitas com o react-hook-form + zod dentro de um dialog, com as validações necessárias. Essa página deve ser liberada para os perfis colaborador, membro da defesa civil e administrador."

## Resumo

As habilidades (ex.: "Motosserra", "CNH D/E", "Embarcação", "Primeiros Socorros") são a lista de referência usada na candidatura de voluntários e no filtro de alocação. Hoje essa lista só nasce da carga inicial de dados: não existe tela para consultá-la, incluir uma habilidade nova, corrigir um nome digitado errado ou remover uma que deixou de ser usada — qualquer ajuste exige acesso direto ao banco.

Esta feature cria uma tela dedicada de gestão de habilidades: listagem paginada, cadastro de nova habilidade, edição do nome de uma existente e exclusão, com confirmação. O acesso é restrito aos papéis de operação interna: coordenador, membro da Defesa Civil e administrador.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Consultar a lista de habilidades cadastradas (Priority: P1)

Uma pessoa da operação precisa ver quais habilidades existem no sistema hoje, para saber o que já está disponível na candidatura de voluntários antes de criar ou corrigir qualquer coisa.

**Why this priority**: É a base das demais ações — sem uma listagem confiável, não há como encontrar o registro a editar ou excluir, nem como saber se uma habilidade já existe antes de cadastrá-la de novo.

**Independent Test**: Acessar a tela com um dos papéis autorizados e confirmar que as habilidades reais do sistema aparecem, distribuídas em páginas, sem carregar tudo de uma vez.

**Acceptance Scenarios**:

1. **Given** existem mais habilidades cadastradas do que cabem em uma página, **When** a pessoa abre a tela de gestão de habilidades, **Then** ela vê a primeira página da lista e consegue navegar para as páginas seguintes.
2. **Given** a pessoa está em qualquer página da lista, **When** ela avança ou volta de página, **Then** a tela mostra o conjunto correto de habilidades daquela página, sem duplicar nem pular registros.
3. **Given** nenhuma habilidade está cadastrada, **When** a pessoa abre a tela, **Then** ela vê uma mensagem clara de lista vazia e a ação de cadastrar continua disponível.

---

### User Story 2 - Cadastrar uma nova habilidade (Priority: P1)

Surgiu uma necessidade nova em campo (ex.: "Operação de drone") e a pessoa da operação precisa incluí-la na lista para que os voluntários possam declará-la.

**Why this priority**: É o principal motivo de existir da tela — sem cadastro, a lista permanece congelada na carga inicial e a operação volta a depender do banco.

**Independent Test**: Cadastrar uma habilidade nova pela tela e confirmar que ela passa a aparecer na listagem e nas telas que consomem a lista de habilidades.

**Acceptance Scenarios**:

1. **Given** a pessoa está na tela de gestão, **When** ela aciona a inclusão, **Then** abre um formulário em janela sobreposta com o campo de nome vazio.
2. **Given** o formulário de inclusão está aberto, **When** ela informa um nome válido e confirma, **Then** a habilidade é criada, a janela fecha, a lista é atualizada e uma confirmação de sucesso é exibida.
3. **Given** o formulário está aberto, **When** ela tenta confirmar com o nome vazio ou apenas com espaços, **Then** a operação é bloqueada e uma mensagem de erro em pt-BR é exibida junto ao campo.
4. **Given** já existe uma habilidade com o mesmo nome (desconsiderando maiúsculas/minúsculas e espaços nas pontas), **When** ela tenta confirmar, **Then** a criação é recusada e a tela informa que a habilidade já existe.
5. **Given** ela abriu o formulário por engano, **When** ela cancela ou fecha a janela, **Then** nada é criado e a lista permanece inalterada.

---

### User Story 3 - Editar o nome de uma habilidade existente (Priority: P2)

Uma habilidade foi cadastrada com nome errado ou ambíguo e precisa ser corrigida sem perder o vínculo com os voluntários que já a declararam.

**Why this priority**: Corrige erros sem exigir excluir e recriar (o que romperia os vínculos existentes), mas depende da listagem e do cadastro já estarem no lugar.

**Independent Test**: Renomear uma habilidade vinculada a pelo menos um voluntário e confirmar que o novo nome aparece na listagem e no perfil desse voluntário, com o vínculo preservado.

**Acceptance Scenarios**:

1. **Given** a pessoa localizou uma habilidade na lista, **When** ela aciona a ação de editar, **Then** abre a mesma janela de formulário já preenchida com o nome atual.
2. **Given** o formulário de edição está aberto, **When** ela altera o nome para um valor válido e confirma, **Then** o nome é atualizado, a janela fecha, a lista reflete a mudança e uma confirmação de sucesso é exibida.
3. **Given** o formulário de edição está aberto, **When** ela informa um nome já usado por outra habilidade, **Then** a alteração é recusada com mensagem clara e o registro permanece inalterado.
4. **Given** a habilidade está vinculada a voluntários, **When** o nome é alterado, **Then** todos os vínculos existentes continuam válidos e passam a exibir o nome novo.

---

### User Story 4 - Excluir uma habilidade (Priority: P3)

Uma habilidade deixou de fazer sentido para a operação e precisa sair da lista, para não poluir o formulário de candidatura.

**Why this priority**: É a ação menos frequente e a de maior risco (afeta vínculos existentes); entrega valor, mas a tela já é útil sem ela.

**Independent Test**: Excluir uma habilidade sem vínculos e confirmar que ela some da listagem e das telas que consomem a lista.

**Acceptance Scenarios**:

1. **Given** a pessoa localizou uma habilidade na lista, **When** ela aciona a exclusão, **Then** o sistema pede confirmação explícita antes de qualquer remoção, identificando a habilidade pelo nome.
2. **Given** a confirmação de exclusão está aberta, **When** ela cancela, **Then** nada é excluído.
3. **Given** a habilidade não está vinculada a nenhum voluntário, **When** ela confirma a exclusão, **Then** a habilidade é removida, a lista é atualizada e uma confirmação de sucesso é exibida.
4. **Given** a habilidade está vinculada a um ou mais voluntários, **When** ela aciona a exclusão, **Then** a exclusão é recusada e a tela informa quantos voluntários estão vinculados, orientando a renomear a habilidade ou remover os vínculos antes de excluir.
5. **Given** a habilidade estava sem vínculos quando a tela foi carregada mas passou a ter vínculos até a confirmação, **When** ela confirma a exclusão, **Then** a exclusão é recusada com a mesma mensagem, sem remover nenhum vínculo.

---

### Edge Cases

- Nome com espaços no início/fim ou espaços duplicados internos: é normalizado antes de salvar e antes da checagem de duplicidade.
- Duas pessoas cadastrando o mesmo nome ao mesmo tempo: apenas uma criação vence; a outra recebe a mensagem de nome já existente, não um erro genérico.
- Registro excluído por outra pessoa enquanto a janela de edição estava aberta: ao confirmar, a tela informa que a habilidade não existe mais e atualiza a lista.
- Voluntário vinculado à habilidade entre o carregamento da lista e a confirmação da exclusão: a checagem de vínculos vale a do momento da exclusão no servidor, não a contagem exibida na tela.
- Exclusão do último item de uma página: a listagem reposiciona a pessoa em uma página válida, sem deixar a tela em branco.
- Falha de rede/servidor ao salvar: a janela permanece aberta com os dados preenchidos e uma mensagem de erro em pt-BR; nada é perdido.
- Acesso por papel não autorizado (usuário comum, voluntário) ou sem sessão: o acesso é negado tanto ao abrir a tela quanto ao tentar executar qualquer ação diretamente.
- Nome excessivamente longo: bloqueado no formulário com mensagem clara, antes de chegar ao servidor.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema DEVE disponibilizar uma tela dedicada à gestão de habilidades dentro da área interna, acessível pela navegação lateral pelos papéis autorizados.
- **FR-002**: O acesso à tela e a todas as suas operações (listar, criar, editar, excluir) DEVE ser restrito aos papéis coordenador, membro da Defesa Civil e administrador, validado no servidor a cada operação — não apenas escondendo a tela na navegação.
- **FR-003**: O sistema DEVE listar as habilidades cadastradas de forma paginada, com a paginação resolvida no servidor (a tela nunca carrega a lista completa).
- **FR-004**: A listagem DEVE exibir, para cada habilidade, o nome, a quantidade de voluntários vinculados e a data de cadastro, ordenada por nome em ordem alfabética por padrão.
- **FR-005**: A listagem DEVE oferecer, por linha, as ações de editar e excluir.
- **FR-006**: Os usuários DEVEM poder cadastrar uma nova habilidade informando apenas o nome, em um formulário apresentado em janela sobreposta sobre a listagem.
- **FR-007**: Os usuários DEVEM poder editar o nome de uma habilidade existente no mesmo formulário, pré-preenchido com o valor atual.
- **FR-008**: O sistema DEVE validar o nome antes de salvar: obrigatório, não vazio após remoção de espaços nas pontas, com no mínimo 2 e no máximo 80 caracteres, exibindo mensagens de erro em pt-BR junto ao campo.
- **FR-009**: O sistema DEVE impedir habilidades com nomes duplicados, comparando de forma insensível a maiúsculas/minúsculas e a espaços nas pontas, tanto na criação quanto na edição, e informar o motivo da recusa de forma específica.
- **FR-010**: O sistema DEVE normalizar o nome antes de persistir (remover espaços nas pontas e colapsar espaços internos repetidos).
- **FR-011**: O sistema DEVE exigir confirmação explícita antes de excluir uma habilidade, identificando o registro pelo nome na confirmação.
- **FR-012**: O sistema DEVE recusar a exclusão de habilidade vinculada a pelo menos um voluntário, validado no servidor no momento da exclusão, informando a quantidade de voluntários vinculados e a alternativa (renomear ou remover os vínculos antes). Nenhum vínculo de voluntário é removido por exclusão de habilidade.
- **FR-013**: A listagem DEVE exibir, por habilidade, a quantidade de voluntários vinculados, para que a viabilidade da exclusão fique visível antes de acionar a ação.
- **FR-014**: O sistema DEVE preservar os vínculos entre voluntários e habilidade em qualquer edição de nome.
- **FR-015**: O sistema DEVE informar o resultado de cada operação (criação, edição, exclusão) por meio de notificação de sucesso ou erro em pt-BR.
- **FR-016**: Após qualquer operação bem-sucedida, a listagem e todas as telas que consomem a lista de habilidades (candidatura de voluntário, filtros de alocação) DEVEM refletir o novo estado sem exigir recarga manual da página.
- **FR-017**: Toda criação, edição e exclusão de habilidade DEVE ser registrada na trilha de auditoria, identificando quem executou e o que mudou.
- **FR-018**: A tela DEVE ser utilizável em telas pequenas (celular), com as ações da listagem e o formulário acessíveis sem rolagem horizontal.
- **FR-019**: A tela DEVE apresentar estados explícitos de carregamento, lista vazia e erro de carregamento, com possibilidade de nova tentativa.

### Key Entities

- **Habilidade**: item da lista de referência de competências dos voluntários. Atributos: identificador, nome (único no sistema) e data de cadastro.
- **Vínculo Voluntário–Habilidade**: associação entre um voluntário e uma habilidade que ele declara possuir; é o que dá peso à exclusão de uma habilidade e o que precisa ser preservado na edição.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Uma pessoa autorizada consegue cadastrar uma habilidade nova, do abrir da tela à confirmação de sucesso, em menos de 30 segundos e sem consultar documentação.
- **SC-002**: 100% das alterações na lista de habilidades passam a ser feitas pela tela, eliminando a necessidade de acesso direto ao banco para essa finalidade.
- **SC-003**: A primeira página da listagem aparece pronta para uso em menos de 1 segundo em conexão típica de campo, com até 500 habilidades cadastradas.
- **SC-004**: Nenhum nome duplicado é criado, mesmo com duas pessoas cadastrando o mesmo nome simultaneamente — verificável em teste de concorrência.
- **SC-005**: Nenhuma tentativa de acesso ou operação por papel não autorizado é bem-sucedida, verificável tanto pela navegação quanto por chamada direta à operação.
- **SC-006**: 95% das pessoas autorizadas concluem, na primeira tentativa e sem ajuda, as tarefas de cadastrar, renomear e excluir uma habilidade.
- **SC-007**: Nenhuma exclusão ocorre sem confirmação explícita — verificável por teste de aceitação da tela.
- **SC-008**: Nenhum voluntário perde uma habilidade declarada em consequência da gestão da lista: zero vínculos removidos por exclusão de habilidade, verificável por teste que tenta excluir habilidade vinculada.

## Assumptions

- O pedido cita o perfil "colaborador", que não existe na matriz de atores do sistema (usuário, voluntário, membro da Defesa Civil, coordenador, administrador). Assume-se que corresponde ao papel **coordenador** — os três papéis pedidos formam exatamente o conjunto de papéis de operação interna já usado nas demais telas da área restrita.
- A entidade Habilidade já existe no sistema e é populada pela carga inicial de dados; esta feature expõe sua gestão, não a cria do zero. Nenhum atributo novo (descrição, categoria, situação ativo/inativo) é adicionado — o cadastro segue sendo apenas o nome.
- Busca/filtro por nome e ordenação por outras colunas ficam fora do escopo desta entrega; a ordenação alfabética com paginação é suficiente para o volume esperado (dezenas de habilidades).
- Importação/exportação em massa de habilidades está fora do escopo.
- A gestão de categorias de atividade — a outra lista de referência do sistema, de estrutura idêntica — está fora do escopo desta feature.
- A tela reutiliza os padrões já estabelecidos no sistema para listagens paginadas, formulários em janela sobreposta, notificações de resultado e controle de acesso por papel; não introduz um padrão novo de interface.
- O formulário é apresentado em janela sobreposta em telas grandes; em telas pequenas, segue o mesmo comportamento adotado nas demais telas do sistema.
