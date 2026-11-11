# Research: Danger Zone — manutenção irrestrita de dados pelo administrador

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-10

Cada decisão abaixo segue o formato Decisão / Racional / Alternativas. As decisões partem da
leitura do schema físico (`db/schema/*.ts`), do módulo de auditoria (`src/modules/auditoria/`) e
do fluxo de sessão (`src/shared/auth/sessao.ts`) como estão no branch.

---

## D1 — Novo módulo `manutencao`, que opera sobre o schema físico por catálogo

**Decisão**: criar o bounded context **Manutenção de Dados** em `src/modules/manutencao/`, com as
quatro camadas. Ele é o único módulo autorizado a ler e escrever em tabelas de outros módulos, e
só o faz através de um **catálogo declarativo** (`domain/catalogo.ts`) que lista tabelas, chaves
primárias, colunas exibíveis e a classificação de cada vínculo.

**Racional**: a Danger Zone atua no nível de armazenamento, não no de domínio — "resetar `item`"
não é uma regra de Estoque, é uma operação sobre linhas. Uma cascata atravessa módulos
(`user` → `entrada` → `saldo_estoque`) e precisa acontecer numa única transação Postgres; pedir a
cada módulo um port de "apagar em massa por conjunto de ids, dentro desta transação" criaria 18
ports novos cujo único consumidor é a Danger Zone, e que vazariam a mesma informação física
(nome de tabela, FK) que o catálogo centraliza.

**Alternativas**:
- *Ports por módulo* — rejeitado pelo custo acima e por espalhar a lógica de cascata em sete
  lugares; é a violação do Princípio I registrada em Complexity Tracking.
- *SQL livre gerado a partir de `pg_catalog` em tempo de execução, sem catálogo* — rejeitado: não
  há onde guardar a classificação inseparável/histórico (D3), os rótulos pt-BR e as colunas
  seguras para exibir.

## D2 — O catálogo é conferido contra `pg_catalog` a cada uso (FR-013a)

**Decisão**: antes de gerar uma prévia, o módulo lê as FKs reais de `pg_constraint` (tabela,
coluna, tabela referenciada, regra `ON DELETE`, `NOT NULL`) e compara com o catálogo por uma função
pura de domínio (`conferirCatalogo`). Toda FK física sem entrada no catálogo — ou entrada do
catálogo sem FK física — torna **indisponíveis** as ações sobre as duas tabelas que ela liga, com a
mensagem "Vínculo `tabela.coluna` → `destino` ainda não classificado". Um teste de integração faz a
mesma conferência contra o Neon e quebra o CI quando uma migração nova adiciona FK sem atualizar o
catálogo.

**Racional**: o catálogo é uma segunda descrição do schema e vai divergir. A divergência não pode
virar comportamento implícito (Princípio VI): bloquear é a única resposta segura, porque assumir
"inseparável" apaga histórico e assumir "histórico" pode violar `NOT NULL` sem registro padrão.

**Alternativas**: conferir só no teste — rejeitado, um banco migrado sem deploy novo (ou o
contrário) escaparia; conferir só em runtime — rejeitado, o erro apareceria em produção e não no
PR.

## D3 — Classificação de cada vínculo

**Decisão** (fonte da verdade fica em `domain/catalogo.ts`; esta tabela é o ponto de partida
revisado):

