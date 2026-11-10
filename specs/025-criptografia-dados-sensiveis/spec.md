# Feature Specification: Criptografia, Mascaramento e Exclusão de Dados Sensíveis (LGPD)

**Feature Branch**: `025-criptografia-dados-sensiveis`

**Created**: 2026-10-31

**Status**: Draft

**Input**: User description: "preciso adicionar uma camada de segurança dos dados por causa da lgpd. Quero que os dados sensíveis dos voluntários sejam armazenados criptografados. A chave deve ser definida via variável de ambiente. Os dados apresentados via sistema devem ser mascarados de forma a apenas admim comseguir ver em texto plano. O cpf deve aparecer 2 números iniciais e 2 finais, os demais dados sensíveis seguem a mesma lógica."

**Decisões do responsável (2026-10-31)**: campos sensíveis = CPF, dia e mês da data de nascimento,
CEP (Q1). Visibilidade por role e por campo, não global (Q2). O titular vê os próprios dados
completos e pode solicitar a exclusão de todos os seus dados (Q3). A exclusão se dá por
**anonimização**: os dados pessoais são eliminados e o histórico operacional é preservado sem
identificar a pessoa (Q4).

## Escopo dos Dados Sensíveis

Os três campos classificados como sensíveis nesta feature, e a regra de máscara de cada um:

| Campo | Exemplo | Forma mascarada | Regra |
| ----- | ------- | --------------- | ----- |
| CPF | `12345678901` | `12•••••••01` | 2 primeiros + 2 últimos dígitos visíveis |
| Data de nascimento | `1990-03-15` | `••/••/1990` | Dia e mês ocultos; **ano permanece visível** |
| CEP | `89250000` | `12••••00` → `89••••00` | 2 primeiros + 2 últimos dígitos visíveis |

O ano de nascimento permanece legível por ser o componente que sustenta a verificação de maioridade e
as faixas etárias dos relatórios, sem identificar a pessoa isoladamente.

## Matriz de Visibilidade

Quem vê o valor completo, por campo. "Mascarado" é sempre o padrão; o acesso ao valor completo é sob
demanda e registrado em auditoria.

| Campo | `usuario` | `voluntario` (dados de terceiros) | Titular (próprios dados) | `membro_defesa_civil` | `coordenador` | `administrador` |
| ----- | --------- | --------------------------------- | ------------------------ | --------------------- | ------------- | --------------- |
| CPF | Mascarado | Mascarado | **Completo** | Mascarado | **Completo** | **Completo** |
| Dia/mês de nascimento | Mascarado | Mascarado | **Completo** | Mascarado | **Completo** | **Completo** |
| CEP | Mascarado | Mascarado | **Completo** | **Completo** | **Completo** | **Completo** |

## Alcance da Exclusão (Anonimização)

A exclusão solicitada pelo titular elimina os dados que o identificam e preserva o registro
operacional da resposta a desastres, sem vínculo com a pessoa.

| Eliminado — não recuperável | Preservado — sem identificar o titular |
| --------------------------- | -------------------------------------- |
| Nome completo, CPF, data de nascimento, telefone, CEP, bairro, profissão e restrições de saúde do cadastro de voluntário | As linhas de participação em turnos, de modo que contagens de vagas e relatórios de períodos passados continuem fechando |
| Nome, e-mail e imagem da conta de usuário | Os registros de auditoria já gravados, que permanecem imutáveis mas deixam de identificar a pessoa |
| Habilidades declaradas pelo titular | Totalizadores e agregados históricos, que não mudam de valor |
| Notificações recebidas, cujo conteúdo pode carregar dado pessoal | — |
| Sessões ativas e vínculos com provedores de login | O registro do próprio pedido de exclusão, como prova de atendimento ao titular |

**Consequência descoberta na análise do código**: o mecanismo de auditoria grava hoje o *snapshot
inteiro* do registro alterado, o que significa que a trilha imutável contém CPF, data de nascimento e
CEP em texto plano. Sem tratar isso, a anonimização seria incompleta — o dado continuaria legível na
auditoria — e a feature teria um segundo armazenamento desprotegido. Ver FR-026 e FR-027.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Dados pessoais protegidos no armazenamento (Priority: P1)

