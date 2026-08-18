# Feature Specification: Padrão único de validação de formulários

**Feature Branch**: `016-formularios-rhf-zod`

**Created**: 2026-08-17

**Status**: Draft

**Input**: User description: "todos os formularios da aplicacao devem utilizar o react-hook-form com as validacoes sendo realizadas com o zod. Todos os campos que tiverem mensagens de erros devem ser apresentados logo abaixo do input, com mensagens de erros condinzentes. Deve ser desabilitado a validacao padrao de formularios do browser, passando a ser utilizado o react-hook-form como padrao."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Erro no campo, logo abaixo do campo (Priority: P1)

Uma pessoa preenche um formulário da aplicação (login, candidatura de voluntariado,
cadastro/edição de usuário) e tenta enviar com dados incompletos ou inválidos. Em vez de um
balão do navegador que some sozinho, ela vê, imediatamente abaixo de cada campo com problema,
uma mensagem em português explicando exatamente o que precisa corrigir naquele campo — todas
de uma vez, para todos os campos com problema, sem precisar corrigir um por vez.

**Why this priority**: é o comportamento que o usuário efetivamente percebe. Sem ele, quem
preenche um formulário longo em campo (candidatura, entrada de estoque) fica preso sem saber o
que está errado — o custo maior do problema atual.

**Independent Test**: abrir qualquer formulário da aplicação, submeter vazio ou com dados
inválidos e verificar que (a) o envio não ocorre, (b) cada campo com problema exibe mensagem
própria abaixo dele, (c) as mensagens estão em pt-BR e descrevem a regra violada.

**Acceptance Scenarios**:

1. **Given** um formulário com campos obrigatórios vazios, **When** o usuário aciona o envio,
   **Then** o envio é bloqueado e cada campo obrigatório vazio exibe sua própria mensagem de
   erro abaixo do controle, simultaneamente.
2. **Given** um campo com formato específico (e-mail, CPF, CEP, telefone, data) preenchido com
   valor inválido, **When** o usuário aciona o envio, **Then** a mensagem exibida descreve a
   regra violada daquele campo (ex.: "Informe um e-mail válido"), e não uma mensagem genérica
   de "campo inválido".
3. **Given** um campo em erro, **When** o usuário corrige o valor, **Then** a mensagem daquele
   campo desaparece assim que o valor passa a ser válido, sem exigir novo envio.
4. **Given** um campo com texto de apoio (dica) e um erro simultâneo, **When** o erro aparece,
   **Then** a mensagem de erro ocupa a mesma faixa da dica, sem deslocar o restante do
   formulário para baixo.

---

### User Story 2 - Nenhum balão do navegador (Priority: P1)

A pessoa nunca mais vê a validação nativa do navegador — nem o balão "Preencha este campo",
nem mensagens em outro idioma, nem o comportamento de parar no primeiro campo inválido. Toda a
validação da aplicação tem aparência, idioma e comportamento únicos, iguais em todos os
formulários e em qualquer navegador.

**Why this priority**: mesma prioridade que a US1 porque as duas juntas formam o comportamento
mínimo coerente — deixar a validação nativa ativa em um único formulário já recria a
inconsistência (idioma do navegador, estilo fora do design system) que a feature elimina.

**Independent Test**: submeter cada formulário incompleto em pelo menos dois navegadores
diferentes e confirmar que nenhum balão nativo aparece e que as mensagens exibidas são
idênticas entre eles.

**Acceptance Scenarios**:

1. **Given** um formulário com campos obrigatórios vazios, **When** o usuário aciona o envio,
   **Then** nenhum balão de validação do navegador é exibido.
2. **Given** o mesmo formulário aberto em navegadores diferentes, **When** o envio é acionado
   com os mesmos dados inválidos, **Then** as mensagens exibidas são as mesmas, no mesmo lugar
   e em pt-BR.
3. **Given** um campo obrigatório, **When** ele está vazio, **Then** ele continua sinalizado
   como obrigatório na interface (marcação visual e para leitor de tela), mesmo sem a
   validação nativa do navegador.

---

### User Story 3 - Erro vindo do servidor no campo certo (Priority: P2)

Algumas regras só podem ser verificadas no servidor (e-mail já cadastrado, CPF já com
candidatura, credenciais inválidas). Quando o servidor recusa o envio apontando um campo
específico, o usuário vê a mensagem no mesmo lugar em que veria um erro de preenchimento —
abaixo daquele campo — e não em um aviso solto no topo que ele precisa relacionar sozinho ao
campo.

**Why this priority**: melhora relevante de clareza, mas o fluxo já é utilizável com as US1 e
US2 entregues (erro do servidor exibido como aviso geral). Depende do padrão estabelecido por
elas.

**Independent Test**: submeter um formulário com dados válidos no formato mas recusados pelo
servidor (ex.: e-mail já cadastrado) e verificar que a mensagem aparece abaixo do campo
correspondente.

**Acceptance Scenarios**:

1. **Given** um envio recusado pelo servidor com erro atribuível a um campo, **When** a
   resposta chega, **Then** a mensagem é exibida abaixo daquele campo, no mesmo formato dos
   erros de preenchimento.
