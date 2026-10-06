# Research: Cadastro de item novo na composição de kit

Feature: [spec.md](./spec.md) · Data: 2026-10-05

Levantamento feito sobre o código atual (`develop`, depois da feature 021). Não havia
NEEDS CLARIFICATION no Technical Context; as decisões abaixo resolvem o "como" de cada FR.

## R1 — Onde mora a regra: caso de uso `SalvarKitUseCase`

- **Decision**: extrair a gravação de kit de `presentation/actions/estoque.ts#salvarKit` para um
  caso de uso `application/use-cases/salvar-kit.ts`. A validação da receita (componente existente
  ou item novo, duplicidade por id e por nome normalizado, estoque mínimo) vai para o domínio
  em `domain/receita-kit.ts` (`validarReceita`, `normalizarNomeItem`). A action passa a fazer só
  gate de role, parse Zod, uma chamada ao caso de uso e invalidação de cache.
- **Rationale**: hoje `salvarKit` chama `withAudit` e o repositório direto da action. Isso
  funcionava enquanto a regra era só "id repetido". Agora há regra de negócio de verdade:
  resolver o nome contra o catálogo, recusar ambiguidade, criar itens e fazer tudo de forma
  atômica. O Princípio I proíbe isso em `presentation`, e o Princípio III exige TDD em
  `domain`/`application`. O padrão a seguir é o de `RegistrarEntradaUseCase`.
- **Alternatives considered**: (a) manter na action e só estender o `if` de duplicidade.
  Rejeitada porque viola os Princípios I e III. (b) Caso de uso separado `CriarItemUseCase`,
  chamado antes de `salvarKit`. Rejeitada porque quebra a atomicidade do FR-006 (item criado e
  kit recusado depois).

## R2 — Atomicidade: um método de repositório com uma transação

- **Decision**: novo método `KitRepository.salvarComposicao(dados)`. Ele roda numa única
  `db.transaction`: resolve os itens novos, cria o que precisar, cria ou atualiza o kit e
  substitui a receita. Devolve `{ kit, itensCriados, vinculos }` ou `{ conflitos }`. No segundo
  caso, a transação é revertida e nada é gravado.
- **Rationale**: hoje `criar`/`atualizar` e `definirReceita` são chamadas separadas, então um
  kit novo pode ficar gravado sem receita se a segunda falhar. Com itens novos esse risco
  inclui itens órfãos (FR-006, FR-008, SC-002). A atomicidade fica no repositório, que é quem
  tem a transação. É a mesma divisão de `EntradaRepository.registrar` e
  `SaidaRepository.registrar`, com o retorno discriminado no estilo `{ deficits }`.
- **Alternatives considered**: passar um `tx` pelo port. Rejeitada porque vaza o Drizzle para
  `application`. O caminho de Unit of Work genérica também foi rejeitado: seria a única no
  projeto (Princípio VI).
- **Consequência**: `criar`, `atualizar` e `definirReceita` ficam sem consumidor e são removidos
  do port e da implementação (conferir com `grep` antes). `buscarPorId` e `receita` continuam,
  porque o `dadosAnteriores` da auditoria usa os dois.

## R3 — Vínculo automático por nome idêntico (FR-009)

- **Decision**: a comparação "idêntico" é `lower(f_unaccent(btrim(nome)))`. Tem duas camadas:
  1. **Cliente, ao sair do campo**: o `Lookup` ganha a prop opcional
     `vincularIdentico?: (texto: string, registro: T) => boolean`, ativa só no modo valor
     livre. No blur, se o texto atual coincide com exatamente um registro das sugestões já
     carregadas para esse mesmo texto (termo da query normalizado = texto normalizado), o
     componente chama `onSelecionar(registro)`. O kit passa
     `(t, i) => normalizarNomeItem(t) === normalizarNomeItem(i.nome)`. A Entrada não passa a
     prop e não muda.
  2. **Servidor, na transação (fonte de verdade)**: para cada item novo, a consulta
     `select id from item where f_unaccent(nome) ilike f_unaccent($nomeEscapado)` (sem curingas,
     com `escaparLike` da 021) acha os itens equivalentes. Com 1 resultado, vincula; com 0,
     cria; com mais de 1, devolve o conflito `ambiguo` daquele componente.
- **Rationale**: o sufixo de similaridade ordena o item idêntico em primeiro lugar nas
  sugestões (similarity = 1), então a camada do cliente quase sempre acerta sem consulta extra.
  O servidor cobre o caso de outra pessoa criar o item no meio tempo (caso-limite da spec) e o
  caso de sugestões desatualizadas. `ILIKE` sem curinga equivale à igualdade sem diferença de
  maiúsculas e usa o índice GIN trigram `item_nome_unaccent_trgm_idx`, que já existe. Os nomes
  já chegam sem espaço nas pontas (`trim` na Entrada e no kit), então o `btrim` do lado da
  coluna é dispensável.
