# Contrato: Estoque mínimo por item (Q3, FR-012 a FR-014)

## Domínio: `src/modules/estoque/domain/estoque-minimo.ts`

```ts
/** `null` = alerta desligado para o item. */
export function limiarDoItem(estoqueMinimo: number | null, limiarGlobal: number): number | null

export function itensCriticos<T extends { saldo: number; estoqueMinimo: number | null }>(
    itens: T[],
    limiarGlobal: number
): (T & { limiar: number })[]
```

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

| Situação                                                                | Resultado                                                                                                                                                                                                             |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sem sessão / role fora de `ROLES_COORDENACAO` (`exigir`, já no arquivo) | `erroAction('nao_autorizado', 'Somente coordenação pode definir o estoque mínimo.')`, sem escrita                                                                                                                     |
| `itemId` inválido ou inexistente                                        | `{ ok: false, erro: { codigo: 'item_nao_encontrado', mensagem: 'Item não encontrado.' } }`                                                                                                                            |
| `estoqueMinimo` negativo, não finito ou > 3 casas decimais              | `erroAction('validacao', 'Revise os campos do formulário.')`, como nas demais actions do arquivo. O formulário valida o mesmo esquema Zod no cliente antes de enviar.                                                 |
| Válido                                                                  | grava, audita (`withAudit`), `updateTag(CACHE_TAGS.estoqueListagem)` (o saldo não muda, então `invalidarSaldo()` não é necessário), agenda `agendarAlertasDeEstoque({ estoqueCritico: true })`, `{ ok: true, valor }` |

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
  visível só para `coordenador`/`administrador`. Abre dialog (desktop) ou drawer (mobile)
  com um campo numérico opcional (RHF + Zod, padrão da feature 016). Campo vazio = usar o
  padrão. Ajuda: "Deixe em branco para usar o padrão (N). Use 0 para não receber alerta
  deste item."
- O limiar global vem do servidor (mesma leitura de `ALERTA_ESTOQUE_MINIMO`) para exibir
  "Padrão (N)".

## Alerta `estoque_critico` (mensagem)

- Um item: `"Arroz (mín. 20 kg) atingiu o estoque mínimo de segurança."`
- Vários: `"Arroz (mín. 20 kg), Cobertor (mín. 10 un) e mais 3 itens atingiram o estoque mínimo de segurança."`
- `contexto`: `{ itens: [{ nome, saldo, limiar }] }`. Antes era `{ limiar, itens: string[] }`.
  Nenhum componente lê o `contexto` (verificado: só é persistido em
  `notificacao-plataforma.ts`), então não há consumidor do formato antigo.
- Idempotência de 12h e canal só in-app: inalterados.

## Exportação de inventário

A aba de inventário (`relatorios.ts`) ganha a coluna "Estoque mínimo": vazia quando
`null`, valor numérico caso contrário.
