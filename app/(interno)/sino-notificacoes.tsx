'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Bell } from 'lucide-react'
import { Badge, Button, Drawer, IconButton, cn } from '@/src/shared/ui'
import type { NotificacaoInApp } from '@/src/modules/notificacoes/presentation/queries/notificacoes'
import { marcarComoLida, marcarTodasComoLidas } from '@/src/modules/notificacoes/presentation/actions/notificacoes'

/**
 * Sino de notificações in-app (NOT-09).
 *
 * A lista abre em `Drawer` e não em `Popover`: em campo, no celular, um painel
 * lateral é mais fácil de ler e fechar do que um balão flutuante.
 */
const COR_POR_EVENTO: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'primary' | 'neutral'> = {
    triagem_concluida: 'success',
    atividade_atribuida: 'info',
    alteracao_atividade: 'warning',
    lembrete_turno: 'info',
    broadcast_urgencia: 'danger',
    cadastros_acumulados: 'info',
    estoque_critico: 'warning',
    deficit_atendimento: 'danger'
}

const ROTULO_POR_EVENTO: Record<string, string> = {
    triagem_concluida: 'Triagem',
    atividade_atribuida: 'Atividade',
    alteracao_atividade: 'Alteração',
    lembrete_turno: 'Lembrete',
    broadcast_urgencia: 'Urgência',
    cadastros_acumulados: 'Cadastros',
    estoque_critico: 'Estoque',
    deficit_atendimento: 'Déficit'
}

export function SinoNotificacoes({ notificacoes, naoLidas }: { notificacoes: NotificacaoInApp[]; naoLidas: number }) {
    const router = useRouter()
    const [aberto, setAberto] = useState(false)
    const [processando, iniciarTransicao] = useTransition()

    function abrirEMarcar(id: string, lida: boolean) {
        if (lida) return
        iniciarTransicao(async () => {
            await marcarComoLida({ id })
            router.refresh()
        })
    }

    function marcarTudo() {
        iniciarTransicao(async () => {
            await marcarTodasComoLidas()
            router.refresh()
        })
    }

    return (
        <>
            <div className="relative">
                <IconButton
                    aria-label={naoLidas > 0 ? `Notificações (${naoLidas} não lidas)` : 'Notificações'}
                    icone={<Bell aria-hidden className="size-5" />}
                    onClick={() => setAberto(true)}
                />
                {naoLidas > 0 && (
                    <span
                        aria-hidden
                        className="pointer-events-none absolute -top-0.5 -right-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-danger-600 px-1 text-xs font-semibold text-white"
                    >
                        {naoLidas > 99 ? '99+' : naoLidas}
                    </span>
                )}
            </div>

            <Drawer
                open={aberto}
                onOpenChange={setAberto}
                lado="right"
                titulo="Notificações"
                descricao={naoLidas > 0 ? `${naoLidas} não lida(s)` : 'Tudo em dia'}
                acoes={
                    naoLidas > 0 && (
                        <Button variant="secondary" loading={processando} onClick={marcarTudo}>
                            Marcar todas como lidas
                        </Button>
                    )
                }
            >
                {notificacoes.length === 0 ? (
                    <p className="text-base text-neutral-500 dark:text-neutral-400">
                        Você ainda não recebeu notificações.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {notificacoes.map((n) => (
                            <li key={n.id}>
                                <button
                                    type="button"
                                    onClick={() => abrirEMarcar(n.id, n.lida)}
                                    className={cn(
                                        'flex w-full flex-col gap-1 rounded-xl border p-3 text-left',
                                        n.lida
                                            ? 'border-border bg-surface'
                                            : 'border-primary-300 bg-primary-50 dark:border-primary-800 dark:bg-primary-950'
                                    )}
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge cor={COR_POR_EVENTO[n.tipo] ?? 'neutral'}>
                                            {ROTULO_POR_EVENTO[n.tipo] ?? 'Aviso'}
                                        </Badge>
                                        <span className="text-base font-semibold text-foreground">{n.titulo}</span>
                                    </div>
                                    <p className="text-sm text-neutral-600 dark:text-neutral-300">{n.mensagem}</p>
                                    <span className="text-xs text-neutral-500">{formatarDataHora(n.criadoEm)}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </Drawer>
        </>
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
