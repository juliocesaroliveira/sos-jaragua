# Contract: `GET /api/relatorios/export`

Substitui o contrato atual (`?tipo=inventario|saidas&formato=csv|xlsx`), mantendo a forma.
Route Handler — payload binário (DESIGN.md §14).

## Request

| Parâmetro | Obrigatório | Valores |
| --- | --- | --- |
| `tipo` | sim | qualquer `SlugRelatorio` (data-model.md §1) |
| `formato` | não | `xlsx` (padrão) \| `csv` |
| `de`, `ate` | não | `AAAA-MM-DD`, para relatórios com período |
| demais | não | filtros específicos do relatório (data-model.md §2), **mesmos nomes** da URL da página |

A página monta o link de download a partir dos seus próprios `searchParams` (sem `page`/
`pageSize`), então "o que está na tela" e "o que vai para o arquivo" usam o mesmo filtro.

## Autorização (ordem)

1. `proxy.ts`: prefixo `/api/relatorios/export` → `membro_defesa_civil`, `administrador`.
2. Handler: sessão ausente ⇒ `403`.
3. Handler: `podeAcessar(definicao.rota, ator.role)` falso ⇒ `403`
   (ex.: `tipo=auditoria` com `membro_defesa_civil`).

## Responses

| Status | Quando | Corpo |
| --- | --- | --- |
| `200` | sucesso | XLSX (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) ou CSV (`text/csv; charset=utf-8`, `;`, BOM) |
| `400` | `tipo` desconhecido, `formato` inválido, período inválido | `{ erro: string }` pt-BR |
| `403` | sem sessão ou sem permissão para o relatório | `{ erro: string }` |
| `422` | `contar(filtros) > 50.000` | `{ erro: 'O relatório tem N linhas, acima do limite de 50.000 para exportação. Reduza o período.' }` |
| `503` | só `tipo=auditoria`, base de auditoria indisponível | `{ erro: string }` |

Transporte em `200`: **streaming** (`ReadableStream`, sem `Content-Length`), com as linhas lidas
em lotes de 2.000 — o limite de 4,5 MB de corpo não vale para streaming (research D8).

Cabeçalhos em `200`: `Content-Disposition: attachment; filename="<slug>-AAAA-MM-DD-HHhMM.<ext>"`
(`nomeDeArquivo`), `Cache-Control: no-store`.

## Conteúdo do arquivo

1. Cabeçalho do documento (data-model.md §3): `Relatório`, `Período`, filtros aplicados,
   `Gerado em`, `Gerado por`, `Total de linhas`.
2. Resumo, quando a definição tem (`rotulo; valor`).
3. Linha em branco.
4. Tabela: cabeçalhos das colunas + **todas** as linhas do filtro.

XLSX: uma aba com o nome do relatório (≤ 31 caracteres), painel congelado abaixo do cabeçalho
da tabela. CSV: textos iniciados por `= + - @ \t \r` prefixados com `'` (FR-011).

## Compatibilidade

`?tipo=inventario` e `?tipo=saidas` sem filtros continuam válidos: inventário completo e
saídas dos **últimos 30 dias** (antes: histórico inteiro). A mudança de padrão é intencional
(FR-005); o histórico completo é obtido com `de` = data da primeira saída.

## `GET /api/contingencia/export`

Inalterado (FR-004).
