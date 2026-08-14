# Feature Specification: Migração do Toast para react-toastify

**Feature Branch**: `010-toast-react-toastify`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "preciso que seja substituido o componente de toast pelo componente react-toastify, mantendo a coesao do design system do projeto"

## Resumo

Hoje o feedback de ações do usuário (conta cadastrada, saída de estoque registrada, candidatura aprovada, erro ao salvar) é exibido por um componente de aviso flutuante próprio, construído sobre o primitivo de toast da biblioteca de componentes atual. São 26 pontos de disparo espalhados por 12 telas.

Esta feature substitui o mecanismo interno que exibe esses avisos pela biblioteca `react-toastify`, **sem alterar o que o usuário vê nem como as telas disparam avisos**. A aparência (cores por tipo, ícones, borda lateral colorida, tipografia, comportamento em tema claro e escuro) permanece a do design system do projeto; a API em pt-BR usada pelas telas (`avisar.sucesso`, `avisar.erro`, `avisar.atencao`, `avisar.info`) permanece idêntica.

Do ponto de vista do usuário final, esta é uma troca invisível: o valor está em consolidar o feedback visual sobre uma biblioteca dedicada e amplamente adotada, sem custo de reaprendizado nem regressão visual.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Continuar recebendo confirmação das ações realizadas (Priority: P1)

Como membro da Defesa Civil operando o sistema em campo, preciso continuar recebendo confirmação visual imediata de que minha ação foi concluída (ou falhou), para saber se posso seguir para a próxima tarefa sem reconferir a tela.

**Why this priority**: é a razão de existir do componente. Em um cenário de emergência, registrar uma saída de estoque e não saber se ela foi gravada leva a registro duplicado ou a item entregue sem baixa. Sem esta história a substituição não entrega nada — ela é a paridade funcional mínima.

**Independent Test**: pode ser testada isoladamente executando uma ação de escrita em qualquer tela (cadastrar conta, registrar entrada, aprovar candidatura) e verificando que o aviso correspondente aparece, com o mesmo texto, e desaparece sozinho.

**Acceptance Scenarios**:

1. **Given** um coordenador na tela de gestão de contas, **When** cadastra uma nova conta com sucesso, **Then** um aviso de sucesso aparece com o título e a descrição em pt-BR e desaparece sozinho após alguns segundos.
2. **Given** um membro da Defesa Civil registrando saída de estoque, **When** a operação falha por saldo insuficiente, **Then** um aviso de erro aparece com a mensagem devolvida pelo servidor e permanece visível por mais tempo que um aviso de sucesso.
3. **Given** um aviso visível na tela, **When** o usuário posiciona o cursor sobre ele, **Then** a contagem para o desaparecimento automático é pausada enquanto o cursor permanecer sobre o aviso.
4. **Given** um aviso visível na tela, **When** o usuário aciona o controle de fechar, **Then** o aviso é removido imediatamente.
5. **Given** cinco ações concluídas em sequência rápida, **When** os avisos são disparados, **Then** no máximo quatro ficam visíveis ao mesmo tempo e os demais aparecem conforme os anteriores saem.

---

### User Story 2 - Enxergar avisos coerentes com o restante da interface (Priority: P1)

Como usuário do sistema, preciso que os avisos usem as mesmas cores, ícones e tipografia do restante da aplicação — inclusive no tema escuro — para que a interface continue legível e previsível sob estresse.

**Why this priority**: o pedido explicita "mantendo a coesão do design system". Uma troca que entregasse o visual padrão da biblioteca introduziria um segundo vocabulário visual na aplicação (outras cores de erro, outro ícone de sucesso, outra família tipográfica), o que em campo aumenta o tempo de leitura justamente na informação mais urgente. É P1 junto com a US1: entregar a função sem a coerência visual seria uma regressão percebida.

**Independent Test**: pode ser testada isoladamente comparando, lado a lado, um aviso de cada tipo (sucesso, erro, atenção, informação) antes e depois da troca, em tema claro e escuro, verificando cor, ícone, borda, espaçamento e fonte.

**Acceptance Scenarios**:

