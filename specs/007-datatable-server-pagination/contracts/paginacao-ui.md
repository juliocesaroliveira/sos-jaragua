# Contrato de UI: `Table` com rodapé de paginação

**Feature**: 007-datatable-server-pagination

Consumidores importam **sempre** do barrel `@/src/shared/ui` (DESIGN_SYSTEM.md §5). Nenhuma tela importa de `@ark-ui/react` diretamente.

---

## U-01 — `Table` ganha a prop opcional `paginacao`

```ts
export interface TableProps<TData extends RowData> {
    titulo: string
    colunas: ColunaTabela<TData>[]
    dados: TData[]
    carregando?: boolean
    vazio?: ReactNode
    onLinhaClick?: (linha: TData) => void

    /** Quando presente, o Table renderiza a barra de rodapé (FR-001). */
    paginacao?: PaginacaoTabela
    /**
     * Dados em tela são de uma página anterior enquanto a nova carrega
     * (`isPlaceholderData`). Atenua a tabela e marca `aria-busy`, sem
     * remover o rodapé (FR-013).
     */
    atualizando?: boolean
}

export interface PaginacaoTabela {
    page: number
    pageSize: number
    totalCount: number
    onPageChange: (page: number) => void
    onPageSizeChange: (pageSize: number) => void
}
```

- **U-01.1**: `paginacao` ausente → comportamento atual, sem rodapé (galeria, tabelas em dialog).
- **U-01.2**: `paginacao` presente → o rodapé é renderizado **inclusive** com `totalCount === 0` e **inclusive** com uma única página (FR-001, edge cases).
- **U-01.3**: `carregando` (skeleton) continua substituindo a tabela; `atualizando` **não** — o rodapé permanece montado e a posição de scroll é preservada (FR-013).

## U-02 — Conteúdo da barra de rodapé

Da esquerda para a direita em `sm+`, empilhado em telas estreitas (FR-015, SC-007):

| Elemento  | Regra                                                                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Totais    | `Exibindo {primeiro}–{ultimo} de {totalCount} registros` — com `totalCount === 0`, `Nenhum registro`. Dentro de `aria-live="polite"` (FR-002/FR-003) |
| Página    | `Página {page} de {totalPaginas}` (FR-003)                                                                                                           |
| Seletor   | `Select` do barrel, opções `5 / 10 / 20 / 50`, rótulo acessível `Registros por página` visualmente oculto (FR-004)                                   |
| Paginação | `Pagination` (U-03) (FR-006)                                                                                                                         |

- **U-02.1**: escolher um tamanho dispara `onPageSizeChange` — e é o consumidor que reseta `page` para 1 (FR-005). O rodapé não decide navegação.
- **U-02.2**: nenhum texto em inglês; números formatados em `pt-BR`.
- **U-02.3**: em 360px, nenhum elemento provoca rolagem horizontal da página (SC-007).

## U-03 — `Pagination`

Mudanças no componente existente (`src/shared/ui/pagination/pagination.tsx`):

- **U-03.1**: remover `if (totalCount <= pageSize) return null`. Com uma única página, os triggers ficam **desabilitados e visíveis** (FR-007), evitando salto de layout.
- **U-03.2**: `Ark.PrevTrigger`/`Ark.NextTrigger` já ficam desabilitados nos extremos pelo Ark — nenhuma lógica manual.
- **U-03.3**: a página ativa mantém `data-[selected]` (estilo) **e** o `aria-current` emitido pelo Ark (FR-015).
- **U-03.4**: alvos de toque permanecem `size-11` (44px) e `ANEL_FOCO` em todos os triggers (SC-005).
- **U-03.5**: a assinatura pública `PaginationProps` é preservada — o componente continua exportado do barrel para uso avulso.

## U-04 — Acessibilidade

- **U-04.1**: todo o rodapé é alcançável por `Tab` na ordem visual, sem armadilha de foco (SC-005).
- **U-04.2**: após a troca de página, a região de totais anuncia a nova faixa via `aria-live="polite"`, sem mover o foco do usuário.
- **U-04.3**: durante `atualizando`, o contêiner da tabela recebe `aria-busy="true"`; os controles do rodapé permanecem operáveis.

## U-05 — Não-objetivos do componente

- Não busca dados, não conhece URL nem TanStack Query — recebe estado e emite callbacks.
- Não implementa ordenação nem filtro (fora de escopo).
- Não persiste a escolha de `pageSize`.