A organização precisa garantir que, se o conteúdo do banco de dados vazar (backup extraviado, acesso
indevido ao provedor, dump compartilhado para depuração), o CPF, a data de nascimento e o CEP dos
voluntários não sejam legíveis por quem obteve o arquivo. A proteção depende de um segredo mantido
fora do banco, controlado pela organização e configurável por ambiente.

**Why this priority**: é a obrigação central da LGPD que motiva a feature (art. 46 — medidas de
segurança aptas a proteger dados pessoais). Sem ela, nenhuma das demais entregas tem valor: mascarar
a exibição não protege contra vazamento do armazenamento. É também a única parte que exige migração
dos dados já existentes, portanto precisa vir primeiro.

**Independent Test**: inspecionar diretamente o conteúdo armazenado de um voluntário recém-cadastrado
e confirmar que CPF, data de nascimento e CEP não aparecem em texto legível; em seguida, abrir o mesmo
voluntário pelo sistema, com o segredo configurado, e confirmar que os dados voltam corretos e
completos. Entrega valor mesmo sem as demais histórias: os cadastros param de ficar expostos.

**Acceptance Scenarios**:

1. **Given** um voluntário envia candidatura com CPF, data de nascimento e CEP, **When** o cadastro é
   persistido, **Then** o conteúdo armazenado desses campos não contém os valores informados em forma
   legível.
2. **Given** um voluntário cujos dados foram armazenados protegidos, **When** o sistema exibe o
   cadastro para quem tem permissão de ver aquele campo completo, **Then** o valor apresentado é
   idêntico ao originalmente informado, sem perda de dígitos ou alteração de formato.
3. **Given** o segredo de proteção não está configurado no ambiente, **When** a aplicação é
   inicializada, **Then** ela recusa a inicialização com mensagem clara em pt-BR indicando a
   configuração ausente, em vez de operar gravando dados desprotegidos.
4. **Given** o banco contém cadastros gravados antes desta feature, **When** a migração de proteção é
   executada, **Then** todos os cadastros existentes passam a estar protegidos e permanecem legíveis
   pelo sistema, sem registros órfãos ou corrompidos.
5. **Given** um voluntário já cadastrado reenvia candidatura com o mesmo CPF, **When** o sistema
   verifica duplicidade, **Then** a candidatura existente é reaproveitada como antes, sem criar um
   segundo cadastro para o mesmo CPF.
6. **Given** a data de nascimento também é guardada na conta de usuário, além do cadastro de
   voluntário, **When** o cadastro é protegido, **Then** não resta cópia legível do dia e do mês em
   nenhum dos dois lugares.
7. **Given** um voluntário envia candidatura com data de nascimento de menor de 18 anos, **When** a
   candidatura é validada, **Then** a recusa por maioridade continua funcionando como hoje, apesar da
   proteção do campo.

---

### User Story 2 - Exibição mascarada por padrão (Priority: P1)

Qualquer pessoa que usa o sistema e vê dados de voluntários — na fila de triagem, nas listagens, nos
painéis de relatório, nos detalhes de alocação — vê os três campos sensíveis mascarados por padrão,
exceto nos casos previstos na Matriz de Visibilidade. O CPF aparece com os 2 primeiros e os 2 últimos
dígitos visíveis, o CEP segue a mesma regra, e a data de nascimento aparece com dia e mês ocultos.

**Why this priority**: é a segunda metade do pedido e a que reduz exposição no dia a dia — a maior
parte das visualizações de dados de voluntário acontece em telas de operação, em campo, com a tela à
vista de terceiros. É P1 porque sem ela os dados continuam expostos em uso normal, mesmo protegidos
no armazenamento.

**Independent Test**: acessar a fila de triagem e os painéis de relatório com uma conta
`membro_defesa_civil` e confirmar que CPF e data de nascimento aparecem mascarados e o CEP aparece
completo, em todas as telas e também nos arquivos exportados.

> **Depende da US1.** Diferente das outras três, esta história não é entregável sozinha: a apresentação
> mascarada decifra antes de mascarar, então sem a US1 no lugar o resultado é máscara sobre texto
> plano — cosmético, sem ganho de segurança. A ordem US1 → US2 é obrigatória.

**Acceptance Scenarios**:

1. **Given** um voluntário com CPF `12345678901`, **When** o CPF é exibido mascarado, **Then**
   aparecem os dígitos `12` no início e `01` no fim, com os dígitos intermediários substituídos por
   marcadores.
