# Feature Specification: Central de relatórios

**Feature Branch**: `023-central-relatorios`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "faca uma varredura no projeto buscando a criacao de relatorios. Deve ser criado uma nova secao de relatorios na aplicacao que podera ser acessada por membros da defesa civil e admins. Faca o levantamento de quais relatorios faz sentido ter na aplicacao com base nos dois banco de dados."

## Contexto

### O que existe hoje (varredura)

- **Tela "Relatórios"** já existe no menu (grupo "Operação"), restrita a **Membro da Defesa
  Civil** e **Administrador** — a mesma matriz de acesso pedida. Ela tem só **dois
  relatórios**, ambos de estoque e sem nenhum filtro:
  - **Inventário atual** — item, categoria, unidade, saldo, estoque mínimo (BR-REL-01).
  - **Histórico de saídas** — data, tipo (avulso/kit), destino, responsável pelo transporte,
    item, quantidade (BR-REL-01). Descartes ficam fora por construção (BR-EST-05).
  - Os dois exportam o conjunto **inteiro** em CSV ou XLSX.
- **Pacote de contingência** (BR-CON-01) é gerado na mesma tela: saldo atual + três
  formulários em branco para anotação manual.
- O card de atalho da home promete "dados de estoque, saídas **e voluntariado**", mas não há
  nenhum relatório de voluntariado.
- **A base de auditoria nunca é lida.** Toda escrita em Doação, Voluntário, Atividade,
  Usuário e Habilidade grava um registro imutável com autor, papel, antes e depois
  (BR-AUD-01, "serve para prestação de contas"), mas não existe tela nem exportação que
  permita consultá-lo.
- Não há relatório de entradas (doações recebidas), descartes, validades, estoque crítico,
  triagem, escalas, evolução da crise nem falhas de notificação, embora todos esses dados
  já estejam registrados.

### O que esta feature faz

Transforma a tela de Relatórios em uma **central de relatórios**: um catálogo agrupado por
assunto, onde cada relatório tem filtros (principalmente período), pré-visualização na tela
e exportação CSV/XLSX do resultado filtrado. Os dois relatórios atuais e o pacote de
contingência continuam existindo dentro da central.

### Catálogo de relatórios (levantamento)

Fontes: **base operacional** (cadastros e movimentações) e **base de auditoria** (trilha
imutável de alterações).

| #    | Relatório                         | Grupo        | Fonte       | Pergunta que responde                                                    | Situação      |
| ---- | --------------------------------- | ------------ | ----------- | ------------------------------------------------------------------------ | ------------- |
| R-01 | Inventário atual                  | Estoque      | Operacional | O que temos agora, e o que está abaixo do mínimo?                        | Existe; amplia |
| R-02 | Histórico de saídas               | Estoque      | Operacional | O que foi entregue à população, quando, para onde?                       | Existe; amplia |
| R-03 | Doações recebidas                 | Estoque      | Operacional | O que entrou, em que condição, com que validade, registrado por quem?    | Novo          |
| R-04 | Descartes                         | Estoque      | Operacional | O que foi baixado sem chegar à população, e por quê?                     | Novo          |
| R-05 | Estoque crítico                   | Estoque      | Operacional | Quais itens estão no mínimo ou abaixo dele?                              | Novo          |
| R-06 | Validades                         | Estoque      | Operacional | Que doações perecíveis venceram ou vão vencer em breve?                  | Novo          |
| R-07 | Movimentação por item             | Estoque      | Operacional | Saldo inicial, entradas, saídas, descartes e saldo final no período      | Novo          |
| R-08 | Entregas por destino              | Estoque      | Operacional | Quanto cada bairro/abrigo recebeu, por categoria?                        | Novo          |
| R-09 | Voluntários cadastrados           | Voluntariado | Operacional | Quem são, onde moram, o que sabem fazer, com que veículo?                | Novo          |
| R-10 | Triagem de candidaturas           | Voluntariado | Operacional | Quantas candidaturas chegaram, foram decididas, e quanto tempo levou?   | Novo          |
| R-11 | Capacidade por habilidade         | Voluntariado | Operacional | Quantos aprovados por habilidade, veículo, disponibilidade e bairro?    | Novo          |
| R-12 | Ocupação de turnos                | Voluntariado | Operacional | Que turnos estão cheios, quais faltam gente?                             | Novo          |
| R-13 | Participação por pessoa           | Voluntariado | Operacional | Quantos turnos e horas cada pessoa teve escalados no período?           | Novo          |
| R-14 | Evolução da crise                 | Crise        | Operacional | Como famílias e pessoas afetadas mudaram ao longo do tempo?              | Novo          |
| R-15 | Demanda × capacidade de kits      | Crise        | Operacional | Quantos kits a crise exige e quantos o estoque permite montar?          | Novo          |
| R-16 | Envio de notificações             | Comunicação  | Operacional | As mensagens chegaram? Quais falharam e por quê?                         | Novo          |
| R-17 | Trilha de auditoria               | Auditoria    | Auditoria   | Quem alterou o quê, quando, e qual era o valor antes?                    | Novo          |

