# Feature Specification: Gestão de Usuários

**Feature Branch**: `006-user-management-page`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "preciso que seja criado uma nova pagina onde deve listar todos os usuários que estão cadastrados na aplicação no formato de DataTable com paginação server-side. Essa interface deve permitir realizar o cadastro de novos usuários através de um dialog/drawer(mobile) via formulário com react-hook-form, solicitando somente os campos necessários para adicionar um usuário como nome, email, senha, role, etc. Essa interface vai ser disponibilizada apenas para desenvolvedores. No dataTable tem que ter a ação de editar um usuário, abrindo no mesmo dialog/drawer, já com os dados preenchidos, permitindo apenas alterar o nome e a role."

## Resumo

Hoje não existe nenhuma tela para visualizar ou administrar a lista completa de contas cadastradas no sistema — criar uma conta com um papel específico (por exemplo, para dar acesso de coordenação a alguém sem passar pelo fluxo de candidatura de voluntário) depende de acesso direto ao banco de dados.

Esta feature cria uma tela de gestão de usuários: uma listagem paginada de todas as contas, com a possibilidade de cadastrar uma nova conta (nome, e-mail, senha e papel) e de editar o nome e o papel de uma conta já existente. O acesso a esta tela é restrito a contas com o papel `administrador` — não existe hoje (nem esta feature cria) um papel "desenvolvedor" separado na matriz de atores do sistema (`usuário`, `voluntário`, `membro da Defesa Civil`, `coordenador`, `administrador`); "desenvolvedores", no pedido original, corresponde na prática a quem já tem o papel de maior privilégio.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Consultar a lista de usuários cadastrados (Priority: P1)

Uma pessoa com acesso a esta tela precisa ver quem tem conta no sistema — nome, e-mail e papel de cada pessoa — sem precisar consultar o banco de dados diretamente.

**Why this priority**: É a base de qualquer outra ação da tela; sem uma listagem confiável, cadastrar ou editar não têm como ser feitos com segurança (a pessoa precisa achar o registro certo primeiro).

**Independent Test**: Pode ser testado acessando a tela e confirmando que a lista mostra contas reais do sistema, distribuídas em páginas, sem precisar carregar todas de uma vez.

**Acceptance Scenarios**:

1. **Given** existem mais contas cadastradas do que cabem em uma página, **When** a pessoa abre a tela de gestão de usuários, **Then** ela vê a primeira página da lista e consegue navegar para as páginas seguintes.
2. **Given** a pessoa está em qualquer página da lista, **When** ela avança ou volta de página, **Then** a tela mostra o conjunto correto de contas para aquela página, sem duplicar nem pular registros.

---

### User Story 2 - Cadastrar uma nova conta (Priority: P1)

Uma pessoa com acesso a esta tela precisa criar uma conta para alguém que ainda não tem uma, definindo o nome, e-mail, senha inicial e papel dessa pessoa.

**Why this priority**: É a razão de existir da tela — sem ela, criar uma conta com um papel específico continua exigindo acesso direto ao banco de dados, o problema que a feature resolve.

**Independent Test**: Pode ser testado abrindo o formulário de cadastro, preenchendo nome, e-mail, senha e papel, confirmando e verificando que a nova conta aparece na listagem com os dados informados.

**Acceptance Scenarios**:

1. **Given** a pessoa está na tela de gestão de usuários, **When** ela aciona a ação de cadastrar uma nova conta, **Then** um formulário aparece (como diálogo em telas maiores, como painel em telas mobile) pedindo nome, e-mail, senha e papel.
2. **Given** o formulário de cadastro preenchido com dados válidos, **When** a pessoa confirma, **Then** a nova conta é criada, o formulário fecha, e a conta passa a aparecer na listagem.
3. **Given** o formulário de cadastro, **When** a pessoa informa um e-mail que já pertence a outra conta, **Then** o cadastro é rejeitado com uma mensagem clara indicando o motivo, sem criar uma conta duplicada.
4. **Given** o formulário de cadastro, **When** a pessoa deixa um campo obrigatório vazio ou informa uma senha que não atende aos critérios mínimos, **Then** o formulário indica o problema e não envia o cadastro até ser corrigido.

---

### User Story 3 - Editar nome e papel de uma conta existente (Priority: P2)

Uma pessoa com acesso a esta tela precisa corrigir o nome de uma conta ou mudar o papel de alguém (por exemplo, promover uma pessoa de voluntária a coordenadora), sem tocar no e-mail ou na senha dessa conta.

**Why this priority**: É um complemento importante ao cadastro (User Story 2), mas o sistema já entrega valor sem ela — cadastrar continua sendo o uso mais frequente.

**Independent Test**: Pode ser testado escolhendo a ação de editar em uma conta da listagem, confirmando que o formulário abre com nome e papel já preenchidos, alterando um deles e confirmando que a listagem reflete a mudança.

**Acceptance Scenarios**:

1. **Given** a pessoa está na listagem, **When** ela aciona a ação de editar em uma conta específica, **Then** o mesmo formulário de nome/papel abre (diálogo ou painel, conforme o tamanho de tela), já preenchido com o nome e o papel atuais dessa conta.
2. **Given** o formulário de edição aberto, **When** a pessoa altera o nome e/ou o papel e confirma, **Then** a conta é atualizada e a listagem passa a mostrar os novos valores.
3. **Given** o formulário de edição aberto, **Then** os campos de e-mail e senha não são exibidos como editáveis — a edição está limitada a nome e papel.

