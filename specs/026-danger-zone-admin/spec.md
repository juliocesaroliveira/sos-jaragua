# Feature Specification: Danger Zone — manutenção irrestrita de dados pelo administrador

**Feature Branch**: `026-danger-zone-admin`

**Created**: 2026-11-10

**Status**: Draft

**Input**: User description: "quero implementar um danger zone na aplicacao que sera acessivel somente por admins. Essa pagina devera permitir manipular as tabelas do banco de dados de forma irrestrita, como por exemplo ter a possibilidade de resetar tabelas. Todas as acoes devem ter uma confirmacao do usuario explicando de forma detalhada o que vai acontecer se a acao solicitada for efetivada. Caso uma acao de reset de uma tabela for solicitada, deve ser perguntado se quer ser feito um delete cascade, demonstrando tudo que vai ser perdido. Caso o delete cascade nao for aceito, as fks deverao ter valor padrao"

## Resumo

Hoje, qualquer limpeza de dados em massa — apagar os registros de um exercício simulado, zerar o
estoque depois de um inventário, remover cadastros de teste antes de abrir a operação ao público —
exige alguém com acesso direto ao banco. Isso concentra a operação em quem conhece o banco, não
deixa rastro na trilha de auditoria da aplicação e não avisa, antes de executar, o que mais será
arrastado junto.

A **Danger Zone** é uma área exclusiva do papel **Administrador** que expõe essas operações
destrutivas dentro da aplicação, com duas garantias que o acesso direto não oferece:

1. **Nenhuma ação executa sem uma confirmação que diga, em linguagem clara, exatamente o que vai
   acontecer** — quais dados somem, quantos registros, quais outras áreas do sistema são afetadas
   e se há como desfazer.
2. **O reset de uma tabela nunca apaga dependentes em silêncio**: o administrador escolhe entre
   apagar em cascata (vendo antes tudo o que será perdido, tabela por tabela, com contagens) ou
   preservar os registros dependentes, que passam a apontar para um valor padrão.

## Clarifications

### Session 2026-11-10

- Q1: Até onde vai "manipular de forma irrestrita"? → **Reset de tabela inteira + exclusão de
  registros selecionados.** Edição de valores de campos fica fora do escopo (a antiga história de
  edição foi removida); alterações de dados continuam pelas telas normais do sistema.
- Q2: Quais tabelas ficam protegidas? → **Nenhuma.** Todas as tabelas de dados operacionais,
  inclusive usuários, sessões, contas de login e verificações, podem ser resetadas. As únicas
  salvaguardas são em nível de registro: a conta e a sessão do administrador que executa a ação,
  a existência de ao menos um administrador ativo e os registros padrão (Q3).
- Q3: Qual é o valor padrão das FKs quando a cascata é recusada? → **Vínculo opcional fica vazio;
  vínculo obrigatório passa a apontar para um registro padrão da tabela de destino** (ex.:
  "Usuário removido", "Item removido", "Categoria removida"), criado e mantido pelo sistema e que
  nenhuma ação da Danger Zone apaga.
- Q: No modo preservação, o que acontece com vínculos que o banco hoje já apaga em cascata? →
  A: A Danger Zone usa uma **classificação própria por vínculo**, independente da regra do banco:
  só vínculos **inseparáveis** (ex.: sessões, itens de uma saída, linhas de receita de kit) são
  apagados na preservação; vínculos de **histórico** (ex.: alocações, notificações, entradas,
  atividades) vão para o valor padrão mesmo que o banco hoje faça cascata.
- Q: O que a trilha de auditoria guarda dos registros apagados pela Danger Zone? → A: **Resumo
  da ação + snapshot de cada registro apagado ou alterado**, com campos sensíveis redigidos.
- Q: Quando a ação apaga registros que alimentam dados calculados (saldo de estoque, métricas de
  kit), recalcular ou só avisar? → A: **Recalcular na mesma execução atômica**, com a prévia
  mostrando o valor antes e depois.
- Q: A Danger Zone deve recusar a execução quando a trilha de auditoria estiver indisponível,
  apesar do Princípio V (auditoria não bloqueante)? → A: **Sim, bloquear**, como exceção restrita à
  Danger Zone, justificada no plano (Complexity Tracking); o Princípio V segue valendo para o resto
  do sistema, sem emenda da constituição.
