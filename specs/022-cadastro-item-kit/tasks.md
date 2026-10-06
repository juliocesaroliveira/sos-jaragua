---
description: 'Task list for 022-cadastro-item-kit'
---

# Tasks: Cadastro de item novo na composição de kit

**Input**: Design documents from `/specs/022-cadastro-item-kit/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R9), data-model.md (V1–V5),
contracts/ (`salvar-kit.md` S-01..S-08, `lookup-vincular-identico.md` V-01..V-07),
quickstart.md (Q1–Q16)

**Tests**: a spec não pede testes, mas a constituição (Princípio III) exige TDD para `domain/`
e `application/` e teste de integração para fluxos transacionais críticos. Por isso, entram:

- testes unitários de `normalizarNomeItem`, `validarReceita`, `itensCriticos` e `SalvarKitUseCase`
  (`npm test`);
- teste de integração de `salvarComposicao` e do efeito da Entrada sobre a flag
  (`npm run test:integracao`).

A UI é validada pelo quickstart, porque o projeto não tem testes de componente. Os testes vêm
**antes** da implementação correspondente e precisam falhar primeiro.

**Organization**: as tarefas estão agrupadas por user story da spec:

- US1: criar item novo no kit;
- US2: reaproveitar item existente e vínculo automático;
- US3: regras da receita com itens novos.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1–US3 da spec

## Convenções que toda task deve seguir

- **Next.js 16 tem mudanças incompatíveis** (`AGENTS.md`). Antes de mexer em Server Function,
  `updateTag`/`revalidateTag` ou `page.tsx`, ler o guia correspondente em
  `node_modules/next/dist/docs/`.
- Textos de interface em pt-BR. Sem `any`. Usar o Prettier do `package.json` (4 espaços, sem `;`,
  aspas simples, 120 colunas). Comentários no estilo do arquivo vizinho, explicando o *porquê*.
- Nos testes unitários de `application`, mockar `@/src/modules/auditoria` como em
  `src/modules/estoque/application/use-cases/registrar-saida.test.ts`. Nos de integração, seguir
  `registrar-saida.integracao.test.ts`: nomes com sufixo `randomUUID().slice(0, 8)` e limpeza em
  `afterEach`.
- `registrarEntrada`, `registrarSaida`, `registrarDescarte` e `definirEstoqueMinimo` **não**
  mudam de payload nem de resposta.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: coluna que marca o item criado pelo kit (research R5, data-model "Mudança de schema").

- [X] T001 Em `db/schema/estoque.ts`, adicionar à tabela `item` a coluna
  `aguardandoPrimeiraEntrada: boolean().notNull().default(false)`, logo depois de
  `estoqueMinimo`. Docblock: `true` só para item criado pelo cadastro de kit (feature 022,
  FR-015). Mantém o item fora do alerta de estoque crítico e volta a `false` na primeira
  entrada. Itens existentes ficam `false`.
- [X] T002 Gerar a migration com `npm run db:generate`. O arquivo esperado é
  `db/migrations/0007_*.sql`, com `ALTER TABLE "item" ADD COLUMN "aguardando_primeira_entrada" boolean DEFAULT false NOT NULL;`.
  Conferir que não há nenhum outro statement e aplicar no branch Neon **de dev** com
  `npm run db:migrate`.

**Checkpoint**: `npx tsc --noEmit` passa, e a coluna existe no Neon de dev.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: domínio, port, repositório transacional, caso de uso e action. As três stories
dependem desta fase, porque toda gravação de kit passa a usar este caminho.

**⚠️ CRITICAL**: nenhuma story começa antes desta fase.

### Domínio (TDD)

- [X] T003 [P] Em `src/modules/estoque/domain/receita-kit.test.ts`, escrever os testes (que
  devem falhar) de `normalizarNomeItem(nome: string): string`:
  - `'  Água Sanitária '` → `'agua sanitaria'`;
  - `'SABÃO'` → `'sabao'`;
  - `'Feijão'` igual a `'feijao'`;
  - string só com espaços → `''`;
  - espaço interno preservado (`'a  b'` → `'a  b'`).
- [X] T004 Implementar `normalizarNomeItem` em `src/modules/estoque/domain/receita-kit.ts`:
  `trim()` → `normalize('NFD')` → `replace(/\p{Diacritic}/gu, '')` → `toLocaleLowerCase('pt-BR')`.
  Docblock dizendo que é o espelho em TS de `lower(f_unaccent(nome))` (research R3). T003 passa.
- [X] T005 Em `src/modules/estoque/domain/receita-kit.ts`, declarar os tipos do data-model:
  - `NovoItem = { nome: string; categoria: CategoriaItem; unidadeMedida: UnidadeMedida; estoqueMinimo: number | null }`;
  - a união `ComponenteInformado`:
    `{ tipo: 'existente'; itemId: string; quantidadePorKit: number } | { tipo: 'novo'; novoItem: NovoItem; quantidadePorKit: number }`.
- [X] T006 Em `src/modules/estoque/domain/receita-kit.test.ts`, escrever os testes (que devem
  falhar) de `validarReceita(componentes: ComponenteInformado[]): Result<ComponenteInformado[], DomainError>`,
  um por regra V1–V5 do data-model. Conferir a chave e a mensagem exatas em
  `erro.detalhes.campos`:
  - V1: lista vazia → `componentes`;
  - V2: quantidade `0` → `componentes.0.quantidade`;
  - V3: nome `'  '` → `componentes.1.itemId` ("Selecione ou digite o item.");
  - V4: `estoqueMinimo` inválido → `componentes.N.estoqueMinimo`, com a mesma mensagem de
    `validarEstoqueMinimo`;
  - V5: dois existentes com o mesmo id, e também `'Feijão'` e `' feijao'` como novos → a
    segunda ocorrência recebe "Este item já está na receita.";
  - caso válido: devolve os componentes com `novoItem.nome` já sem espaços nas pontas.
- [X] T007 Implementar `validarReceita` em `src/modules/estoque/domain/receita-kit.ts`,
  seguindo o padrão de `validarEntrada` em `domain/entrada.ts`: acumular em `campos` e devolver
  `falha(new ValidacaoError('Revise os campos destacados.', { campos }))`. A chave de
  duplicidade é `itemId` ou `'novo:' + normalizarNomeItem(nome)`. Reusar `ehQuantidadePositiva`
  e `validarEstoqueMinimo`. T006 passa. `domain/index.ts` já reexporta `receita-kit`; conferir.

### Port e repositório

- [X] T008 Em `src/modules/estoque/application/ports/estoque-repository.ts`, alterar o
  `KitRepository`:
  - acrescentar `salvarComposicao(dados)` com a assinatura do data-model ("Port");
  - exportar o tipo `ConflitoComposicao = { indice: number; tipo: 'ambiguo' | 'repetido' }`;
  - exportar o tipo `ResultadoComposicao` (a união do retorno);
  - remover `criar`, `atualizar` e `definirReceita` (research R2), depois de confirmar com
    `grep -rn "kitRepository\.\(criar\|atualizar\|definirReceita\)" src app` que o único uso é
    `salvarKit`, que será substituído em T013;
  - acrescentar `aguardandoPrimeiraEntrada: boolean` ao tipo `Item` do port;
  - atualizar os dublês que constroem `Item` à mão
    (`grep -rln "estoqueMinimo:" src/modules/estoque/application`, por exemplo
    `definir-estoque-minimo.test.ts`) com `aguardandoPrimeiraEntrada: false`;
  - rodar `npx tsc --noEmit` antes de seguir.

  Docblock de `salvarComposicao`: uma transação, lock por nome e conflitos sem gravação.
- [X] T009 Escrever o teste de integração (que deve falhar)
  `src/modules/estoque/application/use-cases/salvar-kit.integracao.test.ts`, chamando
  `kitRepository.salvarComposicao` direto contra o Neon. Cenários:
  - **A**: kit novo com 1 existente e 1 novo → kit e receita gravados; o item novo existe com
    `aguardando_primeira_entrada = true` e `saldo_estoque = 0`; `itensCriados` tem 1;
  - **B**: nome novo igual (outra caixa, sem acento) a um item existente único → `vinculos`
    aponta o existente e nenhum item é criado;
  - **C**: dois itens existentes com o mesmo nome normalizado mais um componente novo com esse
    nome → `{ conflitos: [{ indice, tipo: 'ambiguo' }] }`, e a contagem de `item`, `kit` e
    `kit_receita_item` fica inalterada;
  - **D**: nome novo que vincula a um id já selecionado em outra linha → `tipo: 'repetido'`,
    sem gravação;
  - **E**: edição (`id`) de kit existente, trocando a receita → a receita antiga é substituída
    por inteiro;
  - **F**: `id` inexistente → `null`, sem gravação;
  - **G**: dois `salvarComposicao` em `Promise.all` com o mesmo nome novo → exatamente 1 item
    criado, e o outro kit vincula a ele (lock, research R4).

  Na limpeza, apagar `kit_receita_item`, `kit` e depois `item` (a FK `restrict` exige essa
  ordem).
- [X] T010 Implementar `salvarComposicao` no `kitRepository` de
  `src/modules/estoque/infrastructure/drizzle/estoque-repository.ts`. Tudo roda dentro de um
  `db.transaction`:
  1. ordenar os índices dos componentes `novo` por `normalizarNomeItem(nome)`;
  2. para cada um, executar ``tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'item-nome:' + normalizado}))`)``;
  3. buscar ``tx.select({ id: item.id }).from(item).where(sql`f_unaccent(${item.nome}) ilike f_unaccent(${escaparLike(nome)}) escape '\'`).limit(2)``,
     usando `escaparLike` de `@/src/shared/busca/escapar-like`;
  4. com 0 resultados, inserir em `item` (`aguardandoPrimeiraEntrada: true`, `estoqueMinimo`
     via `paraNumeric` ou `null`) e em `saldo_estoque` (`'0'`, `onConflictDoNothing`), guardando
     o item em `itensCriados`; com 1, registrar em `vinculos`; com 2, guardar o conflito
     `ambiguo`;
  5. com os ids resolvidos, detectar ids repetidos (conflito `repetido` na 2ª ocorrência em
     diante);
  6. havendo conflitos, lançar um erro interno que carrega os conflitos, capturar fora do
     `transaction` (o rollback acontece pelo throw) e devolver `{ conflitos }`;
  7. sem conflitos, criar o kit (`insert`) ou atualizá-lo (`update … returning`). Se o `update`
     não devolver linha, devolver `null` (também via throw ou rollback);
  8. apagar a receita do kit e inserir a nova com os ids resolvidos;
  9. devolver `{ kit, itensCriados, vinculos }`.

  Remover as implementações de `criar`, `atualizar` e `definirReceita`. Incluir
  `aguardandoPrimeiraEntrada: item.aguardandoPrimeiraEntrada` em `COLUNAS_ITEM`. Com isso,
  `itemRepository.buscarPorId` e `criar` devolvem o campo. `itemRepository.criar` continua
  gravando `false` (o default), porque não é o caminho do kit. T009 passa.