1. **Given** o tema claro ativo, **When** um aviso de cada tipo é exibido, **Then** cada um usa a cor, o ícone e a borda lateral definidos pelo design system para aquele tipo (sucesso, erro, atenção, informação).
2. **Given** o tema escuro ativo, **When** um aviso é exibido, **Then** as cores de fundo, texto, borda e ícone seguem as variantes de tema escuro do design system e o contraste do texto permanece legível.
3. **Given** o usuário alterna entre tema claro e escuro, **When** há um aviso visível no momento da troca, **Then** o aviso adota o novo tema sem precisar ser fechado e reaberto.
4. **Given** um dispositivo com tela estreita (360px), **When** um aviso é exibido, **Then** ele cabe na tela sem cortar texto e sem cobrir a ação primária da tela.
5. **Given** um aviso com título longo e descrição longa, **When** é exibido, **Then** o texto quebra em múltiplas linhas dentro do limite de largura, sem estourar a caixa nem ser truncado sem indicação.

---

### User Story 3 - Disparar avisos pelo mesmo vocabulário de sempre (Priority: P2)

Como desenvolvedor do projeto, preciso continuar disparando avisos pelos mesmos atalhos em pt-BR já usados nas telas, para que a substituição não exija editar dezenas de arquivos nem crie duas formas concorrentes de avisar.

**Why this priority**: é o que mantém o custo da troca baixo e evita regressão por omissão — reescrever 26 pontos de disparo é onde uma migração deste tipo tipicamente quebra telas. Não é P1 porque, mesmo sem preservar a API, o usuário final ainda receberia os avisos; o valor aqui é de manutenção e de risco, não de uso.

**Independent Test**: pode ser testada isoladamente conferindo que nenhum arquivo de tela precisou ser alterado para os avisos continuarem funcionando, e que existe um único mecanismo de aviso disponível no projeto.

**Acceptance Scenarios**:

1. **Given** as telas existentes que disparam avisos, **When** a substituição é concluída, **Then** nenhuma delas precisou ter suas chamadas de aviso alteradas.
2. **Given** um desenvolvedor implementando uma tela nova, **When** procura como exibir um aviso, **Then** encontra um único mecanismo disponível, com os mesmos quatro atalhos em pt-BR (sucesso, erro, atenção, informação).
3. **Given** o projeto após a substituição, **When** o código é inspecionado, **Then** o mecanismo de aviso anterior não existe mais — não há dois sistemas de toast coexistindo.

---

### Edge Cases

- **Avisos idênticos em sequência rápida** (ex.: dois cliques no mesmo botão): ambos são exibidos como avisos distintos, respeitando o limite de simultâneos — não há mesclagem nem supressão silenciosa, para não esconder do usuário que a ação ocorreu duas vezes.
- **Aviso disparado imediatamente antes de uma navegação de rota**: o aviso permanece visível durante e após a troca de tela, pelo tempo restante da sua duração.
- **Mais de quatro avisos enfileirados**: os excedentes aguardam e são exibidos conforme os anteriores desaparecem; nenhum é descartado sem ser mostrado.
- **Descrição ausente**: o aviso é exibido apenas com o título, sem espaço vazio reservado nem quebra de layout.
- **Aviso exibido sobre um diálogo aberto**: permanece acima do diálogo e continua legível e clicável.
- **Usuário navegando por teclado**: o controle de fechar do aviso é alcançável e possui rótulo em pt-BR.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema DEVE exibir avisos flutuantes de quatro tipos — sucesso, erro, atenção e informação — disparados por qualquer tela da aplicação.
- **FR-002**: Cada aviso DEVE exibir um título obrigatório e uma descrição opcional.
- **FR-003**: Cada aviso DEVE desaparecer automaticamente, com duração distinta por tipo: avisos de erro permanecem visíveis por mais tempo que avisos de sucesso e de informação, e avisos de atenção por tempo intermediário.
- **FR-004**: A contagem para o desaparecimento automático DEVE ser pausada enquanto o aviso estiver sob o cursor ou com foco de teclado, e retomada ao sair.
- **FR-005**: Cada aviso DEVE oferecer um controle de fechamento manual, alcançável por teclado e com rótulo acessível em pt-BR.
- **FR-006**: O sistema DEVE exibir no máximo quatro avisos simultaneamente, enfileirando os excedentes sem descartá-los.
- **FR-007**: Os avisos DEVEM ser posicionados de forma a não obstruir a ação primária da tela, tanto em desktop quanto em telas estreitas.
- **FR-008**: Cada tipo de aviso DEVE usar a cor, o ícone e a borda lateral definidos pelo design system do projeto para aquele tipo, nunca cores ou ícones ad-hoc.
- **FR-009**: Os avisos DEVEM respeitar os temas claro e escuro, inclusive quando o tema é alternado com um aviso já visível.
- **FR-010**: Todo texto de interface dos avisos (rótulos de controles, textos auxiliares) DEVE estar em pt-BR.
- **FR-011**: O vocabulário de disparo de avisos usado pelas telas DEVE ser preservado: os mesmos quatro atalhos em pt-BR, com a mesma assinatura (título e descrição opcional).
- **FR-012**: Nenhuma tela existente que dispara avisos DEVE precisar ser alterada em decorrência desta substituição.
- **FR-013**: O mecanismo de aviso anterior DEVE ser removido; o projeto DEVE ficar com um único mecanismo de aviso ativo.
- **FR-014**: O mecanismo de avisos DEVE ser montado uma única vez no shell da aplicação, servindo todas as rotas — públicas e autenticadas.
- **FR-015**: Avisos DEVEM ser anunciados por leitores de tela no momento em que aparecem, sem exigir que o usuário navegue até eles.

