'use client'

import { Download, FileSpreadsheet, LifeBuoy } from 'lucide-react'
import { Alert, Table, Tabs, type ColunaTabela } from '@/src/shared/ui'
import { ABREVIACAO_UNIDADE, ROTULO_CATEGORIA_ITEM } from '@/src/modules/estoque/domain/item'
import { formatarQuantidade } from '@/src/modules/estoque/domain/quantidade'
import type { ItemComSaldo, LinhaSaidaPlana } from '@/src/modules/estoque/presentation/queries/estoque'

/**
 * Relatórios (BR-REL-01, REL-03).
 *
 * A exportação usa `<a download>` e não `fetch`: o download é um Route Handler
 * binário (DESIGN.md §14), e o link deixa o navegador cuidar do arquivo —
 * inclusive em celular, onde interceptar um blob costuma dar problema.
 */
export function PainelRelatorios({
    inventario,
    saidas,
    podeGerarContingencia
}: {
    inventario: ItemComSaldo[]
    saidas: LinhaSaidaPlana[]
    /** Decidido no servidor: o pacote de contingência tem autorização própria. */
    podeGerarContingencia: boolean
}) {
    const colunasInventario: ColunaTabela<ItemComSaldo>[] = [
        { accessorKey: 'nome', header: 'Item' },
        { id: 'categoria', header: 'Categoria', cell: ({ row }) => ROTULO_CATEGORIA_ITEM[row.original.categoria] },
        {
            id: 'saldo',
            header: 'Saldo',
            cell: ({ row }) =>
                `${formatarQuantidade(row.original.saldo)} ${ABREVIACAO_UNIDADE[row.original.unidadeMedida]}`
        }
    ]

    const colunasSaidas: ColunaTabela<LinhaSaidaPlana>[] = [
        { id: 'data', header: 'Data', cell: ({ row }) => formatarDataHora(row.original.criadoEm) },
        { id: 'tipo', header: 'Tipo', cell: ({ row }) => (row.original.tipo === 'kit' ? 'Kit' : 'Avulso') },
        { accessorKey: 'destino', header: 'Destino' },
        { accessorKey: 'item', header: 'Item' },
        {
            id: 'quantidade',
            header: 'Quantidade',
            cell: ({ row }) =>
                `${formatarQuantidade(row.original.quantidade)} ${ABREVIACAO_UNIDADE[row.original.unidadeMedida]}`
        },
        { accessorKey: 'responsavelTransporte', header: 'Responsável' }
    ]

    return (
        <div className="flex flex-col gap-8">
            <Tabs
                aria-label="Relatórios disponíveis"
                abas={[
                    {
                        value: 'inventario',
                        label: 'Inventário atual',
                        conteudo: (
                            <div className="flex flex-col gap-4">
                                <BotoesExportacao tipo="inventario" total={inventario.length} />
                                <Table
                                    titulo="Inventário atual"
                                    colunas={colunasInventario}
                                    dados={inventario}
                                    vazio="Nenhum item em estoque."
                                />
                            </div>
                        )
                    },
                    {
                        value: 'saidas',
                        label: 'Histórico de saídas',
                        conteudo: (
                            <div className="flex flex-col gap-4">
                                <Alert tom="info" titulo="Descartes não entram neste relatório">
                                    Itens baixados por descarte ficam fora por construção — este é o histórico do que
                                    foi entregue à população.
                                </Alert>
                                <BotoesExportacao tipo="saidas" total={saidas.length} />
                                <Table
                                    titulo="Histórico de saídas"
                                    colunas={colunasSaidas}
                                    dados={saidas}
                                    vazio="Nenhuma saída registrada."
                                />
                            </div>
                        )
                    }
                ]}
            />

            {podeGerarContingencia && <PacoteContingencia />}
        </div>
    )
}

function BotoesExportacao({ tipo, total }: { tipo: 'inventario' | 'saidas'; total: number }) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
                {total === 1 ? '1 linha' : `${total} linhas`}
            </span>
            <a
                href={`/api/relatorios/export?tipo=${tipo}&formato=xlsx`}
                download
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary-600 px-4 text-base font-medium text-primary-foreground hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600"
            >
                <FileSpreadsheet aria-hidden className="size-5" />
                Exportar XLSX
            </a>
            <a
                href={`/api/relatorios/export?tipo=${tipo}&formato=csv`}
                download
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-4 text-base font-medium text-foreground hover:bg-surface-muted"
            >
                <Download aria-hidden className="size-5" />
                Exportar CSV
            </a>
        </div>
    )
}

/** CON-02 — link simples, nunca cacheado (DESIGN.md §15). */
function PacoteContingencia() {
    return (
        <section className="flex flex-col gap-3 rounded-xl border border-warning-300 bg-warning-50 p-4 dark:border-warning-800 dark:bg-warning-950">
            <div className="flex items-start gap-3">
                <LifeBuoy aria-hidden className="size-6 shrink-0 text-warning-600 dark:text-warning-400" />
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-semibold text-warning-900 dark:text-warning-100">
                        Pacote de contingência
                    </h2>
                    <p className="text-sm text-warning-900 dark:text-warning-100">
                        Planilha com o saldo exato deste momento e formulários em branco para anotar entradas, saídas e
                        turnos à mão. Gere e imprima <strong>antes</strong> de perder energia ou conexão.
                    </p>
                </div>
            </div>
            <div>
                <a
                    href="/api/contingencia/export"
                    download
                    className="inline-flex h-11 items-center gap-2 rounded-lg bg-warning-600 px-4 text-base font-medium text-white hover:bg-warning-700"
                >
                    <Download aria-hidden className="size-5" />
                    Gerar pacote de contingência
                </a>
            </div>
        </section>
    )
}

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo'
})

function formatarDataHora(iso: string) {
    return DATA_HORA.format(new Date(iso))
}