### Caso de uso (TDD)

- [X] T011 [P] Escrever `src/modules/estoque/application/use-cases/salvar-kit.test.ts` (que deve
  falhar), com repositório dublê tipado (`vi.fn<KitRepository['salvarComposicao']>`). Casos:
  - receita inválida → `ValidacaoError` e o repositório **não** é chamado;
  - conflito `ambiguo` no índice 2 → `ValidacaoError` com
    `campos['componentes.2.itemId'] = 'Há mais de um item com esse nome. Selecione o item na lista.'`;
  - conflito `repetido` → "Este item já está na receita.";
  - `null` → `NaoEncontradoError` de `@/src/shared/kernel`;
  - conflito ou `null` → `withAudit` **não** é chamado;
  - sucesso com 2 itens criados → `ok({ id, itensCriados: 2 })`, e `withAudit` é chamado 1 vez
    com `tabela: 'kit'` e 2 vezes com `tabela: 'item'`. Para esse caso, o mock de `withAudit`
    precisa registrar as opções em um `vi.fn`.
- [X] T012 Criar `src/modules/estoque/application/use-cases/salvar-kit.ts` com
  `SalvarKitUseCase implements UseCase<EntradaSalvarKit, { id: string; itensCriados: number }>`
  (construtor recebe `KitRepository`). O fluxo:
  - chamar `validarReceita`;
  - em edição, capturar
    `anteriores = { ...await repo.buscarPorId(id), receita: await repo.receita(id) }` (ou
    `null`) **antes** de chamar o repositório;
  - chamar `repo.salvarComposicao(...)` diretamente, **fora** de `withAudit` (research R6);
  - com `null` ou `conflitos`, devolver o erro **sem** auditar, com as chaves
    `componentes.N.itemId` e as mensagens do contrato `salvar-kit.md`;
  - no sucesso,
    `await withAudit({ entidade: 'Doacao', acao: id ? 'update' : 'create', tabela: 'kit', dadosAnteriores: async () => anteriores, extrair: () => ({ entidadeId: kit.id, dadosNovos: { ...kit, receita: componentesResolvidos, itensCriados, vinculos } }) }, async () => resultado)`;
  - no sucesso, para cada item criado,
    `await withAudit({ entidade: 'Doacao', acao: 'create', tabela: 'item', extrair: () => ({ entidadeId: item.id, dadosNovos: { ...item, origem: 'kit', kitId } }) }, async () => item)`
    (research R6).

  Docblock explicando a atomicidade no repositório e a auditoria por item. T011 passa.