2. **Given** um voluntário nascido em `1990-03-15`, **When** a data de nascimento é exibida mascarada,
   **Then** o dia e o mês aparecem ocultos e o ano `1990` aparece legível.
3. **Given** um CEP `89250000`, **When** ele é exibido mascarado, **Then** aparecem `89` no início e
   `00` no fim, com os dígitos intermediários substituídos por marcadores.
4. **Given** um campo sujeito à máscara de 2+2 cujo valor tenha 5 caracteres ou menos, **When** ele é
   exibido mascarado, **Then** nenhum caractere original é revelado — o valor aparece inteiramente
   mascarado.
4. **Given** uma pessoa autenticada, **When** ela acessa qualquer tela que apresenta dados de
   voluntários, **Then** cada campo sensível aparece mascarado ou completo conforme a Matriz de
   Visibilidade, inclusive em listagens, detalhes, totalizadores e tooltips.
5. **Given** uma pessoa com acesso parcial (ex.: `membro_defesa_civil`), **When** ela exporta um
   relatório que contém dados de voluntários, **Then** o arquivo gerado traz completos apenas os
   campos que ela poderia ver completos na tela, e mascarados os demais.
6. **Given** um campo sensível opcional que está vazio, **When** ele é exibido, **Then** aparece a
   indicação de ausência já usada pelo sistema, não uma máscara que sugira existir conteúdo.

---

### User Story 3 - Acesso a dados completos restrito e rastreado (Priority: P2)

Quem tem permissão sobre um campo consegue revelar o valor completo sob demanda, a partir da tela
onde o dado aparece mascarado. Cada revelação é registrada na auditoria, com quem revelou, qual
voluntário, qual campo e quando.

**Why this priority**: é o escape necessário para que a operação não trave — a triagem de candidatura
exige conferir o CPF, e a logística de atendimento exige o CEP. Vem depois das duas primeiras porque,
sem elas, não há o que revelar. O registro de auditoria é o que torna o acesso privilegiado defensável
perante um titular que exerça seu direito de saber quem acessou seus dados.

**Independent Test**: com uma conta `coordenador`, revelar o CPF de um voluntário a partir da fila de
triagem, confirmar que o valor completo aparece, e verificar que a auditoria registrou a revelação com
ator, voluntário, campo e horário.

**Acceptance Scenarios**:

1. **Given** um `coordenador` na fila de Cadastros Pendentes, **When** ele solicita a revelação do CPF
   de uma candidatura, **Then** o CPF completo é apresentado na mesma tela e a aprovação segue
   possível.
2. **Given** uma revelação de campo sensível foi concluída, **When** a auditoria do período é
   consultada, **Then** existe um registro contendo quem revelou, de qual voluntário, qual campo e o
   momento da revelação.
3. **Given** um `membro_defesa_civil`, **When** ele tenta obter o CPF completo de um voluntário por
   qualquer caminho do sistema, **Then** o acesso é recusado e o valor completo não é entregue — ainda
   que o CEP completo continue acessível a ele.
4. **Given** o registro de auditoria da revelação falha, **When** a revelação é solicitada por quem
   tem permissão, **Then** a revelação é concluída e a falha de auditoria é registrada para
   reconciliação, seguindo a política de auditoria não bloqueante já vigente no sistema.

---

### User Story 4 - Titular acessa e exclui os próprios dados (Priority: P2)

O voluntário autenticado acessa uma área de conta onde vê os próprios dados cadastrais em texto
completo, sem máscara, e encontra um botão que solicita a exclusão de todos os seus dados. A exclusão
é uma ação irreversível e exige confirmação explícita antes de ser efetivada.

**Why this priority**: materializa dois direitos do titular previstos na LGPD — o acesso aos próprios
dados (art. 18, II) e a eliminação (art. 18, VI). É P2 e não P1 porque depende de o mascaramento já
existir para fazer sentido como exceção, e porque hoje **não existe nenhuma tela de conta ou perfil no
sistema** — esta história cria essa superfície do zero.

**Independent Test**: autenticar como voluntário, abrir a área de conta, confirmar que CPF, data de
nascimento e CEP aparecem completos, acionar a exclusão, confirmar, e verificar que os dados pessoais
deixaram de ser recuperáveis pelo sistema.

**Acceptance Scenarios**:

