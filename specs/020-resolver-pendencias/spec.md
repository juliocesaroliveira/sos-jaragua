# Feature Specification: Resolução das Pendências Abertas

**Feature Branch**: `020-resolver-pendencias`

**Created**: 2026-10-01

**Status**: Clarified

**Input**: User description: "vamos analisar o documento de pendências @PENDENCIAS.md e validar item a item para resolve-los."

## Resumo

O `PENDENCIAS.md` lista 14 pontos que dependiam de decisão do time. Parte deles já foi resolvida e o documento não foi atualizado, e parte mudou de natureza desde que foi escrita. Esta feature confere cada item contra o estado atual do repositório e classifica cada um em uma de quatro situações:

1. **Já resolvido**: sai do documento e a decisão fica registrada na spec correspondente.
2. **Resolvível em código**: entra no escopo desta feature.
3. **Ação operacional**: precisa de console externo (Vercel, Atlas, Resend, Google, Meta) ou de uma credencial real. Não é código. Fica em um roteiro de execução com critério de "feito".
4. **Depende de decisão de negócio**: precisa da resposta do responsável ou da Defesa Civil.

### Validação item a item (estado em 2026-10-01)

| #   | Item                               | O que o repositório mostra hoje                                                                                                                                                                                                                                                   | Classificação                              |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | `xlsx` com vulnerabilidade alta    | Continua `xlsx@0.18.5` do npm. **Desatualizado:** o documento diz que "nenhum código de exportação foi escrito ainda", mas a geração de planilhas já existe e é usada pelos relatórios. A auditoria de dependências agora acusa 10 vulnerabilidades, não 1 (ver "Achados novos"). | Código: trocar por `exceljs` (Q1)          |
| 2   | `/cadastro` removido               | Resolvido (opção b). O resíduo continua aberto: a rota pública de auto-cadastro por senha segue aceitando requisições, sem tela.                                                                                                                                                  | Código: fechar a rota pública (Q2)         |
| 3   | Senha do admin de bootstrap        | Credencial de desenvolvimento documentada. Falta a credencial de produção.                                                                                                                                                                                                        | Operacional                                |
| 4   | ID-06: timeout de inatividade      | Implementado e corrigido em 2026-09-24. Ainda desmarcado no TASKS.md. Os usuários de teste por papel (incluindo `coordenador`) já existem no banco de desenvolvimento, então a verificação não depende mais de criar usuário.                                                     | Verificação                                |
| 5   | Formato do `datetime-local`        | Campo nativo, sem mudança. A recomendação foi aceitar.                                                                                                                                                                                                                            | Decisão: registrar (a) e encerrar          |
| 6   | Provedor de e-mail                 | Os adapters estão prontos e degradam graciosamente. Falta a conta Resend e o domínio.                                                                                                                                                                                             | Operacional                                |
| 7   | Credenciais de login social        | As variáveis continuam vazias e os botões aparecem mesmo assim. Com a decisão do item 2, o login social virou o **único** caminho público de entrada, então botão quebrado bloqueia o público inteiro.                                                                            | Operacional + código (esconder sem config) |
| 8   | Limiar dos alertas de coordenador  | A mecânica funciona. O limiar de estoque continua global.                                                                                                                                                                                                                         | Código: mínimo por item (Q3)               |
| 9   | Gestão de usuários (`/admin`)      | **Resolvido** pela feature `006-user-management-page`: a tela `/admin` existe, com listagem, criação e edição.                                                                                                                                                                    | Já resolvido: remover                      |
| 10  | AUD-02: grants do Atlas            | O usuário da aplicação continua administrativo.                                                                                                                                                                                                                                   | Operacional                                |
| 11  | DNS SRV na rede de desenvolvimento | É um problema do ambiente local, não do produto. A solução (string não-SRV) já está documentada.                                                                                                                                                                                  | Documentação: mover para o README          |
| 12  | Degradação graciosa da auditoria   | **Resolvido** e coberto por teste. O próprio documento pede a remoção.                                                                                                                                                                                                            | Já resolvido: remover                      |
| 13  | DEPLOY-01 / DEPLOY-02              | Dependem do painel da Vercel.                                                                                                                                                                                                                                                     | Operacional                                |
| 14  | DEPLOY-06: verificação end-to-end  | Faltam `coordenador`, `voluntario` e `usuario`. Os usuários de teste existem. A ressalva "a área `/admin` não existe" está **desatualizada** (ver item 9).                                                                                                                        | Verificação                                |

