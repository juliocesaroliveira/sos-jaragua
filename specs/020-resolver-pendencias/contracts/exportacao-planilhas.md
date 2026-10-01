# Contrato: Exportação de planilhas (Q1, FR-007 a FR-009)

O contrato HTTP **não muda**. Só muda a biblioteca por trás de `gerarXlsx`.

## Rotas (inalteradas)

| Rota                           | Query                                          | Resposta                                                                                    |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `GET /api/relatorios/export`   | `tipo=inventario\|saidas`, `formato=csv\|xlsx` | `200` com arquivo; `400` tipo/formato inválido; `403` sem permissão (corpo JSON `{ erro }`) |
| `GET /api/contingencia/export` | —                                              | `200` com XLSX de várias abas; `403` sem permissão                                          |

Headers de sucesso, inalterados:

- CSV: `Content-Type: text/csv; charset=utf-8`
- XLSX: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename="<prefixo>-<AAAA-MM-DD>-<HHhMM>.<ext>"`

## Módulo `src/modules/contingencia/infrastructure/planilha.ts`

```ts
export type Coluna<T> = { cabecalho: string; valor: (linha: T) => string | number | null | undefined; largura?: number }
export type Aba<T> = { nome: string; colunas: Coluna<T>[]; linhas: T[] }

export function gerarCsv<T>(aba: Aba<T>): string // inalterada
export async function gerarXlsx<T>(abas: Aba<T>[]): Promise<Buffer> // ANTES: síncrona, Buffer
export function nomeDeArquivo(prefixo: string, extensao: string, agora?: Date): string // inalterada
```

A **única quebra de assinatura** é `gerarXlsx`, que passa a ser `async`. Os dois
chamadores ganham um `await`.

## Invariantes do arquivo XLSX gerado (verificados por teste)

1. Uma aba por `Aba`, na ordem recebida. O nome passa por `limitarNomeAba`: `[]:*?/\`
   vira espaço e o resultado é cortado em 31 caracteres.
2. Linha 1 = cabeçalhos, na ordem de `colunas`.
3. Números continuam células numéricas (não texto). `null`/`undefined` viram célula vazia.
4. Largura da coluna = `largura ?? max(12, cabecalho.length + 2)`.
5. Cabeçalho congelado (`ySplit: 1`). É novo: o SheetJS CE ignorava essa opção.
6. Aba com `linhas: []` tem só o cabeçalho (abas em branco do pacote de contingência).
7. Texto com acentos e cedilha volta igual depois de reler o arquivo.

## Invariantes do CSV (inalterados, já cobertos pela implementação atual)

BOM UTF-8, separador `;`, `\r\n`, decimal com vírgula e escape RFC 4180 para `"`, `;` e
quebras de linha.
