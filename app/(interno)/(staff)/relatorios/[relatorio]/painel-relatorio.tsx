'use client'

import { Download, FileDiff, FileSpreadsheet, RotateCcw } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Alert } from '@/src/shared/ui/alert/alert'
import { Button } from '@/src/shared/ui/button/button'
import { cn } from '@/src/shared/ui/cn'
import { Dialog } from '@/src/shared/ui/dialog/dialog'
import { IconButton } from '@/src/shared/ui/icon-button/icon-button'
import { StatCard } from '@/src/shared/ui/stat-card/stat-card'
import { Table, type ColunaTabela } from '@/src/shared/ui/table/table'
import { Tooltip } from '@/src/shared/ui/tooltip/tooltip'
import { chaveRelatorio, useListagemPaginada } from '@/src/shared/query'
import { consultarRelatorioAction } from '@/src/modules/contingencia/presentation/actions/relatorios'
import type { AlteracaoCampo, Celula, LinhaRelatorio } from '@/src/modules/contingencia/application/definicao-relatorio'
import type { PaginaRelatorio } from '@/src/modules/contingencia/application/gerar-relatorio'

/**
 * Avisos, resumo, exportação e prévia de um relatório
 * (contracts/ui-central.md §"Página do relatório").
 *
 * Genérico para os 17 relatórios: as células chegam formatadas do servidor
 * (research D2), então este componente não conhece nenhuma coluna. A
 * exportação usa `<a download>` e não `fetch` — o download é um Route Handler
 * em streaming, e o link deixa o navegador cuidar do arquivo, inclusive no
 * celular.
 */
export function PainelRelatorio({
    slug,
    nome,
    colunas,
    avisos,
    contemDadosSensiveis,
    filtros
}: {
    slug: string
    nome: string
    colunas: string[]
    avisos: readonly string[]
    contemDadosSensiveis: boolean
    /** `relatorio` + filtros da URL — mesma forma usada na hidratação. */
    filtros: Record<string, string>
}) {
    const listagem = useListagemPaginada<LinhaRelatorio, Record<string, unknown>, PaginaRelatorio>({
        chave: (params) => chaveRelatorio(slug, params),
        buscar: consultarRelatorioAction,
        filtros
    })

    // Linha cujo detalhe (antes/depois) está aberto — só a trilha de auditoria
    // tem detalhe (R-17, FR-021).
    const [emDetalhe, setEmDetalhe] = useState<LinhaRelatorio | null>(null)
    const temDetalhe = listagem.rows.some((linha) => linha.detalhe)

    const colunasTabela = useMemo<ColunaTabela<LinhaRelatorio>[]>(() => {
        const dados: ColunaTabela<LinhaRelatorio>[] = colunas.map((cabecalho, indice) => ({
            id: `coluna-${indice}`,
            header: cabecalho,
            cell: ({ row }) => formatarCelula(row.original.celulas[indice])
        }))
        if (!temDetalhe) return dados

        return [
            ...dados,
            {
                id: 'detalhe',
                header: 'Detalhe',
                cell: ({ row }) => {
                    if (!row.original.detalhe) return null
                    // Nomear a linha: "Ver alterações" sozinho não diz de qual
                    // registro (015, T-02.2). A primeira coluna é a data/hora.
                    const rotulo = `Ver alterações de ${formatarCelula(row.original.celulas[0])}`
                    return (
                        <Tooltip conteudo={rotulo}>
                            <IconButton
                                aria-label={rotulo}
                                icone={<FileDiff aria-hidden className="size-5" />}
                                onClick={() => setEmDetalhe(row.original)}
                            />
                        </Tooltip>
                    )
                }
            }
        ]
    }, [colunas, temDetalhe])

    const linkExportacao = (formato: 'xlsx' | 'csv') => {
        const params = new URLSearchParams({ tipo: slug, formato })
        for (const [chave, valor] of Object.entries(filtros)) {
            if (chave !== 'relatorio') params.set(chave, valor)
        }
        return `/api/relatorios/export?${params.toString()}`
    }

    const pagina = listagem.pagina
    const excedeLimite = pagina?.excedeLimiteExportacao ?? false

    return (
        <div className="flex flex-col gap-6">
            {avisos.map((aviso) => (
                <Alert key={aviso} tom="info" titulo="Como ler este relatório">
                    {aviso}
                </Alert>
            ))}

            {pagina && pagina.resumo.length > 0 && (
                <section aria-label="Resumo" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {pagina.resumo.map((item) => (
                        <StatCard key={item.rotulo} label={item.rotulo} valor={formatarCelula(item.valor)} />
                    ))}
                </section>
            )}

            <section aria-label="Exportação" className="flex flex-col gap-3">
                {contemDadosSensiveis && (
                    <Alert tom="warning" titulo="Dados pessoais sensíveis">
                        Este arquivo contém dados pessoais sensíveis (CPF, restrições de saúde). Não compartilhe fora da
                        operação da Defesa Civil — LGPD.
                    </Alert>
                )}
                {excedeLimite && (
                    <Alert tom="warning" titulo="Relatório grande demais para exportar">
                        O resultado passa de 50.000 linhas. Reduza o período ou aplique mais filtros para exportar.
                    </Alert>
                )}
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">
                        {listagem.carregando
                            ? 'Contando linhas…'
                            : listagem.totalCount === 1
                              ? '1 linha'
                              : `${listagem.totalCount.toLocaleString('pt-BR')} linhas`}
                    </span>
                    <LinkExportacao
                        href={linkExportacao('xlsx')}
                        desabilitado={excedeLimite || Boolean(listagem.erro)}
                        principal
                        icone={<FileSpreadsheet aria-hidden className="size-5" />}
                    >
                        Exportar XLSX
                    </LinkExportacao>
                    <LinkExportacao
                        href={linkExportacao('csv')}
                        desabilitado={excedeLimite || Boolean(listagem.erro)}
                        icone={<Download aria-hidden className="size-5" />}
                    >
                        Exportar CSV
                    </LinkExportacao>
                </div>
            </section>

            {listagem.erro ? (
                <Alert tom="danger" titulo={`Não foi possível carregar: ${nome}`}>
                    <div className="flex flex-col items-start gap-3">
                        <p>{listagem.erro.message}</p>
                        <Button
                            variant="secondary"
                            iconeInicio={<RotateCcw className="size-4" />}
                            onClick={() => void listagem.refetch()}
                        >
                            Tentar novamente
                        </Button>
                    </div>
                </Alert>
            ) : (
                <Table
                    titulo={nome}
                    colunas={colunasTabela}
                    dados={listagem.rows}
                    carregando={listagem.carregando}
                    atualizando={listagem.atualizando}
                    vazio="Nenhum registro no período selecionado."
                    paginacao={listagem.paginacao}
                />
            )}

            <Dialog
                open={emDetalhe !== null}
                onOpenChange={(aberto) => !aberto && setEmDetalhe(null)}
                titulo="Alterações do registro"
                descricao={
                    emDetalhe
                        ? `${formatarCelula(emDetalhe.celulas[0])} — ${formatarCelula(emDetalhe.celulas[4])}`
                        : undefined
                }
                tamanho="lg"
            >
                {emDetalhe?.detalhe && <TabelaAlteracoes alteracoes={emDetalhe.detalhe} />}
            </Dialog>
        </div>
    )
}

