'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { UserMinus, UserPlus } from 'lucide-react'
import {
    Alert,
    Badge,
    Button,
    COR_STATUS_ATIVIDADE,
    Dialog,
    IconButton,
    KanbanCard,
    KanbanColumn,
    ROTULO_STATUS_ATIVIDADE,
    Select,
    avisar
} from '@/src/shared/ui'
import type { AtividadeDetalhada, TurnoDetalhado } from '@/src/modules/voluntariado/presentation/queries/atividades'
import type { LinhaVoluntario } from '@/src/modules/voluntariado/presentation/queries/candidaturas'
import type { Lookup } from '@/src/modules/voluntariado/presentation/queries/lookups'
import { alocarVoluntario, cancelarAlocacao } from '@/src/modules/voluntariado/presentation/actions/atividades'

/**
 * Painel de escala por atividade (VOL-11, DESIGN.md §10.2).
 *
 * Em `md+` os turnos ficam lado a lado com rolagem horizontal; abaixo disso a
 * coluna colapsa para lista vertical — o Kanban não é usável em 375px.
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

    const jaAlocados = useMemo(() => new Set(turnoAlvo?.alocados.map((a) => a.voluntarioPerfilId) ?? []), [turnoAlvo])

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
            router.refresh()
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
            router.refresh()
        })
    }

    const podeAlocar = atividade.status === 'aberta'

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
                <div className="flex flex-col gap-3 md:flex-row md:overflow-x-auto md:pb-2">
                    <KanbanColumn
                        titulo="Escala"
                        subtitulo={atividade.local}
                        contagem={`${atividade.turnos.length} turno(s)`}
                    >
                        {atividade.turnos.map((t) => (
                            <KanbanCard
                                key={t.id}
                                horario={`${formatarHora(t.inicio)} – ${formatarHora(t.fim)} · ${formatarData(t.inicio)}`}
                                preenchidas={t.preenchidas}
                                vagas={t.vagas}
                                acoes={
                                    podeAlocar && (
                                        <IconButton
                                            aria-label="Alocar voluntário neste turno"
                                            icone={<UserPlus aria-hidden className="size-5" />}
                                            size="sm"
                                            onClick={() => {
                                                setTurnoAlvo(t)
                                                setSelecionado([])
                                                setErro(null)
                                            }}
                                        />
                                    )
                                }
                                detalhe={
                                    t.alocados.length > 0 && (
                                        <ul className="flex flex-col gap-1">
                                            {t.alocados.map((a) => (
                                                <li
                                                    key={a.alocacaoId}
                                                    className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-surface-muted px-2 text-sm text-foreground"
                                                >
                                                    <span className="truncate">{a.nomeCompleto}</span>
                                                    <IconButton
                                                        aria-label={`Remover ${a.nomeCompleto} do turno`}
                                                        icone={<UserMinus aria-hidden className="size-4" />}
                                                        size="sm"
                                                        variant="ghost"
                                                        loading={emAndamento}
                                                        onClick={() => remover(a.alocacaoId, a.nomeCompleto)}
                                                    />
                                                </li>
                                            ))}
                                        </ul>
                                    )
                                }
                            />
                        ))}
                    </KanbanColumn>
                </div>
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
                        <Button variant="secondary" onClick={() => setTurnoAlvo(null)}>
                            Cancelar
                        </Button>
                        <Button loading={emAndamento} disabled={!selecionado[0]} onClick={alocar}>
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