### Achados novos (não estavam no documento)

- A auditoria das dependências de produção acusa, além do `xlsx`, uma vulnerabilidade **crítica** no framework web (execução remota de código sem autenticação, restrita a servidores Windows) e uma **alta** na biblioteca de imagens. A Vercel não roda em Windows, então o vetor crítico não se aplica ao deploy, mas o alerta polui o CI do mesmo jeito que o item 1. Isso entra no `PENDENCIAS.md` como item novo, e a atualização das dependências entra no escopo desta feature quando houver versão corrigida compatível.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Documento de pendências fiel ao estado real (Priority: P1)

Quem mantém o projeto abre o `PENDENCIAS.md` e encontra só o que ainda está de fato aberto. Cada item restante tem o próximo passo concreto e quem é responsável por ele (time de código, operação/console ou negócio). Itens resolvidos saíram, e a decisão de cada um ficou registrada na spec de origem.

**Why this priority**: Hoje o documento induz a erro: diz que `/admin` não existe e que não há código de planilha. Corrigir isso não custa nada e guia todas as outras histórias.

**Independent Test**: Para cada item que sobrar no documento, conferir no repositório que a afirmação do "Estado atual" é verdadeira. Para cada item removido, achar a decisão registrada na spec de projeto.

**Acceptance Scenarios**:

1. **Given** os itens 9 e 12 estão resolvidos, **When** o documento for atualizado, **Then** eles não aparecem mais, e a decisão de cada um está registrada nas Decisões de Design Consolidadas da spec de projeto.
2. **Given** o item 5 tem recomendação (a) aceita, **When** o documento for atualizado, **Then** ele sai do documento e a decisão "aceitar o formato do navegador; reavaliar se houver relato de confusão" fica registrada.
3. **Given** o item 11 é uma questão de ambiente local, **When** o documento for atualizado, **Then** a orientação de usar a string de conexão não-SRV passa a constar no guia de desenvolvimento local, e o item sai do documento.
4. **Given** os achados novos de vulnerabilidade, **When** o documento for atualizado, **Then** existe um item que os descreve, com severidade e aplicabilidade ao ambiente de produção.

---

### User Story 2 - Planilhas exportadas sem vulnerabilidade conhecida (Priority: P1)

A coordenação continua exportando relatórios e planilhas de contingência exatamente como hoje (mesmas abas, colunas, CSV com separador `;` e acentos corretos no Excel em pt-BR). A auditoria de dependências deixa de acusar a biblioteca de planilhas.

**Why this priority**: Bloqueava REL-01, REL-02 e CON-01, e o código que usa a biblioteca já existe. Quanto mais tempo passar, maior o retrabalho de uma troca.

**Independent Test**: Gerar cada relatório e planilha de contingência antes e depois da mudança e comparar o conteúdo. Rodar a auditoria de dependências e confirmar que a biblioteca de planilhas não aparece.

**Acceptance Scenarios**:

1. **Given** a biblioteca de planilhas trocada por `exceljs`, **When** a auditoria de dependências roda, **Then** nenhuma vulnerabilidade da biblioteca de planilhas é reportada.
2. **Given** um relatório exportado antes da mudança, **When** o mesmo relatório é exportado depois, **Then** abas, cabeçalhos, valores e larguras de coluna são equivalentes, e o arquivo abre no Excel em pt-BR com acentuação correta.
3. **Given** uma instalação limpa das dependências (CI ou deploy), **When** o projeto é instalado, **Then** a instalação conclui sem configuração manual adicional.

---

### User Story 3 - Entrada pública sem botões quebrados e sem porta lateral (Priority: P1)

Um voluntário novo abre a tela de login. Só aparecem os botões dos provedores sociais que de fato funcionam neste ambiente. Ninguém consegue criar conta com senha por fora da interface. Contas com senha continuam nascendo só pela gestão de usuários.

**Why this priority**: Depois da decisão do item 2, o login social é o único auto-cadastro público. Um botão que falha ao clicar significa voluntário que desiste. E uma rota de cadastro por senha aberta, sem tela, contradiz essa mesma decisão.

