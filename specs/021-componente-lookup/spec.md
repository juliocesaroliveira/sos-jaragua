# Feature Specification: Componente Lookup para campos de referência

**Feature Branch**: `021-componente-lookup`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "preciso que seja criado um componente chamado Lookup. Esse componente deve ser utilizado nos campos que sao FK de outras tabelas como por exemplo os itens. Ele deve ser usado nos formularios de cadastro. Esse componente deve ser composto por um input do tipo text com um botao integrado do tipo search que ao ser selecionado eh aberto um dialog com um data table onde sera listado os registros cadastrados da tabela configurada no componente. O data table deve ser paginado via API e deve permitir o usuario clicar na linha de um registro. Ao clicar na linha, o registro deve ser selecionado, o dialog fechado, o valor do id atribuido ao campo e a descricao do item populado no input. O input deve permitir a digitacao, e caso for feito a digitacao, deve aparecer uma lista de no maximo 5 itens conforme o texto digitado, permitindo o usuario selecionar um item da lista. Dessa forma o usuario tem duas formas de selecionar um registro da FK, via digitacao no campo ou via search + data table. Aplique esse componente em todos os campos relacionados ao item do estoque, que estao sendo utilizados nos formularios."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Selecionar um item digitando parte do nome (Priority: P1)

Um operador de estoque preenche um formulário (descarte, saída de itens avulsos, composição de
kit) e precisa informar qual item do estoque está sendo movimentado. Em vez de rolar uma lista
com todos os itens cadastrados, ele começa a digitar parte do nome no campo "Item" e vê, logo
abaixo, até 5 sugestões de itens cadastrados compatíveis com o texto. Ao escolher uma
sugestão (clique ou teclado), o campo passa a exibir o nome do item e o formulário guarda a
referência ao item escolhido.

**Why this priority**: é o caminho mais rápido para quem já sabe o nome do item — o caso mais
comum em operação de campo. Com o catálogo crescendo durante uma emergência, a lista suspensa
atual com todos os itens deixa de ser utilizável; sozinho, este fluxo já resolve o problema.

**Independent Test**: abrir o formulário de descarte, digitar parte do nome de um item
cadastrado, escolher uma das sugestões e enviar o formulário; o descarte deve ser registrado
para o item escolhido.

**Acceptance Scenarios**:

1. **Given** um formulário com campo de item vazio, **When** o operador digita um texto que
   corresponde a itens cadastrados, **Then** aparece uma lista com no máximo 5 itens
   compatíveis com o texto digitado.
2. **Given** a lista de sugestões aberta, **When** o operador escolhe um item (com clique ou
   com setas + Enter), **Then** a lista fecha, o campo exibe a descrição do item e o
   formulário passa a referenciar aquele item.
3. **Given** um texto digitado que não corresponde a nenhum item, **When** a busca termina,
   **Then** a lista informa que nenhum item foi encontrado e nenhum item é selecionado.
4. **Given** um item já selecionado, **When** o operador altera o texto do campo, **Then** a
   seleção anterior é desfeita e o campo volta a exigir uma escolha válida antes do envio.
5. **Given** o operador digitou um texto mas não escolheu nenhuma sugestão, **When** ele tenta
   enviar o formulário, **Then** o envio é bloqueado e o campo exibe mensagem de erro abaixo
   dele pedindo que um item seja selecionado.

---

### User Story 2 - Pesquisar e escolher o item em uma tabela paginada (Priority: P2)

O operador não lembra o nome exato do item, ou quer conferir detalhes (categoria, unidade,
saldo) antes de escolher. Ele aciona o botão de pesquisa integrado ao campo; abre-se uma
janela com uma tabela paginada listando os itens cadastrados. Ele navega entre as páginas,
pode filtrar por texto e clica na linha do item desejado. A janela fecha, o campo exibe a
descrição do item e o formulário guarda a referência ao item escolhido.

**Why this priority**: complementa a digitação para quem não sabe o nome ou precisa comparar
itens parecidos. Não é o caminho principal, mas é o que torna o campo utilizável sem
conhecimento prévio do catálogo.

**Independent Test**: no formulário de descarte, acionar o botão de pesquisa do campo de item,
avançar para a segunda página da tabela, clicar em um item e enviar o formulário; o descarte
deve ser registrado para o item clicado.

**Acceptance Scenarios**:

1. **Given** um formulário com campo de item, **When** o operador aciona o botão de pesquisa,
   **Then** abre-se uma janela com uma tabela dos itens cadastrados, com paginação, mostrando
   a primeira página.