### Action

- [X] T013 Reescrever `salvarKit` em `src/modules/estoque/presentation/actions/estoque.ts`
  conforme `contracts/salvar-kit.md`:
  - manter `exigir(ROLES_COORDENACAO)` como primeira instrução, antes do parse (FR-011);
  - `esquemaKit.componentes` vira
    `z.array(z.union([z.object({ itemId: z.uuid(), quantidadePorKit: z.number().positive() }).strict(), z.object({ novoItem: z.object({ nome: z.string().trim().min(1), categoria: z.enum(CATEGORIAS_ITEM), unidadeMedida: z.enum(UNIDADES_MEDIDA), estoqueMinimo: z.number().min(0).nullable().optional() }), quantidadePorKit: z.number().positive() }).strict()]))`.
    O `.strict()` faz componente com os dois campos ser recusado (S-01), e o payload antigo
    continua válido (S-02);
  - mapear para `ComponenteInformado` (`tipo`, `estoqueMinimo ?? null`);
  - remover o `Set` de ids (agora V5) e o `withAudit` inline;
  - chamar `new SalvarKitUseCase(kitRepository).executar(...)` dentro de
    `comAtorDaSessao(ator, …)`;
  - no sucesso: `updateTag(CACHE_TAGS.estoqueKits)`,
    `revalidateTag(CACHE_TAGS.dashboardKits, PERFIL_REVALIDACAO)`,
    `updateTag(CACHE_TAGS.estoqueListagem)` se `itensCriados > 0`, e
    `agendarAlertasDeEstoque({ estoqueCritico: false })`;
  - devolver `serializar(resultado)` como `registrarEntrada`, com o tipo de retorno
    `ResultadoAction<{ id: string; itensCriados: number }>`;
  - remover os imports que ficarem sem uso (`withAudit`, `Kit`, …).

