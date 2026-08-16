# Feature Specification: Auto-cadastro por provedor externo e pré-preenchimento da candidatura

**Feature Branch**: `011-auto-cadastro-provedor`

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "ao realizar o login na aplicacao utilizando um provedor como o google ou facebook, ao realizar o login o usuario deve ser cadastrado automaticamente no banco de dados, usando as informacoes basicas como nome, email e data de nascimento. O objetivo eh realizar um auto-cadastro de usuario atraves do login via provedor externo. Apos isso, o cadastro de voluntario deve ser alterado, carregando dados do formulario como nome, data de nascimento e email automaticamente, deixando esses campos desabilitados no formulario."

## Resumo

Hoje, quem entra no sistema pela primeira vez por Google ou Facebook já tem uma conta criada automaticamente com nome e e-mail. Mas a conta não guarda **data de nascimento** em lugar nenhum: esse dado só existe depois, digitado manualmente no formulário de candidatura a voluntário — e redigitado a cada reenvio. O formulário também não exibe o e-mail da conta, então o candidato não tem como saber sob qual conta está se candidatando.

Esta feature faz três coisas:

1. **Completa o auto-cadastro**: a conta passa a ter um campo de **data de nascimento**, criado em branco no primeiro acesso e preenchido na primeira candidatura enviada.
2. **Pré-preenche a candidatura**: o formulário passa a carregar **nome completo, data de nascimento e e-mail** da conta do usuário autenticado.
3. **Trava o que não deve ser digitado**: **e-mail** fica sempre desabilitado; **data de nascimento** fica desabilitada assim que a conta já a possui; **nome completo** vem pré-preenchido mas permanece editável.

O valor é menos digitação em um formulário longo, preenchido frequentemente pelo celular e sob estresse, e uma data de nascimento que passa a ser informada uma única vez, com origem rastreável na conta.

### Decisões de escopo

**A data de nascimento não é solicitada aos provedores externos.** Google e Facebook não entregam esse dado nas permissões básicas — exigem escopo adicional, processo de revisão do lado do provedor, e ainda assim o usuário pode recusar ou ter o ano oculto no perfil. Adicionar essa dependência para um dado que o candidato informa uma única vez não se paga. A conta é criada com nome e e-mail; a data de nascimento entra pela primeira candidatura (FR-016) e, a partir daí, vem pré-preenchida e bloqueada.

**O nome completo continua editável.** O nome trazido por Google e Facebook é com frequência apelido ou nome parcial ("Ju Oliveira"), enquanto a candidatura exige nome civil que confira com o CPF na triagem. Travar esse campo empurraria a correção para a fila da Defesa Civil. O campo é pré-preenchido com o nome da conta e o candidato corrige quando necessário — o nome gravado na candidatura é o que ele confirmou, e a conta mantém o nome de exibição vindo do provedor.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Entrar pela primeira vez e ter a conta criada (Priority: P1)

Como morador que quer ajudar, entro no sistema pela primeira vez usando minha conta Google (ou Facebook). Não quero preencher formulário de cadastro nenhum: quero autorizar o provedor e já estar dentro do sistema, com meu nome e e-mail registrados na minha conta.

**Why this priority**: é a fundação. Sem a conta criada e com os dados básicos guardados, não há nada para pré-preencher na história 2. Entregue sozinha, já reduz atrito na porta de entrada do sistema.

**Independent Test**: pode ser testada isoladamente entrando com uma conta de provedor nunca usada antes no sistema e verificando, na área administrativa de usuários, que a conta foi criada com nome e e-mail — sem que nenhuma tela de cadastro tenha sido exibida.

**Acceptance Scenarios**:

1. **Given** um visitante sem conta no sistema, **When** conclui o login por um provedor externo, **Then** a conta é criada automaticamente com o nome e o e-mail informados pelo provedor, com data de nascimento em branco, e o visitante entra no sistema já autenticado, sem passar por formulário de cadastro.
2. **Given** uma pessoa que já possui conta criada por login social, **When** entra novamente pelo mesmo provedor, **Then** nenhuma conta duplicada é criada e a sessão é aberta na conta existente.
3. **Given** uma pessoa que já possui conta criada com e-mail e senha, **When** entra pela primeira vez por um provedor externo usando o **mesmo endereço de e-mail**, **Then** o sistema **não** cria uma segunda conta e recusa o acesso por provedor com mensagem clara orientando a entrar com e-mail e senha.
4. **Given** uma conta recém-criada por provedor externo, **When** a criação é concluída, **Then** o nível de acesso atribuído é o de usuário comum — entrar por Google ou Facebook nunca concede acesso de voluntário, membro da Defesa Civil, coordenador ou administrador.
5. **Given** um visitante na tela de login, **When** vê os botões de acesso por provedor externo, **Then** a tela informa quais dados serão obtidos do provedor (nome e e-mail) e para que serão usados, antes do redirecionamento.

---

### User Story 2 - Candidatar-se a voluntário sem redigitar dados que o sistema já tem (Priority: P1)

Como usuário autenticado que decidiu se candidatar a voluntário, abro o formulário de candidatura e encontro meu **e-mail** exibido e bloqueado, meu **nome completo** já preenchido (podendo corrigir se o provedor tiver trazido um apelido) e, se eu já tiver me candidatado antes, minha **data de nascimento** preenchida e bloqueada. Preencho apenas o que falta e envio.

**Why this priority**: é o objetivo declarado da feature e a parte visível para o candidato. Junto com a história 1 forma o MVP; é testável de forma independente usando qualquer conta autenticada, inclusive contas criadas antes desta feature.

**Independent Test**: pode ser testada isoladamente abrindo o formulário de candidatura com uma conta autenticada e verificando que os três campos aparecem preenchidos com os dados da conta, com os estados de habilitação corretos, e que a candidatura é registrada com esses valores.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado, **When** abre o formulário de candidatura, **Then** o e-mail da conta aparece exibido e desabilitado, deixando claro sob qual conta a candidatura será registrada.
2. **Given** um usuário autenticado, **When** abre o formulário, **Then** o campo nome completo aparece preenchido com o nome da conta e **permanece editável**.
3. **Given** um usuário cujo provedor trouxe um apelido no lugar do nome civil, **When** corrige o campo nome completo e envia, **Then** a candidatura é registrada com o nome corrigido, e o nome de exibição da conta permanece inalterado.
4. **Given** um usuário cuja conta **não** tem data de nascimento registrada, **When** abre o formulário, **Then** o campo de data de nascimento aparece vazio, **habilitado e obrigatório**.
5. **Given** um usuário que preencheu a data de nascimento e enviou a candidatura com sucesso, **When** a candidatura é registrada, **Then** a data informada passa a constar também na conta.
6. **Given** um usuário cuja conta **já tem** data de nascimento registrada, **When** abre o formulário, **Then** o campo aparece preenchido com o valor da conta e **desabilitado**.
7. **Given** o formulário com campos desabilitados, **When** o usuário envia a candidatura, **Then** o sistema usa o e-mail e a data de nascimento da conta, desconsiderando quaisquer valores recebidos do navegador para esses campos.
8. **Given** um candidato que já teve a candidatura rejeitada e reenvia uma nova, **When** abre o formulário, **Then** e-mail, nome e data de nascimento seguem as mesmas regras acima, e os demais campos aparecem preenchidos com os valores da candidatura anterior para revisão.
9. **Given** um usuário com menos de 18 anos segundo a data de nascimento, **When** tenta enviar a candidatura, **Then** o envio é recusado com a mensagem de idade mínima já existente — o pré-preenchimento não contorna a regra de maioridade.

---

### Edge Cases