- Q: A Danger Zone fica sempre disponível em produção ou depende de uma chave de configuração do
  ambiente? → A: **Sempre disponível em todos os ambientes, inclusive produção**, sem chave de
  ativação; a proteção é o papel Administrador, a reautenticação e a confirmação digitada.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Resetar uma tabela vendo o impacto completo (Priority: P1)

O administrador abre a Danger Zone, vê a lista de tabelas do sistema com o número atual de
registros de cada uma e escolhe "Resetar" em uma delas. Antes de qualquer execução, o sistema
mostra um resumo do que vai acontecer e, se existirem registros em outras tabelas que dependem da
tabela escolhida, pergunta: **apagar também os dependentes (cascata) ou preservá-los apontando
para um valor padrão?** Para a opção cascata, é exibida a árvore completa de perdas — cada tabela
afetada, quantos registros dela serão apagados e por qual vínculo. Para a opção de preservação, é
exibido quais tabelas terão vínculos substituídos, quantos registros e qual valor padrão será
usado. Só depois de o administrador digitar a confirmação exigida a ação é executada, e o
resultado (registros apagados e atualizados por tabela) é apresentado.

**Why this priority**: é o caso de uso que motivou a feature e o de maior risco. Sozinho, já
entrega o valor principal: limpar dados em massa com previsibilidade total.

**Independent Test**: com um banco de teste populado, resetar `kit` e verificar que (a) a prévia
listou `kit_receita_item` e `metrica_kit` com as contagens corretas, (b) na cascata esses
registros sumiram, (c) na preservação as entradas de estoque que apontavam para um kit ficaram com
o kit de destino vazio e nada além de `kit` e dos dependentes inseparáveis declarados na prévia
(`kit_receita_item`, `metrica_kit`) foi apagado.

**Acceptance Scenarios**:

1. **Given** uma tabela sem nenhum dependente de histórico com registros (só inseparáveis, ou
   nenhum), **When** o administrador solicita o reset, **Then** a confirmação mostra a contagem de
   registros que serão apagados, lista os inseparáveis que vão junto (se houver) e não oferece a
   escolha cascata/preservação — os dois modos teriam o mesmo resultado.
2. **Given** uma tabela com dependentes de histórico com registros, **When** o administrador
   solicita o reset, **Then** o sistema exige a escolha entre cascata e preservação antes de
   mostrar a confirmação final.
3. **Given** a opção cascata, **When** a prévia é exibida, **Then** ela lista todas as tabelas
   afetadas em qualquer nível de profundidade (dependentes de dependentes), com a contagem de
   registros de cada uma e o total geral.
4. **Given** a opção preservação, **When** a prévia é exibida, **Then** ela lista cada vínculo que
   será substituído, a quantidade de registros afetados e o valor padrão que passará a constar.
5. **Given** a confirmação final, **When** o administrador não digita exatamente o texto exigido,
   **Then** o botão de execução permanece desabilitado.
6. **Given** que os dados mudaram entre a prévia e a execução (alguém criou registros nesse
   intervalo), **When** o administrador confirma, **Then** o sistema detecta a divergência, não
   executa e reapresenta a prévia atualizada.
7. **Given** que qualquer etapa da execução falha, **When** o erro ocorre, **Then** nada é
   alterado (tudo ou nada) e o administrador vê uma mensagem em pt-BR explicando o motivo.

---

### User Story 2 — Apagar registros específicos de uma tabela (Priority: P2)

O administrador abre uma tabela na Danger Zone, navega pelos registros (com paginação e busca),
seleciona um ou mais e pede para apagá-los. O mesmo fluxo da história 1 se aplica — prévia de
dependentes, escolha cascata/preservação, confirmação detalhada — só que restrito aos registros
selecionados.

**Why this priority**: cobre a limpeza cirúrgica (um cadastro de teste, um lote de entrada
lançado em duplicidade) sem obrigar a zerar uma tabela inteira.

**Independent Test**: apagar um único `item` que possui entradas e verificar que a prévia mostra
apenas os dependentes daquele item, não de todos.

**Acceptance Scenarios**:

1. **Given** registros selecionados, **When** o administrador pede para apagá-los, **Then** a
   prévia considera apenas os dependentes desses registros.
2. **Given** a tabela em visualização, **When** ela contém campos sensíveis, **Then** eles
   aparecem mascarados, seguindo a mesma política de mascaramento do resto do sistema.