2. **Given** a janela aberta, **When** o operador muda de página, **Then** a tabela carrega e
   exibe apenas os registros daquela página, sem carregar o catálogo inteiro de uma vez.
3. **Given** a janela aberta, **When** o operador clica na linha de um item, **Then** a janela
   fecha, o campo exibe a descrição do item e o formulário passa a referenciar aquele item.
4. **Given** a janela aberta, **When** o operador a fecha sem clicar em nenhuma linha (botão
   fechar, Esc ou clique fora), **Then** o valor anterior do campo permanece inalterado.
5. **Given** a janela aberta, **When** o operador digita um termo no filtro da janela,
   **Then** a tabela volta à primeira página exibindo apenas os itens compatíveis com o termo.
6. **Given** o operador usa apenas teclado, **When** ele navega até uma linha da tabela e
   confirma, **Then** o item é selecionado da mesma forma que pelo clique.

---

### User Story 3 - Lookup aplicado a todos os campos de item de estoque (Priority: P3)

Todos os formulários que hoje pedem um item do estoque passam a usar o mesmo componente de
seleção, de modo que o operador encontra a mesma interação em qualquer tela, e as regras
específicas de cada formulário continuam valendo (ex.: na saída, item sem saldo não pode ser
escolhido; na composição de kit, o mesmo item não pode aparecer duas vezes).

**Why this priority**: entrega a consistência pedida, mas depende do componente (US1 + US2)
já existir; cada formulário pode ser migrado independentemente.

**Independent Test**: percorrer cada formulário do escopo e verificar que o campo de item usa
o Lookup (digitação + pesquisa) e que as regras do formulário continuam aplicadas.

**Acceptance Scenarios**:

1. **Given** o formulário de descarte, **When** o operador seleciona o item via Lookup,
   **Then** o saldo disponível do item continua sendo exibido e validado como antes.
2. **Given** o formulário de saída de itens avulsos, **When** o operador procura um item sem
   saldo, **Then** o item aparece identificado como sem saldo e não pode ser selecionado —
   tanto nas sugestões quanto na tabela.
3. **Given** o formulário de composição de kit, **When** o operador seleciona em uma linha um
   item já usado em outra linha, **Then** a mensagem de item duplicado continua aparecendo
   como hoje.
4. **Given** um formulário com várias linhas de item (saída, kit), **When** o operador
   adiciona uma nova linha, **Then** a nova linha tem seu próprio Lookup, independente das
   demais.
5. **Given** um formulário aberto para edição com um item já gravado (ex.: receita de kit
   existente), **When** o formulário carrega, **Then** o campo exibe a descrição do item
   gravado sem que o operador precise selecioná-lo de novo.
6. **Given** o formulário de Entrada, **When** o operador seleciona um item existente pelo
   Lookup (sugestão ou tabela), **Then** categoria e unidade de medida são preenchidas a partir
   do item e o aviso de "item existente" é exibido, como hoje.
7. **Given** o formulário de Entrada, **When** o operador digita um nome que não corresponde a
   nenhum item e não seleciona nada, **Then** o texto permanece no campo, o envio não é
   bloqueado pelo Lookup e a entrada cadastra um item novo com aquele nome (exigindo categoria
   e unidade).
8. **Given** o formulário de Saída no tipo "Kits", **When** o operador procura um kit sem
   receita, **Then** o kit aparece identificado como "sem receita" e não pode ser selecionado
   — tanto nas sugestões quanto na tabela.

---

### Edge Cases

- Digitação rápida: sugestões de buscas antigas não podem sobrescrever as da busca mais
  recente; a busca só é disparada após uma pausa curta na digitação e a partir de um número
  mínimo de caracteres.
- Falha ou lentidão na busca (conectividade instável em campo): o campo mostra estado de
  carregamento e, em caso de erro, uma mensagem em pt-BR com possibilidade de tentar de novo,
  sem perder o que já foi digitado nem a seleção anterior.
- Catálogo vazio: a tabela da janela de pesquisa mostra estado vazio explicando que não há
  itens cadastrados.
- Item selecionado excluído/alterado entre a seleção e o envio: o servidor recusa e o erro
  aparece abaixo do campo, como as demais recusas de campo.
- Campo desabilitado ou somente leitura: nem a digitação nem o botão de pesquisa ficam
  ativos.
- Texto digitado com acento/caixa diferente do cadastro ("agua" × "Água"): a busca encontra o
  item mesmo assim.
- Tela de celular: a janela de pesquisa e a lista de sugestões ficam utilizáveis em largura de
  telefone, sem rolagem horizontal da página.
