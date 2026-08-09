'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { Pagination, Select, Table, type ColunaTabela } from '@/src/shared/ui'
import {
    ABREVIACAO_UNIDADE,
    CATEGORIAS_ITEM,
    ROTULO_CATEGORIA_ITEM,
    type CategoriaItem
} from '@/src/modules/estoque/domain/item'
import { formatarQuantidade } from '@/src/modules/estoque/domain/quantidade'
import type { ItemComSaldo } from '@/src/modules/estoque/presentation/queries/estoque'

/**
 * Listagem paginada de estoque (EST-12). Paginação e filtro vivem na URL — a
 * paginação é server-side (NFR §2.1) e o operador consegue recarregar ou
 * compartilhar a visão em que estava.
 */
export function TabelaEstoque({
    rows,
    totalCount,
    page,
    pageSize,
    categoria
}: {
    rows: ItemComSaldo[]
    totalCount: number
    page: number
    pageSize: number
    categoria?: CategoriaItem
}) {
    const router = useRouter()
    const searchParams = useSearchParams()

    function navegar(mudancas: Record<string, string | undefined>) {
        const params = new URLSearchParams(searchParams.toString())
        for (const [chave, valor] of Object.entries(mudancas)) {
            if (valor) params.set(chave, valor)
            else params.delete(chave)
        }
        router.push(`/estoque?${params.toString()}`)
    }

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

            <Table
                titulo="Itens em estoque"
                colunas={colunas}
                dados={rows}
                vazio="Nenhum item encontrado com este filtro."
            />

            <Pagination
                aria-label="Paginação do estoque"
                totalCount={totalCount}
                pageSize={pageSize}
                page={page}
                onPageChange={(p) => navegar({ page: String(p) })}
            />
        </div>
    )
}