- **Provedor não informa e-mail**: sem e-mail não há como identificar a conta de forma única nem contatar o candidato; o login é recusado com mensagem clara orientando a usar outro meio de acesso.
- **Nome do provedor vazio ou com apenas um termo**: a conta é criada normalmente; o candidato completa o nome no formulário, que continua sujeito à exigência de nome completo já existente.
- **Data de nascimento inválida ou futura digitada na candidatura**: recusada pela validação já existente do formulário e nunca gravada na conta.
- **Mesma pessoa entra por Google e depois por Facebook com o mesmo e-mail**: a segunda entrada é recusada com mensagem clara em vez de criar conta duplicada, pelo mesmo motivo do caso conta-com-senha — a vinculação automática entre credenciais distintas exige e-mail verificado localmente, o que o sistema ainda não faz. Não há perda de dados: a conta original permanece acessível pelo provedor original.
- **Pessoa altera o nome no provedor depois de já ter conta**: o nome da conta no sistema não é sobrescrito automaticamente a cada login — o dado de identificação de um voluntário aprovado não pode mudar sem rastro.
- **Data de nascimento já registrada na conta e candidatura reenviada**: o campo permanece bloqueado e a conta não é atualizada de novo — a data é gravada uma única vez, na primeira candidatura que a informa.
- **Candidatura já aprovada**: o comportamento atual permanece — o reenvio é recusado com a mensagem existente, e o pré-preenchimento não abre uma nova via para alterar dados de um voluntário já aprovado.
- **Envio com campos desabilitados manipulados**: campos desabilitados no navegador não são garantia de nada; o sistema desconsidera os valores recebidos para e-mail e data de nascimento bloqueada e usa sempre os da conta.
- **Contas criadas antes desta feature**: não possuem data de nascimento; comportam-se como qualquer conta que ainda não se candidatou (campo editável e obrigatório).
- **Contas criadas por e-mail e senha**: seguem exatamente o mesmo comportamento no formulário — o pré-preenchimento não depende de a conta ter origem em provedor externo.
- **Conta desativada**: o login segue as regras de acesso já existentes; esta feature não altera o tratamento de contas inativas.

## Requirements _(mandatory)_

### Functional Requirements

#### Auto-cadastro por provedor externo

- **FR-001**: O sistema MUST criar automaticamente a conta de quem entra pela primeira vez por um provedor externo, sem exibir formulário de cadastro.
- **FR-002**: O sistema MUST registrar na conta criada o nome e o e-mail informados pelo provedor.
- **FR-003**: A conta MUST possuir um campo de data de nascimento, opcional, criado em branco no auto-cadastro.
- **FR-004**: O sistema MUST NOT solicitar data de nascimento aos provedores externos — as permissões pedidas ficam restritas a nome e e-mail.
- **FR-005**: O sistema MUST reconhecer como a mesma pessoa quem retorna por um provedor externo já vinculado à sua conta, abrindo a sessão existente.
- **FR-005a**: O sistema MUST NOT criar uma segunda conta quando o e-mail devolvido pelo provedor já pertence a uma conta existente; quando a vinculação automática não for permitida, o acesso é recusado com mensagem em pt-BR orientando o meio de entrada correto — nunca com erro genérico de autenticação.
- **FR-006**: O sistema MUST atribuir a toda conta criada por provedor externo o nível de acesso de usuário comum, nunca um nível elevado.
- **FR-007**: O sistema MUST recusar o login com mensagem clara quando o provedor não fornecer e-mail.
- **FR-008**: O sistema MUST NOT sobrescrever automaticamente, em logins subsequentes, o nome já registrado na conta.
- **FR-009**: O sistema MUST registrar em auditoria a criação automática de conta por provedor externo, identificando o provedor de origem.
- **FR-010**: A tela de login MUST informar quais dados serão obtidos do provedor e para que serão usados, antes do redirecionamento.

#### Pré-preenchimento do formulário de candidatura