- Limpar o campo: o operador consegue remover a seleção, deixando o campo vazio (e sujeito à
  validação de obrigatoriedade).

## Requirements _(mandatory)_

### Functional Requirements

**Componente Lookup (genérico)**

- **FR-001**: O sistema MUST oferecer um componente de formulário reutilizável chamado
  "Lookup" para campos que referenciam um registro de outro cadastro, configurável por qual
  cadastro consultar, qual informação exibir como descrição do registro e quais colunas exibir
  na tabela de pesquisa.
- **FR-002**: O Lookup MUST ser composto por um campo de texto com um botão de pesquisa
  integrado visualmente ao campo.
- **FR-003**: Ao digitar no campo, o Lookup MUST exibir uma lista com no máximo 5 registros
  compatíveis com o texto digitado, buscados no servidor.
- **FR-004**: O operador MUST poder escolher um registro da lista de sugestões com mouse/toque
  ou teclado (setas, Enter, Esc).
- **FR-005**: Ao acionar o botão de pesquisa, o Lookup MUST abrir uma janela (diálogo) com uma
  tabela dos registros do cadastro configurado, paginada no servidor (cada página carregada
  sob demanda).
- **FR-006**: A tabela da janela de pesquisa MUST permitir selecionar um registro clicando
  (ou confirmando via teclado) na linha correspondente.
- **FR-007**: A janela de pesquisa MUST oferecer um filtro por texto que restringe os
  registros listados, reiniciando a paginação na primeira página.
- **FR-008**: Ao selecionar um registro (por qualquer dos dois caminhos), o Lookup MUST
  atribuir ao campo do formulário o identificador do registro, exibir a descrição do registro
  no campo de texto e, no caso da janela, fechá-la.
- **FR-009**: Fechar a janela sem selecionar um registro MUST manter o valor anterior do
  campo.
- **FR-010**: Alterar o texto de um campo com registro selecionado MUST desfazer a seleção; o
  formulário só considera válido um valor escolhido por um dos dois caminhos — texto livre
  nunca é aceito como referência (exceto no modo "valor livre permitido", FR-025).
- **FR-011**: O Lookup MUST integrar-se ao padrão de formulários da aplicação (feature 016):
  rótulo, marcação de obrigatório, texto de apoio e mensagem de erro abaixo do campo, foco no
  campo quando houver erro de validação.
- **FR-012**: O Lookup MUST exibir a descrição de um valor já preenchido ao abrir um
  formulário (ex.: edição), sem exigir nova seleção.
- **FR-013**: O Lookup MUST permitir marcar registros como não selecionáveis conforme regra do
  formulário (ex.: item sem saldo na saída), exibindo-os identificados e impedindo a seleção
  nos dois caminhos.
- **FR-014**: O Lookup MUST permitir limpar a seleção atual — em campo opcional por um botão
  de limpar; em campo obrigatório, apagando o texto (sem botão, conforme DESIGN_SYSTEM §4.3.1).
- **FR-015**: A busca por digitação MUST ignorar diferenças de maiúsculas/minúsculas e de
  acentuação.
- **FR-016**: Estados de carregamento, nenhum resultado e erro de busca MUST ser exibidos em
  pt-BR, tanto nas sugestões quanto na tabela.
- **FR-017**: O Lookup MUST ser acessível por teclado e leitor de tela (papel de combobox nas
  sugestões, diálogo com foco gerenciado, botão de pesquisa com nome acessível).
- **FR-018**: As consultas do Lookup MUST exigir a mesma permissão de leitura do cadastro
  consultado (para itens e kits: acesso a `/estoque`) e não devolver nenhum dado além do que o
  usuário já vê na listagem desse cadastro — um usuário sem essa permissão não obtém registros
  pela busca.

**Aplicação aos campos de item de estoque**

- **FR-019**: O campo de item do formulário de **Descarte** MUST usar o Lookup, preservando a
  exibição/validação do saldo disponível do item escolhido.
- **FR-020**: O campo de item de cada linha do formulário de **Saída** (tipo "Itens avulsos")
  MUST usar o Lookup, exibindo o saldo do item nas sugestões e na tabela e impedindo a seleção
  de item sem saldo.
- **FR-021**: O campo de item de cada componente do formulário de **Composição de Kits** MUST
  usar o Lookup, preservando a validação de item duplicado na mesma receita.
- **FR-022**: O campo "Nome do item" do formulário de **Entrada** MUST usar o Lookup em modo
  "valor livre permitido" (FR-025): selecionar um item existente (por sugestão ou pela tabela)
  referencia esse item e preenche categoria e unidade de medida como hoje; texto digitado sem
  seleção significa cadastro de item novo com aquele nome, exigindo categoria e unidade, como
  no comportamento atual. O aviso de "item existente" e a regra de estoque mínimo só para item
  novo continuam valendo.