1. **Given** um voluntário autenticado com cadastro aprovado, **When** ele abre a área de conta,
   **Then** vê o próprio CPF, data de nascimento e CEP completos, sem máscara e sem precisar revelar.
2. **Given** um voluntário na área de conta, **When** ele aciona o botão de exclusão dos próprios
   dados, **Then** o sistema apresenta uma confirmação explícita, em pt-BR, que informa que a ação é
   irreversível e o que será perdido, antes de efetivar qualquer coisa.
3. **Given** um voluntário confirmou a exclusão, **When** a operação conclui, **Then** seus dados
   pessoais deixam de ser recuperáveis pelo sistema e nenhuma tela, consulta ou exportação volta a
   apresentá-los.
4. **Given** um voluntário confirmou a exclusão, **When** a operação conclui, **Then** a sessão dele é
   encerrada e ele não consegue mais autenticar com a conta excluída.
5. **Given** um voluntário com alocações futuras confirmadas, **When** ele solicita a exclusão,
   **Then** o sistema informa o impacto nas alocações antes da confirmação, e as vagas desses turnos
   voltam a ficar disponíveis após a conclusão.
6. **Given** um voluntário que cumpriu turnos no passado, **When** a exclusão conclui, **Then** os
   relatórios de participação daqueles períodos continuam somando o mesmo total de turnos cumpridos,
   sem identificar quem os cumpriu.
7. **Given** uma exclusão foi solicitada e concluída, **When** a auditoria do período é consultada,
   **Then** existe registro do pedido de exclusão, com momento e resultado, e os registros de
   auditoria anteriores daquele titular não apresentam mais dados que o identifiquem.
8. **Given** um voluntário que não tem cadastro de voluntário, apenas conta de usuário, **When** ele
   aciona a exclusão, **Then** a operação conclui normalmente sobre os dados que existem, sem erro.

---

### Edge Cases

- **Segredo ausente ou inválido**: a aplicação não inicializa e informa claramente a configuração
  ausente, em vez de gravar dados desprotegidos ou falhar de forma silenciosa durante um cadastro.
- **Segredo trocado sem reprocessar os dados**: os dados existentes deixam de ser legíveis. O sistema
  deve sinalizar a falha de leitura de forma explícita e distinguível de "campo vazio", para que a
  operação perceba o problema de configuração e não conclua que o cadastro está incompleto.
- **Dado protegido corrompido em uma única linha**: a tela não quebra; o campo afetado é apresentado
  com indicação de erro de leitura e o restante do cadastro continua utilizável.
- **Cópia da data de nascimento na conta de usuário**: o sistema guarda a data de nascimento em dois
  lugares — na conta de usuário e no cadastro de voluntário — e os mantém sincronizados. Proteger
  apenas um deixaria o dia e o mês legíveis no outro (FR-008).
- **Busca e ordenação por campo sensível**: localizar voluntário por CPF completo continua
  funcionando; ordenar ou filtrar por trecho parcial de campo protegido pode deixar de ser suportado —
  ver Assumptions.
- **Faixas etárias em relatórios**: continuam funcionando, pois o ano de nascimento permanece legível.
- **Migração interrompida**: a migração dos dados existentes pode ser re-executada com segurança, sem
  proteger duas vezes o mesmo valor nem corromper linhas já migradas.
- **Exclusão de titular com histórico operacional**: um voluntário que já cumpriu turnos deixa
  referências no histórico de atividades e na trilha de auditoria imutável. A anonimização preserva
  essas referências e remove a identificação (FR-023 a FR-027).
- **Trilha de auditoria com cópia legível**: os snapshots já gravados contêm os campos sensíveis em
  texto plano; sem tratamento, a auditoria se torna o elo mais fraco da feature (FR-026, FR-027).
- **Turno futuro perde participante por exclusão**: a vaga volta a ficar disponível e o turno não fica
  com contagem inconsistente.
- **Exclusão acionada duas vezes**: a segunda solicitação não gera erro nem efeito colateral.
- **Exclusão de titular que é também staff**: uma conta com role de staff que também tem cadastro de
  voluntário — a exclusão não pode deixar a operação sem o responsável por registros que exigem ator.
- **Logs e mensagens de erro**: nenhum campo sensível em texto plano aparece em log de aplicação,
  mensagem de erro, trilha de depuração ou payload de notificação.

## Requirements _(mandatory)_

