'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { CalendarPlus, Check, LogOut, MapPin, X } from 'lucide-react'
import { Alert } from '@/src/shared/ui/alert/alert'
import { Badge, type CorBadge } from '@/src/shared/ui/badge/badge'
import { Button } from '@/src/shared/ui/button/button'
import { Dialog } from '@/src/shared/ui/dialog/dialog'
import { Progress, type TomProgresso } from '@/src/shared/ui/progress/progress'
import { Select } from '@/src/shared/ui/select/select'
import { Switch } from '@/src/shared/ui/switch/switch'
import { avisar } from '@/src/shared/ui/toast/toast'
import type { EstadoTurno } from '@/src/modules/voluntariado/domain/inscricao'
import type { Elegibilidade } from '@/src/modules/voluntariado/presentation/queries/atividades'
import type {
    AtividadeNaVitrine,
    TurnoNaVitrine
} from '@/src/modules/voluntariado/presentation/vitrine-atividades-abertas'
import {
    diaDoTurno,
    filtrarAtividadesAbertas
} from '@/src/modules/voluntariado/presentation/filtros-atividades-abertas'
import { desistirDeTurno, inscreverEmTurno } from '@/src/modules/voluntariado/presentation/actions/inscricao-turno'

/**
 * Vitrine de turnos (018-inscricao-atividades, contrato U-01).
 *
 * Nenhum nome de participante aparece aqui (FR-010a) — só contagens e o
 * estado do próprio usuário. O estado de cada turno chega calculado do
 * servidor; o cliente só filtra e dispara as ações.
 */

const ESTADO: Record<EstadoTurno, { rotulo: string; cor: CorBadge; tom: TomProgresso }> = {
    com_vagas: { rotulo: 'Vagas abertas', cor: 'success', tom: 'success' },
    ultimas_vagas: { rotulo: 'Últimas vagas', cor: 'warning', tom: 'warning' },
    lotado: { rotulo: 'Lotado', cor: 'danger', tom: 'danger' },
    em_andamento: { rotulo: 'Em andamento', cor: 'info', tom: 'primary' },
    inscrito: { rotulo: 'Você está inscrito', cor: 'primary', tom: 'primary' }
}

type Acao = { tipo: 'inscrever' | 'desistir'; atividade: AtividadeNaVitrine; turno: TurnoNaVitrine }

const MENSAGEM_REDE = 'Não foi possível concluir. Verifique sua conexão e tente novamente.'

