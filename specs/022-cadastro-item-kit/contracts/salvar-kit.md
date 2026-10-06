# Contrato: Server Action `salvarKit` (estendida)

Arquivo: `src/modules/estoque/presentation/actions/estoque.ts` · Spec: FR-001, FR-006..FR-012, FR-014

## Permissão

`ROLES_COORDENACAO` (sem mudança). Sem permissão, retorna
`erroAction('nao_autorizado', 'Somente coordenação pode gerir kits.')` e nenhum item é criado
(FR-011).

## Entrada

```text
{
  id?: uuid,
  nome: string (min 1),
  descricao?: string | null,
  ativo?: boolean,
  componentes: Array<
    | { itemId: uuid, quantidadePorKit: number > 0 }
    | { novoItem: {
          nome: string (min 1, trim),
          categoria: CategoriaItem,
          unidadeMedida: UnidadeMedida,
          estoqueMinimo?: number >= 0 | null
        },
        quantidadePorKit: number > 0 }
  >
}
```

- **S-01**: o Zod usa união por presença de `itemId` ou de `novoItem`. Um componente com os
  dois ou com nenhum é recusado com `validacao`.
- **S-02**: o payload só com `itemId` (o formato atual) continua válido. Kits salvos antes desta
  feature se editam sem mudança.

## Saída

```text
ResultadoAction<{ id: uuid, itensCriados: number }>
```

| Caso | Retorno | Gravação |
|------|---------|----------|
| Sucesso | `{ ok: true, valor: { id, itensCriados } }` | kit, receita e itens novos, tudo ou nada |
| Validação de domínio (V1–V5) | `erroAction('validacao', 'Revise os campos destacados.', { campos })` | nada |
| Conflito `ambiguo` no componente N | `campos['componentes.N.itemId'] = 'Há mais de um item com esse nome. Selecione o item na lista.'` | nada |
| Conflito `repetido` no componente N | `campos['componentes.N.itemId'] = 'Este item já está na receita.'` | nada |
| `id` inexistente | `erroAction('nao_encontrado', 'Kit não encontrado.')` | nada |

- **S-03**: o vínculo silencioso, quando um nome novo é idêntico a um único item existente, não
  é erro. O componente é gravado com o id existente e não conta em `itensCriados` (FR-009).
- **S-04**: os caminhos de `campos` usam o **índice do array enviado**. O cliente envia as
  linhas na ordem do `useFieldArray`, então o índice bate com `componentes.N.*` do formulário.

## Efeitos colaterais no sucesso

- **S-05**: auditoria. Um registro de `kit` (create/update), com receita resolvida,
  `itensCriados` e `vinculos`, mais um registro de `item` (create, `origem: 'kit'`, `kitId`) por
  item criado (R6).
- **S-06**: cache. `updateTag(estoqueKits)` e `revalidateTag(dashboardKits)`, e também
  `updateTag(estoqueListagem)` se `itensCriados > 0` (R8).
- **S-07**: alertas. `agendarAlertasDeEstoque({ estoqueCritico: false })`, como hoje. O item
  criado nasce com `aguardando_primeira_entrada = true` (FR-015).

## Efeito na Entrada (`registrarEntrada`)

- **S-08**: a transação de `EntradaRepository.registrar` zera
  `item.aguardando_primeira_entrada` do item que recebe a entrada. O payload e a resposta de
  `registrarEntrada` não mudam.