---

### User Story 3 — Histórico das ações executadas (Priority: P3)

O administrador consulta, dentro da própria Danger Zone, a lista de ações destrutivas já
executadas: quem executou, quando, sobre qual tabela, qual modo (cascata ou preservação) e quantos
registros foram apagados ou alterados em cada tabela.

**Why this priority**: dá responsabilização e permite reconstruir o que aconteceu depois de uma
limpeza; depende das histórias anteriores para ter conteúdo.

**Independent Test**: executar um reset e verificar que ele aparece no histórico com o resumo
idêntico ao exibido na tela de resultado.

**Acceptance Scenarios**:

1. **Given** um reset executado, **When** o histórico é aberto, **Then** a ação aparece com
   ator, data/hora, tabela, modo e contagens por tabela.
2. **Given** uma tentativa cancelada ou que falhou, **When** o histórico é aberto, **Then** ela
   também aparece, marcada como não efetivada.

---

### Edge Cases

- **O administrador reseta a tabela de usuários**: a conta do próprio administrador que executa a
  ação nunca é apagada, e o sistema impede qualquer ação que deixe o sistema sem nenhum
  administrador ativo. A prévia lista essas exceções ("1 registro preservado: sua conta").
- **O administrador reseta sessões ou contas de login**: todos os demais usuários são
  desconectados (ou perdem o meio de login, no caso de contas); a sessão e a conta de login do
  administrador que executa a ação são preservadas, para que ele não perca o acesso no meio da
  operação. A prévia diz isso em linguagem direta.
- **Vínculo obrigatório na preservação** (ex.: uma atividade precisa ter um criador): o vínculo
  passa a apontar para o registro padrão da tabela de destino (FR-012). Se a tabela resetada é a
  própria tabela de destino, o registro padrão sobrevive ao reset — é o "1 registro preservado"
  da prévia.
- **Registro padrão ainda não existe** (base antiga, ou removido por fora da aplicação): o sistema
  o recria antes de substituir os vínculos, dentro da mesma execução atômica.
- **Pedido de exclusão de registro padrão**: o registro padrão não pode ser selecionado para
  exclusão; aparece na listagem marcado como "registro do sistema".
- **Vínculo inseparável** (ex.: sessões de um usuário, itens de uma saída): a opção de
  preservação não se aplica a esses vínculos; a prévia deixa explícito que esses registros serão
  apagados em qualquer modo, e por quê.
- **Vínculo de histórico que o banco hoje apaga em cascata** (ex.: alocações de um voluntário
  quando o usuário é apagado): na preservação, a Danger Zone substitui o vínculo pelo registro
  padrão antes de apagar o pai, de modo que o histórico de turnos sobrevive.
- **Reset de entradas de estoque**: o saldo de cada item afetado é recalculado a partir das
  movimentações remanescentes; se o resultado for negativo (saídas sem as entradas que as
  justificavam), a prévia destaca os itens com saldo negativo antes da confirmação.
- **Ciclo de dependências** entre tabelas: a prévia não entra em loop; cada tabela aparece uma
  única vez na árvore de impacto.
- **Tabela vazia**: a ação de reset aparece desabilitada com a indicação "sem registros".
- **Volume grande** (dezenas de milhares de registros): a prévia continua mostrando contagens
  exatas; a lista individual de registros é truncada com "e mais N registros".
- **Dois administradores executando ações sobrepostas ao mesmo tempo**: a segunda execução detecta
  que os dados mudaram desde a prévia dela e não executa (cenário 1.6).
- **Sessão do administrador expira entre a prévia e a confirmação**: a execução é recusada e o
  administrador precisa autenticar de novo. Sem sessão válida não há ator verificável, então a
  tentativa não entra na trilha de auditoria (que registraria um ator não comprovado); ela fica
  num log estruturado do servidor (`[manutencao] tentativa sem sessão válida`, com tabela, ação,
  IP e horário, sem dados das linhas).
- **Administrador fecha a aba sem cancelar**: nada é registrado — só o cancelamento explícito
  gera evento no histórico.
- **Trilha de auditoria indisponível no momento da execução**: a ação destrutiva não executa (ver
  FR-016), diferentemente das operações de campo.