2. **Given** um envio recusado pelo servidor com erro não atribuível a nenhum campo (falha de
   rede, indisponibilidade), **When** a resposta chega, **Then** a mensagem é exibida como
   aviso geral do formulário, sem se fixar arbitrariamente em um campo.
3. **Given** uma mensagem de erro vinda do servidor exibida em um campo, **When** o usuário
   altera o valor daquele campo, **Then** a mensagem é removida.

---

### User Story 4 - Formulário novo já nasce no padrão (Priority: P3)

Quem implementa uma tela nova de formulário (entrada/saída de estoque, gestão de atividades,
triagem) encontra o padrão documentado e os componentes prontos, e não precisa decidir de novo
como validar, onde posicionar o erro ou como escrever a mensagem.

**Why this priority**: garante que o ganho das histórias anteriores não se perca nas próximas
telas, mas não altera nada do que o usuário final vê hoje.

**Independent Test**: implementar (ou revisar) um formulário novo seguindo apenas a
documentação do padrão e verificar que o resultado atende às US1 e US2 sem decisões ad-hoc.

**Acceptance Scenarios**:

1. **Given** a documentação do padrão de formulários, **When** alguém implementa um formulário
   novo, **Then** existe uma única forma recomendada, documentada, de declarar regras, exibir
   erros e desabilitar a validação nativa.
2. **Given** um formulário novo que não segue o padrão, **When** a revisão acontece, **Then**
   o desvio é identificável por critério objetivo (ausência de validação declarada, erro fora
   da posição padrão, validação nativa ativa).

---

### Edge Cases

- **Controles que não são campos de texto** (seleção, combobox, seletor de data, grupo de
  rádio, grupo de checkbox, switch, campo numérico): a mensagem precisa aparecer abaixo do
  controle na mesma posição e formato dos campos de texto.
- **Campo somente leitura ou desabilitado** (ex.: e-mail preenchido pela conta do provedor):
  não gera erro de preenchimento nem bloqueia o envio.
- **Envio acionado por tecla Enter** dentro de um campo: segue o mesmo caminho de validação do
  clique no botão de envio.
- **Cliques repetidos no botão de envio**: o formulário não dispara envios duplicados enquanto
  o anterior está em andamento.
- **Formulário com campos fora da área visível**: ao bloquear o envio, o primeiro campo com
  erro recebe foco, para que o usuário não fique olhando para um formulário que "não faz nada".
- **Regras condicionais** (campo que só é obrigatório se outro tiver certo valor — ex.: tipo de
  veículo obrigatório apenas quando a pessoa declara que dirige): a obrigatoriedade acompanha a
  condição, e a mensagem some quando a condição deixa de valer.
- **Formulário reaberto após um envio recusado** (diálogo fechado e aberto de novo): não
  reexibe erros do envio anterior.
- **Mensagem longa em telas estreitas**: quebra em mais de uma linha sem cortar o texto nem
  provocar rolagem horizontal.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Todo formulário da aplicação MUST validar os dados informados antes de enviá-los,
  bloqueando o envio enquanto houver campo inválido.
- **FR-002**: As regras de validação de cada formulário MUST ser declaradas em um único lugar
  por formulário, de forma reaproveitável, e não espalhadas por controle ou por manipulador de
  evento.
- **FR-003**: A validação nativa do navegador MUST estar desabilitada em todos os formulários,
  de modo que nenhum balão nativo seja exibido em nenhum navegador.
- **FR-004**: Toda mensagem de erro de campo MUST ser exibida imediatamente abaixo do controle
  correspondente.
- **FR-005**: A mensagem MUST descrever a regra violada naquele campo em pt-BR, de forma
  acionável (o que corrigir), e não apenas sinalizar que há erro.
- **FR-006**: Todos os campos inválidos MUST exibir sua mensagem simultaneamente ao envio
  bloqueado — o usuário não descobre um erro por vez.
- **FR-007**: Após um envio bloqueado, cada campo MUST reavaliar sua validade conforme o
  usuário edita, removendo a mensagem assim que o valor passa a ser válido.
- **FR-008**: Todo tipo de controle usado nos formulários (texto, senha, área de texto,
  numérico, seleção, combobox, seletor de data, grupo de rádio, grupo de checkbox, switch)
  MUST suportar a exibição de mensagem de erro na mesma posição e formato.
- **FR-009**: O campo em erro MUST ser identificável visualmente (destaque de borda) e por
  leitor de tela (estado inválido e associação com a mensagem).
- **FR-010**: A entrada da mensagem de erro MUST NOT deslocar o restante do formulário — ela
  ocupa a mesma faixa reservada ao texto de apoio do campo.
- **FR-011**: Ao bloquear o envio, o foco MUST ir para o primeiro campo com erro.
- **FR-012**: Erros retornados pelo servidor atribuíveis a um campo MUST ser exibidos abaixo
  daquele campo, no mesmo formato dos erros de preenchimento; os não atribuíveis a um campo
  MUST ser exibidos como aviso geral do formulário.