| Vínculo (filho.coluna → pai) | Regra hoje no banco | Obrigatório | Classificação | Na preservação |
|---|---|---|---|---|
| `session.user_id` → `user` | cascade | sim | inseparável | apaga |
| `account.user_id` → `user` | cascade | sim | inseparável | apaga |
| `voluntario_perfil.user_id` → `user` | cascade | sim (único) | inseparável | apaga |
| `voluntario_perfil.aprovado_por` → `user` | set null | não | histórico | vazio |
| `voluntario_habilidade.voluntario_perfil_id` → `voluntario_perfil` | cascade | sim | inseparável | apaga |
| `voluntario_habilidade.habilidade_id` → `habilidade` | restrict | sim | inseparável | apaga |
| `atividade.categoria_id` → `atividade_categoria` | no action | sim | histórico | registro padrão |
| `atividade.criado_por` → `user` | no action | sim | histórico | registro padrão |
| `turno.atividade_id` → `atividade` | cascade | sim | inseparável | apaga |
| `alocacao.turno_id` → `turno` | cascade | sim | inseparável | apaga |
| `alocacao.participante_user_id` → `user` | cascade | sim | **histórico** | registro padrão |
| `alocacao.voluntario_perfil_id` → `voluntario_perfil` | cascade | não | histórico | vazio |
| `alocacao.alocado_por` → `user` | no action | sim | histórico | registro padrão |
| `saldo_estoque.item_id` → `item` | cascade | sim (PK) | inseparável | apaga |
| `kit_receita_item.kit_id` → `kit` | cascade | sim | inseparável | apaga |
| `kit_receita_item.item_id` → `item` | restrict | sim | inseparável | apaga |
| `entrada.item_id` → `item` | restrict | sim | histórico | registro padrão |
| `entrada.kit_destino_id` → `kit` | set null | não | histórico | vazio |
| `entrada.registrado_por` → `user` | no action | sim | histórico | registro padrão |
| `saida.registrado_por` → `user` | no action | sim | histórico | registro padrão |
| `saida_item.saida_id` → `saida` | cascade | sim | inseparável | apaga |
| `saida_item.item_id` → `item` | restrict | sim | histórico | registro padrão |
| `descarte.item_id` → `item` | restrict | sim | histórico | registro padrão |
| `descarte.registrado_por` → `user` | no action | sim | histórico | registro padrão |
| `crise_variaveis.atualizado_por` → `user` | no action | sim | histórico | registro padrão |
| `metrica_kit.kit_id` → `kit` | cascade | sim (único) | inseparável | apaga |
| `notificacao.destinatario_user_id` → `user` | cascade | sim | **histórico** | registro padrão |
| `notificacao_envio.notificacao_id` → `notificacao` | cascade | sim | inseparável | apaga |
| `preferencia_whatsapp.user_id` → `user` | cascade | sim (PK) | inseparável | apaga |
| `consentimento_whatsapp.user_id` → `user` | cascade | sim | inseparável | apaga |

Critérios aplicados:
- **Inseparável** quando o filho é parte do agregado do pai (turno da atividade, item da saída,
  linha de receita do kit), quando é dado pessoal ou credencial do próprio titular (sessão, conta
  de login, perfil de voluntário, consentimento e preferência de WhatsApp — preservá-los sem o
  titular manteria dado pessoal órfão), ou quando um índice único tornaria o registro padrão
  impossível sem ganho (`voluntario_habilidade`, `metrica_kit`).
- **Histórico** quando o filho documenta algo que aconteceu e é lido por relatórios: movimentações
  de estoque, autoria, alocações em turnos e notificações enviadas (relatório R-16).
- Consequência: só três tabelas precisam de registro padrão — `user`, `item` e
  `atividade_categoria` (D4). `kit` não precisa: o único vínculo histórico para ele é opcional.

**Alternativas**: classificar `turno.atividade_id` como histórico — rejeitado, exigiria uma
"Atividade removida" acumulando turnos de atividades distintas, o que não tem leitura útil; quem
apaga uma atividade quer apagar seus turnos.

## D4 — Registros padrão com identificador fixo, criados por migração e recriados sob demanda

**Decisão**: três registros padrão com **id fixo**, declarados em
`src/shared/kernel/registros-sistema.ts` (compartilhado, porque as listagens de outros módulos
precisam excluí-los):

| Tabela | Id | Conteúdo |
|---|---|---|
| `user` | `sistema-usuario-removido` | nome "Usuário removido", e-mail `usuario-removido@sistema.invalid`, role `usuario`, `ativo = false`, sem linha em `account` |
| `item` | `00000000-0000-4000-8000-000000000001` | nome "Item removido", categoria `outros`, unidade `unidade` |
| `atividade_categoria` | `00000000-0000-4000-8000-000000000002` | nome "Categoria removida" |