**Checkpoint**: `npm test`, `npm run test:integracao`, `npx tsc --noEmit` e `npm run lint`
passam. O diálogo de kit atual (só itens existentes) continua salvando como antes (S-02):
verificar criando e editando um kit no navegador.

---

## Phase 3: User Story 1 - Cadastrar um item novo ao compor a receita do kit (Priority: P1) 🎯 MVP

**Goal**: digitar um nome inexistente num componente, preencher o grupo "Item novo" e salvar.
O item nasce com saldo 0, junto com o kit, e fica fora do alerta de estoque crítico até a
primeira entrada.

**Independent Test**: quickstart Q1–Q7, Q10, Q13–Q15.

### Exclusão do alerta (FR-015)

- [X] T014 [P] [US1] Em `src/modules/estoque/domain/estoque-minimo.test.ts`, adicionar os testes
  (que devem falhar) de `itensCriticos`:
  - item com `aguardandoPrimeiraEntrada: true` e saldo 0 abaixo do limiar → não é crítico;
  - o mesmo item com `false` → é crítico;
  - item sem o campo → é crítico (compatibilidade).
- [X] T015 [US1] Em `src/modules/estoque/domain/estoque-minimo.ts`, ampliar o genérico de
  `itensCriticos` para `T extends { saldo: number; estoqueMinimo: number | null; aguardandoPrimeiraEntrada?: boolean }`
  e pular os itens com `aguardandoPrimeiraEntrada === true`. Docblock com a referência a FR-015
  da 022. T014 passa.
