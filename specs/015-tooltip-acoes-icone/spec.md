# Feature Specification: Tooltip em ações de ícone

**Feature Branch**: `015-tooltip-acoes-icone`

**Created**: 2026-08-17

**Status**: Draft

**Input**: User description: "implementar o componente Tooltip com base no ark-ui. Utilizar o novo componente em todos os lugares que precisam de um tooltip para auxiliar o usuario, como botoes de acao."

## Contexto

Hoje o sistema tem dezenas de controles **só com ícone** — editar usuário, remover linha de saída de
estoque, alocar voluntário em turno, sair, abrir notificações, alternar tema. Todos carregam um
rótulo acessível (lido por leitor de tela), mas **nada aparece na tela** para quem enxerga: o
usuário precisa deduzir a ação pelo desenho do ícone, ou clicar para descobrir. Em ações
destrutivas (remover alocação, remover componente de kit) descobrir clicando é caro.

Existe um componente de tooltip no design system, mas ele está adotado em **um único lugar** (a
navegação lateral recolhida). O restante da interface ficou sem apoio visual, e o componente nunca
foi exercitado nos casos que mais importam: ação desabilitada, uso em toque e ação dentro de linha
de tabela.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Descobrir o que um botão de ícone faz (Priority: P1)

Um coordenador abre a lista de usuários e vê, no fim de cada linha, um botão com um desenho de
lápis. Ele para o ponteiro sobre o botão e, em instantes, aparece um pequeno rótulo escrito
"Editar Maria Silva". Ele entende a ação e o alvo dela sem clicar em nada.

**Why this priority**: é o valor central da feature — transformar ícones ambíguos em ações
identificáveis. Sozinha, esta história já elimina o principal caso de erro (clicar para descobrir)
e vale a entrega mesmo sem as demais.

**Independent Test**: passar o ponteiro sobre qualquer botão de ícone adotado e verificar que o
rótulo correspondente aparece, some ao afastar o ponteiro, e descreve a ação daquele botão
específico.

**Acceptance Scenarios**:

1. **Given** um botão de ação representado apenas por ícone, **When** o usuário mantém o ponteiro
   sobre ele por um breve instante, **Then** um rótulo textual descrevendo a ação aparece próximo
   ao botão.
2. **Given** o rótulo visível, **When** o usuário afasta o ponteiro do botão, **Then** o rótulo
   desaparece.
3. **Given** um botão cuja ação se refere a um registro específico (uma pessoa, uma linha), **When**
   o rótulo aparece, **Then** ele identifica o registro alvo, não apenas o verbo genérico.
4. **Given** o usuário move o ponteiro rapidamente por vários botões em sequência, **When** ele não
   para em nenhum, **Then** nenhum rótulo chega a aparecer.

---

### User Story 2 - Enxergar a ação navegando por teclado (Priority: P1)

Um membro da Defesa Civil navega a tela por teclado. Ao chegar com o foco num botão de ícone, o
mesmo rótulo aparece — ele não precisa de mouse para saber onde está.

**Why this priority**: sem isto o apoio visual existe só para quem usa mouse, e a feature deixa de
fora justamente quem depende mais de dicas explícitas. Tem o mesmo peso da P1 anterior porque é o
mesmo requisito visto por outro meio de entrada.

**Independent Test**: percorrer a tela apenas com Tab e confirmar que cada botão de ícone focado
exibe seu rótulo, e que Esc o dispensa sem perder o foco.

**Acceptance Scenarios**:

1. **Given** o foco de teclado chega a um botão de ícone, **When** o botão recebe foco, **Then** o
   rótulo aparece.
2. **Given** um rótulo visível por foco, **When** o foco sai do botão, **Then** o rótulo desaparece.
3. **Given** um rótulo visível, **When** o usuário pressiona Esc, **Then** o rótulo é dispensado e o
   foco permanece no botão.
4. **Given** um usuário de leitor de tela, **When** ele foca o botão, **Then** a ação é anunciada
   **uma única vez** — o rótulo visual não produz anúncio duplicado.

---

### User Story 3 - Entender por que uma ação está indisponível (Priority: P2)

Um operador de estoque vê o botão de remover linha esmaecido, porque só existe uma linha no
formulário. Ao apontar para ele, um rótulo explica a situação em vez de o botão simplesmente não
responder.

**Why this priority**: resolve a maior fonte de confusão depois da identificação da ação — o
controle inerte e mudo. Fica em P2 porque depende do mecanismo entregue nas histórias P1.

**Independent Test**: colocar a tela num estado que desabilite um botão de ícone e verificar que
apontar/focar o botão ainda produz um rótulo.

**Acceptance Scenarios**:

1. **Given** um botão de ícone desabilitado, **When** o usuário aponta para ele, **Then** um rótulo
   aparece mesmo assim.
2. **Given** um botão desabilitado com rótulo visível, **When** o usuário clica nele, **Then** nada
   acontece — exibir o rótulo não reativa a ação.

