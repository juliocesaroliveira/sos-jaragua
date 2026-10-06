# Feature Specification: Cadastro de item novo na composição de kit

**Feature Branch**: `022-cadastro-item-kit`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "quero que seja possivel cadastrar um item via dialog de cadastro do kit, da mesma forma que funciona na entrada de doacoes."

## Contexto

Hoje o único caminho para cadastrar um item de estoque novo é a tela de **Entrada**: o operador
digita um nome que não corresponde a nenhum item cadastrado, informa categoria e unidade de
medida (e, opcionalmente, o estoque mínimo) e o item nasce junto com a entrada. No diálogo de
**Novo kit / Editar kit**, cada componente da receita só aceita um item já cadastrado (feature
021, Lookup); se a coordenação quer montar um kit com um item que ainda não chegou ao estoque,
precisa sair do diálogo, registrar uma entrada fictícia ou esperar a primeira doação.

Esta feature leva o mesmo comportamento da Entrada para cada componente da receita do kit e
substitui a premissa da feature 021 que deixava "criar registro novo fora da Entrada" fora do
escopo.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Cadastrar um item novo ao compor a receita do kit (Priority: P1)

A coordenação está montando o kit "Higiene básica" e precisa incluir "Sabonete líquido 250 ml",
que ainda não existe no cadastro de itens. No campo "Item" de um componente, ela digita o nome;
como nenhum item cadastrado corresponde, a lista informa que o texto será cadastrado como item
novo. A linha passa a pedir categoria e unidade de medida (e oferece estoque mínimo opcional).
Ela informa a quantidade por kit e salva o kit. O item é criado com saldo zero e o kit é salvo
com esse item na receita, numa única operação.

**Why this priority**: é o pedido em si; sem ele a coordenação não consegue planejar kits antes
da chegada das doações, que é justamente o momento em que a receita precisa existir.

**Independent Test**: abrir "Novo kit", digitar no componente um nome de item inexistente,
preencher categoria, unidade e quantidade, salvar. O kit aparece na lista com o item novo na
receita, e o item novo aparece no estoque com saldo 0 e nas buscas de item dos demais formulários.

**Acceptance Scenarios**:

1. **Given** o diálogo de kit aberto, **When** a coordenação digita no campo "Item" de um
   componente um nome que não corresponde a nenhum item, **Then** o texto permanece no campo e a
   lista de sugestões informa que ele será cadastrado como item novo.
2. **Given** um componente com nome de item novo, **When** a linha é exibida, **Then** logo abaixo
   dela aparece um grupo destacado "Item novo" com os campos obrigatórios Categoria e Unidade de
   medida e o campo opcional Estoque mínimo; a quantidade por kit continua na linha.
3. **Given** um componente com nome de item novo e categoria, unidade e quantidade preenchidas,
   **When** a coordenação salva o kit, **Then** o item é criado com saldo 0 e o kit é salvo com
   esse item na receita, e uma mensagem de sucesso é exibida.
4. **Given** um componente com nome de item novo sem categoria ou sem unidade, **When** a
   coordenação tenta salvar, **Then** o envio é bloqueado e a mensagem de erro aparece abaixo do
   campo faltante.
5. **Given** o diálogo com um ou mais itens novos digitados, **When** a coordenação cancela ou
   fecha o diálogo sem salvar, **Then** nenhum item é criado.
6. **Given** o salvamento do kit falha (validação do servidor, permissão ou conexão), **When** a
   coordenação recebe o erro, **Then** nenhum item novo foi criado e o que foi digitado permanece
   no diálogo para nova tentativa.
7. **Given** um kit salvo com item novo, **When** a coordenação reabre esse kit para edição,
   **Then** o componente exibe o item (agora cadastrado) como item existente, sem pedir categoria
   e unidade de novo.

---

### User Story 2 - Escolher item existente continua igual, com aviso de reaproveitamento (Priority: P2)

