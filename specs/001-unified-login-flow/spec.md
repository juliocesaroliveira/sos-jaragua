# Feature Specification: Fluxo Unificado de Login

**Feature Branch**: `001-unified-login-flow`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "preciso alterar o fluxo de login da aplicação. A interface de login deve ser a única rota publica da aplicação. Caso o usuário acesse a aplicação e não tenha uma seção válida, o sistema deverá redireciona-lo para a página de login. A pagina de login deverá apresentar 3 botões, sendo eles: Acessar com Google, Acessar com Facebook e Usar usuário e Senha. Ao clicar nos botões de login via provider como do google ou facebook, o fluxo deve ser o mesmo de hoje, caso o usuário acione o botão 'Usar usuário e senha', o sistema deverá mudar a renderização para os campos de usuário e senha, com os botões de voltar e acessar logo abaixo."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Redirecionamento para login sem sessão válida (Priority: P1)

Um usuário tenta acessar qualquer rota da aplicação (diretamente pela URL, por link salvo, ou após expiração de sessão) sem possuir uma sessão válida. O sistema o redireciona automaticamente para a página de login, impedindo qualquer acesso a conteúdo ou funcionalidade protegida.

**Why this priority**: É a garantia de segurança fundamental da mudança — sem isso, a página de login isolada não tem efeito prático, pois rotas internas continuariam acessíveis sem autenticação.

**Independent Test**: Acessar, sem sessão ativa (cookie limpo ou sessão expirada), qualquer URL da aplicação diferente da página de login e confirmar que o usuário é redirecionado para `/login` sem ver conteúdo protegido.

**Acceptance Scenarios**:

1. **Given** um usuário sem sessão válida, **When** ele acessa a URL raiz da aplicação, **Then** o sistema o redireciona para a página de login.
2. **Given** um usuário sem sessão válida, **When** ele acessa diretamente uma URL interna protegida (por exemplo, uma tela de gestão de estoque), **Then** o sistema o redireciona para a página de login sem exibir qualquer dado da tela solicitada.
3. **Given** um usuário com sessão expirada durante o uso da aplicação, **When** ele tenta realizar uma nova ação protegida, **Then** o sistema o redireciona para a página de login.
4. **Given** um usuário já autenticado com sessão válida, **When** ele acessa a página de login diretamente, **Then** o sistema o redireciona para a área autenticada em vez de exibir o formulário de login novamente.

---

### User Story 2 - Login via provedor social (Google/Facebook) (Priority: P1)

Um usuário na página de login escolhe autenticar-se com sua conta Google ou Facebook, clicando no botão correspondente. O sistema conduz o mesmo fluxo de autenticação social já existente hoje, e ao final o usuário chega autenticado na aplicação.

**Why this priority**: Preserva o método de acesso mais usado atualmente; qualquer regressão aqui bloqueia o acesso da maioria dos usuários já cadastrados via provedor social.

**Independent Test**: Na página de login, clicar em "Acessar com Google" (ou "Acessar com Facebook") e confirmar que o usuário é levado ao fluxo de autenticação do provedor e, ao concluir com sucesso, retorna autenticado à aplicação — comportamento idêntico ao existente antes desta mudança.

**Acceptance Scenarios**:

1. **Given** a página de login exibida no estado inicial (com os 3 botões), **When** o usuário clica em "Acessar com Google", **Then** o sistema inicia o fluxo de autenticação OAuth do Google, exatamente como ocorre atualmente.
2. **Given** a página de login exibida no estado inicial, **When** o usuário clica em "Acessar com Facebook", **Then** o sistema inicia o fluxo de autenticação OAuth do Facebook, exatamente como ocorre atualmente.
3. **Given** um usuário que concluiu com sucesso a autenticação via provedor social, **When** o provedor retorna o controle à aplicação, **Then** o usuário possui uma sessão válida e é direcionado à área autenticada correspondente ao seu papel.

---

