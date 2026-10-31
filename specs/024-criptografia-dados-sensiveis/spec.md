# Feature Specification: Criptografia e Mascaramento de Dados Sensíveis (LGPD)

**Feature Branch**: `024-criptografia-dados-sensiveis`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "preciso adicionar uma camada de segurança dos dados por causa da lgpd. Quero que os dados sensíveis dos voluntários sejam armazenados criptografados. A chave deve ser definida via variável de ambiente. Os dados apresentados via sistema devem ser mascarados de forma a apenas admim comseguir ver em texto plano. O cpf deve aparecer 2 números iniciais e 2 finais, os demais dados sensíveis seguem a mesma lógica."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Dados pessoais protegidos no armazenamento (Priority: P1)

A organização precisa garantir que, se o conteúdo do banco de dados vazar (backup extraviado, acesso
indevido ao provedor, dump compartilhado para depuração), os dados pessoais dos voluntários — CPF,
telefone, data de nascimento, CEP e restrições de saúde — não sejam legíveis por quem obteve o
arquivo. A proteção deve depender de um segredo mantido fora do banco, controlado pela organização e
configurável por ambiente.

**Why this priority**: é a obrigação central da LGPD que motiva a feature (art. 46 — medidas de
segurança aptas a proteger dados pessoais). Sem ela, nenhuma das demais entregas tem valor: mascarar
a exibição não protege contra vazamento do armazenamento. É também a única parte que exige migração
dos dados já existentes, portanto precisa vir primeiro.

**Independent Test**: inspecionar diretamente o conteúdo armazenado de um voluntário recém-cadastrado
e confirmar que nenhum dos campos sensíveis aparece em texto legível; em seguida, abrir o mesmo
voluntário pelo sistema, com o segredo configurado, e confirmar que os dados voltam corretos e
completos. Entrega valor mesmo sem as demais histórias: os cadastros param de ficar expostos.

**Acceptance Scenarios**:

1. **Given** um voluntário envia candidatura com CPF, telefone, data de nascimento, CEP e restrições
   de saúde, **When** o cadastro é persistido, **Then** o conteúdo armazenado desses campos não
   contém os valores informados em forma legível.
2. **Given** um voluntário cujos dados foram armazenados protegidos, **When** o sistema exibe o
   cadastro para quem tem permissão de ver em texto plano, **Then** os valores apresentados são
   idênticos aos originalmente informados, sem perda de caracteres, acentuação ou formatação.
3. **Given** o segredo de proteção não está configurado no ambiente, **When** a aplicação é
   inicializada, **Then** ela recusa a inicialização com mensagem clara em pt-BR indicando a
   configuração ausente, em vez de operar gravando dados desprotegidos.
4. **Given** o banco contém cadastros gravados antes desta feature, **When** a migração de proteção é
   executada, **Then** todos os cadastros existentes passam a estar protegidos e permanecem
   legíveis pelo sistema, sem registros órfãos ou corrompidos.
5. **Given** um voluntário já cadastrado reenvia candidatura com o mesmo CPF, **When** o sistema
   verifica duplicidade, **Then** a candidatura existente é reaproveitada como antes, sem criar um
   segundo cadastro para o mesmo CPF.

---

### User Story 2 - Exibição mascarada por padrão (Priority: P1)

Qualquer pessoa que usa o sistema e vê dados de voluntários — na fila de triagem, nas listagens, nos
painéis de relatório, nos detalhes de alocação — vê os dados sensíveis mascarados por padrão. O CPF
aparece com os 2 primeiros e os 2 últimos dígitos visíveis e o restante substituído por marcadores.
Os demais campos sensíveis seguem a mesma lógica: início e fim preservados, meio oculto.

**Why this priority**: é a segunda metade do pedido e a que reduz exposição no dia a dia — a maior
parte das visualizações de dados de voluntário acontece em telas de operação, em campo, com a tela à
vista de terceiros. É P1 porque sem ela os dados continuam expostos em uso normal, mesmo protegidos
no armazenamento.

**Independent Test**: acessar a fila de triagem e os painéis de relatório com uma conta sem permissão
de ver dados completos e confirmar que todos os campos sensíveis aparecem mascarados no padrão
definido, em todas as telas e também nos arquivos exportados.

**Acceptance Scenarios**:

1. **Given** um voluntário com CPF `12345678901`, **When** o CPF é exibido mascarado, **Then**
   aparecem os dígitos `12` no início e `01` no fim, com os dígitos intermediários substituídos por
   marcadores, sem revelar a quantidade exata de dígitos ocultos de forma que permita reconstrução.
2. **Given** um campo sensível curto, com 4 caracteres ou menos, **When** ele é exibido mascarado,
   **Then** nenhum caractere original é revelado — o valor aparece inteiramente mascarado, pois
   expor 2 no início e 2 no fim revelaria o valor completo.
3. **Given** uma pessoa autenticada sem permissão de ver dados completos, **When** ela acessa
   qualquer tela que apresenta dados de voluntários, **Then** todos os campos sensíveis aparecem
   mascarados, inclusive em listagens, detalhes, totalizadores e tooltips.
4. **Given** uma pessoa sem permissão de ver dados completos, **When** ela exporta um relatório que
   contém dados de voluntários, **Then** o arquivo gerado contém os valores mascarados, não os
   valores completos.
5. **Given** um campo sensível opcional que está vazio, **When** ele é exibido, **Then** aparece a
   indicação de ausência já usada pelo sistema, não uma máscara que sugira existir conteúdo.

---

### User Story 3 - Acesso a dados completos restrito e rastreado (Priority: P2)

Quem tem permissão de ver dados completos consegue revelar o valor em texto plano de um campo
sensível, sob demanda, a partir da tela onde o dado aparece mascarado. Cada revelação é registrada na
auditoria, com quem revelou, qual voluntário, qual campo e quando.

**Why this priority**: é o escape necessário para que a operação não trave — há situações legítimas
que exigem o dado completo (conferência de documento, contato de emergência). Vem depois das duas
primeiras porque, sem elas, não há o que revelar. O registro de auditoria é o que torna o acesso
privilegiado defensável perante um titular que exerça seu direito de saber quem acessou seus dados.

**Independent Test**: com uma conta autorizada, revelar o CPF de um voluntário a partir da fila de
triagem, confirmar que o valor completo aparece, e verificar que a auditoria registrou a revelação
com ator, voluntário, campo e horário.

**Acceptance Scenarios**:

1. **Given** uma pessoa com permissão de ver dados completos, **When** ela solicita a revelação de um
   campo sensível mascarado, **Then** o valor completo é apresentado na mesma tela.
2. **Given** uma revelação de campo sensível foi concluída, **When** a auditoria do período é
   consultada, **Then** existe um registro contendo quem revelou, de qual voluntário, qual campo e o
   momento da revelação.
3. **Given** uma pessoa sem permissão de ver dados completos, **When** ela tenta obter o valor
   completo de um campo sensível por qualquer caminho do sistema, **Then** o acesso é recusado e o
   valor completo não é entregue.
4. **Given** o registro de auditoria da revelação falha, **When** a revelação é solicitada por quem
   tem permissão, **Then** a revelação é concluída e a falha de auditoria é registrada para
   reconciliação, seguindo a política de auditoria não bloqueante já vigente no sistema.

---

### Edge Cases

- **Segredo ausente ou inválido**: a aplicação não inicializa e informa claramente a configuração
  ausente, em vez de gravar dados desprotegidos ou falhar de forma silenciosa durante um cadastro.
- **Segredo trocado sem reprocessar os dados**: os dados existentes deixam de ser legíveis. O sistema
  deve sinalizar a falha de leitura de forma explícita e distinguível de "campo vazio", para que a
  operação perceba o problema de configuração e não conclua que o cadastro está incompleto.
- **Dado protegido corrompido em uma única linha**: a tela não quebra; o campo afetado é apresentado
  com indicação de erro de leitura e o restante do cadastro continua utilizável.
- **Campos muito curtos** (ex.: tipo de veículo, CEP com 8 dígitos, telefone com 10): a regra de
  exposição mínima prevalece sobre a regra de "2 no início e 2 no fim" — ver FR-008.
- **Busca e ordenação por campo sensível**: buscar voluntário por CPF continua funcionando; ordenar ou
  filtrar por trecho parcial de campo protegido pode deixar de ser suportado — a decisão por campo
  está em Assumptions.
- **Migração interrompida**: a migração dos dados existentes pode ser re-executada com segurança, sem
  proteger duas vezes o mesmo valor nem corromper linhas já migradas.