### Key Entities

- **Aviso**: uma mensagem pontual de feedback exibida ao usuário. Atributos: tipo (sucesso, erro, atenção, informação), título, descrição opcional e duração de exibição derivada do tipo.
- **Fila de Avisos**: o conjunto ordenado de avisos aguardando exibição quando o limite de simultâneos foi atingido.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% dos pontos de disparo de aviso existentes na aplicação continuam exibindo o aviso correspondente após a substituição, sem que nenhum arquivo de tela tenha sido alterado.
- **SC-002**: O aviso aparece imediatamente após a conclusão da ação, sem atraso perceptível pelo usuário.
- **SC-003**: Em revisão visual lado a lado dos quatro tipos de aviso, em tema claro e escuro, nenhuma diferença de cor, ícone, borda ou tipografia é identificada em relação ao padrão do design system.
- **SC-004**: Em tela de 360px de largura, nenhum aviso corta texto nem cobre a ação primária da tela.
- **SC-005**: Após a substituição, existe exatamente um mecanismo de aviso disponível no projeto — a busca por mecanismos de aviso não retorna implementações concorrentes.
- **SC-006**: Nenhuma das 12 telas que hoje exibem avisos apresenta regressão: todas continuam confirmando sucesso e reportando erro nas mesmas situações.
- **SC-007**: Todos os avisos são fecháveis por teclado e anunciados por leitor de tela.

## Assumptions

- A biblioteca `react-toastify` é a escolha imposta pelo pedido; esta feature não reavalia alternativas. A troca constitui a decisão documentada exigida pelo princípio de simplicidade operacional da constituição, que pede registro explícito ao substituir capacidade já coberta pela stack.
- Os atalhos em pt-BR de disparo (`sucesso`, `erro`, `atenção`, `informação`) e sua assinatura atual (título obrigatório, descrição opcional) são preservados exatamente como estão — esta é a razão pela qual nenhuma tela precisa ser alterada.
- As durações por tipo, o limite de quatro avisos simultâneos e a posição atual dos avisos na tela são preservados como estão hoje; esta feature não é oportunidade para revisá-los.
- A biblioteca de componentes atual continua sendo usada pelos demais componentes da interface (diálogo, menu, tabela e outros) — apenas o primitivo de toast deixa de ser utilizado, sem remoção da dependência.
- A galeria do design system, que hoje demonstra os avisos, é atualizada junto e passa a demonstrar o novo mecanismo, mantendo-se como referência viva.
- O comportamento em dispositivos de toque segue o de desktop no que for aplicável; a pausa por cursor não se aplica a toque, e isso é aceitável — o fechamento manual e o desaparecimento automático cobrem o caso.
- Não há requisito de persistir avisos entre sessões, recarregamentos de página ou histórico de avisos — o feedback é pontual, e o histórico de eventos relevantes continua sendo responsabilidade do sino de notificações, que é um mecanismo distinto e fora do escopo desta feature.