- [X] T016 [US1] Em `src/modules/estoque/infrastructure/drizzle/estoque-repository.ts`, dentro
  da transação de `entradaRepository.registrar`, logo depois de resolver `itemId`, executar
  `tx.update(item).set({ aguardandoPrimeiraEntrada: false }).where(and(eq(item.id, itemId), eq(item.aguardandoPrimeiraEntrada, true)))`
  (S-08). Comentário: a primeira entrada é a primeira movimentação possível, porque saída e
  descarte exigem saldo.
- [X] T017 [US1] Acrescentar ao `salvar-kit.integracao.test.ts` (T009) o cenário **H**: depois
  do cenário A, `entradaRepository.registrar({ itemId: criado.id, quantidade: 1, condicao: 'novo', perecivel: false, registradoPor })`
  deixa `aguardando_primeira_entrada = false`. Limpar a `entrada` criada no `afterEach`.
- [X] T018 [US1] Em `src/modules/estoque/presentation/queries/estoque.ts`:
  - acrescentar `aguardandoPrimeiraEntrada: boolean` ao tipo `ItemComSaldo`;
  - selecionar `aguardandoPrimeiraEntrada: item.aguardandoPrimeiraEntrada` em `buscarEstoque`,
    `inventarioParaExportacao`, `sugerirItens` e `listarItensLookup`.

  Rodar `npx tsc --noEmit` e corrigir os consumidores que montam `ItemComSaldo` à mão: testes,
  dublês e `registrar-saida.integracao.test.ts`, se for o caso.
- [X] T019 [US1] Em `app/(interno)/(staff)/estoque/tabela-estoque.tsx`, fazer o cálculo de
  `abaixoDoMinimo` também exigir `!row.original.aguardandoPrimeiraEntrada`, mantendo o
  comentário "mesma regra do alerta (`itensCriticos`)".

### Formulário

- [X] T020 [US1] Em `app/(interno)/(staff)/estoque/kits/page.tsx`, importar
  `limiarEstoqueMinimoGlobal` de `@/src/shared/config/limiares-alerta` e renderizar
  `<GestaoKits kits={kits} limiarGlobal={limiarEstoqueMinimoGlobal()} />`, como em
  `entrada/page.tsx`.
- [X] T021 [US1] Em `app/(interno)/(staff)/estoque/kits/gestao-kits.tsx`, mudar o esquema do
  formulário:
  - cada componente passa a ser
    `{ itemId: z.string(), nomeNovo: z.string(), categoria: z.enum(CATEGORIAS_ITEM).or(z.literal('')), unidadeMedida: z.enum(UNIDADES_MEDIDA).or(z.literal('')), estoqueMinimo: campoEstoqueMinimo(), quantidade: quantidadePositiva(...) }`;
  - `COMPONENTE_VAZIO` com todos os campos vazios;
  - no `superRefine`:
    - sem `itemId` e com `nomeNovo.trim()` vazio → `componentes.N.itemId` "Selecione ou digite
      o item.";
    - item novo sem categoria → `componentes.N.categoria` "Selecione a categoria.";
    - item novo sem unidade → `componentes.N.unidadeMedida` "Selecione a unidade de medida.";
  - o `reset` da edição preenche `nomeNovo: ''` e os demais campos vazios para os componentes
    existentes.

  Antes, conferir se `campoEstoqueMinimo`, `quantidadePositiva` e o helper de seleção
  obrigatória estão em `@/src/shared/formulario` e como a Entrada os usa.