### User Story 3 - Alternância para login com usuário e senha (Priority: P2)

Um usuário na página de login, ao invés de usar um provedor social, clica no botão "Usar usuário e senha". A página muda sua renderização para exibir os campos de usuário e senha, junto com os botões "Voltar" e "Acessar" logo abaixo. Ao clicar em "Voltar", o usuário retorna à visualização inicial com os 3 botões.

**Why this priority**: É um fluxo alternativo de acesso (fallback), relevante para contas sem provedor social vinculado, mas de uso secundário em relação ao login social.

**Independent Test**: Na página de login, clicar em "Usar usuário e senha", confirmar que os campos de usuário/senha e os botões "Voltar"/"Acessar" são exibidos no lugar dos 3 botões iniciais; preencher credenciais válidas e clicar em "Acessar" para confirmar autenticação bem-sucedida; em uma segunda tentativa, clicar em "Voltar" e confirmar o retorno à tela inicial com os 3 botões.

**Acceptance Scenarios**:

1. **Given** a página de login no estado inicial, **When** o usuário clica em "Usar usuário e senha", **Then** o sistema substitui a exibição dos 3 botões pelos campos de usuário e senha e pelos botões "Voltar" e "Acessar".
2. **Given** a página de login exibindo os campos de usuário e senha, **When** o usuário clica em "Voltar", **Then** o sistema retorna à exibição inicial com os 3 botões, sem manter dados preenchidos nos campos.
3. **Given** os campos de usuário e senha preenchidos com credenciais válidas, **When** o usuário clica em "Acessar", **Then** o sistema autentica o usuário e o direciona à área autenticada correspondente ao seu papel.
4. **Given** os campos de usuário e senha preenchidos com credenciais inválidas, **When** o usuário clica em "Acessar", **Then** o sistema exibe uma mensagem de erro clara e mantém o usuário na tela de usuário e senha.

---

### Edge Cases

- O que acontece quando o usuário clica em "Acessar" com os campos de usuário e/ou senha vazios? O sistema deve indicar quais campos são obrigatórios sem submeter a tentativa de autenticação.
- O que acontece se o usuário cancelar ou negar permissão no meio do fluxo OAuth do Google/Facebook? O sistema deve retornar à página de login no estado inicial, sem sessão criada, e sem travar a navegação.
- O que acontece se o usuário, já na tela de usuário/senha, atualizar a página (F5) ou acessar a URL de login diretamente de novo? O sistema deve exibir o estado inicial (3 botões), já que a alternância de tela é apenas um estado de interface, não uma rota separada.
- O que acontece se um usuário autenticado, com sessão válida, tentar acessar a página de login pela URL? Deve ser redirecionado para a área autenticada correspondente ao seu papel (ver User Story 1, cenário 4).
- O que acontece com chamadas a rotas técnicas não navegáveis pelo usuário final, como o endpoint de callback OAuth (`/api/auth/...`)? Essas rotas continuam acessíveis sem sessão prévia, pois são parte do próprio mecanismo de autenticação, e não são consideradas "rotas públicas de navegação" para fins desta especificação.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: A página de login é a única rota da aplicação acessível por navegação sem sessão válida; qualquer outra rota de navegação exige sessão válida para ser exibida.
- **FR-002**: O sistema MUST redirecionar automaticamente para a página de login qualquer tentativa de acesso a uma rota protegida por um usuário sem sessão válida ou com sessão expirada.
- **FR-003**: O sistema MUST redirecionar um usuário já autenticado (com sessão válida) que tente acessar a página de login para a área autenticada correspondente ao seu papel, em vez de exibir o formulário de login.
- **FR-004**: A página de login MUST apresentar, em seu estado inicial, exatamente 3 opções de acesso: "Acessar com Google", "Acessar com Facebook" e "Usar usuário e senha".
- **FR-005**: Ao acionar "Acessar com Google" ou "Acessar com Facebook", o sistema MUST conduzir o mesmo fluxo de autenticação via provedor social já existente antes desta mudança, sem alteração de comportamento.
- **FR-006**: Ao acionar "Usar usuário e senha", o sistema MUST substituir, na mesma página, a exibição dos 3 botões iniciais pelos campos de usuário e senha, seguidos dos botões "Voltar" e "Acessar".
- **FR-007**: O botão "Voltar" MUST retornar a página de login ao estado inicial (3 botões), descartando quaisquer valores preenchidos nos campos de usuário e senha.
- **FR-008**: O botão "Acessar" (no formulário de usuário e senha) MUST validar as credenciais informadas e, se válidas, autenticar o usuário e concedê-lo uma sessão válida.
- **FR-009**: Se as credenciais de usuário e senha forem inválidas, o sistema MUST exibir uma mensagem de erro compreensível ao usuário, mantendo-o na tela de usuário e senha.
- **FR-010**: O sistema MUST impedir a submissão do formulário de usuário e senha quando campos obrigatórios estiverem vazios, indicando ao usuário quais campos precisam ser preenchidos.
- **FR-011**: A alternância entre o estado inicial (3 botões) e o estado de usuário/senha MUST ocorrer sem navegação para uma URL diferente (é uma troca de estado de interface dentro da mesma rota de login).

