# Feature Specification: Redefinição de senha e e-mail somente leitura na edição de conta

**Feature Branch**: `008-admin-password-reset`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "na tela /admin ao editar um usuário, o formulario deve trazer as informações de email como um campo disabled. No rodapé do dialog/drawer deve existir um botão de ação chamado \"Trocar Senha\" que ao ser acionado, exibe um campo de password no formulario que ao ser preenchido é substituido a senha do usuário pela nova senha informada. Essa ação de trocar a senha só pode ser exibida para usuários que foram criados manualmente pela tela /admin, ou seja, os usuários que foram cadastrados via provider Google ou Facebook não devem exibir esse botão de ação."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Ver o e-mail da conta durante a edição (Priority: P1)

Ao abrir a edição de uma conta em `/admin`, a pessoa administradora vê o e-mail da conta no formulário, junto do nome e do papel, mas sem poder alterá-lo. Isso confirma qual conta está sendo editada antes de salvar qualquer mudança.

**Why this priority**: hoje o e-mail simplesmente não aparece na edição, e quem administra precisa confiar na linha da tabela que clicou. É a correção mais barata e entrega valor sozinha, sem depender de nada da troca de senha.

**Independent Test**: abrir a edição de qualquer conta e verificar que o e-mail correto aparece, não é editável, e que salvar nome/papel continua funcionando.

**Acceptance Scenarios**:

1. **Given** uma conta com e-mail `maria@exemplo.com`, **When** a pessoa abre a edição dessa conta, **Then** o campo de e-mail exibe `maria@exemplo.com` e não aceita digitação.
2. **Given** o formulário de edição aberto, **When** a pessoa altera o nome e salva, **Then** a alteração é gravada e o e-mail permanece inalterado.
3. **Given** o formulário de **cadastro** de nova conta, **When** a pessoa o abre, **Then** o campo de e-mail continua editável e obrigatório, como hoje.

---

### User Story 2 - Redefinir a senha de uma conta com senha própria (Priority: P2)

Uma pessoa voluntária perdeu o acesso e liga para a coordenação. A pessoa administradora abre a edição da conta, aciona "Trocar Senha" no rodapé do formulário, digita a nova senha e salva. A pessoa passa a entrar com a senha nova.

**Why this priority**: é o valor central do pedido — resolve um chamado de suporte real —, mas depende do formulário de edição já mostrar corretamente a conta (US1).

**Independent Test**: redefinir a senha de uma conta criada manualmente, sair da sessão e entrar com a nova senha; a senha antiga deixa de funcionar.

**Acceptance Scenarios**:

1. **Given** a edição de uma conta com senha própria, **When** a pessoa abre o formulário, **Then** o rodapé exibe a ação "Trocar Senha" e nenhum campo de senha está visível.
2. **Given** o formulário aberto, **When** a pessoa aciona "Trocar Senha", **Then** um campo de senha aparece no formulário, pronto para preenchimento.
3. **Given** o campo de senha visível e preenchido com uma senha válida, **When** a pessoa salva, **Then** a senha da conta é substituída e uma confirmação é exibida.
4. **Given** a senha foi redefinida, **When** a pessoa titular tenta entrar com a senha **antiga**, **Then** o acesso é negado; com a nova, é permitido.
5. **Given** o campo de senha visível, **When** a pessoa salva sem preencher a senha, **Then** o sistema recusa e informa o que falta — não grava uma senha vazia.
6. **Given** o campo de senha visível e ainda não preenchido, **When** a pessoa desiste e recolhe a ação, **Then** salvar altera apenas nome e papel, sem tocar na senha.
7. **Given** uma senha nova com menos que o mínimo exigido, **When** a pessoa tenta salvar, **Then** a mensagem indica o requisito e nada é gravado.

---

### User Story 3 - Não oferecer troca de senha para contas de provedor externo (Priority: P2)

Contas que entram pelo Google ou pelo Facebook não têm senha neste sistema. Para elas, a ação "Trocar Senha" simplesmente não aparece, evitando que a administração prometa algo que não existe.