- **Gravação dos snapshots falha depois do banco já alterado**: a execução é tratada como falha e
  revertida por inteiro (FR-015); não existe ação efetivada sem os snapshots correspondentes.

## Requirements _(mandatory)_

### Functional Requirements

**Acesso**

- **FR-001**: A Danger Zone MUST ser acessível exclusivamente a usuários com o papel
  Administrador; qualquer outro papel recebe a mesma resposta de acesso negado usada no resto do
  sistema, e a verificação de papel é repetida em cada ação executada, não só ao abrir a
  página.
- **FR-002**: O item de navegação para a Danger Zone MUST aparecer apenas para administradores e
  MUST ser visualmente distinto das áreas operacionais (sinalização de risco).
- **FR-002a**: A Danger Zone MUST estar disponível em todos os ambientes, inclusive produção, sem
  depender de chave de ativação; o ambiente atual MUST ser exibido de forma destacada no topo da
  página e repetido no texto da confirmação final.
- **FR-003**: Toda ação destrutiva MUST exigir sessão recente: se o administrador autenticou há
  mais de 15 minutos, o sistema MUST pedir nova autenticação (pelo mesmo meio de login que ele
  usa — senha ou provedor social) antes de executar.

**Inventário de tabelas**

- **FR-004**: O sistema MUST listar as tabelas de dados operacionais com nome amigável em pt-BR,
  nome técnico, área do sistema a que pertencem (Identidade, Voluntariado, Estoque, Logística,
  Notificações) e contagem atual de registros.
- **FR-005**: O sistema MUST exibir, para cada tabela, quais outras tabelas dependem dela e de
  quais ela depende.
- **FR-006**: Todas as tabelas de dados operacionais MUST estar disponíveis para ações
  destrutivas — nenhuma tabela é protegida por inteiro, inclusive usuários, sessões, contas de
  login e verificações. A proteção é por registro: conta e sessão do administrador executor,
  último administrador ativo (FR-018) e registros padrão (FR-012). Para tabelas de autenticação,
  a confirmação MUST alertar explicitamente o efeito sobre o acesso das pessoas (desconexão,
  perda do meio de login).

**Ações disponíveis**

- **FR-007**: O administrador MUST poder resetar uma tabela (apagar todos os seus registros).
- **FR-008**: O administrador MUST poder apagar registros selecionados de uma tabela.
- **FR-009**: A Danger Zone MUST NOT oferecer edição de valores de campos, inserção de registros
  nem execução de comandos livres sobre o banco; suas únicas ações sobre dados são as de FR-007 e
  FR-008.

**Prévia de impacto e confirmação**

- **FR-010**: Antes de qualquer ação, o sistema MUST apresentar uma confirmação detalhada
  contendo: a ação solicitada; a tabela e a área do sistema; quantos registros serão apagados ou
  alterados; quais outras tabelas serão afetadas e como; as consequências práticas para quem usa
  o sistema (ex.: "voluntários perderão o histórico de turnos", "usuários serão desconectados");
  e a declaração explícita de que a ação **não pode ser desfeita** pela aplicação.
- **FR-011**: Quando a ação apagar registros que possuem dependentes **de histórico** (FR-013), o
  sistema MUST perguntar se o administrador deseja apagar em cascata; quando só há dependentes
  inseparáveis, a escolha não é oferecida, porque os dois modos dão o mesmo resultado. O sistema
  MUST mostrar, para a opção cascata, a árvore
  completa do que será perdido: cada tabela atingida em qualquer nível, a contagem de registros
  por tabela, o total geral e uma amostra identificável dos registros (ex.: nome do item, título
  da atividade) com campos sensíveis mascarados.
- **FR-012**: Quando a cascata não for aceita, os registros dependentes MUST ser preservados e
  seus vínculos com os registros apagados MUST passar a apontar para um valor padrão: vínculo
  **opcional** fica vazio; vínculo **obrigatório** aponta para o **registro padrão** da tabela de
  destino (ex.: "Usuário removido", "Item removido"). A prévia MUST mostrar, para cada vínculo,
  quantos registros serão alterados e qual valor padrão será usado.
- **FR-012a**: Cada tabela que é destino de pelo menos um vínculo **de histórico** obrigatório (hoje:
  usuários, itens e categorias de atividade) MUST ter exatamente
  um registro padrão, identificável como "registro do sistema", que nenhuma ação da Danger Zone
  apaga e que o sistema recria se estiver ausente. O registro padrão de usuário MUST NOT conseguir
  autenticar nem receber notificações.