### Key Entities

- **Sessão do Usuário**: Representa o estado de autenticação vigente de um usuário (válida, expirada ou inexistente); determina se o acesso a rotas protegidas é permitido ou se o redirecionamento à página de login é necessário.
- **Página de Login**: Única rota pública de navegação da aplicação; possui dois estados de exibição — estado inicial (3 opções de acesso) e estado de usuário/senha (formulário de credenciais).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% das tentativas de acesso a rotas protegidas sem sessão válida resultam em redirecionamento para a página de login, sem exposição de conteúdo protegido.
- **SC-002**: Usuários conseguem concluir o login via Google ou Facebook no mesmo tempo e com a mesma taxa de sucesso observados antes desta mudança (sem regressão perceptível pelo usuário).
- **SC-003**: Usuários conseguem alternar para o formulário de usuário e senha e retornar ao estado inicial em menos de 1 segundo de resposta de interface, sem recarregar a página.
- **SC-004**: 100% das tentativas de login com credenciais de usuário/senha inválidas resultam em mensagem de erro clara, sem o usuário ser levado a outra tela ou perder o contexto do formulário.

## Assumptions

- A autenticação via usuário e senha (fallback sem provedor social) já existe como capacidade de backend na aplicação; esta feature trata apenas da experiência de apresentação/alternância na página de login, não da criação de um novo mecanismo de autenticação.
- "Rota pública" refere-se a rotas de navegação alcançadas por um usuário final (páginas); endpoints técnicos do próprio mecanismo de autenticação (ex.: callback OAuth) não são afetados por este requisito, pois não são navegados diretamente pelo usuário.
- O redirecionamento de usuários sem sessão válida se aplica a toda a aplicação, sem exceção de rotas adicionais além da própria página de login.
- Papéis de usuário (staff, voluntário etc.) continuam determinando a área autenticada de destino após o login bem-sucedido, sem alteração nessa lógica de roteamento pós-login.
- **Decisão de escopo confirmada com o usuário**: a landing page (`app/(public)/page.tsx`) e o formulário público de candidatura de voluntário (`app/(public)/voluntariado/candidatura`), hoje acessíveis sem sessão, passam a exigir sessão válida como qualquer outra rota — a página de login é literalmente a única exceção. Isso significa que a submissão de candidatura de um novo voluntário deixa de ser possível sem uma conta/sessão prévia; a forma como um novo voluntário obtém acesso inicial (ex.: login social cria conta automaticamente na primeira autenticação) está fora do escopo desta feature e é tratada como comportamento já suportado pelo mecanismo de autenticação existente (criação de `user` na primeira autenticação via provedor social ou credenciais).
