# Especificação Detalhada de Requisitos de Negócio (BRD)

## Projeto: SOS Jaraguá - Gestão e mobilização em situações de emergência

### 1. Visão Geral e Propósito

O **SOS Jaraguá** é uma plataforma web para gestão de crises pela Defesa Civil de Jaraguá do Sul, com foco em desastres naturais. O sistema deve operar sob alta demanda e prever cenários de instabilidade de infraestrutura local, gerenciando duas vertentes:

1. **Recursos Humanos (Voluntários):** Triagem, alocação por habilidades e gestão de turnos.
2. **Recursos Materiais (Estoque):** Controle de inventário, composição de kits, projeção de demanda e fluxo de descarte.

---

### 2. Matriz de Atores e Permissões

| Ator                    | Descrição                          | Permissões Principais                                                                                                        |
| :---------------------- | :--------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| **Usuário (Comum)**     | Conta autenticada sem privilégios. | Acessar tela inicial; Preencher e submeter formulário de voluntariado.                                                       |
| **Voluntário**          | Usuário com candidatura aprovada.  | Visualizar suas atividades/turnos; Receber notificações.                                                                     |
| **Membro Defesa Civil** | Operador de campo e triagem.       | Registrar saída de itens/kits; Visualizar Dashboard de Inteligência; Aprovar/Rejeitar voluntários.                           |
| **Coordenador**         | Gestor operacional da crise.       | Todas do Membro + Registrar entradas; Cadastrar receitas de Kits; Criar atividades; Alocar voluntários; Registrar descartes. |
| **Administrador**       | Gestor do sistema.                 | Acesso total; Gestão de usuários e permissões; Configurações globais.                                                        |

---

### 3. Módulo 1: Gestão de Voluntários e Mobilização

#### 3.1. Formulário de Candidatura (Entrada de Dados)

**Gatilho:** Usuário comum acessa a área "Quero ser Voluntário".

| Campo                   | Tipo de Dado       | Obrigatoriedade | Regra de Negócio / Comportamento                                      |
| :---------------------- | :----------------- | :-------------- | :-------------------------------------------------------------------- |
| Nome Completo           | Texto              | Sim             | -                                                                     |
| Data de Nascimento      | Data               | Sim             | Sistema deve validar maioridade (>= 18 anos).                         |
| Documento (CPF)         | Texto formatado    | Sim             | Validação de máscara e dígito verificador.                            |
| Telefone (WhatsApp)     | Texto formatado    | Sim             | -                                                                     |
| E-mail                  | E-mail             | Sim             | Validação de formato de e-mail.                                       |
| CEP e Bairro            | Texto              | Sim             | Auxilia no mapeamento geográfico do voluntário.                       |
| Profissão / Formação    | Texto              | Sim             | -                                                                     |
| Habilidades Específicas | Múltipla Escolha   | Não             | Checkboxes: Motosserra, CNH D/E, Embarcação, Primeiros Socorros, etc. |
| Veículo Próprio         | Booleano (Sim/Não) | Sim             | Se "Sim", habilitar campo `Tipo de Veículo`.                          |
| Tipo de Veículo         | Múltipla Escolha   | Condicional     | Opções: Carro, Caminhonete, Moto, Barco.                              |
| Disponibilidade         | Múltipla Escolha   | Sim             | Opções: Integral, Manhã, Tarde, Noite, Fim de Semana.                 |
| Restrições de Saúde     | Texto Longo        | Não             | Ex: Alergias, limitações físicas.                                     |

#### 3.2. Fluxo de Aprovação (Triagem)

- **BR-VOL-01:** Submissões caem em uma tabela de "Cadastros Pendentes".
- **BR-VOL-02:** O Coordenador/Membro Defesa Civil pode visualizar os detalhes e clicar em "Aprovar" ou "Rejeitar".
- **BR-VOL-03:** Ao aprovar, o `role` (perfil) do usuário muda automaticamente de `User` para `Voluntario`. O sistema dispara notificação de aprovação.