A migração os insere (`ON CONFLICT DO NOTHING`). A execução de uma ação os recria dentro da mesma
transação quando ausentes (edge case "registro padrão ainda não existe"). Nenhuma ação da Danger
Zone os inclui no conjunto a apagar: o planejador os remove do conjunto e os lista como "registro
do sistema preservado".

O registro padrão de usuário não autentica (`ativo = false` já encerra a sessão em
`resolverSessao`, e não há `account` nem senha) e não recebe notificação (o serviço de
notificação já recusa destinatário inativo com o motivo `usuario_inativo`).

**Racional**: id fixo dispensa coluna nova em três tabelas de três módulos e permite que o filtro
das listagens seja uma constante. `.invalid` é TLD reservado (RFC 2606): nunca entrega e-mail.

**Alternativas**: coluna `sistema boolean` — rejeitado, três migrações de coluna e um filtro por
coluna em cada consulta, para o mesmo efeito; registro padrão criado só sob demanda — rejeitado,
deixaria a primeira execução fazendo DDL implícito de dado e dificultaria o teste.

## D5 — Índice único parcial em `alocacao` (colisão com o registro padrão)

**Decisão**: substituir `alocacao_turno_participante_idx` (`turno_id`, `participante_user_id`)
por um índice **parcial** com `WHERE participante_user_id <> 'sistema-usuario-removido'`.

**Racional**: na preservação, dois usuários apagados que estavam no mesmo turno passariam ambos a
apontar para o registro padrão, e o índice único recusaria a segunda atualização — a ação
inteira falharia. O índice não é alvo de `ON CONFLICT` em nenhum caminho do código (só garante
"uma inscrição por pessoa por turno"), então torná-lo parcial não muda o comportamento das telas.
É o único índice único que contém um vínculo histórico obrigatório; os demais (D3) foram
classificados como inseparáveis.

**Alternativas**: apagar a alocação quando houver colisão — rejeitado, perderia histórico de forma
não determinística; vários registros padrão de usuário — rejeitado, contradiz FR-012a.

## D6 — Algoritmo: conjuntos-alvo em tabelas temporárias, expandidos até ponto fixo

**Decisão**: dentro de uma transação, para cada tabela atingida o planejador cria uma tabela
temporária `ON COMMIT DROP` com as chaves das linhas a apagar (`dz_apagar_<tabela>`) ou a
redirecionar (`dz_redirecionar_<tabela>_<coluna>`). O conjunto inicial é a tabela inteira (reset)
ou as chaves selecionadas, menos os registros protegidos. Em seguida, para cada vínculo cujo pai
tem conjunto não vazio:
- **cascata**, ou vínculo inseparável → as linhas filhas entram em `dz_apagar_<filho>`;
- **preservação** e vínculo histórico → as linhas filhas entram em `dz_redirecionar_…` (a menos que
  já estejam em `dz_apagar_<filho>`, caso em que a exclusão prevalece).

Repete até nenhum conjunto crescer (ponto fixo — trata ciclos e profundidade arbitrária; cada
tabela aparece uma vez na árvore). A prévia é feita de `COUNT(*)` desses conjuntos mais uma amostra
de até 5 linhas por tabela. A execução aplica, nesta ordem: (1) `UPDATE` dos redirecionamentos,
(2) `DELETE` dos conjuntos em ordem topológica reversa (filhos antes dos pais), (3) recálculo de
saldo (D10).

A ordem "redirecionar antes de apagar" é o que faz a classificação da Danger Zone prevalecer
sobre o `ON DELETE CASCADE` físico (FR-013): quando o pai é apagado, o filho histórico já não
aponta para ele, e o banco não tem o que cascatear. Apagar filhos antes dos pais é o que permite
apagar através de vínculos `restrict`/`no action` no modo cascata.

**Racional**: tabelas temporárias mantêm conjuntos de dezenas de milhares de chaves fora da
memória do servidor e permitem que prévia e execução usem exatamente o mesmo código. A topologia
(ordem e ponto fixo) é uma função pura de domínio sobre o grafo do catálogo — testável sem banco
(Princípio III).

**Alternativas**: CTE recursiva única — rejeitada, não expressa a regra "exclusão prevalece sobre
redirecionamento" nem gera contagens por vínculo; carregar ids em memória — rejeitado pelo volume.