- **Mesma pessoa vendo o próprio cadastro**: ver Q3 em Clarifications.
- **Exportação de relatórios**: arquivos gerados respeitam a mesma regra de permissão da tela que os
  originou — nunca contêm dado completo para quem não poderia vê-lo na tela.
- **Logs e mensagens de erro**: nenhum campo sensível em texto plano aparece em log de aplicação,
  mensagem de erro, trilha de depuração ou payload de notificação.

## Requirements _(mandatory)_

### Functional Requirements

**Proteção no armazenamento**

- **FR-001**: O sistema MUST armazenar os campos sensíveis do cadastro de voluntário de forma
  ilegível para quem tem acesso apenas ao conteúdo do banco de dados, sem acesso ao segredo da
  organização.
- **FR-002**: O segredo usado para proteger e recuperar os dados MUST ser fornecido por variável de
  ambiente, nunca armazenado no banco nem versionado no repositório, e MUST ser configurável de forma
  independente por ambiente (desenvolvimento, homologação, produção).
- **FR-003**: O sistema MUST recusar a inicialização, com mensagem explícita em pt-BR, quando o
  segredo estiver ausente ou não atender ao formato/tamanho mínimo exigido — nunca operar em modo
  degradado gravando dados desprotegidos.
- **FR-004**: O sistema MUST recuperar os valores originais integralmente, preservando acentuação,
  pontuação e espaços, sem truncar nem alterar o conteúdo informado pelo voluntário.
- **FR-005**: O sistema MUST manter a garantia de CPF único por voluntário e a localização de
  cadastro existente por CPF, de modo que o reenvio de candidatura continue reaproveitando o
  cadastro, como hoje.
- **FR-006**: O sistema MUST converter os cadastros já existentes para a forma protegida em uma
  operação de migração idempotente, re-executável sem corromper dados já migrados.
- **FR-007**: O sistema MUST NOT expor campo sensível em texto plano em logs de aplicação, mensagens
  de erro, trilhas de depuração ou conteúdo de notificações enviadas.

**Mascaramento na apresentação**

- **FR-008**: O sistema MUST mascarar cada campo sensível preservando os 2 primeiros e os 2 últimos
  caracteres e substituindo os intermediários por marcadores. Quando o valor tiver 5 caracteres ou
  menos, o sistema MUST mascarar o valor inteiro, sem revelar nenhum caractere original.
- **FR-009**: O sistema MUST mascarar os dados sensíveis por padrão em todas as superfícies de
  apresentação — listagens, telas de detalhe, painéis de relatório, tooltips e arquivos exportados —
  sem exigir que cada tela nova se lembre de aplicar a máscara.
- **FR-010**: O sistema MUST apresentar a indicação de ausência já usada no sistema para campo
  sensível opcional vazio, distinguindo visualmente "sem valor" de "valor mascarado".
- **FR-011**: O sistema MUST apresentar indicação explícita de falha de leitura quando um valor
  protegido não puder ser recuperado, distinguível de campo vazio, mantendo o restante do cadastro
  utilizável.

**Controle de acesso ao dado completo**

- **FR-012**: O sistema MUST restringir o acesso ao valor completo dos campos sensíveis às roles
  autorizadas definidas em Q2, recusando o acesso para todas as demais em qualquer caminho de leitura
  (tela, consulta, exportação).
- **FR-013**: Pessoas autorizadas MUST be able to revelar, sob demanda e a partir da tela onde o dado
  aparece mascarado, o valor completo de um campo sensível.
- **FR-014**: O sistema MUST registrar na auditoria cada revelação de dado completo, contendo ator,
  voluntário, campo revelado e momento, seguindo a política de auditoria não bloqueante já vigente.
- **FR-015**: O sistema MUST aplicar a mesma regra de permissão ao conteúdo dos arquivos exportados
  que aplica à tela que os originou.

### Key Entities

- **Cadastro de Voluntário**: extensão do usuário com os dados pessoais declarados na candidatura.
  Passa a distinguir, para cada campo, o valor protegido no armazenamento, a forma mascarada
  apresentada por padrão e o valor completo, acessível apenas a quem tem permissão.
- **Campo Sensível**: classificação declarada de um dado pessoal do voluntário, que determina se o
  campo é protegido no armazenamento, como é mascarado e quem pode ver seu valor completo. O conjunto
  exato de campos nesta classificação está em Q1.