**Relatórios avaliados e deixados de fora** (os dados não existem hoje):

- **Kits distribuídos por tipo de kit** — a saída de kit registra os itens deduzidos, mas não
  qual kit nem quantas unidades de kit saíram.
- **Presença em turno** — a escala registra quem foi escalado, não quem compareceu.
- **Atendimentos por família/beneficiário** — o destino da saída é texto livre; não há
  cadastro de beneficiários.

## Clarifications

### Session 2026-10-08

- Q: Como CPF e restrições de saúde aparecem nos relatórios de voluntariado e na trilha de
  auditoria? → A: Completos, na tela e na exportação (FR-014), com aviso de dado sensível
  junto da exportação.
- Q: Quem pode consultar a trilha de auditoria? → A: Somente Administrador (FR-020).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Prestar contas das doações por período (Priority: P1)

Um membro da Defesa Civil precisa enviar à prefeitura o que entrou e o que saiu do centro de
distribuição na última semana. Ele abre "Relatórios", vê o catálogo agrupado por assunto,
escolhe "Doações recebidas", define o período e confere a prévia na tela. Exporta em XLSX.
Repete com "Histórico de saídas" e "Descartes" para o mesmo período. Cada arquivo diz no
topo qual relatório é, o período e os filtros usados, quando foi gerado e por quem.

**Why this priority**: prestação de contas de doações é a finalidade original da tela
(BR-REL-01) e hoje é impossível recortar por período — o operador exporta o histórico
inteiro e filtra à mão em planilha, o que não escala no meio de uma crise.

**Independent Test**: com entradas, saídas e descartes registrados em datas diferentes,
abrir cada um dos relatórios R-01 a R-04, aplicar um período e conferir que a prévia e o
arquivo exportado contêm exatamente os registros desse período.

**Acceptance Scenarios**:

1. **Given** um membro da Defesa Civil autenticado, **When** abre "Relatórios", **Then** vê
   os relatórios agrupados (Estoque, Voluntariado, Crise, Comunicação), cada um com nome e
   uma frase dizendo o que responde; o grupo Auditoria só aparece para administradores.
2. **Given** saídas registradas em 01/10 e 06/10, **When** o usuário gera "Histórico de
   saídas" de 05/10 a 07/10, **Then** a prévia e o arquivo trazem só a de 06/10.
3. **Given** um período aplicado, **When** o usuário exporta em CSV ou XLSX, **Then** o
   arquivo contém **todas** as linhas do filtro (não só a página visível) e um cabeçalho com
   nome do relatório, período, demais filtros, data/hora de geração e nome de quem gerou.
4. **Given** um descarte no período, **When** o usuário gera "Histórico de saídas", **Then**
   o descarte não aparece; **When** gera "Descartes", **Then** ele aparece com o motivo.
5. **Given** um coordenador, voluntário ou usuário comum, **When** tenta abrir a central ou
   baixar qualquer relatório por endereço direto, **Then** o acesso é negado.

---

### User Story 2 - Antecipar falta e perda de estoque (Priority: P2)

Antes de planejar a próxima distribuição, a Defesa Civil gera "Estoque crítico" para ver os
itens que estão no mínimo ou abaixo, e "Validades" para ver doações perecíveis vencidas ou
que vencem nos próximos 30 dias. Com isso decide o que pedir em campanha e o que distribuir
primeiro.

