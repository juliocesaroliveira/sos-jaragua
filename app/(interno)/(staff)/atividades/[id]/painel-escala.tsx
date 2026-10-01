'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { Check, UserMinus, UserPlus, X } from 'lucide-react'
import { Alert } from '@/src/shared/ui/alert/alert'
import { Badge, COR_STATUS_ATIVIDADE, ROTULO_STATUS_ATIVIDADE } from '@/src/shared/ui/badge/badge'
import { Button } from '@/src/shared/ui/button/button'
import { Dialog } from '@/src/shared/ui/dialog/dialog'
import { IconButton } from '@/src/shared/ui/icon-button/icon-button'
import { IconePapel } from '@/src/shared/ui/icone-papel/icone-papel'
import { KanbanCard } from '@/src/shared/ui/kanban/kanban-card'
import { Select } from '@/src/shared/ui/select/select'
import { Tooltip } from '@/src/shared/ui/tooltip/tooltip'
import { avisar } from '@/src/shared/ui/toast/toast'
import type { AtividadeDetalhada, TurnoDetalhado } from '@/src/modules/voluntariado/presentation/queries/atividades'
import type { LinhaVoluntario } from '@/src/modules/voluntariado/presentation/queries/candidaturas'
import type { Lookup } from '@/src/modules/voluntariado/presentation/queries/lookups'
import { alocarVoluntario, cancelarAlocacao } from '@/src/modules/voluntariado/presentation/actions/atividades'

/**
 * Painel de escala por atividade (VOL-11, DESIGN.md §10.2).
 *
 * Cada turno é um card próprio numa grade `auto-fill`: os cards ficam lado a
 * lado, quebram para a linha de baixo quando não cabem e, no celular, ficam um
 * por linha. `auto-fill` (e não `auto-fit`) mantém as trilhas vazias, para que
 * uma atividade com um único turno não estique o card na largura toda.
 */