- **Normalização em TS** (`normalizarNomeItem`, domínio puro): `trim()` →
  `normalize('NFD')` → remoção de `\p{Diacritic}` → `toLocaleLowerCase('pt-BR')`. Para nomes
  em português, ela equivale ao `f_unaccent` + `lower` do Postgres. Ela é usada na duplicidade
  dentro da receita (cliente e domínio) e no vínculo do cliente.
- **Alternatives considered**: (a) índice único em `lower(f_unaccent(nome))`. Rejeitada porque
  a tabela `item` não tem garantia de que não existam duplicatas antigas (o caso-limite
  "duplicidade antiga" existe justamente por isso), e a Entrada continua aceitando nomes
  repetidos. (b) Vincular só no servidor. Rejeitada porque o usuário veria os campos "Item
  novo" para um item que já existe até salvar, o que contraria US2-AS3.

## R4 — Concorrência na criação

- **Decision**: dentro da transação, antes da busca de cada nome novo, rodar
  `select pg_advisory_xact_lock(hashtext('item-nome:' || $nomeNormalizado))`. Dois
  salvamentos de kit concorrentes com o mesmo nome novo ficam em série: o segundo vê o item
  criado pelo primeiro e vincula.
- **Rationale**: é barato (o lock vive só na transação) e não precisa de migration nem de
  constraint. Os nomes são processados em ordem de normalização, para evitar deadlock entre
  dois kits com os mesmos nomes em ordens diferentes.
- **Limite aceito**: a Entrada não pega o lock, então uma Entrada e um kit simultâneos com o
  mesmo nome novo ainda podem gerar duplicata. A janela é de milissegundos, e a Entrada já
  aceita duplicata hoje. O caso fica registrado e não é tratado (fora do escopo, Assumptions
  da spec).

## R5 — Exclusão do alerta de estoque crítico (FR-015)

- **Decision**: nova coluna `item.aguardando_primeira_entrada boolean not null default false`,
  com estes pontos:
  - O repositório marca a coluna como `true` ao criar item pelo kit.
  - `EntradaRepository.registrar` a zera na mesma transação da entrada
    (`update item set aguardando_primeira_entrada = false where id = $1 and aguardando_primeira_entrada`).
  - `itensCriticos` (domínio) ignora itens com `aguardandoPrimeiraEntrada === true`.
  - O selo "abaixo do mínimo" da tabela de estoque segue a mesma regra.
- **Rationale**: "sem movimentação" derivado de `not exists (entrada)` mudaria o comportamento
  de itens que já existem sem entrada, como os criados por seed ou por
  `ItemRepository.criar`. Esses itens passariam a sumir dos alertas sem ninguém ter pedido. A
  coluna explícita só afeta itens nascidos pelo kit, e o default `false` preserva todo o
  catálogo atual. Além disso, `itensCriticos` continua puro (o dado vem na linha) e testável.
  Saída e descarte exigem saldo, que só vem de uma entrada, então zerar a coluna na entrada
  cobre o "primeira movimentação" do FR-015.
- **Alternatives considered**: (a) `exists(entrada)` nas queries. Rejeitada pelo efeito
  colateral descrito acima. (b) Coluna `origem` (`entrada` | `kit`). Rejeitada porque não diz
  quando a exclusão termina, e ainda exigiria a mesma consulta a `entrada`.
- **Impacto em tipos**: `ItemComSaldo` (queries) ganha `aguardandoPrimeiraEntrada: boolean`. As
  queries `listarEstoque`/`buscarEstoque` e `inventarioParaExportacao` passam a selecionar a
  coluna. As colunas do relatório de inventário (`COLUNAS_INVENTARIO`) não mudam.

## R6 — Auditoria (FR-012)

- **Decision**: o caso de uso captura o snapshot anterior (`buscarPorId` + `receita`, só em
  edição) **antes** de chamar `salvarComposicao`, e chama o repositório **fora** de `withAudit`.
  Só no sucesso registra
  `withAudit({ entidade: 'Doacao', acao, tabela: 'kit', dadosAnteriores: async () => anteriores, extrair }, async () => resultado)`.
  O `dadosNovos` traz a receita final, já com os ids resolvidos, mais `itensCriados` e
  `vinculos`. Conflito ou `null` não geram nenhum registro: nada foi gravado, e a auditoria
  descreve só o que aconteceu (BR-AUD-01). Depois disso, para cada item criado, roda um
  `withAudit` próprio com `tabela: 'item'`, `acao: 'create'`, `entidadeId: item.id` e
  `dadosNovos: { ...item, origem: 'kit', kitId }`, com `fn` devolvendo o item já criado.
