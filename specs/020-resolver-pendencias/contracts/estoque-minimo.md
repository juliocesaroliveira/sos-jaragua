# Contrato: Estoque mínimo por item (Q3, FR-012 a FR-014)

## Domínio: `src/modules/estoque/domain/estoque-minimo.ts`

```ts
/** `null` = alerta desligado para o item. */
export function limiarDoItem(estoqueMinimo: number | null, limiarGlobal: number): number | null

export function itensCriticos<T extends { saldo: number; estoqueMinimo: number | null }>(
    itens: T[],
    limiarGlobal: number
): (T & { limiar: number })[]

/** Mensagem de erro em pt-BR, ou `null` quando válido. Usada pela Entrada e pela edição. */
export function validarEstoqueMinimo(valor: number | null): string | null
```

`validarEstoqueMinimo`: `null` é válido. Negativo → "Informe um número maior ou igual a
zero.". Não finito → "Informe um número válido.". Mais de 3 casas decimais → "Use no
máximo 3 casas decimais.". Acima de `99_999_999_999.999` → "Valor muito alto.".

## Configuração: `src/shared/config/limiares-alerta.ts`

```ts
export function limiarCadastrosPendentes(): number // ALERTA_CADASTROS_PENDENTES, > 0, default 10
export function limiarEstoqueMinimoGlobal(): number // ALERTA_ESTOQUE_MINIMO, >= 0, default 5
export function limiarDeficitPercentual(): number // ALERTA_DEFICIT_PERCENTUAL, > 0, default 80
```

Fica em `shared` (e não em `estoque/infrastructure`) porque é lida por
`notificacoes/application` e por `app/(staff)/estoque`. Ver research D4 e análise C1.

| `estoqueMinimo` | `limiarDoItem` | crítico quando    |
| --------------- | -------------- | ----------------- |
| `null`          | `limiarGlobal` | `saldo <= global` |
| `0`             | `null`         | nunca             |
| `n > 0`         | `n`            | `saldo <= n`      |

## Server Action: `definirEstoqueMinimo`

`src/modules/estoque/presentation/actions/estoque.ts`

```ts
export async function definirEstoqueMinimo(entrada: {
    itemId: string // uuid
    estoqueMinimo: number | null // null = usar o padrão global
}): Promise<ResultadoAction<{ itemId: string; estoqueMinimo: number | null }>>
```

| Situação                                                             | Resultado                                                                                                                                                                                                             |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sem sessão / role fora de `ROLES_OPERACAO` (`exigir`, já no arquivo) | `erroAction('nao_autorizado', 'Você não tem permissão para definir o estoque mínimo.')`, sem escrita                                                                                                                  |
| `itemId` inválido ou inexistente                                     | `{ ok: false, erro: { codigo: 'nao_encontrado', mensagem: 'Item não encontrado.' } }` (`NaoEncontradoError` do kernel)                                                                                                |
| `estoqueMinimo` negativo, não finito ou > 3 casas decimais           | `erroAction('validacao', 'Revise os campos do formulário.')`, como nas demais actions do arquivo. O formulário valida o mesmo esquema Zod no cliente antes de enviar.                                                 |
| Válido                                                               | grava, audita (`withAudit`), `updateTag(CACHE_TAGS.estoqueListagem)` (o saldo não muda, então `invalidarSaldo()` não é necessário), agenda `agendarAlertasDeEstoque({ estoqueCritico: true })`, `{ ok: true, valor }` |

Camadas, conforme o Princípio I: a action faz parse com Zod e checa role, e chama
`DefinirEstoqueMinimoUseCase` (`application/use-cases/definir-estoque-minimo.ts`), que usa
o port de item (`itemRepository`): `buscarPorId(id)` (existente ou novo, conforme o port atual) +
`definirEstoqueMinimo(id, valor)` (novo), implementados em `infrastructure/drizzle/estoque-repository.ts`.
O use case devolve `Result` e a action usa `serializar`, no mesmo padrão de `registrarDescarte`.

## UI: tabela de `/estoque`

- Coluna nova **"Mínimo"**: `Padrão (5 kg)` quando `null`, `Sem alerta` quando `0`, e o
  valor formatado com a unidade quando `n`.
- Linha com `saldo <= limiar efetivo` ganha destaque de estado crítico (token de alerta do
  DESIGN_SYSTEM, com texto, não só cor).