**Why this priority**: sem isso, a US2 cria uma armadilha — a ação apareceria para todas as contas e falharia, ou pior, criaria uma senha para uma conta que só deveria entrar pelo provedor externo. Mesma prioridade da US2 porque as duas precisam existir juntas para o resultado ser correto.

**Independent Test**: abrir a edição de uma conta criada por login Google e verificar que o rodapé não oferece "Trocar Senha", enquanto uma conta criada manualmente oferece.

**Acceptance Scenarios**:

1. **Given** uma conta criada por login Google, **When** a pessoa abre sua edição, **Then** a ação "Trocar Senha" não é exibida.
2. **Given** uma conta criada por login Facebook, **When** a pessoa abre sua edição, **Then** a ação "Trocar Senha" não é exibida.
3. **Given** uma conta criada manualmente em `/admin`, **When** a pessoa abre sua edição, **Then** a ação "Trocar Senha" é exibida.
4. **Given** uma conta de provedor externo, **When** uma tentativa de redefinição de senha chega ao sistema mesmo assim, **Then** ela é recusada — a ausência do botão não é a única proteção.

---

### Edge Cases

- **Conta com acesso por senha e por provedor externo** ao mesmo tempo: a ação é exibida e redefine apenas a senha; o acesso pelo provedor continua funcionando.
- **A conta é excluída ou perde a senha entre abrir o formulário e salvar**: a redefinição é recusada com mensagem clara, sem erro genérico.
- **A pessoa administradora redefine a própria senha**: é permitido; ao final, ela continua com a sessão ativa e passa a usar a nova senha nos próximos acessos.
- **Sessões abertas da pessoa titular** em outros dispositivos: são encerradas após a redefinição, para que uma senha comprometida não continue valendo em uma sessão já aberta.
- **Senha nova igual à atual**: aceita, sem tratamento especial — o sistema não compara com a senha anterior.
- **Falha ao gravar a nova senha**: nome e papel também não são alterados; a pessoa vê o erro e pode tentar de novo, sem estado pela metade.
- **Reabrir o formulário depois de uma redefinição**: o campo de senha volta recolhido e vazio; a senha digitada não é lembrada.
- **Alternar entre editar uma conta com senha e outra de provedor externo** sem fechar o diálogo: a ação aparece/desaparece conforme a conta corrente, e o campo de senha nunca fica preenchido de uma conta para outra.
- **Cadastro de nova conta**: o rodapé não exibe "Trocar Senha" — a senha inicial já é um campo obrigatório do próprio cadastro.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O formulário de **edição** de conta MUST exibir o e-mail da conta.
- **FR-002**: O campo de e-mail na edição MUST ser somente leitura — nenhuma alteração de e-mail é aceita por esta tela.
- **FR-003**: O campo de e-mail no formulário de **cadastro** MUST permanecer editável e obrigatório.
- **FR-004**: O rodapé do formulário de edição MUST exibir uma ação rotulada "Trocar Senha" quando a conta possuir senha própria.
- **FR-005**: A ação "Trocar Senha" MUST NOT ser exibida para contas cujo acesso se dá exclusivamente por provedor externo (Google, Facebook).
- **FR-006**: A ação "Trocar Senha" MUST NOT ser exibida no formulário de cadastro.
- **FR-007**: Ao acionar "Trocar Senha", o sistema MUST revelar um campo de senha no formulário, inicialmente vazio, com o conteúdo mascarado.
- **FR-008**: Enquanto o campo de senha não for revelado, salvar o formulário MUST alterar apenas nome e papel, sem qualquer efeito sobre a senha.
- **FR-009**: Com o campo revelado e preenchido, salvar MUST substituir a senha da conta pela informada.
- **FR-010**: A nova senha MUST atender ao mesmo requisito mínimo já exigido no cadastro de conta.
- **FR-011**: Com o campo revelado e vazio, o sistema MUST recusar o envio com mensagem em português indicando o que falta.
- **FR-012**: A pessoa MUST poder recolher a ação e desistir da troca antes de salvar, voltando ao comportamento de FR-008.
- **FR-013**: O sistema MUST recusar qualquer redefinição de senha destinada a uma conta sem senha própria, independentemente de o botão ter sido exibido.
- **FR-014**: Somente pessoas com perfil de administração MUST poder redefinir a senha de uma conta, com a mesma verificação já aplicada às demais operações desta tela.
- **FR-015**: Alteração de nome/papel e redefinição de senha, quando enviadas juntas, MUST ser aplicadas de forma tudo-ou-nada: se a senha falhar, nada é alterado.
- **FR-016**: Após uma redefinição bem-sucedida, o sistema MUST encerrar as demais sessões ativas da conta afetada.
- **FR-017**: Após uma redefinição bem-sucedida, o sistema MUST exibir uma confirmação e fechar o formulário, como já faz nas demais operações desta tela.
- **FR-018**: O sistema MUST NOT exibir, ecoar ou registrar a senha informada em qualquer lugar além do próprio campo mascarado.
- **FR-019**: A redefinição de senha MUST ser registrada no histórico de auditoria, identificando quem executou e sobre qual conta — sem incluir a senha.
- **FR-020**: Reabrir o formulário de edição MUST apresentar o campo de senha recolhido e vazio.

