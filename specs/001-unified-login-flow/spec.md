# Feature Specification: Fluxo Único de Login

**Feature Branch**: `feat/spec-tasks-implementation`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "preciso alterar o fluxo de login da aplicação. A interface de login deve ser a unica rota publica da aplicação. Caso o usuário acesse a aplicação e não tenha uma seção válida, o sistema deverá redireciona-lo para a página de login. A pagina de login deverá apresentar 3 botões, sendo eles: Acessar com Google, Acessar com Facebook e Usar usuário e Senha. Ao clicar nos botões de login via provider como do google ou facebook, o fluxo deve ser o mesmo de hoje, caso o usuário acione o botão "Usar usuário e senha", o sistema deverá mudar a renderização para os campos de usuário e senha, com os botões de voltar e acessar logo abaixo."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acesso sem sessão válida é redirecionado ao login (Priority: P1)

Qualquer pessoa (voluntário, coordenador, membro da Defesa Civil ou visitante) que tente
acessar qualquer rota da aplicação sem possuir uma sessão válida é automaticamente
redirecionada para a página de login, que passa a ser a única rota pública do sistema.

**Why this priority**: É a mudança estrutural central pedida — sem isso, o restante do
fluxo (botões de escolha de método) não tem efeito prático, já que hoje pode existir mais
de uma rota pública. Sem esse comportamento a aplicação não está em conformidade com o
requisito de segurança solicitado.

**Independent Test**: Acessar, sem estar autenticado, qualquer URL da aplicação (a raiz,
uma rota de painel, uma rota profunda qualquer) e confirmar que o usuário sempre termina na
página de login, nunca vendo conteúdo interno.

**Acceptance Scenarios**:

1. **Given** um visitante sem sessão ativa, **When** ele acessa a URL raiz da aplicação,
   **Then** o sistema o redireciona para a página de login.
2. **Given** um visitante sem sessão ativa, **When** ele tenta acessar diretamente uma URL
   interna da aplicação (por exemplo, um link de painel salvo anteriormente), **Then** o
   sistema o redireciona para a página de login em vez de exibir a página solicitada ou um
   erro.
3. **Given** um usuário cuja sessão expirou (ex.: timeout de inatividade), **When** ele tenta
   navegar para qualquer rota, **Then** o sistema o redireciona para a página de login.

---

### User Story 2 - Escolha do método de acesso na tela de login (Priority: P1)

Ao chegar à página de login, o usuário vê três opções de acesso, apresentadas como botões:
"Acessar com Google", "Acessar com Facebook" e "Usar usuário e senha".

**Why this priority**: É o segundo pedido explícito do usuário e a porta de entrada de todo
login — sem as três opções visíveis e funcionais, ninguém consegue entrar na aplicação.

**Independent Test**: Abrir a página de login sem estar autenticado e verificar que os três
botões estão visíveis, legíveis e habilitados antes de qualquer interação.

**Acceptance Scenarios**:

1. **Given** a página de login carregada, **When** o usuário a visualiza pela primeira vez,
   **Then** os três botões ("Acessar com Google", "Acessar com Facebook", "Usar usuário e
   senha") são exibidos, e nenhum campo de usuário/senha é exibido ainda.
2. **Given** a página de login, **When** o usuário clica em "Acessar com Google", **Then** o
   sistema inicia o mesmo fluxo de autenticação social com Google já existente na aplicação
   hoje, sem alterações de comportamento.
3. **Given** a página de login, **When** o usuário clica em "Acessar com Facebook", **Then**
   o sistema inicia o mesmo fluxo de autenticação social com Facebook já existente na
   aplicação hoje, sem alterações de comportamento.

---

### User Story 3 - Login com usuário e senha via alternância de tela (Priority: P2)

Ao clicar em "Usar usuário e senha", a página de login troca sua renderização para exibir os
campos de usuário (e-mail) e senha, junto com dois botões: "Voltar" e "Acessar".

**Why this priority**: Depende da tela inicial (User Story 2) existir primeiro; é o caminho
alternativo de acesso para quem não usa login social, portanto essencial, mas construído em
cima da User Story 2.

**Independent Test**: Na página de login, clicar em "Usar usuário e senha" e verificar que a
tela muda para o formulário de credenciais, sem navegar para uma URL diferente, e que é
possível voltar à tela dos três botões.

**Acceptance Scenarios**:

1. **Given** a página de login mostrando os três botões, **When** o usuário clica em "Usar
   usuário e senha", **Then** a tela substitui os três botões pelos campos de e-mail e senha,
   com os botões "Voltar" e "Acessar" logo abaixo dos campos.
2. **Given** a tela de credenciais (e-mail/senha) exibida, **When** o usuário clica em
   "Voltar", **Then** a tela retorna à exibição inicial com os três botões, descartando
   qualquer valor já digitado nos campos.
3. **Given** a tela de credenciais exibida com e-mail e senha válidos preenchidos, **When** o
   usuário clica em "Acessar", **Then** o sistema autentica o usuário usando o mesmo fluxo de
   login por usuário/senha já existente na aplicação hoje e, em caso de sucesso, o leva à
   área correspondente ao seu papel.
4. **Given** a tela de credenciais exibida, **When** o usuário submete e-mail ou senha
   inválidos, **Then** o sistema exibe mensagem de erro apropriada e mantém o usuário na tela
   de credenciais (não retorna automaticamente à tela dos três botões).

---

### Edge Cases

- O que acontece se o usuário já estiver autenticado e tentar acessar a página de login
  diretamente? O sistema deve redirecioná-lo para a área correspondente ao seu papel, em vez
  de exibir novamente o login.
- O que acontece se o usuário clicar em "Acessar com Google" ou "Acessar com Facebook"
  enquanto a tela de credenciais (e-mail/senha) está visível? O sistema deve tratar isso como
  qualquer clique válido nesses botões, iniciando o fluxo social correspondente (os botões
  sociais deixam de aparecer apenas na tela de credenciais, mas continuam existindo na tela
  inicial de login).
- O que acontece se a autenticação social (Google/Facebook) falhar ou for cancelada pelo
  usuário no provedor? O sistema deve retornar o usuário à página de login (tela inicial de
  três botões) com uma mensagem de erro, sem deixá-lo em estado intermediário.
- O que acontece se o usuário chegar à página de login já com um destino pretendido (ex.:
  tentou acessar uma rota interna específica antes de ser redirecionado)? Após autenticar com
  sucesso, o sistema deve levá-lo à área apropriada ao seu papel; retornar ao destino original
  é desejável quando aplicável, mas não obrigatório para este fluxo.
- O que acontece com as rotas de callback dos provedores sociais (Google/Facebook) e outras
  rotas técnicas indispensáveis para o próprio processo de autenticação? Essas rotas
  continuam acessíveis sem sessão, pois são parte do mecanismo de login em si — a exigência
  de "única rota pública" se refere às páginas navegáveis pelo usuário, não aos endpoints
  técnicos do próprio fluxo de autenticação.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST tratar a página de login como a única rota navegável
  publicamente da aplicação — nenhuma outra página de conteúdo é acessível sem sessão válida.
- **FR-002**: O sistema MUST redirecionar qualquer requisição de navegação, para qualquer
  rota que não seja a página de login (ou os endpoints técnicos do próprio fluxo de
  autenticação), feita sem sessão válida, para a página de login.
- **FR-003**: O sistema MUST redirecionar para a página de login também quando uma sessão
  existente deixar de ser válida (ex.: expiração, timeout de inatividade), no próximo
  acesso a uma rota protegida.
- **FR-004**: A página de login MUST exibir, em seu estado inicial, exatamente três opções
  de acesso: "Acessar com Google", "Acessar com Facebook" e "Usar usuário e senha".
- **FR-005**: O sistema MUST iniciar, ao clicar em "Acessar com Google" ou "Acessar com
  Facebook", o mesmo fluxo de autenticação social hoje existente na aplicação, sem alterar
  seu comportamento.
- **FR-006**: O sistema MUST, ao clicar em "Usar usuário e senha", substituir a exibição dos
  três botões pelos campos de e-mail e senha, seguidos pelos botões "Voltar" e "Acessar",
  permanecendo na mesma página de login (sem navegação para outra URL).
- **FR-007**: O sistema MUST, ao clicar em "Voltar" na tela de credenciais, retornar à
  exibição inicial com os três botões.
- **FR-008**: O sistema MUST, ao clicar em "Acessar" com credenciais válidas, autenticar o
  usuário usando o mesmo fluxo de login por usuário/senha hoje existente na aplicação.
- **FR-009**: O sistema MUST exibir mensagem de erro compreensível e manter o usuário na tela
  de credenciais quando e-mail ou senha informados forem inválidos.
- **FR-010**: O sistema MUST redirecionar um usuário já autenticado que acessar a página de
  login para a área correspondente ao seu papel, em vez de exibir novamente as opções de
  login.
- **FR-011**: O sistema MUST manter a página de login e suas mensagens em Português
  Brasileiro (pt-BR), consistente com o restante da aplicação.

### Key Entities

- **Sessão**: Representa o estado de autenticação de um usuário; possui validade (pode
  expirar ou ser encerrada) e determina se o acesso a rotas protegidas é permitido.
- **Usuário**: Pessoa que acessa a aplicação; autentica-se via provedor social (Google,
  Facebook) ou via credenciais próprias (e-mail e senha); após autenticado, é direcionado à
  área correspondente ao seu papel na aplicação.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das tentativas de acesso a rotas internas sem sessão válida resultam em
  redirecionamento para a página de login (nenhuma página de conteúdo é exposta sem
  autenticação).
- **SC-002**: Um usuário consegue alternar entre a tela de opções de login e a tela de
  usuário/senha (ida e volta) em menos de 2 cliques, sem sair da página de login.
- **SC-003**: 100% dos logins via Google, Facebook ou usuário/senha bem-sucedidos levam o
  usuário à área correspondente ao seu papel, sem etapas manuais adicionais.
- **SC-004**: Usuários relatam não encontrar nenhuma outra tela de login ou ponto de entrada
  divergente na aplicação além desta página única.

## Assumptions

- Os fluxos de autenticação social (Google, Facebook) e de autenticação por usuário/senha já
  existentes na aplicação continuam funcionando como estão hoje; esta feature altera apenas
  a apresentação/entrada (única página de login, com alternância de tela) e a regra de rota
  pública única, não a lógica de autenticação em si.
- "Área correspondente ao seu papel" após login segue a segmentação de papéis já definida na
  aplicação (ex.: voluntário, coordenador, membro da Defesa Civil, administrador); esta
  feature não introduz novos papéis.
- Endpoints técnicos estritamente necessários ao próprio mecanismo de autenticação (ex.:
  callback de OAuth dos provedores sociais) permanecem acessíveis sem sessão, pois fazem
  parte do processo de login e não são "conteúdo" da aplicação.
- Retornar o usuário ao destino originalmente pretendido após o login (deep-link redirect) é
  um comportamento desejável, mas não é um requisito obrigatório desta feature — o requisito
  obrigatório é apenas chegar à área correspondente ao papel do usuário.