**Why this priority**: evita ruptura de itens essenciais e perda de alimentos — ambos têm
custo humano direto numa emergência. Depende só de dados que já existem.

**Independent Test**: com itens acima e abaixo do mínimo e entradas perecíveis com
validades variadas, gerar R-05 e R-06 e conferir que só os itens/entradas esperados aparecem.

**Acceptance Scenarios**:

1. **Given** um item com mínimo próprio e outro que usa o mínimo padrão, ambos abaixo do
   mínimo, **When** o usuário gera "Estoque crítico", **Then** os dois aparecem com saldo,
   mínimo aplicado e quanto falta para atingi-lo, ordenados do mais crítico ao menos crítico.
2. **Given** entradas perecíveis vencidas, vencendo em 10 dias e em 60 dias, **When** o
   usuário gera "Validades" com o horizonte padrão, **Then** aparecem as duas primeiras,
   marcadas como "Vencida" e "A vencer", e a de 60 dias não aparece.
3. **Given** o relatório de validades, **When** é exibido ou exportado, **Then** traz um aviso
   de que a validade é da doação recebida e não garante que essa quantidade ainda esteja no
   estoque.

---

### User Story 3 - Conhecer e acompanhar a força voluntária (Priority: P2)

A Defesa Civil precisa saber quantos voluntários aprovados têm barco ou motosserra no bairro
afetado, quais turnos da semana ainda têm vaga, quantas candidaturas esperam triagem há
dias, e quantas horas cada pessoa já tem escaladas para evitar sobrecarga.

**Why this priority**: mobilizar a pessoa certa é a segunda frente da operação; hoje esses
números só existem espalhados em várias telas e não podem ser exportados.

**Independent Test**: com voluntários em diferentes status, habilidades e bairros, e turnos
com ocupações variadas, gerar R-09 a R-13 e conferir contagens e listas contra os cadastros.

**Acceptance Scenarios**:

1. **Given** voluntários aprovados com e sem a habilidade "Embarcação", **When** o usuário
   gera "Capacidade por habilidade" filtrando pelo bairro X, **Then** vê quantos aprovados de
   X têm cada habilidade, cada tipo de veículo e cada disponibilidade.
2. **Given** candidaturas recebidas no período, **When** o usuário gera "Triagem de
   candidaturas", **Then** vê quantas estão pendentes, aprovadas e rejeitadas, o tempo médio
   entre envio e decisão, e a lista das pendentes da mais antiga para a mais nova.
3. **Given** turnos no período com 2/5 e 5/5 vagas preenchidas, **When** o usuário gera
   "Ocupação de turnos", **Then** cada turno mostra atividade, local, início/fim, vagas,
   confirmados e percentual de ocupação; cancelamentos não contam como confirmados.
4. **Given** uma pessoa escalada em três turnos de 4 h no período, um deles cancelado,
   **When** o usuário gera "Participação por pessoa", **Then** ela aparece com 2 turnos e
   8 h escaladas, e o relatório deixa claro que são horas escaladas, não presença confirmada.
5. **Given** o relatório "Voluntários cadastrados", **When** é exibido ou exportado,
   **Then** os dados pessoais sensíveis seguem a regra de FR-014.

---

### User Story 4 - Consultar quem alterou o quê (Priority: P2)

Surge uma divergência: o saldo de água caiu mais do que as saídas explicam, ou um voluntário
diz que foi aprovado e depois rejeitado. Um administrador abre "Trilha de auditoria", filtra
por período, assunto (Doação, Voluntário, Atividade, Usuário, Habilidade), tipo de ação e
autor, e vê cada alteração com data/hora, autor, papel do autor no momento e o que mudou.

**Why this priority**: a trilha já é gravada para prestação de contas (BR-AUD-01) mas é
invisível; sem consulta, ela não cumpre a finalidade para a qual existe.

**Independent Test**: realizar uma entrada, editar um kit e aprovar um voluntário; abrir a
trilha filtrada pelo período e conferir os três registros com autor, ação e diferença.

**Acceptance Scenarios**:

1. **Given** alterações feitas por pessoas diferentes, **When** o usuário filtra a trilha
   pelo autor A, **Then** só vê as alterações de A, da mais recente para a mais antiga.
2. **Given** a edição de um registro, **When** o usuário abre o detalhe da linha, **Then** vê
   lado a lado os campos que mudaram, com valor anterior e novo.
3. **Given** a base de auditoria indisponível, **When** o usuário abre a trilha, **Then** vê
   uma mensagem de indisponibilidade com opção de tentar novamente, e todos os outros
   relatórios continuam funcionando.
4. **Given** um Membro da Defesa Civil, **When** abre a central, **Then** a trilha e o grupo
   "Auditoria" não aparecem no catálogo, e o endereço direto da trilha e de sua exportação
   é negado.

---

### User Story 5 - Consolidados para o comando da operação (Priority: P3)

Para a reunião diária do comando, a Defesa Civil gera "Movimentação por item" (saldo
inicial, entradas, saídas, descartes e saldo final de cada item no período), "Entregas por
destino" (quanto cada bairro/abrigo recebeu, por categoria), "Evolução da crise"
(famílias/pessoas afetadas ao longo do tempo), "Demanda × capacidade de kits" e "Envio de
notificações" (quantas mensagens falharam e por quê).

**Why this priority**: são visões agregadas que aceleram decisões, mas podem ser
reconstruídas manualmente a partir dos relatórios das histórias 1 a 3.

**Independent Test**: com movimentações conhecidas em um período, gerar R-07 e conferir que
saldo inicial + entradas − saídas − descartes = saldo final para cada item; gerar R-08,
R-14, R-15 e R-16 e conferir contra os registros de origem.

**Acceptance Scenarios**:

1. **Given** um item com saldo 100 antes do período, entrada de 50, saída de 30 e descarte
   de 5 no período, **When** o usuário gera "Movimentação por item", **Then** vê 100, 50, 30,
   5 e 115.
2. **Given** saídas para "Abrigo Central" e "abrigo central " no período, **When** o usuário
   gera "Entregas por destino", **Then** as duas são somadas no mesmo destino.
3. **Given** cinco atualizações das variáveis da crise, **When** o usuário gera "Evolução da
   crise", **Then** vê as cinco em ordem cronológica com autor e a variação em relação à
   anterior.
4. **Given** kits com métrica de demanda, **When** o usuário gera "Demanda × capacidade",
   **Then** cada kit mostra demanda projetada, kits montáveis com o saldo atual e déficit,
   com os mesmos números do Painel.
5. **Given** e-mails com falha no período, **When** o usuário gera "Envio de notificações",
   **Then** vê totais por tipo e canal e a lista das falhas com o erro registrado.

---

### Edge Cases

- **Período sem dados**: a prévia mostra estado vazio explicando que não há registros no
  período; a exportação ainda é permitida e gera um arquivo só com o cabeçalho.
- **Período inválido** (início depois do fim, data futura como início): o filtro é
  recusado com mensagem clara, sem gerar o relatório.
- **Volume grande** (ex.: período de um ano na trilha de auditoria): a prévia continua
  paginada; a exportação traz o conjunto completo dentro do limite de SC-004. Acima dele, o
  usuário é orientado a reduzir o período.
- **Fuso horário**: datas de filtro e de exibição são do horário de Brasília; um registro
  feito às 23h30 de 05/10 pertence ao dia 05/10, não ao 06/10.
- **Item ou pessoa removido/renomeado depois do fato**: relatórios históricos mostram o
  nome atual quando o cadastro ainda existe; a trilha de auditoria mostra o valor gravado no
  momento da alteração.
- **Autor da auditoria sem cadastro atual** (conta removida): a linha aparece com o
  identificador gravado e a indicação "usuário não encontrado".
- **Base de auditoria indisponível**: só a trilha falha; os demais relatórios não dependem
  dela.
- **Planilha aberta em programa que interpreta fórmulas**: textos livres que começam com
  `=`, `+`, `-` ou `@` (destino, motivo, nome) são exportados como texto, nunca como fórmula.
- **Candidatura reenviada após rejeição**: a triagem considera a situação atual da
  candidatura; o histórico de idas e vindas é consultado pela trilha de auditoria.