export function ListaAtividadesAbertas({
    atividades,
    elegibilidade
}: {
    atividades: AtividadeNaVitrine[]
    elegibilidade: Elegibilidade
}) {
    const router = useRouter()
    const [emAndamento, iniciarTransicao] = useTransition()
    const [acao, setAcao] = useState<Acao | null>(null)

    const [categoriaId, setCategoriaId] = useState<string | undefined>()
    const [dia, setDia] = useState<string | undefined>()
    const [somenteComVagas, setSomenteComVagas] = useState(false)

    const categorias = useMemo(
        () => [...new Map(atividades.map((a) => [a.categoriaId, a.categoria])).entries()],
        [atividades]
    )
    const dias = useMemo(
        () => [...new Map(atividades.flatMap((a) => a.turnos.map((t) => [diaDoTurno(t.inicio), t.inicio]))).entries()],
        [atividades]
    )
    const visiveis = useMemo(
        () => filtrarAtividadesAbertas(atividades, { categoriaId, dia, somenteComVagas }),
        [atividades, categoriaId, dia, somenteComVagas]
    )
    const filtrosAtivos = Boolean(categoriaId || dia || somenteComVagas)

    function limparFiltros() {
        setCategoriaId(undefined)
        setDia(undefined)
        setSomenteComVagas(false)
    }

    function confirmar() {
        if (!acao) return
        const { tipo, atividade, turno } = acao

        iniciarTransicao(async () => {
            try {
                const resultado =
                    tipo === 'inscrever'
                        ? await inscreverEmTurno({ atividadeId: atividade.id, turnoId: turno.id })
                        : await desistirDeTurno({ atividadeId: atividade.id, alocacaoId: turno.alocacaoId })

                setAcao(null)
                router.refresh()

                if (!resultado.ok) {
                    avisar.erro(
                        tipo === 'inscrever' ? 'Inscrição não realizada' : 'Desistência não realizada',
                        resultado.erro.mensagem
                    )
                    return
                }

                if (tipo === 'inscrever') {
                    avisar.sucesso('Inscrição confirmada', `Você está escalado em "${atividade.titulo}".`)
                } else {
                    avisar.info('Desistência registrada', 'A vaga foi liberada para outra pessoa.')
                }
            } catch {
                // Falha de rede: o diálogo continua aberto para tentar de novo.
                avisar.erro(
                    tipo === 'inscrever' ? 'Inscrição não realizada' : 'Desistência não realizada',
                    MENSAGEM_REDE
                )
            }
        })
    }

    if (atividades.length === 0) {
        return (
            <>
                {!elegibilidade.elegivel && <AvisoElegibilidade motivo={elegibilidade.motivo} />}
                <Alert tom="info" titulo="Não há atividades abertas no momento">
                    Quando a coordenação abrir novas atividades, elas aparecem aqui.
                </Alert>
            </>
        )
    }

    return (
        <>
            {!elegibilidade.elegivel && <AvisoElegibilidade motivo={elegibilidade.motivo} />}

            <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-end">
                <div className="sm:w-56">
                    <Select
                        id="filtroCategoria"
                        label="Categoria"
                        placeholder="Todas as categorias"
                        opcoes={categorias.map(([value, label]) => ({ value, label }))}
                        value={categoriaId ? [categoriaId] : []}
                        onValueChange={(v) => setCategoriaId(v[0])}
                    />
                </div>
                <div className="sm:w-56">
                    <Select
                        id="filtroDia"
                        label="Dia"
                        placeholder="Todos os dias"
                        opcoes={dias.map(([value, inicio]) => ({ value, label: formatarDia(inicio) }))}
                        value={dia ? [dia] : []}
                        onValueChange={(v) => setDia(v[0])}
                    />
                </div>
                <div className="flex min-h-11 items-center">
                    <Switch
                        id="somenteComVagas"
                        label="Somente com vagas"
                        checked={somenteComVagas}
                        onCheckedChange={setSomenteComVagas}
                    />
                </div>
                {filtrosAtivos && (
                    <Button variant="ghost" iconeInicio={<X className="size-4" />} onClick={limparFiltros}>
                        Limpar filtros
                    </Button>
                )}
            </div>

            {visiveis.length === 0 ? (
                <Alert
                    tom="info"
                    titulo="Nenhuma atividade corresponde aos filtros"
                    acao={
                        <Button variant="secondary" onClick={limparFiltros}>
                            Limpar filtros
                        </Button>
                    }
                />
            ) : (
                <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {visiveis.map((a) => (
                        <li key={a.id}>
                            <CartaoAtividade
                                atividade={a}
                                elegivel={elegibilidade.elegivel}
                                ocupado={emAndamento}
                                aoAgir={(tipo, turno) => setAcao({ tipo, atividade: a, turno })}
                            />
                        </li>
                    ))}
                </ul>
            )}

            <Dialog
                open={acao !== null}
                onOpenChange={(aberto) => !aberto && !emAndamento && setAcao(null)}
                titulo={acao?.tipo === 'desistir' ? 'Desistir do turno?' : 'Confirmar inscrição'}
                acoes={
                    <>
                        <Button
                            variant="secondary"
                            iconeInicio={<X className="size-4" />}
                            disabled={emAndamento}
                            onClick={() => setAcao(null)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant={acao?.tipo === 'desistir' ? 'danger' : 'primary'}
                            iconeInicio={<Check className="size-4" />}
                            loading={emAndamento}
                            onClick={confirmar}
                        >
                            {acao?.tipo === 'desistir' ? 'Confirmar desistência' : 'Confirmar inscrição'}
                        </Button>
                    </>
                }
            >
                {acao && (
                    <div className="flex flex-col gap-2 text-base text-foreground">
                        <p className="font-semibold">{acao.atividade.titulo}</p>
                        <p>{acao.atividade.local}</p>
                        <p>
                            {formatarDiaCompleto(acao.turno.inicio)}, das {formatarHora(acao.turno.inicio)} às{' '}
                            {formatarHora(acao.turno.fim)}
                        </p>
                        {acao.tipo === 'desistir' && (
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                A vaga será liberada para outra pessoa.
                            </p>
                        )}
                    </div>
                )}
            </Dialog>
        </>
    )
}

function AvisoElegibilidade({ motivo }: { motivo: string }) {
    return (
        <Alert
            tom="info"
            titulo={motivo}
            acao={
                <Link
                    href="/voluntariado/candidatura"
                    className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-base font-medium text-foreground hover:bg-surface-muted"
                >
                    Quero ser voluntário
                </Link>
            }
        >
            Você pode ver as atividades, mas só se inscreve depois que o cadastro for aprovado.
        </Alert>
    )
}

function CartaoAtividade({
    atividade,
    elegivel,
    ocupado,
    aoAgir
}: {
    atividade: AtividadeNaVitrine
    elegivel: boolean
    ocupado: boolean
    aoAgir: (tipo: Acao['tipo'], turno: TurnoNaVitrine) => void
}) {
    const porDia = useMemo(() => {
        const grupos = new Map<string, TurnoNaVitrine[]>()
        for (const t of atividade.turnos) {
            const chave = diaDoTurno(t.inicio)
            grupos.set(chave, [...(grupos.get(chave) ?? []), t])
        }
        return [...grupos.values()]
    }, [atividade.turnos])

    return (
        <article className="flex h-full flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <header className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">{atividade.titulo}</h2>
                    <Badge cor="neutral">{atividade.categoria}</Badge>
                </div>
                <p className="flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400">
                    <MapPin aria-hidden className="size-4 shrink-0" />
                    {atividade.local}
                </p>
            </header>

            {porDia.map((turnos) => (
                <section key={turnos[0].id} className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold text-neutral-600 capitalize dark:text-neutral-300">
                        {formatarDia(turnos[0].inicio)}
                    </h3>
                    <ul className="flex flex-col gap-2">
                        {turnos.map((t) => (
                            <li key={t.id}>
                                <LinhaTurno turno={t} elegivel={elegivel} ocupado={ocupado} aoAgir={aoAgir} />
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </article>
    )
}

function LinhaTurno({
    turno,
    elegivel,
    ocupado,
    aoAgir
}: {
    turno: TurnoNaVitrine
    elegivel: boolean
    ocupado: boolean
    aoAgir: (tipo: Acao['tipo'], turno: TurnoNaVitrine) => void
}) {
    const estado = ESTADO[turno.estado]
    const textoVagas = `${Math.min(turno.preenchidas, turno.vagas)} de ${turno.vagas} vagas preenchidas`
    const aceitaInscricao = turno.estado === 'com_vagas' || turno.estado === 'ultimas_vagas'

    return (
        <div className="flex flex-col gap-3 rounded-lg bg-surface-muted p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base font-medium text-foreground">
                    {formatarHora(turno.inicio)} – {formatarHora(turno.fim)}
                </p>
                <Badge cor={estado.cor}>{estado.rotulo}</Badge>
            </div>

            <Progress
                label={textoVagas}
                value={Math.min(turno.preenchidas, turno.vagas)}
                max={turno.vagas}
                tom={estado.tom}
                mostrarValor={false}
            />

            {aceitaInscricao && elegivel && (
                <Button
                    fullWidth
                    iconeInicio={<CalendarPlus className="size-4" />}
                    disabled={ocupado}
                    onClick={() => aoAgir('inscrever', turno)}
                >
                    Quero participar
                </Button>
            )}

            {turno.estado === 'inscrito' &&
                (turno.podeDesistir ? (
                    <Button
                        variant="secondary"
                        fullWidth
                        iconeInicio={<LogOut className="size-4" />}
                        disabled={ocupado}
                        onClick={() => aoAgir('desistir', turno)}
                    >
                        Desistir
                    </Button>
                ) : (
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">
                        Para desistir, fale com a coordenação.
                    </p>
                ))}
        </div>
    )
}

const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const DIA = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo'
})
const DIA_COMPLETO = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'America/Sao_Paulo'
})

function formatarHora(iso: string) {
    return HORA.format(new Date(iso))
}

function formatarDia(iso: string) {
    return DIA.format(new Date(iso))
}

function formatarDiaCompleto(iso: string) {
    return DIA_COMPLETO.format(new Date(iso))
}