---

### User Story 4 - Usar o sistema em celular sem perder informação (Priority: P2)

Uma voluntária opera o sistema pelo celular em campo. Não existe "apontar sem tocar" em tela
sensível ao toque, então nenhum rótulo aparece — e ela ainda assim consegue concluir todas as
tarefas.

**Why this priority**: o sistema é usado em campo, em celular, sob estresse. Se algum passo passar a
depender do rótulo para ser compreendido, a feature terá criado uma regressão em vez de uma
melhoria. É P2 porque é uma restrição de não-regressão, não uma capacidade nova.

**Independent Test**: percorrer os fluxos críticos (aprovar candidatura, registrar saída de estoque,
alocar voluntário) em viewport de celular por toque, sem nunca ver um rótulo, e concluir cada um.

**Acceptance Scenarios**:

1. **Given** um dispositivo de toque, **When** o usuário toca um botão de ícone, **Then** a ação do
   botão é executada imediatamente, sem um passo intermediário de exibir rótulo.
2. **Given** qualquer fluxo crítico em celular, **When** o usuário o percorre sem nunca ver um
   rótulo, **Then** ele consegue concluir o fluxo — nenhuma informação necessária existe apenas no
   rótulo.

---

### User Story 5 - Consultar o padrão na vitrine do design system (Priority: P3)

Quem desenvolve uma tela nova abre a vitrine do design system, encontra o tooltip demonstrado nas
suas variações (posições, ação habilitada e desabilitada, dentro de linha de tabela) e aplica o
mesmo padrão sem reinventá-lo.

**Why this priority**: sustenta a consistência ao longo do tempo, mas nenhum usuário final depende
disso. Entregue por último.

**Independent Test**: abrir a vitrine e verificar que a seção do tooltip demonstra as variações
suportadas de forma interativa.

**Acceptance Scenarios**:

1. **Given** a vitrine do design system, **When** o desenvolvedor abre a seção de tooltip, **Then**
   ele vê exemplos interativos das posições e dos estados suportados.

---

### Edge Cases

- **Botão junto à borda da janela**: o rótulo se reposiciona para permanecer inteiramente visível,
  em vez de ser cortado ou gerar rolagem horizontal na página.
- **Botão dentro de área rolável (linha de tabela, painel de escala)**: ao rolar com o rótulo
  visível, ele acompanha o botão ou é dispensado — nunca fica flutuando sobre um lugar vazio.
- **Botão dentro de diálogo ou gaveta**: o rótulo aparece **acima** do conteúdo do diálogo, não
  atrás dele.
- **Rótulo longo**: quebra em mais de uma linha dentro de uma largura máxima, em vez de esticar
  numa faixa que atravessa a tela.
- **Ação que muda de estado** (ex.: alternar tema, expandir/recolher navegação): o rótulo passa a
  descrever a ação do novo estado assim que ele muda, sem exigir que o usuário saia e volte.
- **Botão que entra em carregamento durante a ação**: o rótulo não trava visível depois que o
  ponteiro sai.
- **Movimento reduzido**: com preferência do sistema por menos animação, o rótulo aparece sem
  transição.

## Requirements _(mandatory)_

### Funcionamento do componente

- **FR-001**: O sistema DEVE oferecer um único componente de tooltip no design system, usado por
  todas as telas; nenhuma tela pode montar sua própria versão de rótulo flutuante.
- **FR-002**: O componente DEVE exibir o rótulo ao apontar com o ponteiro e ao receber foco de
  teclado, e ocultá-lo ao afastar o ponteiro, ao perder o foco e ao pressionar Esc.
- **FR-003**: O componente DEVE aguardar um breve atraso antes de exibir o rótulo por ponteiro, de
  modo que atravessar uma fileira de botões não dispare uma sequência de rótulos.
- **FR-004**: O componente DEVE permitir escolher o lado em que o rótulo aparece e DEVE reposicioná-
  lo automaticamente quando o lado escolhido não couber na janela visível.
- **FR-005**: O componente DEVE renderizar o rótulo acima de qualquer camada sobreposta da aplicação
  (diálogo, gaveta, menu), sem ficar recortado pelo contêiner do gatilho.
- **FR-006**: O componente DEVE exibir o rótulo também quando o controle acionador está
  desabilitado, sem tornar o controle acionável.
- **FR-007**: O componente DEVE limitar a largura do rótulo e quebrar textos longos em várias
  linhas.
- **FR-008**: O componente DEVE respeitar a preferência do sistema por movimento reduzido.
- **FR-009**: O componente DEVE atender ao contraste mínimo de texto exigido pelo padrão de
  acessibilidade do projeto, nos temas claro e escuro.
- **FR-010**: O sistema NÃO PODE anunciar a ação duas vezes para leitores de tela quando o controle
  já possui rótulo acessível equivalente ao texto do tooltip.
