'use client'

import { useQuery } from '@tanstack/react-query'
import { List, RotateCcw, Trash2 } from 'lucide-react'
import { Alert } from '@/src/shared/ui/alert/alert'
import { Button } from '@/src/shared/ui/button/button'
import { SkeletonLista } from '@/src/shared/ui/skeleton/skeleton'
import { Tooltip } from '@/src/shared/ui/tooltip/tooltip'
import { inventarioAction } from '@/src/modules/manutencao/presentation/actions/danger-zone'
import type { LinhaInventario } from '@/src/modules/manutencao/application/use-cases/inventario'
import { CHAVE_INVENTARIO } from './chaves'

type Props = {
    onResetar: (tabela: string, rotulo: string) => void
    onVerRegistros: (tabela: string, rotulo: string) => void
}

const numero = new Intl.NumberFormat('pt-BR')

/**
 * Inventário das tabelas por área (U-03, FR-004, FR-005).
 *
 * Em cartões e não em tabela larga: cada linha tem quatro informações e dois
 * botões, e precisa caber em 360 px sem rolagem lateral.
 */
export function Inventario({ onResetar, onVerRegistros }: Props) {
    const consulta = useQuery({
        queryKey: CHAVE_INVENTARIO,
        queryFn: async () => {
            const r = await inventarioAction()
            if (!r.ok) throw new Error(r.erro.mensagem)
            return r.valor
        }
    })

    if (consulta.isPending) return <SkeletonLista linhas={8} />
    if (consulta.isError) {
        return (
            <Alert
                tom="danger"
                titulo="Não foi possível carregar as tabelas"
                acao={
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => consulta.refetch()}
                        iconeInicio={<RotateCcw aria-hidden className="size-4" />}
                    >
                        Tentar de novo
                    </Button>
                }
            >
                {consulta.error.message}
            </Alert>
        )
    }

    const porArea = new Map<string, LinhaInventario[]>()
    for (const t of consulta.data.tabelas) porArea.set(t.rotuloArea, [...(porArea.get(t.rotuloArea) ?? []), t])

    return (
        <div className="flex flex-col gap-8">
            {[...porArea.entries()].map(([area, tabelas]) => (
                <section key={area} aria-labelledby={`area-${area}`} className="flex flex-col gap-3">
                    <h2 id={`area-${area}`} className="text-lg font-semibold text-foreground">
                        {area}
                    </h2>
                    <ul className="grid gap-3 md:grid-cols-2">
                        {tabelas.map((t) => (
                            <li
                                key={t.nome}
                                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
                            >
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-foreground">{t.rotulo}</span>
                                        <code className="text-xs text-neutral-500 dark:text-neutral-400">{t.nome}</code>
                                    </div>
                                    <span className="text-sm text-neutral-600 tabular-nums dark:text-neutral-300">
                                        {numero.format(t.registros)} {t.registros === 1 ? 'registro' : 'registros'}
                                        {t.registrosSistema > 0 && ' + 1 do sistema'}
                                    </span>
                                </div>

                                <dl className="grid gap-1 text-sm">
                                    <div className="flex flex-wrap gap-1">
                                        <dt className="text-neutral-500 dark:text-neutral-400">Depende de:</dt>
                                        <dd className="text-foreground">{t.dependeDe.join(', ') || '—'}</dd>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        <dt className="text-neutral-500 dark:text-neutral-400">Dependentes:</dt>
                                        <dd className="text-foreground">{t.dependentes.join(', ') || '—'}</dd>
                                    </div>
                                </dl>

                                <div className="flex flex-wrap gap-2">
                                    <ComMotivo motivo={t.motivoIndisponivel}>
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            disabled={!t.disponivel}
                                            aria-describedby={t.motivoIndisponivel ? `motivo-${t.nome}` : undefined}
                                            iconeInicio={<Trash2 aria-hidden className="size-4" />}
                                            onClick={() => onResetar(t.nome, t.rotulo)}
                                        >
                                            Resetar
                                        </Button>
                                    </ComMotivo>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        disabled={t.registros === 0}
                                        iconeInicio={<List aria-hidden className="size-4" />}
                                        onClick={() => onVerRegistros(t.nome, t.rotulo)}
                                    >
                                        Ver registros
                                    </Button>
                                </div>
                                {t.motivoIndisponivel && (
                                    <p
                                        id={`motivo-${t.nome}`}
                                        className="text-xs text-neutral-500 dark:text-neutral-400"
                                    >
                                        {t.motivoIndisponivel}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    )
}

/** Botão desabilitado não recebe foco nem hover: a dica envolve um wrapper. */
function ComMotivo({ motivo, children }: { motivo?: string; children: React.ReactNode }) {
    if (!motivo) return <>{children}</>
    return (
        <Tooltip conteudo={motivo}>
            <span tabIndex={0} className="inline-flex rounded-lg">
                {children}
            </span>
        </Tooltip>
    )
}