### Key Entities

- **Conta**: pessoa com acesso ao sistema; possui nome, e-mail e papel. O e-mail identifica a conta e não é alterável por esta tela.
- **Meio de acesso da conta**: forma pela qual a conta entra no sistema — senha própria (criada manualmente em `/admin`) ou provedor externo (Google, Facebook). Uma conta pode ter mais de um. É o que determina se a ação "Trocar Senha" aparece.
- **Sessão ativa**: acesso já aberto da pessoa titular em um dispositivo; encerrado quando a senha é redefinida.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A pessoa administradora confirma qual conta está editando sem sair do formulário, em 100% das aberturas.
- **SC-002**: Um chamado de "esqueci a senha" é resolvido pela administração em menos de 1 minuto, do clique em editar até a confirmação.
- **SC-003**: A ação "Trocar Senha" aparece em 100% das contas com senha própria e em 0% das contas exclusivamente de provedor externo.
- **SC-004**: Nenhuma alteração de e-mail é possível pela tela de edição, verificado por tentativa direta.
- **SC-005**: Após a redefinição, a senha anterior falha em 100% das tentativas de acesso e a nova funciona na primeira tentativa.
- **SC-006**: Nenhuma senha aparece em texto legível na tela, em mensagens de confirmação ou no histórico de auditoria.
- **SC-007**: Toda redefinição de senha é atribuível a uma pessoa administradora identificada no histórico.

## Assumptions

- O requisito mínimo de senha permanece o já adotado no cadastro de conta; esta feature não endurece nem afrouxa a política.
- Não há confirmação de senha (campo repetido) — o campo é único, coerente com o cadastro atual.
- A pessoa titular **não** é obrigada a trocar a senha no próximo acesso; a senha definida pela administração é definitiva até que alguém a mude de novo.
- Notificar a pessoa titular por e-mail sobre a redefinição fica fora desta feature.
- A administração pode redefinir a própria senha por esta tela, desde que sua conta tenha senha própria.
- Encerrar as demais sessões da conta afetada é o comportamento padrão esperado de uma redefinição administrativa; a sessão de quem executou a ação não é encerrada.
- Contas de provedor externo continuam sem meio de definir senha por esta tela — promovê-las a acesso por senha não faz parte do escopo.
- A distinção entre conta com senha e conta de provedor externo já é registrada pelo sistema de autenticação existente e pode ser consultada.

## Out of Scope

- Alteração de e-mail de uma conta existente.
- Fluxo de "esqueci minha senha" iniciado pela própria pessoa titular.
- Envio de e-mail de notificação ou de link de redefinição.
- Exigir troca obrigatória de senha no próximo acesso.
- Vincular ou desvincular provedores externos de uma conta.
- Mudanças na política de complexidade de senha.