- **Rationale**: a busca de auditoria por `entidadeId` do item encontra o registro de criação,
  e o campo `origem` responde "de onde veio". `withAudit` já roda depois do commit por design e
  nunca desfaz a operação, então o registro por item segue a mesma semântica (Princípio V).
  Tudo continua passando pelo wrapper central, sem log solto.
- **Alternatives considered**: envolver o repositório inteiro em `withAudit`, como hoje.
  Rejeitada porque o wrapper registra mesmo quando a transação foi revertida por conflito, o que
  geraria um registro de uma gravação que não existiu. Registrar só no `dadosNovos` do kit. Rejeitada porque a busca
  pelo id do item não acharia a criação. Expor `registrarAuditoria` direto foi rejeitada porque
  seria um caminho de log fora do wrapper (Princípio V).

## R7 — Formulário do kit (UX, FR-001..FR-005, FR-013, FR-014)

- **Decision**: cada linha de `componentes` passa a ter
  `{ itemId, nomeNovo, categoria, unidadeMedida, estoqueMinimo, quantidade }`, com estes
  pontos:
  - O `Lookup` usa `permitirValorLivre`, `vincularIdentico` e
    `mensagemVazia="Nenhum item com esse nome. Ele será cadastrado como item novo."`.
  - `onTextoLivre` grava `nomeNovo`. `onSelecionar(item)` grava `itemId` e limpa `nomeNovo` e
    os campos de item novo. `onSelecionar(null)` limpa `itemId`.
  - Com `nomeNovo` preenchido e `itemId` vazio, aparece abaixo da linha um grupo com borda e
    título "Item novo", contendo Categoria e Unidade de medida (`Select`, obrigatórios, **sem
    valor inicial**) e Estoque mínimo (`NumberInput` opcional, com
    `apoioEstoqueMinimo(limiarGlobal, unidade)`, como na Entrada).
  - A `page.tsx` de kits passa a enviar `limiarGlobal={limiarEstoqueMinimoGlobal()}`.
  - O Zod do formulário valida cada linha com `itemId` ou `nomeNovo` (mensagem "Selecione ou
    digite o item."). Com `nomeNovo`, exige `categoria` e `unidadeMedida`. O `superRefine` de
    duplicado compara a chave `itemId ?? 'novo:' + normalizarNomeItem(nomeNovo)`.
  - Os erros do servidor chegam por caminho (`componentes.3.itemId`, `componentes.3.categoria`).
    `camposConhecidos` passa a ser `CAMPOS` mais os caminhos das linhas atuais.
- **Rationale (sem valor inicial)**: na Entrada, o padrão "Outros / Unidade" é aceitável
  porque o operador está com o produto na mão. No kit, o item ainda não chegou, e uma unidade
  errada (un × kg) muda o significado da "quantidade por kit". Forçar a escolha torna o
  US1-AS4 testável. É o único desvio deliberado em relação à Entrada.
- **Alternatives considered**: diálogo secundário. Rejeitada pela resposta da clarificação Q2.

## R8 — Invalidação de cache e alertas

- **Decision**: ao concluir com sucesso, a action:
  - chama `updateTag(CACHE_TAGS.estoqueKits)` e `revalidateTag(dashboardKits)`, como hoje;
  - chama também `updateTag(CACHE_TAGS.estoqueListagem)` quando `itensCriados.length > 0`,
    porque um item novo aparece na tabela de estoque;
  - mantém `agendarAlertasDeEstoque({ estoqueCritico: false })`. Pelo FR-015, item novo não
    altera a avaliação de crítico.

  No cliente, segue a invalidação de `RAIZ_LOOKUP`, que já existe. As leituras do Lookup não
  têm cache no servidor (021).
- **Rationale**: é o mesmo conjunto de tags que a Entrada usa para item novo, menos o saldo,
  que não muda.

## R9 — Next.js 16

- `salvarKit` continua uma Server Function (`'use server'`), com `updateTag`/`revalidateTag`
  como já está no arquivo. Não há rota nova, `'use cache'` novo nem mudança de `page.tsx` além
  de passar `limiarGlobal`, que é uma leitura de configuração síncrona, como na Entrada.
  Antes de mexer, a task deve conferir `node_modules/next/dist/docs/` sobre `updateTag`
  (AGENTS.md).