- **FR-013**: Cada vínculo MUST ter uma classificação explícita mantida pela Danger Zone, que
  prevalece sobre a regra de exclusão declarada hoje no banco: **inseparável** (o registro filho
  não tem sentido sem o pai — ex.: sessões de um usuário, itens de uma saída, linhas de receita de
  kit) ou **histórico** (o registro filho documenta algo que aconteceu — ex.: alocações em turnos,
  notificações, entradas de estoque, atividades). Na preservação, vínculos inseparáveis MUST ser
  apagados e vínculos de histórico MUST receber o valor padrão (FR-012), mesmo quando o banco hoje
  apagaria em cascata; na cascata, ambos são apagados. A prévia MUST mostrar a classificação de
  cada vínculo afetado e listar os inseparáveis separadamente.
- **FR-013a**: Todo vínculo existente no banco MUST estar classificado; um vínculo sem
  classificação (ex.: criado por migração posterior) MUST bloquear as ações sobre as tabelas que
  ele liga, com mensagem indicando o vínculo pendente, em vez de assumir um comportamento.
- **FR-014**: A execução MUST exigir que o administrador digite um texto de confirmação que
  contenha o nome da tabela (ex.: `RESETAR kit`); o botão de execução permanece desabilitado até
  o texto conferir exatamente.
- **FR-015**: A execução MUST ser atômica (tudo ou nada) e MUST ser recusada se as contagens no
  momento da execução divergirem das contagens exibidas na prévia confirmada.
- **FR-015a**: Quando a ação apagar ou desvincular registros que alimentam dados calculados (ex.:
  saldo de estoque a partir de entradas, saídas e descartes; métricas de kit), o sistema MUST
  recalcular esses dados dentro da mesma execução atômica, e a prévia MUST mostrar, por item
  afetado, o valor atual e o valor resultante. Se o recálculo falhar, a ação inteira é revertida.

**Auditoria e segurança operacional**

- **FR-016**: Toda ação executada ou tentada por um administrador com sessão válida MUST ser
  registrada na trilha de auditoria com
  ator, data/hora, ação, tabela, modo (cascata/preservação), contagens por tabela e resultado.
  Para ações efetivadas, a trilha MUST guardar também um **snapshot de cada registro apagado** e,
  para registros cujo vínculo foi substituído pelo valor padrão, o valor anterior do vínculo —
  todos ligados ao identificador da execução, para permitir reconstrução manual. Valores de campos
  sensíveis MUST ser redigidos nos snapshots, como no restante da trilha. Se a trilha estiver
  indisponível, a ação destrutiva MUST NOT executar e o administrador MUST ver mensagem explicando
  que a ação foi recusada por falta de auditoria. Esta é uma exceção deliberada e **restrita à
  Danger Zone** à política de auditoria não bloqueante do projeto (Princípio V): ações
  destrutivas em massa não são operações de campo e não podem acontecer sem rastro. A exceção não
  se estende a nenhuma outra área do sistema.
- **FR-017**: A Danger Zone MUST NOT alterar ou apagar registros da trilha de auditoria.
- **FR-018**: O sistema MUST impedir que o administrador apague a própria conta, a própria sessão
  ativa e a própria conta de login, e MUST impedir qualquer ação cujo resultado deixe o sistema sem
  ao menos um administrador ativo; registros poupados por esta regra MUST aparecer na prévia.
- **FR-019**: Após a execução, o sistema MUST exibir o resultado real (registros apagados e
  alterados por tabela) e MUST garantir que as telas do sistema reflitam os dados novos sem
  exigir que outros usuários recarreguem manualmente dados em cache.
- **FR-020**: Todos os textos da Danger Zone (rótulos, prévias, confirmações, erros) MUST estar
  em pt-BR.

### Key Entities

- **Tabela gerenciável**: uma tabela de dados operacionais exposta na Danger Zone — nome amigável,
  nome técnico, área do sistema, contagem de registros e quantidade de registros do sistema (padrão) que ela contém.
- **Vínculo (dependência)**: relação entre uma tabela filha e uma tabela pai — qual campo aponta
  para qual tabela, se é obrigatório, como o banco se comporta hoje quando o pai é apagado
  (apaga junto, bloqueia, ou limpa o vínculo), a **classificação da Danger Zone** (inseparável ou
  histórico) e qual valor padrão usar na preservação.