- [X] T022 [US1] No mesmo `gestao-kits.tsx`, configurar o `Lookup` de cada componente:
  - props `permitirValorLivre`,
    `mensagemVazia="Nenhum item com esse nome. Ele será cadastrado como item novo."`,
    `value={field.value || null}` e
    `descricao={field.value ? (nomes[field.value] ?? '') : nomeNovoDaLinha}`;
  - `onTextoLivre={(t) => setValue(`componentes.${indice}.nomeNovo`, t)}`;
  - `onSelecionar(item)`, com item: grava o nome em `nomesSelecionados`, chama
    `field.onChange(item.id)` e limpa `nomeNovo`, `categoria`, `unidadeMedida` e
    `estoqueMinimo` da linha (`setValue` + `clearErrors`);
  - `onSelecionar(null)`: chama `field.onChange('')`.

  Ler `nomeNovoDaLinha` com `useWatch({ control, name: 'componentes' })`, uma vez fora do
  `map`.
- [X] T023 [US1] No mesmo `gestao-kits.tsx`, quando a linha tem `nomeNovo.trim()` e não tem
  `itemId`, renderizar logo abaixo dela (dentro do mesmo bloco `key={campo.id}`, com a linha
  passando a `flex-col`) um `<fieldset>` com borda (`rounded-lg border border-border p-3`) e
  `<legend>` "Item novo". Dentro dele, em `grid gap-3 sm:grid-cols-2`:
  - `Controller` + `Select` "Categoria" (obrigatório), com as opções de
    `CATEGORIAS_ITEM`/`ROTULO_CATEGORIA_ITEM`;
  - `Controller` + `Select` "Unidade de medida" (obrigatório), com `UNIDADES_MEDIDA`/
    `ROTULO_UNIDADE_MEDIDA`;
  - `Controller` + `NumberInput` "Estoque mínimo (opcional, em {abreviação})", com
    `apoio={apoioEstoqueMinimo(limiarGlobal, …)}` e `sm:col-span-2`. A abreviação usa
    `ABREVIACAO_UNIDADE` quando a unidade foi escolhida e é omitida quando não foi.

  Copiar os `Select`/`NumberInput` de `entrada/entrada-form.tsx`, com ids
  `categoria-${idBase}-${indice}` etc. Os valores vazios usam `value={field.value ? [field.value] : []}`.
- [X] T024 [US1] No mesmo `gestao-kits.tsx`, mudar a função `salvar`:
  - montar `componentes` como `{ itemId, quantidadePorKit }` para linhas com `itemId` e como
    `{ novoItem: { nome: nomeNovo.trim(), categoria, unidadeMedida, estoqueMinimo: paraEstoqueMinimo(estoqueMinimo) }, quantidadePorKit }`
    para as demais. `paraEstoqueMinimo` é o mesmo helper que a Entrada usa;
  - em `aplicarErrosDoServidor`, passar
    `camposConhecidos={[...CAMPOS, ...fields.flatMap((_, i) => ['itemId', 'categoria', 'unidadeMedida', 'estoqueMinimo', 'quantidade'].map((c) => `componentes.${i}.${c}`))]}`;
  - o toast de sucesso acrescenta ", com N item(ns) novo(s)" quando `itensCriados > 0`.

  O diálogo só fecha no sucesso. Em erro, o que foi digitado permanece (FR-014).

**Checkpoint**: quickstart Q1–Q7, Q10 e Q13–Q15 passam. US1 é entregável como MVP.

---

## Phase 4: User Story 2 - Escolher item existente continua igual, com vínculo automático (Priority: P2)

**Goal**: selecionar um item existente remove o grupo "Item novo". Editar o texto desfaz a
seleção. Um nome idêntico a um item cadastrado é vinculado sozinho ao sair do campo e, como
garantia, no servidor.

**Independent Test**: quickstart Q8, Q9 e Q12.