#### 3.3. Gestão de Atividades e Escalas

- **Cadastro de Atividade:** O Coordenador cria uma necessidade informando Título, Categoria (ex: _Separação de itens, Montagem de kits, Apoio logístico_), Local e Quantidade de Vagas.
- **BR-VOL-04 (Escalas):** A atividade deve ser fragmentada em **Turnos de 4 horas** (ex: 08:00-12:00, 12:00-16:00).
- **BR-VOL-05 (Alocação):** O Coordenador seleciona um voluntário da base (podendo filtrar por Habilidades) e o vincula a um turno específico de uma atividade.
- **Painel Visual (Kanban/Lista):** A interface deve exibir colunas/listas por Atividade, mostrando as vagas preenchidas vs. vagas abertas em cada turno, destacando em vermelho (gargalo) turnos deficitários.

---

### 4. Módulo 2: Gestão de Doações e Estoque

#### 4.1. Cadastro de Entrada (Recebimento)

**Gatilho:** Coordenador registra materiais recebidos no centro de distribuição.

| Campo            | Tipo de Dado       | Obrigatoriedade | Regra de Negócio / Comportamento                                                                                                                     |
| :--------------- | :----------------- | :-------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nome do Item     | Texto              | Sim             | **BR-EST-01:** Sistema deve possuir _Auto-complete_ consultando itens já cadastrados para evitar duplicidade (ex: "Ág..." sugere "Água Mineral 5L"). |
| Categoria        | Seleção Única      | Sim             | Água, Alimentação, Higiene, Limpeza, Acomodação, Materiais de Construção, Vestuário, Outros.                                                         |
| Condição         | Seleção Única      | Sim             | Novo, Usado (Bom Estado), Necessita Higienização (Foco em roupas/colchões).                                                                          |
| Quantidade       | Numérico (Decimal) | Sim             | > 0.                                                                                                                                                 |
| Unidade Medida   | Seleção Única      | Sim             | Unidade, Kg, Litro, Fardo, Caixa.                                                                                                                    |
| Perecível        | Booleano (Sim/Não) | Sim             | Se "Sim", habilitar e obrigar `Data de Validade`.                                                                                                    |
| Data de Validade | Data               | Condicional     | Bloquear inserção de data retroativa (vencida).                                                                                                      |
| Destinação (Kit) | Seleção Única      | Não             | Dropdown listando Kits pré-cadastrados. Se preenchido, o item entra no estoque já reservado para aquele kit.                                         |

#### 4.2. Composição de Kits de Sobrevivência (Receitas)

- **BR-EST-02:** O sistema deve ter um CRUD de "Kits" (ex: Cesta Básica).
- **BR-EST-03:** O Coordenador adiciona itens à "receita" do kit (ex: Kit Higiene = 2 Sabonetes (Un) + 1 Creme Dental (Un) + 1 Papel Higiênico (Fardo)).

#### 4.3. Fluxo de Saída e Validação

- **Modalidades:** O operador seleciona se a saída é de **Itens Avulsos** ou **Kits**.
- **BR-EST-04 (Validação de Kit):** Se o operador solicitar a saída de "10 Cestas Básicas", o sistema deve iterar sobre a "receita" da Cesta Básica e verificar o estoque real de cada componente.
    - _Cenário A (Sucesso):_ Saldo suficiente. O sistema deduz os itens individuais do estoque global e registra a saída.
    - _Cenário B (Falha):_ Falta algum item. O sistema **bloqueia** a transação e exibe erro específico: _"Saída bloqueada. Faltam 5 Kg de Arroz para montar esta quantidade de kits."_
- **Campos de Saída:** Tipo (Avulso/Kit), Quantidade, Destino (Texto livre para bairro/abrigo/família) e Responsável pelo Transporte.

#### 4.4. Fluxo de Descarte (Baixa de Estoque)