const ROTULO_TIPO_ALTERACAO: Record<AlteracaoCampo['tipo'], string> = {
    alterado: 'Alterado',
    incluido: 'Incluído',
    removido: 'Removido'
}

/** Campo | Antes | Depois — o "qual era o valor antes?" da trilha (FR-021). */
function TabelaAlteracoes({ alteracoes }: { alteracoes: AlteracaoCampo[] }) {
    return (
        <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">Campos alterados, com valor anterior e novo</caption>
                <thead className="border-b border-border">
                    <tr>
                        {['Campo', 'Antes', 'Depois'].map((titulo) => (
                            <th
                                key={titulo}
                                scope="col"
                                className="px-3 py-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
                            >
                                {titulo}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {alteracoes.map((a) => (
                        <tr key={a.campo}>
                            <th scope="row" className="px-3 py-2 align-top font-medium text-foreground">
                                {a.campo}
                                <span className="block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                                    {ROTULO_TIPO_ALTERACAO[a.tipo]}
                                </span>
                            </th>
                            <td className="px-3 py-2 align-top break-all text-neutral-600 dark:text-neutral-300">
                                {a.antes ?? '—'}
                            </td>
                            <td className="px-3 py-2 align-top break-all text-foreground">{a.depois ?? '—'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

/**
 * Com 0 linhas a exportação continua permitida — gera o arquivo só com o
 * cabeçalho (caso de borda "período sem dados"). Desabilitado é só acima do
 * limite ou com erro: um link morto sem motivo não ajuda ninguém.
 */
function LinkExportacao({
    href,
    desabilitado,
    principal,
    icone,
    children
}: {
    href: string
    desabilitado: boolean
    principal?: boolean
    icone: ReactNode
    children: ReactNode
}) {
    const classes = cn(
        'inline-flex h-11 items-center gap-2 rounded-lg px-4 text-base font-medium',
        principal
            ? 'bg-primary-600 text-primary-foreground hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600'
            : 'border border-border text-foreground hover:bg-surface-muted',
        desabilitado && 'pointer-events-none opacity-50'
    )

    if (desabilitado) {
        return (
            <span aria-disabled className={classes}>
                {icone}
                {children}
            </span>
        )
    }

    return (
        <a href={href} download className={classes}>
            {icone}
            {children}
        </a>
    )
}

const NUMERO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

function formatarCelula(celula: Celula): string {
    if (celula === null) return '—'
    if (typeof celula === 'number') return NUMERO.format(celula)
    return celula
}