- Ação por linha **"Definir estoque mínimo"** (ícone + tooltip, padrão da feature 015),
  visível para todos que acessam `/estoque` (`membro_defesa_civil`, `coordenador`,
  `administrador`, idênticos a `ROLES_OPERACAO`), então não há prop de permissão na
  tabela. A action continua checando a role (defesa em profundidade). Abre dialog (desktop) ou drawer (mobile)
  com um campo numérico opcional (RHF + Zod, padrão da feature 016). Campo vazio = usar o
  padrão. Ajuda: "Deixe em branco para usar o padrão (N). Use 0 para não receber alerta
  deste item."
- O limiar global vem do servidor (`limiarEstoqueMinimoGlobal()`) para exibir
  "Padrão (N)".

## Entrada: item novo com mínimo

`src/modules/estoque/presentation/actions/estoque.ts` → `esquemaEntrada.novoItem` ganha
`estoqueMinimo: z.number().min(0).nullable().optional()`. O domínio
(`DadosEntrada.novoItem.estoqueMinimo?: number | null`) é validado em `validarEntrada` com
`validarEstoqueMinimo`; o erro vai para `campos.estoqueMinimo`. O repositório grava no
mesmo `INSERT` do item, dentro da transação da entrada.

| Situação                  | Resultado                                                         |
| ------------------------- | ----------------------------------------------------------------- |
| Item novo, campo vazio    | item criado com `estoque_minimo = NULL` (comportamento atual)     |
| Item novo, `20`           | item criado com `estoque_minimo = 20`                             |
| Item novo, `-1`           | `ValidacaoError` com `campos.estoqueMinimo`, nada gravado         |
| Item existente (`itemId`) | campo não aparece no formulário; `novoItem` é ignorado, como hoje |

Formulário (`app/(interno)/(staff)/estoque/entrada/entrada-form.tsx`): o campo "Estoque
mínimo (opcional)" aparece só no ramo `ehItemNovo`, junto de categoria e unidade, com a
mesma ajuda do dialog.

## Alerta `estoque_critico` (mensagem)

A montagem é uma função pura de domínio, testada sem banco (Princípio III):

```ts
// src/modules/notificacoes/domain/mensagem-estoque-critico.ts
export type ItemCritico = { nome: string; saldo: number; limiar: number; unidadeMedida: UnidadeMedida }

export function mensagemEstoqueCritico(criticos: ItemCritico[]): {
    titulo: string
    mensagem: string
    contexto: { itens: { nome: string; saldo: number; limiar: number }[] }
} | null
```

- Lista vazia → `null` (nada a emitir).
- `titulo`: `"Estoque crítico"`.
- Cada nome sai como `"{nome} (mín. {formatarQuantidade(limiar)} {ABREVIACAO_UNIDADE[unidadeMedida]})"`.
- Até **5** nomes, na ordem recebida, separados por `", "`. Acima de 5: `" e mais N item"`
  (N = 1) ou `" e mais N itens"` (N > 1).
- Verbo: `"atingiu"` com 1 item crítico no total, `"atingiram"` com mais de um.
- `mensagem`: `"{lista} {verbo} o estoque mínimo de segurança."`
- `contexto.itens` traz **todos** os itens críticos, não só os 5 exibidos.

Exemplos:

- 1 item: `"Arroz (mín. 20 kg) atingiu o estoque mínimo de segurança."`
- 2 itens: `"Arroz (mín. 20 kg), Cobertor (mín. 10 un) atingiram o estoque mínimo de segurança."`
- 7 itens: `"A (mín. 1 un), B (mín. 1 un), C (mín. 1 un), D (mín. 1 un), E (mín. 1 un) e mais 2 itens atingiram o estoque mínimo de segurança."`
- Decimal: `"Feijão (mín. 2,5 kg) atingiu…"`

`avaliarEstoqueCritico` (application) só compõe: `itensCriticos` → `mensagemEstoqueCritico`
→ `emitir`.

- `contexto`: `{ itens: [{ nome, saldo, limiar }] }`. Antes era `{ limiar, itens: string[] }`.
  Nenhum componente lê o `contexto` (verificado: só é persistido em
  `notificacao-plataforma.ts`), então não há consumidor do formato antigo.
- Idempotência de 12h e canal só in-app: inalterados.

## Exportação de inventário

A aba de inventário (`relatorios.ts`) ganha a coluna "Estoque mínimo": vazia quando
`null`, valor numérico caso contrário.
