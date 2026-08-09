'use client'

import { useTable, type ColumnDef, type RowData } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { cn } from '../cn'
import { Skeleton } from '../skeleton/skeleton'

/**
 * Table — wrapper de **apresentação** sobre o TanStack Table headless
 * (DESIGN_SYSTEM.md §4.13). Não é um primitivo Ark.
 *
 * A paginação é sempre server-side (NFR §2.1): este componente recebe apenas a
 * página corrente já resolvida e não conhece `totalCount` — quem pagina é o
 * `Pagination` ao lado, alimentado pela query de listagem.
 *
 * Densidade confortável: linha com `h-12` efetiva (`py-3`), cabeçalho em
 * `text-xs uppercase`, hover em `bg-surface-muted`.
 */
/**
 * Nenhuma feature do TanStack é habilitada: ordenação, filtro e paginação são
 * resolvidos no servidor (NFR §2.1), então só o row model core é necessário.
 */
type SemFeatures = Record<string, never>

export type ColunaTabela<TData extends RowData> = ColumnDef<SemFeatures, TData, unknown>

export interface TableProps<TData extends RowData> {
    /** Rótulo acessível da tabela — obrigatório (a tabela não tem `<caption>` visível). */
    titulo: string
    colunas: ColunaTabela<TData>[]
    dados: TData[]
    carregando?: boolean
    /** Exibido quando `dados` está vazio e não há carregamento em curso. */
    vazio?: ReactNode
    onLinhaClick?: (linha: TData) => void
}

export function Table<TData extends RowData>({
    titulo,
    colunas,
    dados,
    carregando,
    vazio,
    onLinhaClick
}: TableProps<TData>) {
    const table = useTable({ features: {}, columns: colunas, data: dados })

    if (carregando) {
        return (
            <div className="flex flex-col gap-2" aria-busy="true" aria-label={`Carregando ${titulo}`}>
                {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} altura="h-12" />
                ))}
            </div>
        )
    }

    if (dados.length === 0) {
        return (
            <p className="rounded-xl border border-border bg-surface p-8 text-center text-base text-neutral-500 dark:text-neutral-400">
                {vazio ?? 'Nenhum registro encontrado.'}
            </p>
        )
    }

    return (
        // Tabelas largas rolam dentro do próprio contêiner — a página nunca
        // rola horizontalmente (§1.7).
        <div className="w-full overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full border-collapse text-left">
                <caption className="sr-only">{titulo}</caption>
                <thead className="border-b border-border">
                    {table.getHeaderGroups().map((grupo) => (
                        <tr key={grupo.id}>
                            {grupo.headers.map((header) => (
                                <th
                                    key={header.id}
                                    scope="col"
                                    className="px-4 py-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
                                >
                                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody className="divide-y divide-border">
                    {table.getRowModel().rows.map((linha) => (
                        <tr
                            key={linha.id}
                            onClick={onLinhaClick ? () => onLinhaClick(linha.original as TData) : undefined}
                            className={cn(
                                'hover:bg-surface-muted',
                                onLinhaClick && 'cursor-pointer focus-within:bg-surface-muted'
                            )}
                        >
                            {/* `getAllCells` e não `getVisibleCells`: a feature de
                                visibilidade de coluna não está habilitada — as
                                colunas exibidas são decididas por quem monta
                                `colunas`. */}
                            {linha.getAllCells().map((celula) => (
                                <td key={celula.id} className="px-4 py-3 text-base text-foreground">
                                    <table.FlexRender cell={celula} />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