A coordenação começa a digitar "Sabonete" e aparece "Sabonete em barra 90 g" já cadastrado. Ao
escolher a sugestão (ou uma linha da tabela de pesquisa), o componente referencia o item
existente, categoria e unidade vêm do cadastro e não são editáveis, e os campos de item novo
somem. Se depois ela altera o texto, a seleção é desfeita e o texto volta a valer como item novo.

**Why this priority**: evita que o modo de item novo gere duplicidade no catálogo; é o mesmo
cuidado que a Entrada já tem, e sem ele o US1 polui o cadastro.

**Independent Test**: no diálogo de kit, digitar parte do nome de um item existente, escolher a
sugestão, salvar; o kit referencia o item existente e nenhum item novo é criado.

**Acceptance Scenarios**:

1. **Given** um componente com texto digitado, **When** a coordenação escolhe um item existente
   (sugestão ou tabela), **Then** o componente referencia esse item, os campos de item novo
   deixam de ser exibidos e a linha mostra a unidade do item existente.
2. **Given** um componente com item existente selecionado, **When** a coordenação altera o texto,
   **Then** a seleção é desfeita e o componente passa a ser tratado como item novo com o texto
   digitado.
3. **Given** um componente cujo texto digitado é idêntico ao nome de um item cadastrado
   (ignorando maiúsculas, minúsculas, acentos e espaços nas pontas), **When** a coordenação sai
   do campo ou salva o kit, **Then** o componente passa a referenciar automaticamente o item
   existente (exibindo o nome como está no cadastro), os campos de item novo deixam de ser
   exibidos e nenhum item novo é criado.

---

### User Story 3 - Regras da receita valem também para itens novos (Priority: P3)

As regras da receita do kit (ao menos um componente, quantidade positiva, mesmo item não pode
aparecer duas vezes) continuam valendo, agora considerando também os itens novos digitados.

**Why this priority**: protege a integridade da receita; é consequência direta do US1, mas pode
ser verificada separadamente.

**Independent Test**: no diálogo de kit, criar duas linhas com o mesmo nome de item novo e
tentar salvar; o envio é bloqueado com a mensagem de item repetido.

**Acceptance Scenarios**:

1. **Given** duas linhas da receita com o mesmo nome de item novo (ignorando maiúsculas,
   minúsculas, acentos e espaços nas pontas), **When** a coordenação tenta salvar, **Then** o
   envio é bloqueado e a segunda linha exibe "Este item já está na receita."
2. **Given** uma linha com item existente e outra com o mesmo item já selecionado, **When** a
   coordenação tenta salvar, **Then** a mensagem de item repetido continua aparecendo como hoje.
3. **Given** um kit salvo com item novo, **When** a coordenação olha o card do kit, **Then** o
   card mostra o item na receita e a capacidade "0 kit(s) montável(is) com o saldo atual",
   porque o item novo tem saldo zero.

---

### Edge Cases

- Vários itens novos no mesmo kit: todos são criados juntos com o kit, ou nenhum é criado.
- Duas pessoas cadastram ao mesmo tempo um item com o mesmo nome (uma pela Entrada, outra pelo
  kit): quando o kit é salvo depois, o componente é vinculado ao item que acabou de nascer, sem
  criar um segundo item; categoria, unidade e estoque mínimo digitados na linha são descartados
  em favor dos do cadastro.
- Mais de um item cadastrado com o mesmo nome normalizado (duplicidade antiga do catálogo): não
  há vínculo automático; o salvamento é recusado com a mensagem "Há mais de um item com esse
  nome. Selecione o item na lista." abaixo do campo.
- Nome com espaços extras nas pontas: é gravado sem eles; nome só com espaços é tratado como
  campo vazio.
- Nome muito longo: não há limite de tamanho, como na Entrada.
- Kit inativo: pode receber item novo na receita como qualquer kit; o item novo fica disponível
  nos demais formulários independentemente do kit.