- [X] T025 [US2] Em `src/shared/ui/lookup/lookup.tsx`, acrescentar a prop opcional
  `vincularIdentico?: (texto: string, registro: T) => boolean` a `LookupProps`, com docblock
  do contrato `lookup-vincular-identico.md`. Em `aoPerderFoco`, antes do `return` do modo valor
  livre:
  - prosseguir só se `permitirValorLivre && vincularIdentico && !valorAtual` e se o destino do
    foco está fora do componente (a mesma checagem de `relatedTarget` que já existe) (V-01,
    V-06);
  - calcular `const texto = textoRef.current.trim()` e prosseguir só se
    `termoBusca.trim() === texto` (V-02);
  - filtrar `sugestoes.data ?? []` por `vincularIdentico(texto, r) && !motivoIndisponivel?.(r)`
    (V-03) e, havendo exatamente um, chamar `onSelecionar(registro)` (V-04, V-05).

  Reorganizar `aoPerderFoco` para que a checagem de destino rode antes dos dois ramos, sem
  mudar o comportamento atual dos usos sem a prop (V-07).
- [X] T026 [US2] Em `app/(interno)/(staff)/estoque/kits/gestao-kits.tsx`, passar ao `Lookup`
  do componente `vincularIdentico={(texto, item) => normalizarNomeItem(texto) === normalizarNomeItem(item.nome)}`,
  importando `normalizarNomeItem` de `@/src/modules/estoque/domain`. Conferir que o
  `onSelecionar` de T022 já limpa o grupo "Item novo", o que cobre o US2-AS1 e o vínculo
  automático.
- [X] T027 [US2] Conferir no navegador o US2-AS2: com item selecionado, editar o texto chama
  `onSelecionar(null)` e `onTextoLivre`, e o grupo "Item novo" reaparece com categoria e
  unidade vazias. Se a categoria ou a unidade do item anterior "vazar", limpar em
  `onSelecionar(null)` em `gestao-kits.tsx`.

**Checkpoint**: Q8, Q9 e Q12 passam, e US1 continua funcionando.

---

## Phase 5: User Story 3 - Regras da receita valem também para itens novos (Priority: P3)

**Goal**: a duplicidade da receita considera nomes novos normalizados, no cliente e no
servidor, e o card do kit reflete o item novo com saldo 0.

**Independent Test**: quickstart Q11 e o card da Q4.

- [X] T028 [US3] Em `app/(interno)/(staff)/estoque/kits/gestao-kits.tsx`, trocar a chave do
  `superRefine` de duplicado (o `Map vistos`) para `componente.itemId || (componente.nomeNovo.trim() ? 'novo:' + normalizarNomeItem(componente.nomeNovo) : '')`,
  ignorando a chave vazia. Manter a mensagem "Este item já está na receita." em
  `componentes.N.itemId` e atualizar o docblock do esquema.
- [X] T029 [US3] Conferir no navegador (Q4) que o card do kit salvo com item novo lista o item
  e mostra "0 kit(s) montável(is) com o saldo atual" (US3-AS3). `listarKitsComReceita` já traz
  `saldo` por componente pelo `leftJoin` de `saldo_estoque`. Se o item novo aparecer sem saldo
  (`null`), ajustar o `coalesce` nessa query em `src/modules/estoque/presentation/queries/estoque.ts`.

**Checkpoint**: Q11 passa, e US1/US2 continuam funcionando.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T030 [P] Registrar em `spec/DESIGN.md` §19 a decisão "Item criado pelo kit: coluna
  `aguardando_primeira_entrada` + vínculo por nome normalizado com `pg_advisory_xact_lock`",
  com rationale e alternativas (research R3–R5) e o limite aceito (Entrada concorrente sem
  lock).
- [X] T031 [P] Em `spec/DESIGN_SYSTEM.md` §4.4.1 (Lookup), documentar a prop
  `vincularIdentico` (V-01..V-07) e o padrão "grupo Item novo abaixo da linha" para formulários
  com linhas.
- [X] T032 Rodar `npm test`, `npm run test:integracao`, `npm run lint`, `npx tsc --noEmit` e
  `npm run build`, e corrigir o que falhar.