- **FR-011**: O componente NÃO PODE ser o único meio de transmitir informação necessária para
  concluir uma tarefa — todo controle assistido por tooltip permanece identificável por seu rótulo
  acessível.
- **FR-012**: Textos de tooltip DEVEM estar em pt-BR e descrever a ação de forma imperativa e curta
  (ex.: "Editar usuário", "Remover do turno").

### Adoção nas telas

- **FR-013**: Todo controle de ação representado **apenas por ícone**, sem texto visível, DEVE
  exibir tooltip descrevendo sua ação.
- **FR-014**: A adoção DEVE cobrir, no mínimo, os seguintes controles hoje sem apoio visual:
    - Barra superior: abrir navegação, sair.
    - Sino de notificações.
    - Alternância de tema claro/escuro.
    - Navegação lateral: recolher/expandir.
    - Administração de usuários: editar usuário (por linha da tabela).
    - Painel de escala da atividade: alocar voluntário no turno, remover voluntário do turno.
    - Saída de estoque: remover linha do formulário.
    - Gestão de kits: remover componente do kit.
- **FR-015**: Quando a ação se refere a um registro identificável, o texto do tooltip DEVE nomear o
  registro (ex.: "Remover João Souza do turno"), coerente com o rótulo acessível já existente.
- **FR-016**: Controles que **já exibem texto visível** descrevendo a ação NÃO PODEM receber
  tooltip, para não repetir a mesma informação duas vezes.
- **FR-017**: A vitrine do design system DEVE demonstrar o componente nas variações suportadas
  (posições, estado desabilitado, uso em linha de tabela).
- **FR-018**: A adoção NÃO PODE alterar o comportamento, o alvo de toque, o alinhamento ou o
  espaçamento dos controles existentes — apenas acrescentar o rótulo de apoio.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% dos controles de ação sem texto visível listados no FR-014 exibem tooltip por
  ponteiro e por foco de teclado.
- **SC-002**: Um usuário que nunca viu a tela identifica corretamente a ação de qualquer botão de
  ícone em até 2 segundos de apontamento, sem clicar.
- **SC-003**: Zero ocorrências de anúncio duplicado da mesma ação em verificação com leitor de tela
  nos controles adotados.
- **SC-004**: Todos os fluxos críticos (aprovar candidatura, registrar saída de estoque, alocar
  voluntário em turno) permanecem 100% concluíveis por toque em celular, sem nenhum tooltip exibido.
- **SC-005**: Nenhum rótulo é exibido cortado, fora da janela visível ou atrás de camada sobreposta,
  em verificação nas larguras de celular, tablet e desktop.
- **SC-006**: Existe exatamente uma implementação de tooltip na base de código; nenhuma tela importa
  um primitivo de tooltip diretamente da biblioteca externa.
- **SC-007**: Nenhuma regressão de alinhamento ou de tamanho de alvo de toque nos controles adotados
  em relação ao estado anterior.

## Assumptions

- **O componente já existe e será evoluído, não criado do zero.** O design system já traz um tooltip
  sobre o primitivo do Ark UI, adotado apenas na navegação lateral recolhida. Esta feature o
  endurece (estado desabilitado, largura máxima, movimento reduzido, ausência de anúncio duplicado)
  e o adota amplamente. "Implementar" foi lido como "deixar pronto para uso geral", não como
  "substituir por outra implementação".
- **Ark UI é o primitivo, conforme pedido do usuário e a stack definida na constituição** (Ark UI +
  Tailwind CSS v4). Telas continuam importando pelo barril do design system, nunca do pacote
  externo.
- **Tooltip é melhoria progressiva, não canal primário.** Em toque não há hover; o rótulo acessível
  de cada controle continua sendo a garantia funcional. Nenhum requisito depende do tooltip para a
  tarefa ser possível.
- **Controles internos de primitivos do design system ficam fora do escopo de adoção**: fechar
  diálogo/gaveta/aviso, setas de paginação, incremento/decremento de campo numérico e navegação de
  meses do calendário. São convenções universais dentro de um contexto já rotulado; acrescentar
  rótulo ali seria ruído. Podem ser revisitados depois, sem bloquear esta entrega.
- **Ações que já vivem dentro de menu de contexto com texto visível** (Aprovar, Rejeitar, Cancelar
  em menus de linha) não recebem tooltip — FR-016 se aplica.
- O atraso de exibição, a distância do rótulo ao gatilho e o estilo visual seguem o que o design
  system já pratica; esta feature não redefine linguagem visual.
- Não há mudança de dados, de permissão ou de regra de negócio: a feature é exclusivamente de
  camada de apresentação, sem entidades novas e sem impacto em auditoria.

## Dependencies

- Design system existente (`Tooltip`, `IconButton`, barril de exportação) e a vitrine interna do
  design system.
- Telas que hoje concentram ações de ícone: barra superior, navegação lateral, sino de notificações,
  administração de usuários, painel de escala, saída de estoque e gestão de kits.