**Independent Test**: Num ambiente sem credenciais do Facebook, abrir a tela de login e confirmar que só o botão do Google aparece (e vice-versa). Tentar criar conta com senha chamando a rota pública diretamente e confirmar a recusa. Criar uma conta pela gestão de usuários e confirmar que funciona.

**Acceptance Scenarios**:

1. **Given** um provedor social sem credenciais configuradas, **When** a tela de login é exibida, **Then** o botão desse provedor não aparece.
2. **Given** nenhum provedor social configurado, **When** a tela de login é exibida, **Then** aparece só o login por e-mail e senha, sem espaço vazio nem divisor órfão.
3. **Given** a rota pública fechada, **When** alguém não autenticado tenta criar conta com senha pela rota pública, **Then** a requisição é recusada e nenhuma conta é criada.
4. **Given** a rota pública fechada, **When** um administrador cria uma conta com senha pela gestão de usuários, **Then** a conta é criada normalmente.

---

### User Story 4 - Verificação de papéis e do timeout concluída (Priority: P2)

Quem mantém o projeto percorre o roteiro de verificação com os usuários de teste de `coordenador`, `voluntario` e `usuario`. Confirma a matriz de acesso de cada papel e que o timeout de inatividade derruba a sessão do `coordenador` mas não a do `voluntario`. Ao final, ID-06 e DEPLOY-06 ficam marcados como concluídos.

**Why this priority**: O código já está pronto, falta só a evidência. Não bloqueia o uso, mas mantém duas tasks abertas sem motivo.

**Independent Test**: Com o timeout reduzido para 1 minuto, logar como `coordenador`, ficar inativo e confirmar o redirecionamento com o motivo "expirado". Repetir com `voluntario` e confirmar que a sessão continua.

**Acceptance Scenarios**:

1. **Given** timeout de 1 minuto e sessão de `coordenador`, **When** passam mais de 1 minuto sem atividade e a pessoa navega, **Then** ela vai para o login com o aviso de sessão expirada.
2. **Given** timeout de 1 minuto e sessão de `coordenador` em uso contínuo (navegação a cada 30s por 5 minutos), **When** a janela passa, **Then** a sessão continua ativa.
3. **Given** timeout de 1 minuto e sessão de `voluntario`, **When** passam mais de 1 minuto sem atividade, **Then** a sessão continua ativa.
4. **Given** cada papel restante, **When** o roteiro de acesso às rotas protegidas é percorrido, **Then** cada rota responde conforme a matriz de atores do BRD §2, e o resultado fica registrado.

---

### User Story 5 - Alerta de estoque crítico coerente com cada item (Priority: P2)

A coordenação recebe o alerta de estoque crítico quando um item cai abaixo do mínimo de segurança **daquele item**, e não de um número único para tudo.

**Why this priority**: Com o limiar global, 5 cobertores e 5 kg de arroz disparam o mesmo alerta, e o alerta perde credibilidade. Decidido em Q3: mínimo por item com fallback global.

**Independent Test**: Definir mínimos diferentes para dois itens, baixar o saldo de cada um até ficar logo abaixo do seu mínimo e confirmar que cada alerta dispara no momento certo, citando o item correto.

**Acceptance Scenarios**:

1. **Given** o item A com mínimo 20, **When** o saldo de A cai para 19, **Then** o alerta de estoque crítico cita A.
2. **Given** um item sem mínimo definido, **When** o saldo cai, **Then** vale o limiar padrão global.
3. **Given** uma pessoa da gestão de estoque, **When** ela cadastra ou edita um item, **Then** ela pode informar o mínimo de segurança desse item.

---

### User Story 6 - Roteiro operacional para colocar em produção (Priority: P3)

O responsável pelo deploy tem um roteiro único, em ordem, com os passos de console que nenhum código resolve: credencial do administrador de produção, conta de e-mail transacional, aplicações OAuth, usuário restrito do banco de auditoria, variáveis e cron na plataforma de hospedagem. Cada passo tem um critério verificável de "feito".

**Why this priority**: São passos necessários para produção, mas fora do repositório. O que a feature entrega aqui é clareza e ordem, não a execução.

**Independent Test**: Uma pessoa que não participou do desenvolvimento segue o roteiro e consegue dizer, para cada passo, se ele está feito ou não.

**Acceptance Scenarios**:

1. **Given** o roteiro, **When** é lido, **Then** cada passo (itens 3, 6, 7, 10 e 13) traz pré-requisito, ação, onde ela é feita e como verificar.
2. **Given** um passo concluído, **When** ele é verificado, **Then** o item correspondente sai do `PENDENCIAS.md`.

---

### Edge Cases

- **Diferenças de formato entre bibliotecas (Q1)**: a biblioteca nova pode gravar larguras de coluna, tipos de célula (número vs. texto) e nomes de aba de forma diferente. A equivalência é conferida pelo conteúdo aberto no Excel e por teste automatizado sobre o arquivo gerado, não pelos bytes. Nomes de aba com mais de 31 caracteres ou com caracteres proibidos precisam continuar sendo tratados.
- **Provedor social configurado pela metade** (só o ID, sem o segredo): conta como não configurado, e o botão não aparece.
- **Fechar a rota pública de cadastro por senha (Q2) sem quebrar a gestão de usuários**: a criação de contas pelo administrador não pode depender da rota pública.
- **Item com mínimo de segurança zero ou vazio (Q3)**: zero desliga o alerta para o item; vazio usa o padrão global.
- **Atualizar o framework web para corrigir a vulnerabilidade crítica**: uma major nova pode trazer mudança incompatível. A atualização só entra se a suíte de testes e o build passarem; se não passar, fica registrada como pendência.
- **Usuário de teste com credencial versionada no `PENDENCIAS.md`**: as credenciais de desenvolvimento não podem existir no banco de produção. O roteiro operacional inclui conferir isso.

## Requirements _(mandatory)_

### Functional Requirements

**Documento de pendências**

- **FR-001**: O `PENDENCIAS.md` MUST conter só itens que continuam abertos depois desta feature. Cada um MUST ter "Estado atual" verdadeiro na data da atualização e responsável identificado (código, operação ou negócio).
- **FR-002**: Os itens 9 e 12 MUST ser removidos, e a decisão de cada um MUST ficar registrada nas Decisões de Design Consolidadas da spec de projeto.
- **FR-003**: O item 5 MUST ser encerrado com a decisão "aceitar o formato do navegador" registrada, junto com o gatilho de reavaliação (relato de confusão em campo).
- **FR-004**: O item 11 MUST sair do `PENDENCIAS.md`, e a orientação para desenvolvimento local MUST passar para o guia de setup do projeto.
- **FR-005**: As vulnerabilidades novas de dependência (framework web, biblioteca de imagens) MUST ser registradas, com severidade e aplicabilidade à produção.
- **FR-006**: Toda decisão tomada nesta feature (Q1, Q2, Q3 e as de FR-002 a FR-004) MUST ficar registrada nas Decisões de Design Consolidadas da spec de projeto.

**Biblioteca de planilhas (item 1)**

- **FR-007**: A exportação de planilhas MUST deixar de usar uma versão com vulnerabilidade conhecida, substituindo a biblioteca atual por `exceljs` (Q1). A escolha de biblioteca de planilhas registrada na spec de projeto (`DESIGN.md` §16) MUST ser atualizada para refletir a troca.
- **FR-008**: As planilhas e CSVs exportados MUST manter o conteúdo atual: abas, cabeçalhos, valores, larguras de coluna, separador `;` e acentuação legível no Excel em pt-BR.
- **FR-009**: A instalação das dependências MUST funcionar em ambiente limpo (CI e deploy) sem passo manual.

**Entrada pública (itens 2 e 7)**

- **FR-010**: A tela de login MUST exibir o botão de um provedor social só quando as credenciais desse provedor estiverem completas no ambiente.
- **FR-011**: A rota pública de criação de conta por e-mail e senha MUST recusar requisições externas, enquanto a criação de contas pela gestão de usuários continua funcionando.

**Alertas (item 8)**

- **FR-012**: O alerta de estoque crítico MUST usar o mínimo de segurança definido para cada item, com fallback para o limiar global quando o item não tiver mínimo próprio.
- **FR-013**: A gestão de estoque MUST permitir definir e editar o mínimo de segurança de cada item.
- **FR-014**: Os valores padrão dos três limiares MUST ficar documentados como provisórios até serem confirmados pela Defesa Civil. A confirmação é passo do roteiro operacional (FR-018).

**Verificação (itens 4 e 14)**