- Item novo criado pelo kit aparece imediatamente nas buscas de item da Entrada, Saída, Descarte
  e Composição de Kits, com saldo 0 (na Saída e no Descarte, identificado como sem saldo).
- Item criado pelo kit com estoque mínimo informado (ou herdando o padrão global) e saldo 0: não
  gera alerta nem conta como estoque crítico até a primeira entrada; a partir dela, se o saldo
  continuar abaixo do mínimo, o alerta segue a regra normal (FR-015).
- Item criado pelo kit e depois retirado da receita (ou kit replanejado) antes de qualquer
  movimentação: o item permanece no catálogo normalmente, com saldo 0; não há exclusão
  automática.
- Tela de celular: a linha de componente com os campos de item novo continua utilizável em
  largura de telefone, sem rolagem horizontal da página.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O campo "Item" de cada componente da receita, no diálogo de Novo kit e de Editar
  kit, MUST aceitar texto livre como nome de item novo, da mesma forma que o campo "Nome do item"
  da Entrada: texto digitado sem seleção vale como item novo; selecionar uma sugestão ou linha da
  tabela referencia o item existente.
- **FR-002**: Quando nenhum item cadastrado corresponder ao texto digitado, a lista de sugestões
  MUST informar que o texto será cadastrado como item novo.
- **FR-003**: Um componente com item novo MUST exigir Categoria e Unidade de medida e MUST
  oferecer Estoque mínimo opcional, com as mesmas opções, regras e mensagens da Entrada (mínimo
  ausente herda o padrão global). Esses campos MUST aparecer logo abaixo da linha do componente,
  agrupados sob um destaque visual "Item novo", somente enquanto o componente for item novo — sem
  diálogo secundário.
- **FR-004**: Um componente com item existente selecionado MUST NOT exibir os campos de item
  novo; categoria e unidade são as do cadastro do item.
- **FR-005**: Alterar o texto de um componente com item existente selecionado MUST desfazer a
  seleção, passando o texto a valer como item novo.
- **FR-006**: Ao salvar o kit, o sistema MUST criar todos os itens novos da receita e salvar o kit
  em uma única operação: ou tudo é gravado, ou nada é gravado.
- **FR-007**: Cada item criado pelo kit MUST nascer com saldo 0 e ficar disponível imediatamente
  em todas as buscas de item do estoque, como um item criado pela Entrada.
- **FR-008**: Cancelar ou fechar o diálogo sem salvar MUST NOT criar nenhum item.
- **FR-009**: Quando o nome de item novo de um componente for igual ao de exatamente um item já
  cadastrado (comparando sem diferença de maiúsculas, minúsculas, acentos e espaços nas pontas),
  o sistema MUST vincular automaticamente o componente a esse item existente em vez de criar um
  item novo — no formulário, ao sair do campo, e no servidor, ao salvar (cobrindo o item criado
  por outra pessoa no meio tempo). Se houver mais de um item cadastrado com esse nome, o
  salvamento MUST ser recusado pedindo a seleção na lista. Nome de item novo igual ao de outro
  componente da mesma receita MUST ser recusado como item repetido (FR-010). As mensagens
  aparecem abaixo do campo do componente.
- **FR-010**: As regras atuais da receita MUST continuar valendo: ao menos um componente,
  quantidade por kit positiva e item não repetido (agora também entre itens novos).
- **FR-011**: Criar item pelo diálogo de kit MUST exigir a mesma permissão de gerir kits
  (coordenação); quem não pode gerir kits não cria itens por esse caminho.
- **FR-012**: A criação de cada item novo MUST ser registrada na auditoria, identificando quem
  criou e que a origem foi o cadastro de kit, além do registro já existente da alteração do kit.
- **FR-013**: Ao reabrir um kit salvo com item novo, o componente MUST exibir o item como item
  existente, sem nova seleção.