- [ ] T033 Executar o roteiro manual completo de `specs/022-cadastro-item-kit/quickstart.md`
  (Q1–Q16) e a verificação do SC-002, no Neon **de dev**. Registrar divergências como novas
  tasks e marcar no próprio quickstart o que passou.
  _Parcial (2026-10-05), no navegador com sessão de administrador: passaram Q1–Q4, Q6–Q9,
  Q11 e o selo de Q4/FR-015 em `/estoque`. Cobertos pelo teste de integração (cenários
  A–H): atomicidade e SC-002 (C, F), concorrência (G, base de Q12) e a primeira entrada (H,
  base de Q14). Faltam no navegador: Q5, Q10, Q12, Q13 (offline), Q14, Q15 (auditoria no
  Mongo) e Q16 (375 px). O kit e o item de teste foram apagados do Neon de dev ao final._

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências. T002 depende de T001.
- **Foundational (Phase 2)**: depende do Setup. A ordem é:
  - T003 → T004;
  - T004 + T005 → T006 → T007;
  - T008 → T009 → T010;
  - T007 + T008 → T011 → T012;
  - T010 + T012 → T013.
- **US1 (Phase 3)**: depende de toda a Phase 2. T014 → T015, T016 → T017, T018 → T019, e
  T020 → T021 → T022 → T023 → T024 (mesmo arquivo, em sequência).
- **US2 (Phase 4)**: T025 independe de US1, porque é um arquivo compartilhado. T026 e T027
  dependem de T022 (US1).
- **US3 (Phase 5)**: T028 depende de T021 (mesmo esquema). T029 depende de T024.
- **Polish (Phase 6)**: depois das stories. T030 ∥ T031.

### User Story Dependencies

- **US1 (P1)**: independente depois da Phase 2. É o MVP.
- **US2 (P2)**: usa o formulário de US1. O vínculo no servidor já vem da Phase 2.
- **US3 (P3)**: usa o formulário de US1. O conflito `repetido` no servidor já vem da Phase 2.

### Parallel Opportunities

- Phase 2: T003 ∥ T008 (arquivos diferentes). T011 pode ser escrito em paralelo com T009/T010.
- US1: T014 ∥ T016 ∥ T018 ∥ T020 (arquivos diferentes), antes da sequência do formulário.
- US2: T025 (Lookup) ∥ toda a sequência de formulário de US1.
- Polish: T030 ∥ T031.

---

## Parallel Example: Phase 2

```text
Task: "T003 Testes de normalizarNomeItem em src/modules/estoque/domain/receita-kit.test.ts"
Task: "T008 Port salvarComposicao em src/modules/estoque/application/ports/estoque-repository.ts"
```

## Parallel Example: User Story 1

```text
Task: "T014 Testes de itensCriticos em src/modules/estoque/domain/estoque-minimo.test.ts"
Task: "T016 Entrada zera aguardando_primeira_entrada em src/modules/estoque/infrastructure/drizzle/estoque-repository.ts"
Task: "T018 ItemComSaldo + flag em src/modules/estoque/presentation/queries/estoque.ts"
Task: "T020 limiarGlobal em app/(interno)/(staff)/estoque/kits/page.tsx"
Task: "T025 [US2] vincularIdentico em src/shared/ui/lookup/lookup.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2: nesse ponto, o servidor já aceita item novo e vincula nome idêntico.
2. Phase 3 (US1): grupo "Item novo" no diálogo e exclusão do alerta.
3. **Parar e validar**: quickstart Q1–Q7, Q10 e Q13–Q15.

### Incremental Delivery

1. Setup + Foundational → o diálogo atual continua funcionando (S-02).
2. US1 → cadastro de item novo no kit (MVP).
3. US2 → vínculo automático ao sair do campo.
4. US3 → duplicidade por nome normalizado no cliente.
5. Polish → documentação e roteiro completo.

## Notes

- Commits sugeridos:
  - `feat(db): item.aguardando_primeira_entrada` (Phase 1);
  - `refactor(estoque): SalvarKitUseCase with atomic composition` (Phase 2);
  - `feat(estoque): create item from kit dialog` (US1);
  - `feat(ui): Lookup vincularIdentico` (US2);
  - `docs:` (Polish).
- A remoção de `criar`, `atualizar` e `definirReceita` do `KitRepository` (T008/T010) é a única
  mudança de port além do acréscimo. Conferir que nenhum dublê de teste implementa esses
  métodos (`grep -rn "definirReceita" src`).