- **FR-011**: O formulário de candidatura MUST exibir e-mail, nome completo e data de nascimento carregados da conta do usuário autenticado.
- **FR-012**: O formulário MUST apresentar o campo de e-mail sempre desabilitado (visível e legível, não editável).
- **FR-013**: O formulário MUST apresentar o campo nome completo pré-preenchido com o nome da conta e **editável**.
- **FR-014**: O formulário MUST apresentar a data de nascimento desabilitada quando a conta já a possuir, e vazia, habilitada e obrigatória quando não possuir.
- **FR-015**: O formulário MUST deixar visualmente evidente que os campos desabilitados vêm da conta do usuário, e não que estão indisponíveis por erro.
- **FR-016**: O sistema MUST gravar na conta a data de nascimento informada na candidatura, quando a conta ainda não a possuía, de modo que a partir daí o campo passe a vir pré-preenchido e bloqueado.
- **FR-017**: O sistema MUST usar sempre os valores da conta para e-mail e para data de nascimento já registrada, desconsiderando valores recebidos do navegador para esses campos.
- **FR-018**: O sistema MUST registrar na candidatura o nome completo confirmado pelo usuário no formulário, sem alterar o nome de exibição da conta.
- **FR-019**: O e-mail MUST ser exibido apenas para conferência, permanecendo vinculado à conta e não duplicado no cadastro de candidatura.
- **FR-020**: O sistema MUST continuar aplicando todas as regras de validação já existentes da candidatura — nome completo obrigatório, maioridade, CPF válido e único, telefone, CEP, disponibilidade mínima e tipo de veículo condicional.
- **FR-021**: O sistema MUST manter o comportamento atual de reenvio de candidatura rejeitada e de recusa de reenvio de candidatura já aprovada.
- **FR-022**: Os campos desabilitados MUST permanecer legíveis e com contraste adequado nos temas claro e escuro, e acessíveis a leitores de tela como campos de somente leitura.

### Key Entities

- **Conta de usuário**: representa a pessoa autenticada no sistema. Passa a guardar, além de nome, e-mail, nível de acesso e situação (ativa/inativa), a **data de nascimento** — opcional, preenchida na primeira candidatura enviada. É a fonte de verdade para e-mail e data de nascimento.
- **Vínculo com provedor externo**: registro de que uma conta acessa o sistema por Google ou Facebook. Já existe; esta feature não altera sua estrutura.
- **Candidatura a voluntário**: dados que a pessoa envia para se tornar voluntária (nome completo, CPF, telefone, endereço, profissão, restrições de saúde, veículo, disponibilidade, habilidades). A data de nascimento passa a ser **derivada da conta** após o primeiro envio; o nome permanece um dado próprio da candidatura, apenas pré-preenchido a partir da conta.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Uma pessoa sem conta consegue entrar no sistema por provedor externo em menos de 30 segundos e sem preencher nenhum campo de formulário.
- **SC-002**: 100% dos logins por provedor externo que retornam e-mail resultam em conta criada ou reconhecida.
- **SC-003**: No primeiro envio de candidatura, o candidato deixa de digitar o e-mail e recebe o nome já preenchido; em qualquer envio seguinte, deixa de digitar também a data de nascimento.
- **SC-004**: O tempo mediano de preenchimento da candidatura por quem entrou via provedor externo cai pelo menos 15% em relação ao fluxo atual.
- **SC-005**: Nenhuma candidatura é registrada com data de nascimento divergente da registrada na conta do autor.
- **SC-006**: Nenhuma conta é criada com nível de acesso acima de usuário comum por meio de login social.
- **SC-007**: Divergências entre nome do candidato e documento, apontadas na triagem, não aumentam em relação ao volume atual.
- **SC-008**: Nenhum consentimento solicitado a Google ou Facebook inclui dados além de nome e e-mail.

## Assumptions

- O login por Google e Facebook já está implementado e em funcionamento; esta feature estende o que a conta guarda e como o formulário de candidatura a consome, sem introduzir os provedores.
- O e-mail é o identificador único de conta no sistema; contas com o mesmo e-mail são a mesma pessoa, independentemente do provedor usado.
- O cadastro por e-mail e senha continua disponível e não é alterado por esta feature; contas criadas por essa via também ganham data de nascimento pela primeira candidatura.
- Contas já existentes não recebem data de nascimento retroativamente — ela é preenchida no próximo envio de candidatura ou permanece em branco.
- Nome de exibição da conta e nome completo da candidatura são dados distintos por decisão: o primeiro é o rótulo social vindo do provedor, o segundo é o nome civil que a triagem confere contra o CPF. A divergência entre eles é esperada e não é erro.
- A data de nascimento é dado pessoal sujeito à LGPD: é coletada apenas para verificação de maioridade e identificação do voluntário, e não é exibida a outros usuários além do próprio titular e da equipe de triagem.
- O formulário de candidatura continua acessível apenas a usuários autenticados.
- Corrigir uma data de nascimento já gravada na conta não é escopo desta feature; até que exista uma tela de perfil, a correção é uma intervenção administrativa.