### Functional Requirements

**Proteção no armazenamento**

- **FR-001**: O sistema MUST armazenar o CPF, a data de nascimento e o CEP do cadastro de voluntário
  de forma ilegível para quem tem acesso apenas ao conteúdo do banco de dados, sem acesso ao segredo
  da organização.
- **FR-002**: O segredo usado para proteger e recuperar os dados MUST ser fornecido por variável de
  ambiente, nunca armazenado no banco nem versionado no repositório, e MUST ser configurável de forma
  independente por ambiente (desenvolvimento, homologação, produção).
- **FR-003**: O sistema MUST recusar a inicialização, com mensagem explícita em pt-BR, quando o
  segredo estiver ausente ou não atender ao formato/tamanho mínimo exigido — nunca operar em modo
  degradado gravando dados desprotegidos.
- **FR-004**: O sistema MUST recuperar os valores originais integralmente, sem truncar nem alterar o
  conteúdo informado pelo voluntário.
- **FR-005**: O sistema MUST manter a garantia de CPF único por voluntário e a localização de cadastro
  existente por CPF, de modo que o reenvio de candidatura continue reaproveitando o cadastro, como
  hoje.
- **FR-006**: O sistema MUST preservar a validação de maioridade na submissão de candidatura, apesar
  da proteção da data de nascimento.
- **FR-007**: O sistema MUST converter os cadastros já existentes para a forma protegida em uma
  operação de migração idempotente, re-executável sem corromper dados já migrados.
- **FR-008**: O sistema MUST proteger a data de nascimento em todos os lugares onde ela é persistida,
  incluindo a cópia mantida na conta de usuário, de modo que não reste nenhuma cópia legível do dia e
  do mês.
- **FR-009**: O sistema MUST NOT expor campo sensível em texto plano em logs de aplicação, mensagens
  de erro, trilhas de depuração ou conteúdo de notificações enviadas.

**Mascaramento na apresentação**

- **FR-010**: O sistema MUST mascarar o CPF e o CEP preservando os 2 primeiros e os 2 últimos dígitos
  e substituindo os intermediários por marcadores. **Regra de exposição mínima**: quando um campo
  sujeito a esta máscara tiver 5 caracteres ou menos, o sistema MUST mascará-lo por inteiro — expor 2
  no início e 2 no fim revelaria praticamente o valor completo. A regra vale para qualquer campo que
  venha a entrar na classificação, não apenas CPF e CEP.
- **FR-011**: O sistema MUST mascarar a data de nascimento ocultando o dia e o mês e mantendo o ano
  legível.
- **FR-012**: O sistema MUST mascarar os dados sensíveis por padrão em todas as superfícies de
  apresentação — listagens, telas de detalhe, painéis de relatório, tooltips e arquivos exportados —
  sem exigir que cada tela nova se lembre de aplicar a máscara.
- **FR-013**: O sistema MUST apresentar a indicação de ausência já usada no sistema para campo
  sensível vazio, distinguindo visualmente "sem valor" de "valor mascarado".
- **FR-014**: O sistema MUST apresentar indicação explícita de falha de leitura quando um valor
  protegido não puder ser recuperado, distinguível de campo vazio, mantendo o restante do cadastro
  utilizável.

**Controle de acesso ao dado completo**

- **FR-015**: O sistema MUST conceder acesso ao valor completo de cada campo sensível exatamente
  conforme a Matriz de Visibilidade, avaliando campo a campo e role a role, recusando o acesso em
  qualquer outro caso e em qualquer caminho de leitura (tela, consulta, exportação).
- **FR-016**: Pessoas autorizadas sobre um campo MUST be able to revelar, sob demanda e a partir da
  tela onde o dado aparece mascarado, o valor completo daquele campo.
- **FR-017**: O sistema MUST registrar na auditoria cada revelação de dado completo, contendo ator,
  voluntário, campo revelado e momento, seguindo a política de auditoria não bloqueante já vigente.
- **FR-018**: O sistema MUST aplicar a mesma regra de permissão ao conteúdo dos arquivos exportados
  que aplica à tela que os originou.

**Direitos do titular**

- **FR-019**: O sistema MUST oferecer ao titular autenticado uma área de conta que apresenta os
  próprios dados cadastrais em texto completo, sem máscara e sem exigir ação de revelação.