- **Mudança de papel durante a sessão**: quem perde o papel deixa de conseguir gerar
  relatórios na próxima requisição, inclusive downloads em andamento iniciados depois disso.

## Requirements _(mandatory)_

### Functional Requirements

**Central e acesso**

- **FR-001**: A central MUST estar disponível na entrada "Relatórios" do menu existente e
  substituir o conteúdo atual da tela, mantendo o mesmo endereço.
- **FR-002**: A central e toda exportação de relatório MUST ser acessíveis somente a
  **Membro da Defesa Civil** e **Administrador**, tanto pela tela quanto por endereço direto
  de download (exceção: trilha de auditoria, ver FR-020).
- **FR-003**: A central MUST apresentar os relatórios em catálogo agrupado por assunto
  (Estoque, Voluntariado, Crise, Comunicação, Auditoria), cada um com nome e uma descrição
  de uma frase da pergunta que responde.
- **FR-004**: O pacote de contingência MUST continuar disponível na central, com o mesmo
  conteúdo e a mesma regra de acesso de hoje.

**Comportamento comum a todos os relatórios**

- **FR-005**: Relatórios baseados em histórico (R-02, R-03, R-04, R-07, R-08, R-10, R-12,
  R-13, R-14, R-16, R-17) MUST aceitar filtro de período com data inicial e final, com
  padrão "últimos 30 dias" e atalhos para "hoje", "últimos 7 dias" e "últimos 30 dias".
- **FR-006**: Cada relatório MUST mostrar uma prévia paginada na tela com os filtros
  aplicados e o total de linhas encontradas.
- **FR-007**: Cada relatório MUST ser exportável em CSV e XLSX contendo **todas** as linhas
  do filtro aplicado, não só a página visível.
- **FR-008**: Todo arquivo exportado MUST identificar no topo (XLSX) ou nas primeiras linhas
  (CSV) o nome do relatório, o período e os filtros aplicados, a data/hora de geração e o
  nome de quem gerou.
- **FR-009**: Todo relatório MUST refletir o estado no momento da geração — nenhum
  resultado pode ser servido de uma geração anterior.
- **FR-010**: Datas de filtro e de exibição MUST usar o horário de Brasília; textos,
  rótulos, categorias e unidades MUST aparecer em português, com os mesmos rótulos usados no
  restante do sistema.
- **FR-011**: Textos livres exportados MUST ser gravados como texto literal, nunca
  interpretados como fórmula pela planilha.
- **FR-012**: Os filtros aplicados MUST ficar no endereço da página, para que um relatório
  possa ser reaberto ou compartilhado com os mesmos filtros por quem tem acesso.
- **FR-013**: A tela da central MUST ser utilizável em celular (filtros, prévia e botões de
  exportação acessíveis sem rolagem horizontal da página).

**Dados pessoais**

- **FR-014**: Nos relatórios de voluntariado (R-09, R-13) e na trilha de auditoria (R-17),
  CPF e restrições de saúde MUST aparecer **completos**, na tela e na exportação — a
  restrição de saúde é informação de segurança no campo (alergias, limitações físicas) e o
  CPF é o identificador inequívoco da pessoa. Telefone e bairro MUST aparecer, pois são
  necessários para acionar voluntários. A tela da central MUST lembrar, junto dos botões de
  exportação desses relatórios, que o arquivo contém dados pessoais sensíveis (LGPD) e não
  deve ser compartilhado fora da operação.

**Relatórios de Estoque**

