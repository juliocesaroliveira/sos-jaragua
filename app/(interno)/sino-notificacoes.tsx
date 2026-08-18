'use client'

import { useState } from 'react'
import { Bell, CheckSquare } from 'lucide-react'
import { Badge, Button, Drawer, IconButton, Tooltip, cn } from '@/src/shared/ui'
import type { NotificacaoInApp } from '@/src/modules/notificacoes/presentation/queries/notificacoes'
import { useNotificacoes } from '@/src/modules/notificacoes/presentation/client/use-notificacoes'

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

/**
 * As props são a **semente** resolvida pelo Server Component
 * (012-notificacoes-tempo-real): o estado exibido a partir daí vem do hook, que
 * reconsulta sozinho a cada 30s com a aba visível e imediatamente ao recuperar
 * o foco.
 */
export function SinoNotificacoes({ notificacoes, naoLidas }: { notificacoes: NotificacaoInApp[]; naoLidas: number }) {
    const [aberto, setAberto] = useState(false)
    const {
        notificacoes: lista,
        naoLidas: totalNaoLidas,
        marcarUma,
        marcarTodas,
        processando
    } = useNotificacoes({ notificacoes, naoLidas })

    function abrirEMarcar(id: string, lida: boolean) {
        if (lida) return
        marcarUma(id)
    }

    // Um rótulo só para o nome acessível e para a dica (C-04.3). A contagem
    // entra nos dois: quem aponta o sino vê quantas há sem precisar abri-lo.
    const rotuloSino = totalNaoLidas > 0 ? `Notificações (${totalNaoLidas} não lidas)` : 'Notificações'

    return (
        <>
            <div className="relative">
                <Tooltip conteudo={rotuloSino} posicao="bottom">
                    <IconButton
                        aria-label={rotuloSino}
                        icone={<Bell aria-hidden className="size-5" />}
                        onClick={() => setAberto(true)}
                    />
                </Tooltip>
                {totalNaoLidas > 0 && (
                    <span
                        aria-hidden
                        className="pointer-events-none absolute -top-0.5 -right-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-danger-600 px-1 text-xs font-semibold text-white"
                    >
                        {totalNaoLidas > 99 ? '99+' : totalNaoLidas}
                    </span>
                )}
            </div>

            <Drawer
                open={aberto}
                onOpenChange={setAberto}
                lado="right"
                titulo="Notificações"
                descricao={totalNaoLidas > 0 ? `${totalNaoLidas} não lida(s)` : 'Tudo em dia'}
                acoes={
                    totalNaoLidas > 0 && (
                        <Button
                            variant="secondary"
                            iconeInicio={<CheckSquare className="size-4" />}
                            loading={processando}
                            onClick={marcarTodas}
                        >
                            Marcar todas como lidas
                        </Button>
                    )
                }
            >
                {lista.length === 0 ? (
                    <p className="text-base text-neutral-500 dark:text-neutral-400">
                        Você ainda não recebeu notificações.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {lista.map((n) => (
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