- **FR-020**: O titular MUST be able to solicitar, a partir dessa área, a exclusão de todos os seus
  dados.
- **FR-021**: O sistema MUST exigir confirmação explícita antes de efetivar a exclusão, informando em
  pt-BR que a ação é irreversível e o que será perdido, incluindo o impacto sobre alocações futuras
  confirmadas.
- **FR-022**: Após a exclusão, o sistema MUST tornar os dados pessoais do titular não recuperáveis e
  MUST NOT voltar a apresentá-los em nenhuma tela, consulta ou exportação.
- **FR-023**: O sistema MUST eliminar na exclusão todos os itens listados como "Eliminado" na seção
  **Alcance da Exclusão**, incluindo os campos pessoais que não são protegidos por criptografia nesta
  feature (nome, telefone, bairro, profissão, restrições de saúde).
- **FR-024**: O sistema MUST preservar as linhas de participação em turnos do titular excluído,
  desvinculadas de sua identidade, de modo que contagens e relatórios de períodos passados continuem
  produzindo os mesmos totais.
- **FR-025**: O sistema MUST liberar as vagas dos turnos futuros em que o titular excluído estava
  confirmado, sem deixar a contagem de vagas do turno inconsistente.
- **FR-026**: O sistema MUST NOT gravar, a partir desta feature, os campos sensíveis em texto plano na
  trilha de auditoria — a trilha registra que o campo mudou, sem reproduzir o valor completo.
- **FR-027**: O sistema MUST remover, em uma operação única de remediação executada junto da migração
  de proteção, os campos sensíveis em texto plano já presentes nos snapshots de auditoria gravados
  antes desta feature. Essa remediação MUST ser registrada como evento próprio, e é a **única**
  exceção admitida à imutabilidade da trilha.
- **FR-028**: Após a exclusão, o sistema MUST encerrar a sessão do titular e impedir nova autenticação
  com a conta excluída.
- **FR-029**: O sistema MUST registrar na auditoria o pedido de exclusão, com momento e resultado, sem
  reintroduzir na trilha os dados pessoais que acabou de eliminar.
- **FR-030**: O sistema MUST tratar uma segunda solicitação de exclusão para o mesmo titular sem erro
  e sem efeito colateral.
- **FR-031**: O sistema MUST impedir que a exclusão deixe sem ator registros operacionais que exigem
  responsável, quando o titular também possui role de staff.

### Key Entities

- **Cadastro de Voluntário**: extensão do usuário com os dados pessoais declarados na candidatura.
  Passa a distinguir, para cada campo sensível, o valor protegido no armazenamento, a forma mascarada
  apresentada por padrão e o valor completo, acessível apenas conforme a Matriz de Visibilidade.
- **Campo Sensível**: classificação declarada de um dado pessoal do voluntário — nesta feature, CPF,
  data de nascimento e CEP. Determina a regra de máscara do campo e o conjunto de roles que podem ver
  seu valor completo.
- **Segredo de Proteção**: valor fornecido pelo ambiente de execução, necessário para recuperar os
  dados protegidos. Vive fora do banco de dados e é o controle que torna o conteúdo do banco
  ininteligível sem ele.
- **Registro de Revelação**: entrada de auditoria produzida quando alguém acessa o valor completo de
  um campo sensível. É o que permite responder a um titular quem acessou seus dados.
- **Pedido de Exclusão**: solicitação do titular para eliminar seus dados, com o momento, o resultado
  e o alcance do que foi eliminado. Produz registro de auditoria próprio, sem reproduzir os dados
  eliminados.
- **Titular Anônimo**: identidade residual a que passam a apontar os registros operacionais de alguém
  que pediu exclusão. Preserva a integridade das contagens históricas sem permitir reconstituir quem
  era a pessoa.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em uma inspeção do conteúdo armazenado de 100% dos cadastros de voluntários, nenhum
  valor de CPF, data de nascimento ou CEP aparece em forma legível — nem no cadastro de voluntário,
  nem na conta de usuário.
- **SC-002**: 100% das telas e dos arquivos exportados que apresentam dados de voluntários aplicam a
  Matriz de Visibilidade corretamente, campo a campo — verificado por varredura de todas as
  superfícies de apresentação existentes, com uma conta de cada role.
- **SC-003**: 100% das tentativas de obter valor completo de campo sensível fora da Matriz de
  Visibilidade são recusadas, em todos os caminhos de leitura testados.