export function PainelEscala({
    atividade,
    voluntarios,
    habilidades,
    habilidadeSelecionada
}: {
    atividade: AtividadeDetalhada
    voluntarios: LinhaVoluntario[]
    habilidades: Lookup[]
    habilidadeSelecionada?: string
}) {
    const router = useRouter()
    const [emAndamento, iniciarTransicao] = useTransition()
    const [turnoAlvo, setTurnoAlvo] = useState<TurnoDetalhado | null>(null)
    const [selecionado, setSelecionado] = useState<string[]>([])
    const [erro, setErro] = useState<string | null>(null)

    // A seleção manual só lista voluntários com perfil; a equipe interna sem
    // perfil (`voluntarioPerfilId` nulo) nunca aparece entre os disponíveis.
    const jaAlocados = useMemo(
        () => new Set(turnoAlvo?.alocados.flatMap((a) => (a.voluntarioPerfilId ? [a.voluntarioPerfilId] : [])) ?? []),
        [turnoAlvo]
    )

    const disponiveis = voluntarios.filter((v) => !jaAlocados.has(v.id))

    function filtrarPorHabilidade(valores: string[]) {
        const id = valores[0]
        const url = new URL(window.location.href)
        if (id) url.searchParams.set('habilidade', id)
        else url.searchParams.delete('habilidade')
        router.replace(`${url.pathname}${url.search}`)
    }

    function alocar() {
        if (!turnoAlvo || !selecionado[0]) return
        setErro(null)

        iniciarTransicao(async () => {
            const resultado = await alocarVoluntario({
                atividadeId: atividade.id,
                turnoId: turnoAlvo.id,
                voluntarioPerfilId: selecionado[0]
            })

            if (!resultado.ok) {
                setErro(resultado.erro.mensagem)
                return
            }

            avisar.sucesso('Voluntário alocado', 'A pessoa foi notificada do turno.')
            setTurnoAlvo(null)
            setSelecionado([])
        })
    }

    function remover(alocacaoId: string, nome: string) {
        iniciarTransicao(async () => {
            const resultado = await cancelarAlocacao({ atividadeId: atividade.id, alocacaoId })
            if (!resultado.ok) {
                avisar.erro('Não foi possível remover', resultado.erro.mensagem)
                return
            }
            avisar.info('Alocação cancelada', `${nome} foi avisado.`)
        })
    }

    const podeAlocar = atividade.status === 'aberta'
    const contagemEscalas = atividade.turnos.length === 1 ? '1 escala' : `${atividade.turnos.length} escalas`

    return (
        <>
            <header className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                        {atividade.titulo}
                    </h1>
                    <Badge cor={COR_STATUS_ATIVIDADE[atividade.status]}>
                        {ROTULO_STATUS_ATIVIDADE[atividade.status]}
                    </Badge>
                </div>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    {atividade.categoria} · {atividade.local}
                </p>
            </header>

            {!podeAlocar && (
                <Alert tom="warning" titulo="Atividade não está aberta">
                    Reabra a atividade para voltar a alocar voluntários.
                </Alert>
            )}

            <div className="max-w-xs">
                <Select
                    id="filtroHabilidade"
                    label="Filtrar voluntários por habilidade"
                    placeholder="Todas as habilidades"
                    opcoes={habilidades.map((h) => ({ value: h.id, label: h.nome }))}
                    value={habilidadeSelecionada ? [habilidadeSelecionada] : []}
                    onValueChange={filtrarPorHabilidade}
                />
            </div>

            {atividade.turnos.length === 0 ? (
                <Alert tom="info" titulo="Esta atividade ainda não tem turnos" />
            ) : (
                <section aria-labelledby="titulo-escalas" className="flex flex-col gap-3">
                    <header className="flex items-baseline gap-2">
                        <h2 id="titulo-escalas" className="text-xl font-semibold text-foreground">
                            Escalas
                        </h2>
                        <span className="text-sm text-neutral-500 dark:text-neutral-400">{contagemEscalas}</span>
                    </header>
                    {/*
                      `min(100%, 18rem)` impede que a trilha mínima estoure a
                      largura em telas de 320px; `items-start` deixa cada card com
                      a altura do próprio conteúdo.
                    */}
                    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] items-start gap-3">
                        {atividade.turnos.map((t) => {
                            // Um rótulo só para o nome acessível e a dica
                            // (C-04.3). Leva data e horário porque, com vários
                            // cards na tela, um nome genérico repetido não diz
                            // ao leitor de tela qual turno o botão afeta.
                            const rotuloAlocar = `Alocar voluntário no turno de ${formatarData(t.inicio)}, ${formatarHora(t.inicio)} – ${formatarHora(t.fim)}`
                            return (
                                <KanbanCard
                                    key={t.id}
                                    horario={`${formatarHora(t.inicio)} – ${formatarHora(t.fim)} · ${formatarData(t.inicio)}`}
                                    preenchidas={t.preenchidas}
                                    vagas={t.vagas}
                                    acoes={
                                        podeAlocar && (
                                            <Tooltip conteudo={rotuloAlocar}>
                                                <IconButton
                                                    aria-label={rotuloAlocar}
                                                    icone={<UserPlus aria-hidden className="size-5" />}
                                                    size="sm"
                                                    onClick={() => {
                                                        setTurnoAlvo(t)
                                                        setSelecionado([])
                                                        setErro(null)
                                                    }}
                                                />
                                            </Tooltip>
                                        )
                                    }
                                    detalhe={
                                        t.alocados.length > 0 ? (
                                            <ul className="flex flex-col gap-1">
                                                {t.alocados.map((a) => {
                                                    // Um rótulo só para os dois
                                                    // consumidores (C-04.3). O nome
                                                    // aparece ao lado, mas chega
                                                    // truncado quando é longo — a dica
                                                    // é onde ele cabe inteiro.
                                                    const rotulo = `Remover ${a.nome} do turno`
                                                    return (
                                                        <li
                                                            key={a.alocacaoId}
                                                            className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-surface-muted px-2 text-sm text-foreground"
                                                        >
                                                            <span className="flex min-w-0 flex-1 items-center gap-1.5">
                                                                <span className="truncate">{a.nome}</span>
                                                                <IconePapel role={a.role} />
                                                                {a.origem === 'inscricao_propria' && (
                                                                    <Badge cor="neutral">Inscrição própria</Badge>
                                                                )}
                                                            </span>
                                                            {/*
                                                              Durante `emAndamento` o
                                                              botão fica desabilitado e a
                                                              dica não abre: é estado
                                                              transitório de segundos, sem
                                                              nada a explicar (D4).
                                                            */}
                                                            <Tooltip conteudo={rotulo} posicao="left">
                                                                <IconButton
                                                                    aria-label={rotulo}
                                                                    icone={<UserMinus aria-hidden className="size-4" />}
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    loading={emAndamento}
                                                                    onClick={() => remover(a.alocacaoId, a.nome)}
                                                                />
                                                            </Tooltip>
                                                        </li>
                                                    )
                                                })}
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                                Nenhum voluntário escalado ainda.
                                            </p>
                                        )
                                    }
                                />
                            )
                        })}
                    </ul>
                </section>
            )}

            <Dialog
                open={turnoAlvo !== null}
                onOpenChange={(aberto) => !aberto && setTurnoAlvo(null)}
                titulo="Alocar voluntário"
                descricao={
                    turnoAlvo
                        ? `${formatarHora(turnoAlvo.inicio)} – ${formatarHora(turnoAlvo.fim)} · ${formatarData(turnoAlvo.inicio)}`
                        : undefined
                }
                acoes={
                    <>
                        <Button
                            variant="secondary"
                            iconeInicio={<X className="size-4" />}
                            onClick={() => setTurnoAlvo(null)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            iconeInicio={<Check className="size-4" />}
                            loading={emAndamento}
                            disabled={!selecionado[0]}
                            onClick={alocar}
                        >
                            Alocar
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    {erro && <Alert tom="danger" titulo={erro} />}

                    {disponiveis.length === 0 ? (
                        <Alert tom="info" titulo="Nenhum voluntário disponível">
                            Todos os voluntários aprovados com este filtro já estão neste turno.
                        </Alert>
                    ) : (
                        <Select
                            id="voluntario"
                            label="Voluntário"
                            obrigatorio
                            opcoes={disponiveis.map((v) => ({
                                value: v.id,
                                label:
                                    v.habilidades.length > 0
                                        ? `${v.nomeCompleto} — ${v.habilidades.join(', ')}`
                                        : v.nomeCompleto
                            }))}
                            value={selecionado}
                            onValueChange={setSelecionado}
                        />
                    )}
                </div>
            </Dialog>
        </>
    )
}

const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const DATA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })

function formatarHora(iso: string) {
    return HORA.format(new Date(iso))
}

function formatarData(iso: string) {
    return DATA.format(new Date(iso))
}
