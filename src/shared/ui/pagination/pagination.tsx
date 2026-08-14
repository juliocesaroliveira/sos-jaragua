'use client'

import { Pagination as Ark } from '@ark-ui/react/pagination'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ANEL_FOCO, cn } from '../cn'

/**
 * Pagination sobre o primitivo Ark (DESIGN_SYSTEM.md §4.13).
 *
 * **Sempre server-side** (NFR §2.1): este componente só emite a página
 * escolhida; buscar as linhas é responsabilidade da query de listagem, que
 * recebe `{ page, pageSize, filtros, sort }` e devolve `{ rows, totalCount }`
 * (DESIGN.md §8).
 */
export interface PaginationProps {
    /** Total de registros no servidor, não o tamanho da página atual. */
    totalCount: number
    pageSize: number
    page: number
    onPageChange: (pagina: number) => void
    'aria-label'?: string
}

const BOTAO =
    'inline-flex size-11 items-center justify-center rounded-lg text-sm font-medium text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40'

export function Pagination({ totalCount, pageSize, page, onPageChange, ...rest }: PaginationProps) {
    // Com uma única página os triggers ficam desabilitados, **não** ausentes
    // (007-datatable-server-pagination, U-03.1): sumir com a barra a cada
    // filtro que reduz o resultado sacode o layout sob o cursor de quem
    // acabou de clicar ali.
    return (
        <Ark.Root
            count={totalCount}
            pageSize={pageSize}
            page={page}
            onPageChange={(detalhe) => onPageChange(detalhe.page)}
            siblingCount={1}
            aria-label={rest['aria-label'] ?? 'Paginação'}
            className="flex items-center justify-center gap-1"
        >
            <Ark.PrevTrigger aria-label="Página anterior" className={cn(BOTAO, ANEL_FOCO)}>
                <ChevronLeft aria-hidden className="size-5" />
            </Ark.PrevTrigger>
            <Ark.Context>
                {(api) =>
                    api.pages.map((pagina, indice) =>
                        pagina.type === 'page' ? (
                            <Ark.Item
                                key={`p-${pagina.value}`}
                                {...pagina}
                                className={cn(
                                    BOTAO,
                                    'data-[selected]:bg-primary-600 data-[selected]:text-primary-foreground dark:data-[selected]:bg-primary-500',
                                    ANEL_FOCO
                                )}
                            >
                                {pagina.value}
                            </Ark.Item>
                        ) : (
                            <Ark.Ellipsis key={`e-${indice}`} index={indice} className="px-2 text-neutral-500">
                                &hellip;
                            </Ark.Ellipsis>
                        )
                    )
                }
            </Ark.Context>
            <Ark.NextTrigger aria-label="Próxima página" className={cn(BOTAO, ANEL_FOCO)}>
                <ChevronRight aria-hidden className="size-5" />
            </Ark.NextTrigger>
        </Ark.Root>
    )
}
