'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Alert } from '@/src/shared/ui/alert/alert'
import { Badge, type CorBadge } from '@/src/shared/ui/badge/badge'
import { Button } from '@/src/shared/ui/button/button'
import { SkeletonLista } from '@/src/shared/ui/skeleton/skeleton'
import { cn } from '@/src/shared/ui/cn'
import { historicoAction } from '@/src/modules/manutencao/presentation/actions/danger-zone'
import type { SituacaoExecucao } from '@/src/modules/auditoria'
import { chaveHistorico } from './chaves'

const TAMANHO_PAGINA = 10

const SITUACAO: Record<SituacaoExecucao, { rotulo: string; cor: CorBadge }> = {
    concluida: { rotulo: 'Concluída', cor: 'success' },
    falhou: { rotulo: 'Falhou', cor: 'danger' },
    recusada: { rotulo: 'Recusada', cor: 'warning' },
    cancelada: { rotulo: 'Cancelada', cor: 'neutral' },
    desfecho_nao_confirmado: { rotulo: 'Desfecho não confirmado', cor: 'info' }
}

const MODO: Record<string, string> = {
    cascata: 'Cascata',
    preservacao: 'Preservação',
    sem_dependentes: 'Sem dependentes'
}

const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })
const numero = new Intl.NumberFormat('pt-BR')

/**
 * Histórico das ações (U-06, US3). Cada linha expande para as contagens por
 * tabela. Com a auditoria fora do ar, só esta aba mostra o aviso — o
 * inventário continua utilizável (C-06).
 */
export function Historico() {
    const [pagina, setPagina] = useState(1)
    const params = { page: pagina, pageSize: TAMANHO_PAGINA }
    const consulta = useQuery({
        queryKey: chaveHistorico(params),
        queryFn: async () => {
            const r = await historicoAction(params)
            if (!r.ok) throw new Error(r.erro.mensagem)
            return r.valor
        },
        placeholderData: keepPreviousData
    })

    if (consulta.isPending) return <SkeletonLista linhas={5} />
    if (consulta.isError) {
        return (
            <Alert tom="warning" titulo="Histórico indisponível">
                {consulta.error.message}
            </Alert>
        )
    }

    const { rows, totalCount } = consulta.data
    const totalPaginas = Math.max(1, Math.ceil(totalCount / TAMANHO_PAGINA))

    if (rows.length === 0) {
        return <p className="text-sm text-neutral-500 dark:text-neutral-400">Nenhuma ação executada ainda.</p>
    }

    return (
        <div className="flex flex-col gap-4">
            <ul className={cn('flex flex-col gap-2', consulta.isPlaceholderData && 'opacity-60')}>
                {rows.map((e) => {
                    const linhas = Object.entries(e.contagens).filter(
                        ([, c]) => c.apagar > 0 || Object.values(c.redirecionar).some((n) => n > 0)
                    )
                    const apagados = linhas.reduce((a, [, c]) => a + c.apagar, 0)
                    const alterados = linhas.reduce(
                        (a, [, c]) => a + Object.values(c.redirecionar).reduce((x, n) => x + n, 0),
                        0
                    )
                    return (
                        <li key={e.execucaoId} className="rounded-xl border border-border bg-surface">
                            <details>
                                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
                                    <Badge cor={SITUACAO[e.situacao].cor}>{SITUACAO[e.situacao].rotulo}</Badge>
                                    <span className="font-medium text-foreground">
                                        {e.acao === 'excluir_selecionados' ? 'Exclusão de selecionados' : 'Reset'} ·{' '}
                                        <code>{e.tabela}</code>
                                    </span>
                                    <span className="text-neutral-600 dark:text-neutral-300">
                                        {e.ator} · {dataHora.format(new Date(e.inicio))}
                                    </span>
                                    <span className="tabular-nums text-neutral-600 dark:text-neutral-300">
                                        {MODO[e.modo ?? ''] ?? e.modo} · {numero.format(apagados)} apagado(s)
                                        {alterados > 0 && ` · ${numero.format(alterados)} alterado(s)`}
                                        {e.situacao !== 'concluida' && ' (previsto)'}
                                    </span>
                                </summary>
                                <div className="flex flex-col gap-1 border-t border-border p-3 text-sm">
                                    {e.motivo && (
                                        <p className="text-neutral-600 dark:text-neutral-300">Motivo: {e.motivo}</p>
                                    )}
                                    {e.situacao === 'desfecho_nao_confirmado' && (
                                        <p className="text-info-700 dark:text-info-300">
                                            O início foi registrado, mas o resultado não. Confira o banco antes de
                                            repetir a ação.
                                        </p>
                                    )}
                                    <ul>
                                        {linhas.map(([tabela, c]) => (
                                            <li key={tabela} className="flex justify-between gap-2">
                                                <code>{tabela}</code>
                                                <span className="tabular-nums">
                                                    {numero.format(c.apagar)} apagado(s)
                                                    {Object.entries(c.redirecionar).map(
                                                        ([col, n]) => ` · ${col}: ${numero.format(n)} alterado(s)`
                                                    )}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </details>
                        </li>
                    )
                })}
            </ul>
            <div className="flex items-center justify-between gap-2 text-sm">
                <Button
                    variant="secondary"
                    size="sm"
                    disabled={pagina <= 1}
                    onClick={() => setPagina((p) => p - 1)}
                    iconeInicio={<ChevronLeft aria-hidden className="size-4" />}
                >
                    Anterior
                </Button>
                <span className="tabular-nums text-neutral-600 dark:text-neutral-300">
                    Página {pagina} de {totalPaginas}
                </span>
                <Button
                    variant="secondary"
                    size="sm"
                    disabled={pagina >= totalPaginas}
                    onClick={() => setPagina((p) => p + 1)}
                    iconeFim={<ChevronRight aria-hidden className="size-4" />}
                >
                    Próxima
                </Button>
            </div>
        </div>
    )
}