### Edge Cases

- O que acontece se duas pessoas tentarem editar a mesma conta ao mesmo tempo? A última confirmação bem-sucedida prevalece; não há bloqueio de edição concorrente nesta versão.
- O que acontece se a pessoa tentar editar ou alterar o papel da própria conta enquanto estiver com a sessão aberta nesta tela? Não há restrição: qualquer papel da matriz de atores, incluindo `administrador`, pode ser atribuído a qualquer conta a partir desta tela, inclusive à própria conta de quem está editando — a única salvaguarda é o controle de acesso à tela em si (FR-003).
- O que acontece se a lista de usuários estiver vazia (nenhuma conta cadastrada)? A tela mostra uma mensagem indicando que não há contas, sem quebrar a paginação.
- O que acontece se a pessoa cancelar o formulário de cadastro ou edição no meio do preenchimento? O formulário fecha sem salvar nada, e a listagem permanece como estava.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema DEVE exibir uma listagem de todas as contas cadastradas na aplicação, mostrando ao menos nome, e-mail e papel de cada uma.
- **FR-002**: O sistema DEVE paginar a listagem no servidor — cada página solicitada retorna apenas o conjunto de contas correspondente, não a lista inteira.
- **FR-003**: O sistema DEVE restringir o acesso a esta tela a contas com o papel `administrador` — nenhum outro papel da matriz de atores pode acessá-la.
- **FR-004**: O sistema DEVE permitir cadastrar uma nova conta informando nome, e-mail, senha e papel.
- **FR-005**: O sistema DEVE apresentar o formulário de cadastro como diálogo em telas maiores e como painel (drawer) em telas mobile.
- **FR-006**: O sistema DEVE impedir o cadastro de uma conta com e-mail já usado por outra conta existente, informando o motivo da rejeição.
- **FR-007**: O sistema DEVE validar que todos os campos obrigatórios do cadastro (nome, e-mail, senha, papel) foram preenchidos e que a senha atende a critérios mínimos de segurança antes de criar a conta.
- **FR-008**: O sistema DEVE permitir editar o nome e o papel de uma conta já cadastrada, a partir de uma ação disponível na listagem.
- **FR-009**: O sistema DEVE reutilizar o mesmo formulário (diálogo/painel) para cadastro e edição, preenchendo os campos com os dados atuais da conta quando a ação for de edição.
- **FR-010**: O sistema NÃO DEVE permitir alterar e-mail ou senha de uma conta existente a partir do formulário de edição desta tela.
- **FR-011**: O sistema DEVE atualizar a listagem imediatamente após um cadastro ou edição bem-sucedidos, refletindo os novos dados sem exigir um recarregamento manual da página.
- **FR-012**: O sistema DEVE permitir cancelar o formulário de cadastro ou edição sem persistir nenhuma alteração.

### Key Entities

- **Conta de usuário**: representa uma pessoa com acesso ao sistema. Atributos relevantes a esta feature: nome, e-mail (identificador único de login), senha (definida no cadastro, não editável nesta tela), papel (define o nível de acesso). Já existe no sistema — esta feature adiciona uma superfície de administração sobre ela, não um novo tipo de dado.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Uma pessoa com acesso à tela consegue localizar qualquer conta cadastrada navegando pela listagem paginada, sem precisar de acesso direto ao banco de dados.
- **SC-002**: Uma nova conta com papel específico pode ser criada em menos de 1 minuto, do início do preenchimento do formulário até ela aparecer na listagem.
- **SC-003**: 100% das tentativas de cadastro com e-mail duplicado ou campos obrigatórios ausentes são rejeitadas com uma mensagem clara, sem gerar conta inconsistente.
- **SC-004**: 100% das edições de nome/papel feitas por esta tela refletem corretamente na listagem, sem nunca alterar e-mail ou senha da conta editada.

## Assumptions

- "Desenvolvedores", no pedido original, é tratado como equivalente ao papel `administrador` já existente — decisão do stakeholder, não um papel novo. Quem hoje é `administrador` passa a ter acesso a esta tela.
- Não há restrição sobre quais papéis podem ser atribuídos a partir desta tela — decisão explícita do stakeholder: qualquer papel pode ser concedido a qualquer conta, inclusive `administrador` e inclusive à própria conta de quem está editando. O único controle é o acesso à tela em si (FR-003).
- A listagem cobre contas de todos os papéis do sistema (não só perfis de staff) — a tela é uma ferramenta administrativa geral sobre a base de contas, não uma extensão da navegação por papel de negócio.
- Não há, nesta versão, ação de excluir ou desativar uma conta a partir desta tela — apenas listar, cadastrar e editar nome/papel, como descrito no pedido original.
- Não há exigência de que a pessoa recém-cadastrada troque a senha no primeiro acesso — a senha definida no formulário de cadastro é a senha válida da conta até que a própria pessoa a altere por outro meio já existente no sistema.
- Critérios mínimos de senha seguem o mesmo padrão já usado no cadastro de contas em outras partes do sistema, sem uma política nova específica para esta tela.
- Colunas exibidas na listagem (nome, e-mail, papel) podem ser complementadas com outras informações não sensíveis já existentes na conta (por exemplo, data de criação), a critério da fase de planejamento, desde que não substituam as três colunas centrais.
