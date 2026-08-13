'use client'

import { useMemo } from 'react'
import { Alert, Button, Select, Table, type ColunaTabela } from '@/src/shared/ui'
import { chaveEstoque, useListagemPaginada } from '@/src/shared/query'
import {
    ABREVIACAO_UNIDADE,
    CATEGORIAS_ITEM,
    ROTULO_CATEGORIA_ITEM,
    type CategoriaItem
} from '@/src/modules/estoque/domain/item'
import { formatarQuantidade } from '@/src/modules/estoque/domain/quantidade'
import { listarEstoqueAction } from '@/src/modules/estoque/presentation/actions/listagens'
import type { ItemComSaldo } from '@/src/modules/estoque/presentation/queries/estoque'

/**
 * Listagem paginada de estoque (EST-12). Paginação e filtro vivem na URL — a
 * paginação é server-side (NFR §2.1) e o operador consegue recarregar ou
 * compartilhar a visão em que estava. Cada página é buscada pela Server
 * Function via TanStack Query (007-datatable-server-pagination).
 */
export function TabelaEstoque({ categoria }: { categoria?: CategoriaItem }) {
    const { rows, carregando, atualizando, erro, refetch, paginacao, navegar } = useListagemPaginada<
        ItemComSaldo,
        { categoria?: CategoriaItem }
    >({
        chave: chaveEstoque,
        buscar: listarEstoqueAction,
        filtros: { categoria }
    })

    const colunas = useMemo<ColunaTabela<ItemComSaldo>[]>(
        () => [
            { accessorKey: 'nome', header: 'Item' },
            {
                id: 'categoria',
                header: 'Categoria',
                cell: ({ row }) => ROTULO_CATEGORIA_ITEM[row.original.categoria]
            },
            {
                id: 'saldo',
                header: 'Saldo',
                cell: ({ row }) => (
                    <span
                        className={row.original.saldo <= 0 ? 'text-danger-700 dark:text-danger-400' : 'text-foreground'}
                    >
                        {formatarQuantidade(row.original.saldo)} {ABREVIACAO_UNIDADE[row.original.unidadeMedida]}
                    </span>
                )
            }
        ],
        []
    )

    return (
        <div className="flex flex-col gap-4">
            <div className="max-w-xs">
                <Select
                    id="filtroCategoria"
                    label="Categoria"
                    placeholder="Todas"
                    opcoes={CATEGORIAS_ITEM.map((c) => ({ value: c, label: ROTULO_CATEGORIA_ITEM[c] }))}
                    value={categoria ? [categoria] : []}
                    onValueChange={(v) => navegar({ categoria: v[0], page: undefined })}
                />
            </div>

            {erro ? (
                <Alert tom="danger" titulo="Não foi possível carregar o estoque">
                    <div className="flex flex-col items-start gap-3">
                        <p>{erro.message}</p>
                        <Button variant="secondary" onClick={() => void refetch()}>
                            Tentar novamente
                        </Button>
                    </div>
                </Alert>
            ) : (
                <Table
                    titulo="Itens em estoque"
                    colunas={colunas}
                    dados={rows}
                    carregando={carregando}
                    atualizando={atualizando}
                    vazio="Nenhum item encontrado com este filtro."
                    paginacao={paginacao}
                />
            )}
        </div>
    )
}
