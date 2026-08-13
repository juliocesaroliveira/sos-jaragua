'use client'

import { useId } from 'react'
import { TAMANHOS_PAGINA, calcularFaixa, ehTamanhoPagina, type TamanhoPagina } from '@/src/shared/paginacao'
import { Pagination } from '../pagination/pagination'
import { Select, type OpcaoSelect } from '../select/select'

/**
 * Rodapé de paginação do `Table` (007-datatable-server-pagination, U-02).
 *
 * Não busca dados nem conhece a URL: recebe o estado resolvido e emite
 * callbacks. Quem decide o que fazer com a página escolhida é a tela — o que
 * mantém este componente utilizável tanto pela listagem real quanto pela
 * vitrine do design system.
 */
export interface PaginacaoTabela {
    page: number
    pageSize: number
    /** Total no servidor, não o tamanho da página atual. */
    totalCount: number
    onPageChange: (page: number) => void
    onPageSizeChange: (pageSize: TamanhoPagina) => void
}

const OPCOES_TAMANHO: OpcaoSelect[] = TAMANHOS_PAGINA.map((tamanho) => ({
    value: String(tamanho),
    label: String(tamanho)
}))

const formatador = new Intl.NumberFormat('pt-BR')

export function TableFooter({ page, pageSize, totalCount, onPageChange, onPageSizeChange }: PaginacaoTabela) {
    const idSelect = useId()
    const { totalPaginas, primeiro, ultimo } = calcularFaixa({ page, pageSize, totalCount })

    return (
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5 text-sm text-neutral-500 dark:text-neutral-400">
                {/* `aria-live` anuncia a nova faixa depois da troca de página
                    sem roubar o foco de quem acabou de clicar (U-04.2). */}
                <p aria-live="polite">
                    {totalCount === 0
                        ? 'Nenhum registro'
                        : `Exibindo ${formatador.format(primeiro)}–${formatador.format(ultimo)} de ${formatador.format(totalCount)} registros`}
                </p>
                <p>
                    Página {formatador.format(page)} de {formatador.format(totalPaginas)}
                </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                <div className="w-24">
                    <Select
                        id={idSelect}
                        label="Registros por página"
                        rotuloOculto
                        opcoes={OPCOES_TAMANHO}
                        value={[String(pageSize)]}
                        onValueChange={([valor]) => {
                            const numero = Number(valor)
                            if (ehTamanhoPagina(numero)) onPageSizeChange(numero)
                        }}
                    />
                </div>

                <Pagination
                    aria-label="Navegação entre páginas"
                    totalCount={totalCount}
                    pageSize={pageSize}
                    page={page}
                    onPageChange={onPageChange}
                />
            </div>
        </div>
    )
}