## D7 — Divergência entre prévia e execução: recálculo sob trava

**Decisão**: a prévia devolve uma **impressão digital** = contagens por tabela e por vínculo
(apagar / redirecionar / preservar). Na execução, a transação toma `LOCK TABLE … IN SHARE ROW
EXCLUSIVE MODE` em todas as tabelas do grafo atingido (bloqueia escrita concorrente, permite
leitura), recalcula os conjuntos e compara a impressão digital com a confirmada. Diferente →
rollback, evento `recusada` com motivo `dados_mudaram`, e a tela reapresenta a prévia nova
(cenário 1.6).

**Racional**: comparar contagens é exatamente o que FR-015 pede e o que o administrador viu. A
trava garante que nada muda entre a comparação e a aplicação. Ações são raras e feitas por
poucas pessoas; bloquear escritas por alguns segundos é aceitável — e a própria confirmação avisa
que operações de campo ficam suspensas durante a execução.

**Alternativas**: isolamento `SERIALIZABLE` — rejeitado, falha só no commit, depois de os
snapshots já terem ido para a auditoria, e exige retry; comparar hash das chaves — mais forte, mas
sem ganho percebido pelo administrador e com custo de leitura de todas as chaves duas vezes.

## D8 — Auditoria bloqueante e append-only: evento de início com snapshots, depois desfecho

**Decisão**: a sequência da execução é:
1. ping no Mongo; falhou → recusa com `auditoria_indisponivel`, nada é tocado no Postgres.
2. Postgres: `BEGIN`, travas (D7), recálculo e comparação.
3. Mongo: grava o evento **`iniciada`** (resumo + impressão digital) e os **snapshots** de cada
   linha a apagar ou redirecionar (lotes de 500 em `insertMany`), todos com o mesmo `execucaoId`.
   Falhou → `ROLLBACK`, recusa com `auditoria_indisponivel`.
4. Postgres: aplica (D6), `COMMIT`.
5. Mongo: grava o evento **`concluida`** com as contagens reais. Se o passo 4 falhou, grava
   **`falhou`** com a mensagem.

Nenhum registro de auditoria é alterado depois de gravado: o estado de uma execução é o último
evento do seu `execucaoId`. Uma execução com `iniciada` sem desfecho (o servidor caiu entre 4 e 5,
ou o Mongo caiu no passo 5) aparece no histórico como **"desfecho não confirmado"** e orienta a
conferir o banco — os snapshots já estão lá, então o rastro existe nos dois casos.

Esta escrita **não** passa por `withAudit` (que grava depois da mutação e engole falhas, por
design do Princípio V). Ela passa por uma porta nova do módulo de auditoria,
`registrarExecucaoManutencao`, que reaproveita `redigirCamposSensiveis` e **propaga** a falha. A
política de degradação graciosa continua intacta para todo o resto do sistema.

**Racional**: é a única ordem que satisfaz ao mesmo tempo "sem auditoria, não executa" (FR-016) e
"não existe ação efetivada sem os snapshots" (edge case) com dois bancos sem transação
distribuída: os snapshots são gravados **antes** do commit, e o commit só acontece se eles foram
aceitos. O custo — snapshots de uma execução que acabou falhando — é benigno e explicado pelo
evento `falhou`.

**Alternativas**: gravar tudo depois do commit — rejeitado, uma falha do Mongo deixaria uma
execução sem rastro, exatamente o que a decisão Q4 proíbe; atualizar o status de um documento
único — rejeitado, quebra a imutabilidade da trilha (Princípio V).

## D9 — Redação dos snapshots: sensíveis com marca, credenciais descartadas

**Decisão**: todo snapshot passa por `redigirCamposSensiveis` (cpf, cep, data de nascimento,
índice cego). Além disso, colunas de **credencial** são **removidas** do snapshot, não marcadas:
`account.password`, `account.access_token`, `account.refresh_token`, `account.id_token`,
`session.token`, `verification.value`. O catálogo marca essas colunas como `credencial`, e a mesma
marcação as exclui da listagem de registros e da amostra da prévia.