- **FR-014**: Erros do salvamento (validação, permissão, conexão) MUST ser exibidos em pt-BR e
  MUST preservar no diálogo tudo o que foi digitado.
- **FR-015**: Um item criado pelo kit MUST NOT disparar alerta de estoque crítico ao ser criado e
  MUST ficar fora da avaliação de estoque crítico enquanto não tiver nenhuma movimentação; ele
  passa a ser avaliado normalmente a partir da primeira movimentação de estoque (na prática, a
  primeira entrada, já que sem saldo não há saída nem descarte).

### Key Entities

- **Item de Estoque** (existente): nome, categoria, unidade de medida, estoque mínimo opcional e
  saldo. Passa a poder nascer por dois caminhos: Entrada (com saldo da entrada) e Composição de
  Kit (com saldo 0).
- **Kit / Receita do kit** (existente): nome, descrição, situação (ativo/inativo) e componentes
  (item + quantidade por kit). Um componente pode agora referenciar um item criado na mesma
  operação.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A coordenação cadastra um kit com um item que ainda não existe no estoque sem sair
  do diálogo de kit, em menos de 2 minutos para um kit de até 5 componentes.
- **SC-002**: 0 itens criados quando o salvamento do kit é cancelado ou falha (verificável
  contando os itens do catálogo antes e depois).
- **SC-003**: 0 itens duplicados por nome (sem diferença de maiúsculas, minúsculas e acentos)
  criados pelo caminho do kit.
- **SC-004**: 100% dos itens criados pelo kit aparecem nas buscas de item dos demais formulários
  de estoque logo após o salvamento.
- **SC-005**: Todo o fluxo de item novo no diálogo de kit é concluível usando apenas teclado e em
  largura de celular.

## Assumptions

- "Da mesma forma que na Entrada" significa: mesmo campo com modo de texto livre (feature 021,
  modo "valor livre permitido"), mesmos campos obrigatórios (categoria e unidade), mesmo estoque
  mínimo opcional e mesmas mensagens. A única diferença é que o item nasce com saldo 0, porque
  compor um kit não é uma entrada de mercadoria.
- O item novo é criado somente ao salvar o kit (não no momento em que o nome é digitado), para
  não deixar itens órfãos quando o diálogo é cancelado.
- Na Entrada, um nome igual a um item existente hoje leva ao aviso de "item existente" só quando
  o operador seleciona a sugestão. No kit, o nome digitado igual ao de um item existente é
  vinculado automaticamente a esse item (FR-009), porque aqui não há quantidade a somar e a
  duplicidade só poluiria o catálogo. A Entrada não muda nesta feature.
- O modo de item novo vale tanto em Novo kit quanto em Editar kit.
- Esta feature substitui, para o diálogo de kit, a premissa da feature 021 de que o único caminho
  para item novo é a Entrada. O Descarte e a Saída continuam aceitando apenas itens existentes.
- Criar, editar ou excluir itens fora destes dois caminhos (uma tela de gestão de itens) está
  fora do escopo; itens criados por engano, pelo kit ou pela Entrada, ficam no catálogo até essa
  feature futura.

## Clarifications

### Session 2026-10-05

- Q: Se a coordenação digitar no kit um nome de item novo igual ao de um item já cadastrado, o
  que o sistema deve fazer? → A: Vincular automaticamente o componente ao item existente, sem
  criar item novo (FR-009).
- Q: Onde os campos do item novo devem aparecer no diálogo de kit? → A: Logo abaixo da linha do
  componente, só quando o item é novo, agrupados sob o destaque "Item novo" (FR-003).
- Q: Item criado pelo kit (saldo 0) deve disparar o alerta de estoque crítico? → A: Não ao criar;
  só entra na avaliação de estoque crítico depois da primeira movimentação (FR-015).
- Q: O que acontece com um item criado pelo kit e retirado da receita antes de qualquer
  movimentação? → A: Permanece no catálogo normalmente; limpeza fica para uma futura tela de
  gestão de itens.