- **SC-004**: 100% das revelações de dado completo e 100% dos pedidos de exclusão têm registro de
  auditoria correspondente.
- **SC-005**: A migração dos cadastros existentes conclui sem perda: a quantidade de cadastros
  legíveis pelo sistema depois da migração é igual à de antes, e cada valor recuperado é idêntico ao
  original.
- **SC-006**: As telas de operação de campo que apresentam dados de voluntário continuam respondendo
  dentro da meta de 300ms já vigente para leituras críticas, sem regressão perceptível atribuível à
  proteção dos dados.
- **SC-007**: Uma busca de voluntário por CPF completo continua encontrando o cadastro existente em
  100% dos casos, preservando o fluxo de reenvio de candidatura.
- **SC-008**: A recusa de candidatura de menor de 18 anos continua ocorrendo em 100% dos casos.
- **SC-009**: Nenhum relatório ou agregação do sistema depende do dia ou do mês de nascimento —
  verificado por varredura das consultas de relatório. O ano permanece legível pela máscara, de modo
  que uma agregação futura por faixa etária continue possível sem reverter a proteção.
- **SC-010**: Após uma exclusão solicitada pelo titular, nenhuma das superfícies de apresentação do
  sistema retorna dado pessoal daquele titular — verificado varrendo todas as telas, consultas e
  exportações que antes o apresentavam.
- **SC-011**: Após uma exclusão, os relatórios de participação dos períodos em que o titular cumpriu
  turnos retornam exatamente os mesmos totais de antes da exclusão.
- **SC-012**: Uma inspeção da trilha de auditoria completa não encontra CPF, data de nascimento ou CEP
  em texto plano — nem nos registros novos, nem nos remediados.
- **SC-013**: Uma varredura dos logs de aplicação de um ciclo completo de cadastro, triagem, aprovação
  e alocação não encontra nenhum campo sensível em texto plano.

## Clarifications

### Resolvidas em 2026-10-31

- **Q1 — Campos sensíveis**: CPF, dia e mês da data de nascimento, CEP. Ver a tabela em **Escopo dos
  Dados Sensíveis**.
- **Q2 — Visibilidade**: não é global, é por campo e por role. Ver **Matriz de Visibilidade**. A
  decisão preserva a triagem: o `coordenador` continua conseguindo conferir o CPF para aprovar
  candidatura.
- **Q3 — Titular**: vê os próprios dados completos e pode solicitar a exclusão de todos os seus dados
  (User Story 4).
- **Q4 — Alcance da exclusão**: **anonimização** (opção A). Os dados pessoais são eliminados; o
  histórico operacional e a trilha de auditoria são preservados sem identificar o titular. Ver
  **Alcance da Exclusão (Anonimização)**. A análise do código revelou que a trilha de auditoria guarda
  hoje os campos sensíveis em texto plano, o que exige uma remediação única dos snapshots já gravados
  (FR-027) — detalhada em **Riscos Conhecidos**.

### Pendentes

Nenhuma. As quatro perguntas foram resolvidas e a spec está pronta para `/speckit-plan`.

## Assumptions

- **Escopo limitado a voluntários**: o pedido trata dos dados de voluntários. Os outros contextos do
  sistema (Estoque/Doações, Logística) não têm campos pessoais sensíveis equivalentes no cadastro
  atual e ficam fora desta feature.
- **Telefone, profissão, bairro, nome e restrições de saúde ficam fora da proteção**, por decisão do
  responsável em Q1. Ver a ressalva registrada em **Riscos Conhecidos** abaixo.
- **Esta é a decisão documentada exigida pela Constituição**: o Princípio IV determina hoje "não
  introduzir criptografia a nível de campo sem decisão documentada". Esta spec é essa decisão, e a
  Constituição precisará de emenda (bump MINOR) registrando a mudança de postura e a motivação de
  conformidade com a LGPD. Sem essa emenda, a implementação contradiz o princípio vigente.
- **Revelação sob demanda, não exibição automática**: para quem tem permissão sobre um campo, o dado
  completo é revelado por ação explícita, não exibido de imediato ao abrir a tela. A exceção é o
  titular vendo os próprios dados (FR-019), onde a exibição é direta. Isso reduz exposição de tela em
  campo e dá significado ao registro de auditoria.