- **Prévia de impacto**: o retrato calculado antes da execução — ação, modo, árvore de tabelas
  afetadas com contagens, vínculos a substituir, amostra de registros e um identificador da
  versão dos dados usada para detectar divergência na execução.
- **Execução de ação destrutiva**: o registro do que foi feito — ator, data/hora, prévia
  confirmada, contagens reais, resultado (efetivada, cancelada, recusada, falhou).
- **Registro padrão**: registro de referência por tabela que recebe os vínculos de dependentes
  preservados quando o vínculo é obrigatório (ex.: um "Usuário removido" ou "Item removido").

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% das ações destrutivas executadas são precedidas por uma prévia cujas
  contagens coincidem com as contagens efetivamente apagadas/alteradas (verificável comparando a
  prévia com o resultado registrado).
- **SC-002**: Nenhum usuário sem papel Administrador consegue visualizar a Danger Zone ou
  executar qualquer ação dela, inclusive chamando a ação diretamente sem passar pela tela (0
  sucessos em testes de acesso negado).
- **SC-003**: Em 100% dos resets com a opção de preservação, nenhum registro fora da tabela
  escolhida e dos vínculos inseparáveis declarados na prévia é apagado.
- **SC-004**: Um administrador consegue resetar uma tabela com dependentes, da escolha da tabela
  à confirmação do resultado, em menos de 2 minutos, entendendo antes de confirmar o que será
  perdido (validado com um administrador real lendo a prévia e descrevendo o impacto).
- **SC-005**: A prévia de impacto de qualquer tabela é exibida em até 5 segundos com o volume
  de dados atual de produção.
- **SC-006**: 100% das ações executadas, recusadas ou com falha aparecem no histórico e na
  trilha de auditoria.
- **SC-007**: Nenhuma falha durante a execução deixa o banco em estado parcial (0 casos de reset
  parcialmente aplicado em testes de falha induzida).
- **SC-008**: Após 100% das ações efetivadas, o saldo de estoque de cada item afetado coincide
  com o recalculado a partir das movimentações remanescentes (0 divergências em verificação
  pós-execução).

## Assumptions

- **Escopo de dados**: a Danger Zone atua sobre os dados operacionais relacionais do sistema
  (Identidade, Voluntariado, Estoque, Logística, Notificações). A trilha de auditoria fica fora do
  alcance por definição — sua imutabilidade é um princípio do projeto — e é justamente onde a
  própria Danger Zone registra o que fez.
- **Registros padrão nas telas normais**: os registros padrão (ex.: "Usuário removido") podem
  aparecer em históricos e relatórios como autor/destino de registros preservados; o
  planejamento deve garantir que não apareçam como opção selecionável em formulários e listas de
  escolha.
- **Estrutura não muda**: "manipular tabelas" significa manipular **dados**. Criar, renomear ou
  apagar tabelas e colunas (estrutura do banco) continua sendo feito pelo fluxo de migrações do
  projeto, fora da aplicação.
- **Sem desfazer**: a aplicação não oferece "desfazer" para ações da Danger Zone; a recuperação
  completa depende da restauração pontual oferecida pelo provedor do banco, e a confirmação deixa
  isso explícito. Os snapshots da trilha (FR-016) permitem reconstrução manual parcial, sem os
  campos sensíveis.
- **Dados sensíveis**: amostras e listagens seguem a mesma política de mascaramento e visibilidade
  por papel já adotada pelo sistema; a Danger Zone não é um atalho para ver dados completos.
- **Anonimização vs. exclusão**: apagar um usuário com histórico operacional pela Danger Zone é
  uma ação distinta da eliminação a pedido do titular (que anonimiza no lugar); a prévia deve
  alertar que, para atender um pedido de titular, o caminho correto é a anonimização.
- **Reautenticação**: o limite de 15 minutos para exigir nova autenticação segue a prática comum
  para ações sensíveis. Como parte dos administradores entra só por provedor social (sem senha), a
  reautenticação é um novo login, não a digitação de senha (research D11).
- **Público**: o número de administradores é pequeno (poucas pessoas), então concorrência alta
  na Danger Zone não é um requisito; basta detectar e recusar sobreposição.