- **FR-015**: R-01 *Inventário atual* MUST listar item, categoria, unidade, saldo, mínimo
  aplicado (próprio do item ou padrão global, identificando qual) e situação ("Abaixo do
  mínimo"/"OK"), com filtro por categoria e por situação.
- **FR-016**: R-02 *Histórico de saídas* MUST manter as colunas atuais, acrescentar
  "Registrado por", aceitar filtro por período, tipo (avulso/kit), destino (busca por texto)
  e categoria, e nunca incluir descartes.
- **FR-017**: R-03 *Doações recebidas* MUST listar data, item, categoria, quantidade,
  unidade, condição, perecível, validade, kit de destino informado e registrado por, com
  filtro por período, categoria e condição. R-04 *Descartes* MUST listar data, item,
  categoria, quantidade, unidade, motivo e registrado por, com filtro por período e
  categoria.
- **FR-018**: R-05 *Estoque crítico* MUST listar os itens com saldo igual ou abaixo do
  mínimo aplicado, com saldo, mínimo e quantidade faltante, do mais crítico (maior falta
  proporcional) ao menos crítico. R-06 *Validades* MUST listar as entradas perecíveis
  vencidas ou com validade dentro de um horizonte configurável no filtro (padrão 30 dias),
  com situação "Vencida"/"A vencer", dias até o vencimento e o aviso de que a validade é da
  doação recebida, não do saldo remanescente.
- **FR-019**: R-07 *Movimentação por item* MUST mostrar, por item e para o período, saldo
  inicial, total de entradas, total de saídas, total de descartes e saldo final, onde saldo
  final = saldo inicial + entradas − saídas − descartes. R-08 *Entregas por destino* MUST
  somar as quantidades entregues por destino e categoria no período, unificando destinos que
  diferem apenas em maiúsculas/minúsculas e espaços nas pontas.

**Relatório de Auditoria**

- **FR-020**: R-17 *Trilha de auditoria* MUST ser acessível **somente a Administrador** —
  tanto a prévia quanto a exportação, por tela e por endereço direto. Para Membro da Defesa
  Civil, o item não aparece no catálogo e o grupo "Auditoria" não é exibido.
- **FR-021**: R-17 MUST listar data/hora, assunto (Doação, Voluntário, Atividade, Usuário,
  Habilidade), ação (criação, alteração, exclusão), registro afetado, autor (nome) e papel do
  autor no momento, da mais recente para a mais antiga, com filtro por período, assunto,
  ação e autor; cada linha MUST permitir ver os campos alterados com valor anterior e novo.
  A exportação MUST incluir uma coluna com o resumo das alterações.
- **FR-022**: A consulta à trilha MUST ser somente leitura; a central nunca altera nem
  remove registros de auditoria.
- **FR-023**: Indisponibilidade da base de auditoria MUST afetar apenas R-17, com mensagem
  de erro e opção de tentar novamente.

**Relatórios de Voluntariado**

- **FR-024**: R-09 *Voluntários cadastrados* MUST listar nome, CPF, situação (pendente,
  aprovado, rejeitado), telefone, bairro, profissão, habilidades, veículo próprio e tipo,
  disponibilidade, restrições de saúde, data de cadastro e data da decisão, com filtro por situação, bairro,
  habilidade, tipo de veículo e disponibilidade.
- **FR-025**: R-10 *Triagem de candidaturas* MUST mostrar, para candidaturas enviadas no
  período, as quantidades por situação, o tempo médio entre envio e decisão, e a lista de
  pendentes com dias de espera, da mais antiga para a mais nova. Data de envio: para
  candidaturas pendentes, a data do último envio (um reenvio conta como envio novo); para
  as já decididas, a data do primeiro envio. Tempo até decisão = data da decisão − primeiro
  envio.
- **FR-026**: R-11 *Capacidade por habilidade* MUST contar voluntários **aprovados** por
  habilidade, por tipo de veículo e por disponibilidade, com filtro por bairro.
- **FR-027**: R-12 *Ocupação de turnos* MUST listar, para turnos que começam no período,
  atividade, categoria da atividade, local, situação da atividade, início, fim, vagas,
  confirmados e percentual de ocupação, com filtro por atividade, categoria e situação, e um
  destaque para turnos com vagas abertas. Alocações canceladas não contam.
- **FR-028**: R-13 *Participação por pessoa* MUST listar, por participante, a quantidade de
  turnos confirmados no período e o total de horas escaladas, com rótulo explícito de que
  são horas escaladas e não presença registrada.

**Relatórios de Crise e Comunicação**

- **FR-029**: R-14 *Evolução da crise* MUST listar cada atualização das variáveis da crise no
  período com data/hora, famílias afetadas, pessoas afetadas, autor e variação em relação à
  atualização anterior.
- **FR-030**: R-15 *Demanda × capacidade de kits* MUST mostrar, por kit ativo com métrica
  configurada, a base de demanda, a proporção, a demanda projetada, os kits montáveis com o
  saldo atual e o déficit, usando o mesmo cálculo do Painel.
- **FR-031**: R-16 *Envio de notificações* MUST mostrar, para o período, totais por tipo de
  notificação, canal e situação de envio (enviado, pendente, falhou), e a lista das falhas
  com data, tipo, canal, destinatário e erro registrado.

### Key Entities _(include if feature involves data)_

- **Relatório**: item do catálogo — identificador (R-01…R-17), nome, grupo, descrição,
  filtros aceitos, colunas da prévia e da exportação, perfis que podem acessá-lo.
- **Filtro de relatório**: conjunto de valores aplicados a uma geração — período (início e
  fim) e filtros específicos (categoria, situação, destino, assunto, autor, horizonte etc.).
- **Geração/exportação**: um resultado concreto — relatório, filtros, formato, data/hora e
  autor da geração; é o que aparece no cabeçalho do arquivo.
- **Fontes lidas (já existentes, não alteradas)**: itens e saldos; entradas, saídas e
  descartes; kits e métricas de demanda; voluntários, habilidades, atividades, turnos e
  escalas; variáveis da crise; notificações e envios; registros de auditoria (autor, papel,
  assunto, ação, antes, depois).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Um membro da Defesa Civil gera e baixa o relatório de saídas de uma semana
  específica em até 1 minuto a partir da home, sem editar a planilha depois.
- **SC-002**: A prévia de qualquer relatório com até 10.000 registros no período aparece em
  até 3 segundos.
- **SC-003**: Para todo item, o relatório de movimentação fecha a conta (saldo inicial +
  entradas − saídas − descartes = saldo final) e o saldo final bate com o inventário atual
  quando o período termina hoje — 100% dos itens.
- **SC-004**: A exportação de até 50.000 linhas termina em até 30 segundos; acima disso o
  usuário recebe orientação para reduzir o período em vez de uma falha genérica.
- **SC-005**: 0 relatórios ou downloads acessíveis a coordenador, voluntário ou usuário
  comum, e 0 acessos de Membro da Defesa Civil à trilha de auditoria — verificado para cada
  um dos 17 relatórios por tela e por endereço direto.
- **SC-006**: Toda alteração registrada na trilha de auditoria no período pode ser
  encontrada filtrando por assunto e autor em até 3 interações.
- **SC-007**: Os números de "Demanda × capacidade de kits" são idênticos aos do Painel no
  mesmo instante.
- **SC-008**: A queda da base de auditoria não impede a geração de nenhum dos outros 16
  relatórios.

## Assumptions

- "Nova seção de relatórios" é atendida **evoluindo a tela Relatórios existente**, que já tem
  a matriz de acesso pedida (Membro da Defesa Civil e Administrador). Criar uma segunda tela
  com o mesmo propósito duplicaria navegação e autorização.
- Coordenadores continuam **sem** acesso à central, como hoje — decisão de produto já
  registrada na matriz de navegação.
- Os relatórios são de **leitura e exportação**; não há agendamento, envio automático por
  e-mail, gráficos nem relatórios montados pelo usuário nesta feature.
- Formatos de exportação permanecem CSV e XLSX (BR-REL-01); PDF fica fora do escopo.
- A exportação do histórico de saídas sem filtro passa a trazer os **últimos 30 dias** (padrão
  de FR-005), e não mais o histórico inteiro; o histórico completo é obtido informando o
  período desde a primeira saída.
- Gerar ou baixar um relatório não é registrado na trilha de auditoria — a trilha cobre
  alterações de dados, não leituras (BR-AUD-01).
- "Mínimo aplicado" segue a regra existente: mínimo próprio do item quando definido, senão o
  padrão global.
- "Horas escaladas" são calculadas pela duração dos turnos confirmados; o sistema não
  registra presença.
- A triagem reflete a situação atual de cada candidatura, já que um reenvio substitui a
  candidatura anterior; idas e vindas aparecem na trilha de auditoria.
- Nenhum dado novo é coletado: todos os relatórios usam registros que o sistema já grava.
  Os relatórios listados como "deixados de fora" exigiriam novas informações e seriam uma
  feature própria.
