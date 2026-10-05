'use client'

import { useTable, type ColumnDef, type RowData } from '@tanstack/react-table'
import type { ReactNode } from 'react'
import { ANEL_FOCO, cn } from '../cn'
import { Skeleton } from '../skeleton/skeleton'
import { TableFooter, type PaginacaoTabela } from './table-footer'

/**
 * Table — wrapper de **apresentação** sobre o TanStack Table headless
 * (DESIGN_SYSTEM.md §4.13). Não é um primitivo Ark.
 *
 * A paginação é sempre server-side (NFR §2.1): este componente recebe apenas a
 * página corrente já resolvida. O rodapé (`paginacao`) mostra os totais e emite
 * a página escolhida; buscar as linhas continua sendo responsabilidade da query
 * de listagem (007-datatable-server-pagination, U-01).
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
    /**
     * Torna a linha acionável — por clique **e** por teclado (Tab até a linha,
     * Enter ou Espaço), para que a seleção por linha do Lookup (021, FR-006/017)
     * não dependa de mouse.
     */
    onLinhaClick?: (linha: TData) => void
    /** Linha exibida, mas não acionável (ex.: item sem saldo no Lookup da saída). */
    linhaDesabilitada?: (linha: TData) => boolean
    /**
     * Quando presente, o rodapé de paginação é renderizado — inclusive com
     * `totalCount === 0` ou uma única página (U-01.2). Ausente, o `Table`
     * comporta-se como antes (vitrine, tabelas dentro de diálogo).
     */
    paginacao?: PaginacaoTabela
    /**
     * As linhas em tela são de uma página anterior enquanto a nova carrega
     * (`isPlaceholderData` do TanStack Query). Atenua a tabela sem desmontar o
     * rodapé — o skeleton de `carregando` derrubaria a barra e sacudiria o
     * layout a cada clique (U-01.3, FR-013).
     */
    atualizando?: boolean
}

export function Table<TData extends RowData>({
    titulo,
    colunas,
    dados,
    carregando,
    vazio,
    onLinhaClick,
    linhaDesabilitada,
    paginacao,
    atualizando
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
            <div className="rounded-xl border border-border bg-surface">
                <p className="p-8 text-center text-base text-neutral-500 dark:text-neutral-400">
                    {vazio ?? 'Nenhum registro encontrado.'}
                </p>
                {paginacao && <TableFooter {...paginacao} />}
            </div>
        )
    }

    return (
        <div className="w-full rounded-xl border border-border bg-surface">
            {/* Tabelas largas rolam dentro do próprio contêiner — a página nunca
                rola horizontalmente (§1.7). O rodapé fica fora dessa área de
                rolagem, para permanecer sempre visível. */}
            <div
                className={cn('w-full overflow-x-auto', atualizando && 'opacity-60 transition-opacity')}
                aria-busy={atualizando || undefined}
            >
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
                        {table.getRowModel().rows.map((linha) => {
                            const original = linha.original as TData
                            const desabilitada = linhaDesabilitada?.(original) ?? false
                            const acionavel = Boolean(onLinhaClick) && !desabilitada
                            return (
                                <tr
                                    key={linha.id}
                                    tabIndex={onLinhaClick ? (acionavel ? 0 : -1) : undefined}
                                    aria-disabled={onLinhaClick && desabilitada ? true : undefined}
                                    onClick={acionavel ? () => onLinhaClick?.(original) : undefined}
                                    onKeyDown={
                                        acionavel
                                            ? (evento) => {
                                                  if (evento.key !== 'Enter' && evento.key !== ' ') return
                                                  evento.preventDefault()
                                                  onLinhaClick?.(original)
                                              }
                                            : undefined
                                    }
                                    className={cn(
                                        'hover:bg-surface-muted',
                                        acionavel && cn('cursor-pointer focus-within:bg-surface-muted', ANEL_FOCO),
                                        desabilitada && 'cursor-not-allowed opacity-60'
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
                            )
                        })}
                    </tbody>
                </table>
            </div>
            {paginacao && <TableFooter {...paginacao} />}
        </div>
    )
}