- **Rotação do segredo fora do escopo v1**: o segredo é definido por variável de ambiente e pode ser
  substituído, mas um procedimento automatizado de rotação com reprocessamento de todos os dados não
  faz parte desta entrega. O requisito desta spec é que a troca de segredo falhe de forma visível
  (FR-014), não que seja transparente.
- **Busca por CPF completo, não parcial**: localizar voluntário por CPF inteiro continua suportado
  (FR-005). Busca por trecho parcial de campo protegido não é requisito desta feature.
- **Marcador de máscara**: o caractere ou símbolo usado como marcador seguirá o padrão visual do
  design system do projeto; não é objeto de decisão nesta spec.
- **Mascaramento acontece no servidor**: o valor completo não é entregue ao navegador de quem não tem
  permissão de vê-lo, de modo que a máscara não seja contornável inspecionando a resposta.
- **A auditoria existente é reaproveitada**: os registros de revelação e de exclusão usam o mecanismo
  centralizado de auditoria já vigente e herdam sua política de degradação não bloqueante.
- **Migração em janela controlada**: a conversão dos cadastros existentes é executada como operação
  administrativa única, não como conversão preguiçosa durante o uso normal.
- **A área de conta do titular é nova**: não existe hoje nenhuma tela de perfil ou conta no sistema. A
  User Story 4 cria essa superfície, com o escopo mínimo de apresentar os próprios dados e oferecer a
  exclusão — não é uma tela de edição de perfil.
- **Exclusão é imediata, sem período de carência**: a confirmação efetiva a operação. Um período de
  arrependimento com exclusão agendada não faz parte desta entrega.
- **A auditoria deixa de registrar o valor dos campos sensíveis**: por FR-026, a trilha passa a
  registrar que o campo mudou sem reproduzir o valor. O custo aceito é perder a capacidade de
  reconstituir, pela trilha, qual era o CPF antes de uma correção — a detecção da mudança permanece.
  Decisão tomada por padrão razoável, não solicitada explicitamente; contestável.
- **A anonimização não reaproveita o e-mail**: o endereço do titular excluído é liberado ou
  neutralizado de forma que a conta não seja reativável, sem bloquear um futuro cadastro independente
  da mesma pessoa.
- **Sem portabilidade de dados nesta entrega**: o direito de portabilidade (LGPD art. 18, V) não faz
  parte do escopo. A área de conta apresenta os dados, mas não os exporta em formato interoperável.

## Riscos Conhecidos

- **Restrições de saúde ficam sem proteção.** Por decisão de Q1, `restricoesSaude` não entra no
  conjunto protegido. Vale registrar que a LGPD classifica dado referente à saúde como **dado pessoal
  sensível** (art. 5º, II) — a categoria de proteção mais estrita da lei, sujeita a hipóteses de
  tratamento próprias (art. 11) —, enquanto CPF e CEP são dados pessoais comuns. O resultado é que o
  campo juridicamente mais protegido permanece legível no banco enquanto campos de categoria comum são
  criptografados. A Constituição do projeto (Princípio IV) também cita `restricoesSaude` junto com
  `cpf` como os dados sensíveis do sistema. Incluí-lo custaria pouco a mais nesta feature e muito mais
  depois. A decisão é do responsável; esta spec segue com o escopo de Q1.
- **Telefone permanece legível**, sendo o principal vetor de contato indevido num eventual vazamento.
  Mesmo raciocínio: incluir agora é mais barato que incluir depois.
- **A trilha de auditoria exige uma exceção pontual à imutabilidade.** O mecanismo de auditoria grava
  o snapshot inteiro do registro alterado, de modo que a trilha já acumulada contém CPF, data de
  nascimento e CEP em texto plano. Criptografar apenas o banco relacional deixaria a auditoria como
  cópia legível dos mesmos dados, e a anonimização de um titular seria incompleta. O tratamento
  previsto (FR-026 e FR-027) exige **uma** remediação única dos snapshots já gravados — a única
  exceção admitida ao Princípio V. Isso precisa constar da emenda da Constituição, junto da emenda do
  Princípio IV.
- **A exclusão não alcança backups e cópias de retenção do provedor de banco.** Um titular excluído
  pode permanecer em backups até que o ciclo de retenção expire. Tratar isso exige política de
  retenção documentada, que não faz parte desta entrega.