- **FR-015**: O fluxo de timeout de inatividade MUST ser exercitado com `coordenador` (expira) e `voluntario` (não expira). ID-06 é marcado concluído só depois disso.
- **FR-016**: A matriz de acesso MUST ser verificada com `coordenador`, `voluntario` e `usuario`, com resultado registrado. DEPLOY-06 é marcado concluído só depois disso.

**Dependências (achado novo)**

- **FR-017**: O framework web e a biblioteca de imagens MUST ser atualizados para versões sem as vulnerabilidades reportadas, quando existir versão compatível que mantenha lint, tipagem, testes e build verdes. Senão, fica uma pendência registrada (FR-005).

**Roteiro operacional (itens 3, 6, 7, 10 e 13)**

- **FR-018**: MUST existir um roteiro operacional único e ordenado com os passos fora do repositório. Cada passo tem ação, local, pré-requisitos e critério de verificação. O roteiro inclui confirmar que credenciais de desenvolvimento não existem em produção.

### Key Entities

- **Pendência**: ponto em aberto no `PENDENCIAS.md`. Atributos: número, título, contexto, estado atual, responsável (código, operação ou negócio), ação necessária e tasks bloqueadas.
- **Decisão consolidada**: registro de decisão na spec de projeto. Atributos: data, item de origem, opção escolhida e justificativa.
- **Item de estoque** _(Q3)_: ganha o atributo "mínimo de segurança" (opcional; vazio usa o padrão global; zero desliga o alerta).
- **Passo operacional**: entrada do roteiro de produção. Atributos: ação, local (console), pré-requisito e verificação.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% dos itens que ficarem no `PENDENCIAS.md` têm "Estado atual" confirmado contra o repositório na data da atualização. Zero afirmações desatualizadas, contra 3 conhecidas hoje (itens 1, 9 e 14).
- **SC-002**: O documento cai de 14 itens para no máximo 7. Todos os restantes são operacionais ou aguardam terceiros.
- **SC-003**: A auditoria das dependências de produção não reporta nenhuma vulnerabilidade alta ou crítica que tenha correção disponível compatível.
- **SC-004**: 100% dos relatórios e planilhas exportados antes da mudança têm conteúdo equivalente depois dela.
- **SC-005**: Em qualquer ambiente, zero botões de login social que falham ao clicar.
- **SC-006**: Zero contas criadas com senha por fora da gestão de usuários.
- **SC-007**: As tasks ID-06 e DEPLOY-06 ficam marcadas como concluídas, com a evidência da verificação registrada.
- **SC-008**: Uma pessoa sem contexto prévio consegue dizer, em menos de 10 minutos, quais passos do roteiro operacional estão feitos.

## Assumptions

- O público-alvo usa navegador em pt-BR. Por isso o item 5 fica encerrado com a opção (a), conforme a recomendação já registrada.
- Os usuários de teste por papel listados no quickstart da feature de cadastro existem no banco de desenvolvimento e servem para a verificação dos itens 4 e 14.
- O vetor crítico do framework web (servidores Windows) não se aplica ao deploy atual. A atualização entra por higiene de CI, não por exposição real.
- O deploy roda em hospedagem que resolve DNS SRV normalmente. O item 11 só afeta desenvolvimento local.
- Os itens operacionais (3, 6, 7, 10 e 13) **não** são executados por esta feature. Ela entrega o roteiro e a parte de código que deixa o sistema pronto para eles (por exemplo, esconder botões sem credencial).
- A confirmação dos valores numéricos dos limiares com a Defesa Civil fica fora desta feature. Os defaults atuais continuam como provisórios.

## Clarifications

### Session 2026-10-01

- Q1 (item 1): Qual opção para a biblioteca de planilhas: versão corrigida pelo CDN do SheetJS, trocar por `exceljs` ou manter? → A: **(b) trocar por `exceljs`**. O pacote é publicado no registro público e mantido. A troca diverge de `DESIGN.md` §16, que precisa ser atualizado.
- Q2 (item 2, resíduo): Fechar a rota pública de auto-cadastro por e-mail e senha? → A: **Sim, fechar**. Contas com senha nascem só pela gestão de usuários (`/admin`). Fecha o resíduo do item 2.
- Q3 (item 8): O mínimo de segurança do alerta de estoque crítico passa a ser por item? → A: **Sim, por item**, com fallback para o limiar global quando o item não tiver mínimo próprio. Exige um atributo novo no item de estoque.