- **Segredo de Proteção**: valor fornecido pelo ambiente de execução, necessário para recuperar os
  dados protegidos. Vive fora do banco de dados e é o controle que torna o conteúdo do banco
  ininteligível sem ele.
- **Registro de Revelação**: entrada de auditoria produzida quando alguém autorizado acessa o valor
  completo de um campo sensível. É o que permite responder a um titular quem acessou seus dados.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em uma inspeção do conteúdo armazenado de 100% dos cadastros de voluntários, nenhum
  valor de campo sensível aparece em forma legível.
- **SC-002**: 100% das telas e dos arquivos exportados que apresentam dados de voluntários exibem os
  campos sensíveis mascarados para quem não tem permissão de ver dados completos — verificado por
  varredura de todas as superfícies de apresentação existentes.
- **SC-003**: 100% das tentativas de obter valor completo de campo sensível por quem não tem
  permissão são recusadas, em todos os caminhos de leitura testados.
- **SC-004**: 100% das revelações de dado completo têm registro de auditoria correspondente com ator,
  voluntário, campo e horário.
- **SC-005**: A migração dos cadastros existentes conclui sem perda: a quantidade de cadastros
  legíveis pelo sistema depois da migração é igual à de antes, e cada valor recuperado é idêntico ao
  original.
- **SC-006**: As telas de operação de campo que apresentam dados de voluntário continuam respondendo
  dentro da meta de 300ms já vigente para leituras críticas, sem regressão perceptível atribuível à
  proteção dos dados.
- **SC-007**: Uma busca de voluntário por CPF completo continua encontrando o cadastro existente em
  100% dos casos, preservando o fluxo de reenvio de candidatura.
- **SC-008**: Uma varredura dos logs de aplicação de um ciclo completo de cadastro, triagem,
  aprovação e alocação não encontra nenhum campo sensível em texto plano.

## Clarifications

As três perguntas abaixo precisam de resposta antes de `/speckit-plan`. Elas afetam escopo e
privacidade e não têm padrão seguro que possa ser assumido sem decisão do responsável.

### Q1: Quais campos entram na classificação de "dado sensível"?

**Context**: FR-001 e a entidade **Campo Sensível** dependem dessa lista. Hoje o cadastro de
voluntário contém: nome completo, CPF, data de nascimento, telefone, CEP, bairro, profissão,
restrições de saúde, veículo próprio, tipo de veículo e disponibilidade. A Constituição do projeto
(Princípio IV) hoje cita `cpf` e `restricoesSaude` como os dados sensíveis.

**What we need to know**: o conjunto exato de campos a proteger no armazenamento e mascarar na
apresentação.

**Suggested Answers**:

| Option | Answer | Implications |
| ------ | ------ | ------------ |
| A      | CPF, telefone, data de nascimento, CEP e restrições de saúde | Cobre documento, contato, dado de saúde e localização aproximada. Nome e bairro seguem legíveis, preservando as telas de triagem e alocação, que dependem de identificar a pessoa e a região. Recomendado. |
| B      | Apenas CPF e restrições de saúde | Menor esforço e menor impacto nas telas; alinhado ao texto atual da Constituição. Deixa telefone, data de nascimento e CEP expostos num eventual vazamento de banco. |
| C      | Todos os campos de identificação pessoal, incluindo nome completo, bairro e profissão | Proteção máxima. Impacta fortemente as telas de operação: a fila de triagem e a alocação passam a listar nomes mascarados, e ordenação/busca por nome deixa de funcionar como hoje. |
| Custom | Informe a lista de campos | Liste os campos exatamente como aparecem no cadastro. |

**Your choice**: _[Aguardando resposta]_

### Q2: Quais roles podem ver o dado completo em texto plano?

**Context**: FR-012. O pedido original diz "apenas admin". O sistema tem as roles `usuario`,
`voluntario`, `membro_defesa_civil`, `coordenador` e `administrador`. Hoje a fila de Cadastros
Pendentes exibe o CPF completo, e quem aprova ou rejeita candidatura é o `coordenador`.

**What we need to know**: se a permissão fica restrita a `administrador` ou se inclui `coordenador`.

**Suggested Answers**:

| Option | Answer | Implications |
| ------ | ------ | ------------ |
| A      | Somente `administrador` | Interpretação literal do pedido. Maior proteção, mas o `coordenador` passa a aprovar candidatura vendo o CPF mascarado — é preciso confirmar que a triagem não depende de conferir o documento completo. |
| B      | `administrador` e `coordenador` | Preserva o fluxo de triagem atual, em que quem aprova consegue conferir o documento. Amplia o conjunto de pessoas com acesso ao dado completo, com cada acesso registrado em auditoria (FR-014). |
| C      | Somente `administrador`, e a triagem passa a usar uma conferência que não exige o documento completo | Mantém a restrição máxima e trata explicitamente o impacto na triagem — porém adiciona escopo de redesenho do fluxo de aprovação a esta feature. |
| Custom | Informe as roles | Liste as roles autorizadas. |

**Your choice**: _[Aguardando resposta]_

### Q3: O voluntário vê os próprios dados em texto plano?

**Context**: FR-012 e o edge case "mesma pessoa vendo o próprio cadastro". A LGPD garante ao titular
o direito de acesso aos seus próprios dados (art. 18, II); por outro lado, o pedido diz que apenas
admin vê texto plano.

**What we need to know**: se o próprio voluntário, autenticado, vê o próprio CPF e demais campos
sensíveis completos ou mascarados.

**Suggested Answers**:

| Option | Answer | Implications |
| ------ | ------ | ------------ |
| A      | Sim, o titular vê os próprios dados completos | Atende diretamente ao direito de acesso do titular e evita que a pessoa não consiga conferir o que cadastrou. A regra de mascaramento passa a ser "dados de terceiros", não "todos os dados". Recomendado. |
| B      | Não, o titular também vê os próprios dados mascarados | Interpretação literal do pedido e regra mais simples de implementar e auditar. Exige um caminho separado para atender a um pedido formal de acesso do titular, fora do sistema. |
| C      | Mascarado por padrão, com revelação dos próprios dados sob demanda e registro em auditoria | Reduz exposição de tela e preserva o direito de acesso. Custo: o mesmo mecanismo de revelação precisa valer também para o titular, não só para as roles privilegiadas. |
| Custom | Descreva a regra desejada | — |

**Your choice**: _[Aguardando resposta]_

## Assumptions

- **Escopo limitado a voluntários**: o pedido trata dos dados de voluntários. Os outros contextos do
  sistema (Estoque/Doações, Logística) não têm campos pessoais sensíveis equivalentes no cadastro
  atual e ficam fora desta feature. O e-mail e o nome vindos da autenticação também ficam fora, por
  serem gerenciados pelo provedor de autenticação.
- **Esta é a decisão documentada exigida pela Constituição**: o Princípio IV determina hoje "não
  introduzir criptografia a nível de campo sem decisão documentada". Esta spec é essa decisão, e a
  Constituição precisará de emenda (bump MINOR) registrando a mudança de postura e a motivação de
  conformidade com a LGPD. Sem essa emenda, a implementação contradiz o princípio vigente.
- **Revelação sob demanda, não exibição automática**: para quem tem permissão, o dado completo é
  revelado por ação explícita, não exibido de imediato ao abrir a tela. Isso reduz exposição de tela
  em campo e dá significado ao registro de auditoria.
- **Rotação do segredo fora do escopo v1**: o segredo é definido por variável de ambiente e pode ser
  substituído, mas um procedimento automatizado de rotação com reprocessamento de todos os dados não
  faz parte desta entrega. O requisito desta spec é que a troca de segredo falhe de forma visível
  (FR-011), não que seja transparente.
- **Busca por CPF completo, não parcial**: localizar voluntário por CPF inteiro continua suportado
  (FR-005). Busca por trecho parcial de campo protegido não é requisito desta feature.
- **Marcador de máscara**: o caractere ou símbolo usado como marcador seguirá o padrão visual do
  design system do projeto; não é objeto de decisão nesta spec.
- **Mascaramento acontece no servidor**: o valor completo não é entregue ao navegador de quem não tem
  permissão de vê-lo, de modo que a máscara não seja contornável inspecionando a resposta.
- **A auditoria existente é reaproveitada**: o registro de revelação usa o mecanismo centralizado de
  auditoria já vigente no sistema e herda sua política de degradação não bloqueante.
- **Migração em janela controlada**: a conversão dos cadastros existentes é executada como operação
  administrativa única, não como conversão preguiçosa durante o uso normal.