- **FR-023**: O campo de kit de cada linha do formulário de **Saída** (tipo "Kits") MUST usar o
  Lookup, consultando o cadastro de kits; kits sem receita aparecem identificados como "sem
  receita" e não podem ser selecionados, nem nas sugestões nem na tabela. Pela mesma decisão,
  o campo opcional "Destinação (kit)" do formulário de **Entrada** MUST usar o Lookup de kits
  (só kits ativos; opcional, com limpar seleção).
- **FR-025**: O Lookup MUST suportar um modo opcional "valor livre permitido", ativado por
  configuração do campo: nesse modo, texto digitado sem seleção é aceito como valor do campo
  (sem identificador de registro) em vez de bloquear o envio, e a lista de sugestões informa
  que o texto será tratado como novo registro quando nenhum compatível for encontrado. Fora
  desse modo vale a regra do FR-010. Selecionar um registro e depois editar o texto desfaz a
  seleção também neste modo, passando o texto a valer como valor livre.
- **FR-024**: As regras de negócio e mensagens de erro existentes de cada formulário migrado
  MUST continuar valendo sem alteração de comportamento além da forma de seleção do item.

### Key Entities

- **Configuração de Lookup**: define, para cada uso, o cadastro consultado, a descrição
  exibida do registro, as colunas da tabela de pesquisa, o filtro de texto e eventuais regras
  de "não selecionável".
- **Item de Estoque** (existente): registro referenciado pelos formulários; atributos
  relevantes para a seleção: nome (descrição), categoria, unidade de medida e saldo atual.
- **Kit** (existente): registro referenciado pela saída do tipo "Kits"; atributos relevantes:
  nome, quantidade de componentes e se possui receita.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Um operador que conhece o nome do item o seleciona por digitação em menos de 5
  segundos, independentemente do tamanho do catálogo.
- **SC-002**: As sugestões aparecem em até 1 segundo após a pausa na digitação em conexão
  normal, e nunca mais de 5 sugestões são exibidas.
- **SC-003**: Abrir a janela de pesquisa ou mudar de página exibe os registros em até 2
  segundos em conexão normal, mesmo com milhares de itens cadastrados, porque apenas a página
  visível é carregada.
- **SC-004**: 100% dos campos de item de estoque dos formulários do escopo usam o Lookup, com
  a mesma interação em todos eles.
- **SC-005**: 0 envios de formulário com referência de item inválida (texto digitado sem
  seleção) chegam ao servidor.
- **SC-006**: Todo o fluxo (digitação, sugestões, pesquisa, paginação, seleção) é concluível
  usando apenas teclado.

## Assumptions

- "Formulários de cadastro" no escopo são os formulários do módulo de Estoque que referenciam
  item ou kit hoje: Entrada (modo valor livre), Descarte, Saída (itens avulsos e kits) e
  Composição de Kits. O diálogo de estoque mínimo não está no escopo, pois o item já vem
  fixado pela linha da tabela de estoque (não há campo de escolha).
- O Lookup é genérico para qualquer cadastro, mas nesta feature só é aplicado a campos de item
  de estoque e de kit; outros cadastros adotam o componente em features futuras.
- A descrição exibida de um item de estoque é o seu nome; categoria, unidade de medida e saldo
  aparecem como informação complementar nas sugestões e como colunas na tabela.
- A busca por digitação começa a partir de 2 caracteres, após uma pausa curta na digitação
  (padrão de mercado para autocomplete).
- A tabela da janela de pesquisa reutiliza o padrão de tabela com paginação no servidor já
  existente na aplicação (feature 007), com tamanho de página padrão desse componente.
- O Lookup seleciona um único registro por campo; seleção múltipla está fora do escopo.
- Criar um novo registro a partir da janela de pesquisa (ex.: botão "cadastrar item" dentro do
  diálogo) está fora do escopo; o único caminho de item novo é o modo valor livre da Entrada,
  que já existe hoje.

## Clarifications

### Session 2026-10-05

- Q: O formulário de Entrada deve usar o Lookup, dado que hoje aceita texto livre para item
  novo? → A: Sim, com um modo "valor livre permitido" no Lookup (FR-022, FR-025).
- Q: O campo de kit da Saída (tipo "Kits") também usa o Lookup? → A: Sim; kits sem receita não
  são selecionáveis (FR-023).
- Os textos de interface seguem pt-BR, conforme a constituição do projeto.