- **BR-EST-05:** Deve existir uma tela de "Baixa por Descarte" para registrar a saída de caixas inúteis, sacolas vazias, ou itens vencidos/avariados.
- Esses itens saem do saldo de estoque, mas são tagueados como `Descarte` no banco de dados para não constarem nos relatórios de "Itens entregues à população".

---

### 5. Módulo 3: Inteligência Logística (Dashboard)

- **Entrada de Variáveis:** Tela para a Defesa Civil atualizar os números oficiais da crise: `Total de Famílias Afetadas` e `Total de Pessoas Afetadas`.
- **BR-INT-01 (Cálculo de Projeção):** Baseado no histórico (Portaria N° 04 / IAH), o sistema deve permitir configurar uma métrica (ex: 1 Cesta Básica para cada 1 Família Afetada; 1 Kit Acomodação para cada Pessoa Desabrigada).
- **BR-INT-02 (Atualização Dinâmica):** O Dashboard deve exibir, em tempo real, dois grandes indicadores visuais:
    - `Kits Necessários (Demanda)`: Baseado no cálculo acima.
    - `Kits Possíveis (Capacidade)`: Quantos kits o sistema consegue montar agora, cruzando a "receita" dos kits com o saldo atual do estoque.
    - _Comportamento:_ A cada nova doação recebida (Entrada), o indicador de "Kits Possíveis" é recalculado.

---

### 6. Matriz de Comunicação e Notificações

| Evento / Gatilho        | Destinatário         | Canal               | Conteúdo da Mensagem (Resumo)                                            |
| :---------------------- | :------------------- | :------------------ | :----------------------------------------------------------------------- |
| Triagem Concluída       | Voluntário           | E-mail / Plataforma | "Seu cadastro foi aprovado. Você agora é um voluntário."                 |
| Atividade Atribuída     | Voluntário           | E-mail / Plataforma | Detalhes da tarefa, data, turno (horário) e local.                       |
| Alteração de Atividade  | Voluntário           | E-mail / Plataforma | Aviso de mudança de local, horário ou cancelamento.                      |
| Lembrete de Turno       | Voluntário           | Plataforma (Push)   | Disparado 2h antes do início do turno estabelecido.                      |
| _Broadcast_ de Urgência | Todos os Voluntários | E-mail / Plataforma | Disparo manual do Coordenador para convocação em massa.                  |
| Cadastros Acumulados    | Coordenadores        | Plataforma (Alerta) | "Existem X cadastros de voluntários aguardando aprovação."               |
| Estoque Crítico         | Coordenadores        | Plataforma (Alerta) | "O item [Nome] atingiu o estoque mínimo de segurança."                   |
| Déficit de Atendimento  | Defesa Civil         | Plataforma (Alerta) | "A capacidade de montagem de kits está X% abaixo da demanda de vítimas." |

---

### 7. Auditoria, Relatórios e Contingência

- **BR-AUD-01 (Logs Restritos):** Todo evento de CRUD (Create, Read, Update, Delete) nas entidades `Doacao`, `Voluntario`, e `Atividade` deve gerar um log com: `Timestamp`, `User_ID`, `Ação Realizada` e `Dados Anteriores/Novos`. Este log não é apagável e serve para prestação de contas.
- **BR-REL-01 (Exportação):** Funcionalidade para exportar o Inventário Atual (Estoque) e o Histórico de Saídas em formato `.CSV` ou `.XLSX` (para compatibilidade com outras Defesas Civis).
- **BR-CON-01 (Plano de Contingência Offline):** O sistema deve possuir um botão "Gerar Pacote de Contingência". Ao clicar, o sistema compila e faz o download de uma planilha contendo:
    - Aba 1: Saldo exato do estoque no momento do download.
    - Aba 2: Formulário em branco para anotação manual de Entradas.
    - Aba 3: Formulário em branco para anotação manual de Saídas.
    - Aba 4: Formulário em branco para gestão de turnos de voluntários.
    - _Objetivo:_ Permitir a impressão rápida e transição imediata para controle em papel em caso de queda de energia ou perda da conexão (ex: falha na Starlink/Rede Interna).