**Racional**: hash de senha e token de sessão não têm valor de auditoria e dariam a quem lê a
trilha material para ataque offline ou sequestro de sessão. A marca HMAC de D-redação existe para
detectar mudança de valor; um registro apagado não muda depois.

**Alternativas**: gravar credenciais redigidas por HMAC — rejeitado, sem uso legítimo.

**Gap aceito, herdado**: `restricoes_saude` e `telefone` aparecem nos snapshots como no resto da
trilha, pela decisão Q1 da feature 025 registrada no Princípio IV.

## D10 — Dados calculados: só `saldo_estoque` é derivado

**Decisão**: o único dado materializado a partir de outros registros é `saldo_estoque`. Para todo
item cujas movimentações foram apagadas ou redirecionadas (inclusive o registro padrão "Item
removido", que as recebe), a execução recalcula
`quantidade_atual = Σ entrada − Σ saida_item − Σ descarte` dentro da transação, com `INSERT … ON
CONFLICT DO UPDATE`. A prévia mostra saldo atual × resultante por item e destaca resultado
negativo.

`metrica_kit` **não** é derivado: guarda a base de demanda e a proporção configuradas por kit.
"Kits possíveis" e "kits necessários" são calculados na leitura do dashboard e se ajustam sozinhos
quando a cache é invalidada (D12).

Um teste de integração trava a premissa: recalcular o saldo de um banco populado pelos casos de uso
normais **não altera** nenhum saldo. Se falhar, a fórmula não reflete alguma regra de
movimentação e o recálculo não pode ser usado.

**Alternativas**: chamar casos de uso do Estoque para refazer o saldo — rejeitado pelo mesmo
motivo de D1 (precisa da mesma transação) e porque eles fazem deltas, não recálculo.

## D11 — Reautenticação por "sessão recente", válida também para login social

**Decisão**: uma ação destrutiva exige que a sessão tenha sido **criada** há no máximo 15 minutos
(`session.createdAt`, que o `getSession` já devolve). Fora da janela, a ação devolve
`reautenticacao_necessaria` e a tela oferece "Entrar novamente", que encerra a sessão e leva a
`/login?redirecionar=/admin/danger-zone`. O usuário reentra pelo mesmo meio que usa normalmente —
senha ou Google/Facebook.

**Racional**: o pedido de senha da spec não funciona para quem entra só por provedor social (não
há senha), e o auto-cadastro público é justamente o social. Exigir login recente tem o mesmo efeito
de segurança — prova de posse da credencial há pouco tempo — para os dois meios. É também o
conceito de *fresh session* do próprio better-auth.

**Ajuste na spec**: FR-003 passa a dizer "pedir nova autenticação" em vez de "pedir a senha".

**Alternativas**: verificação de senha via endpoint — rejeitado, exclui admins sem senha.

## D12 — Invalidação de cache e efeito sobre sessões

**Decisão**: depois do commit, a action chama `updateTag` + `revalidateTag` para **todas** as tags
de `CACHE_TAGS`, mais `tagAtividade(id)` para cada atividade atingida e
`tagNotificacoesUsuario(id)` para cada usuário atingido. É uma operação rara; invalidar tudo é mais
simples e mais seguro que derivar o subconjunto exato.

Resetar `session` apaga as sessões no banco na hora, mas o cookie cache assinado
(`JANELA_COOKIE_CACHE_SEGUNDOS = 5 min`) mantém quem já estava navegando por até 5 minutos — é o
trade-off já aceito em `src/shared/auth/opcoes.ts`. A prévia de `session`, `account` e `user` diz
isso em linguagem direta ("as pessoas serão desconectadas em até 5 minutos").

As consultas TanStack Query no navegador de outros usuários se atualizam pelo próprio ciclo de
revalidação (foco/tempo de staleness). FR-019 é satisfeito no servidor; não há push para clientes
abertos.

## D13 — Acesso: rota sob `/admin`, resposta padrão de acesso negado

**Decisão**: a página fica em `app/(interno)/(staff)/admin/danger-zone/` e herda a regra
`{ prefixo: '/admin', roles: ['administrador'] }` de `REGRAS_DE_ROTA` (proxy) e
`exigirAcessoA('/admin/danger-zone')` na página. Cada Server Action relê a sessão e exige
`administrador`. Quem não é admin é levado a `/sem-permissao`, como em toda rota com regra de role.

**Ajuste na spec**: FR-001 pedia "página não encontrada". O sistema usa `/sem-permissao` para
rotas com regra de role, e o próprio `/admin` já revela que existe uma área administrativa;
responder 404 só aqui exigiria tirar a rota do mapa de roles, o que o Princípio IV proíbe. FR-001
passa a dizer "a mesma resposta de acesso negado usada no resto do sistema".

O item de menu entra no grupo `administracao` com um campo novo opcional `perigo: true` em
`ItemNavegacao`, que o shell renderiza com cor de alerta (FR-002).

## D14 — Exclusão da própria conta e do último administrador

**Decisão**: o planejador remove do conjunto inicial e de toda expansão: a linha `user` do
executor, a sessão corrente do executor (por `session.token`) e as linhas `account` do executor.
O invariante "sobra ao menos um administrador ativo" é verificado de qualquer forma, mas é
satisfeito por construção: o executor é administrador ativo e nunca é apagado.

A proteção vale também para dependentes inseparáveis desses registros: a sessão do executor não é
apagada nem quando `user` é resetado em cascata.

## D15 — Registros padrão fora das telas normais

**Decisão**: as consultas de seleção (lookup de item, lookup de categoria de atividade, listagem
de usuários do `/admin`, listagem de estoque, filtros de relatório) passam a excluir os ids de
`REGISTROS_SISTEMA`. Relatórios e históricos **continuam mostrando** "Usuário removido" / "Item
removido" como autor ou item de movimentações preservadas — é a leitura correta do histórico.

**Racional**: o registro padrão não pode ser escolhido para uma entrada nova nem editado pelo
`/admin` (reativá-lo daria uma conta que agrega o histórico de várias pessoas).

## D16 — Histórico da Danger Zone lido da trilha, não de tabela própria

**Decisão**: o histórico (US3) é uma consulta à coleção `audit_logs` filtrando
`entidade = 'ManutencaoDados'` e agrupando por `execucaoId`. Não há tabela Postgres de execuções.
Cancelamentos explícitos (botão "Cancelar" na confirmação) gravam um evento `cancelada`; fechar a
aba sem cancelar não gera registro — limitação documentada.

**Racional**: a trilha já é a fonte imutável; uma tabela no Postgres seria apagável pela própria
Danger Zone (resetável como qualquer outra), o que derrotaria o propósito.

## D17 — Ambiente exibido

**Decisão**: o ambiente vem de `VERCEL_ENV` (`production` / `preview` / `development`), com
`NODE_ENV` como fallback local, e aparece numa faixa no topo e na frase de confirmação final
("Você está em **PRODUÇÃO**").

## D18 — Documentação e governança

**Decisão**: na implementação, registrar em `spec/DESIGN.md` uma seção "Manutenção de Dados
(Danger Zone)" com D1, D3, D6, D8 e a exceção ao Princípio V; acrescentar o módulo à lista de
bounded contexts (§3) e o índice parcial de D5 em `spec/DB_SCHEMA.md`. A constituição **não** é
emendada (decisão Q4 da clarificação): as exceções aos Princípios I e V ficam justificadas no
Complexity Tracking deste plano.

---

## Riscos residuais

- **Trava de escrita**: durante a execução, operações de campo nas tabelas atingidas esperam a
  transação. Mitigado por aviso na confirmação; um reset em plena operação de crise continua
  sendo decisão do administrador.
- **Volume de snapshots**: um reset de `user` em cascata pode gerar dezenas de milhares de
  documentos. Aceito (decisão Q2); `insertMany` em lotes e o índice `manutencao.execucaoId` mantêm a leitura
  do histórico rápida.
- **Evento de desfecho perdido**: tratado como "desfecho não confirmado" (D8), não como sucesso.
- **Catálogo desatualizado**: bloqueia ações em vez de agir errado (D2).