- **FR-013**: Enquanto um envio está em andamento, o formulário MUST impedir envios duplicados
  e sinalizar o estado de envio.
- **FR-014**: Regras de validação condicionais MUST ser suportadas (obrigatoriedade dependente
  do valor de outro campo), com a mensagem aparecendo e desaparecendo conforme a condição.
- **FR-015**: Campos somente leitura ou desabilitados MUST NOT bloquear o envio nem gerar
  mensagem de erro de preenchimento.
- **FR-016**: Ao reabrir um formulário previamente submetido (diálogo/tela reaberta), o estado
  MUST iniciar sem mensagens de erro remanescentes.
- **FR-017**: Todos os formulários existentes hoje na aplicação MUST estar em conformidade com
  os requisitos acima ao final da entrega — nenhum formulário fica fora do padrão.
- **FR-018**: O padrão MUST estar documentado no repositório, com orientação suficiente para
  que um formulário novo o siga sem decisões ad-hoc.

### Restrições Técnicas Mandatórias _(determinadas pelo solicitante)_

Estas restrições foram explicitamente exigidas na descrição da feature e, por isso, fazem
parte do escopo aceito — não são escolhas de implementação em aberto:

- **TC-001**: O gerenciamento de estado e submissão dos formulários usa **react-hook-form**.
- **TC-002**: As regras de validação são declaradas em esquemas **Zod**, ligados ao
  react-hook-form por resolver.
- **TC-003**: A validação nativa do navegador é desabilitada (`noValidate` no elemento de
  formulário), tornando o react-hook-form a única autoridade de validação no cliente.

### Key Entities

- **Esquema de validação do formulário**: conjunto declarativo de regras por campo
  (obrigatoriedade, formato, faixa, condicionais) e das mensagens em pt-BR correspondentes.
  É a fonte única de verdade da validação daquele formulário no cliente.
- **Estado de erro do campo**: associação entre um campo e a mensagem atualmente exibida
  abaixo dele — originada da validação local ou da resposta do servidor.
- **Erro geral do formulário**: mensagem não atribuível a nenhum campo específico (falha de
  rede, indisponibilidade, recusa genérica), exibida fora da faixa de erro dos campos.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% dos formulários da aplicação bloqueiam envio inválido sem exibir qualquer
  balão de validação nativa, verificado em pelo menos dois navegadores diferentes.
- **SC-002**: 100% dos campos passíveis de erro exibem a mensagem imediatamente abaixo do
  controle; nenhuma mensagem de campo aparece em outra posição.
- **SC-003**: 100% das mensagens de erro estão em pt-BR e nomeiam a correção necessária —
  nenhuma mensagem genérica do tipo "campo inválido" ou texto em inglês.
- **SC-004**: Ao submeter um formulário inteiramente vazio, o usuário vê de uma só vez todas as
  pendências: nenhum campo obrigatório fica sem mensagem.
- **SC-005**: Uma pessoa que erra um campo em um formulário longo identifica e corrige o erro
  sem rolar a página procurando — o primeiro campo com erro recebe foco em 100% dos envios
  bloqueados.
- **SC-006**: Um formulário novo implementado seguindo apenas a documentação do padrão atende
  a SC-001 a SC-005 sem ajustes adicionais.
- **SC-007**: Nenhuma regressão de acessibilidade: todo campo em erro é anunciado como inválido
  e com sua mensagem por leitor de tela.

## Assumptions

- **Momento da validação**: a validação ocorre no envio e, a partir daí, o campo é reavaliado
  conforme o usuário digita/altera. Não há mensagem de erro antes da primeira tentativa de
  envio — evita punir quem ainda está preenchendo.
- **Escopo de "formulário"**: aplica-se a todo conjunto de campos submetido como uma operação
  (login, candidatura, criação/edição de usuário, e os formulários de estoque e atividades a
  implementar). Controles isolados de filtro/busca/paginação de listagens, que não submetem
  dados, ficam fora do escopo.
- **Validação de servidor permanece obrigatória**: a validação no cliente é de experiência de
  uso, não de segurança — as Server Actions continuam validando toda entrada independentemente,
  conforme o Princípio IV da constituição.
- **Reaproveitamento de esquemas**: quando a regra é a mesma no cliente e no servidor (CPF,
  e-mail, maioridade), o esquema é compartilhado em vez de duplicado, para que as mensagens não
  divirjam.
- **Componentes de campo já existentes** (`Campo` e derivados em `src/shared/ui/`) já
  implementam a posição, o estilo e a fiação de acessibilidade da mensagem de erro; a feature
  padroniza o uso deles e cobre os controles que ainda não estejam adequados, sem redesenhar o
  design system.
- **Escrita das mensagens**: mensagens curtas, em segunda pessoa e no imperativo ("Informe um
  e-mail válido"), consistentes entre formulários para a mesma regra.
- **Formulários futuros**: o padrão vale também para as telas ainda não implementadas; esta
  spec cobre a conformidade das telas existentes hoje e a documentação que rege as próximas.
