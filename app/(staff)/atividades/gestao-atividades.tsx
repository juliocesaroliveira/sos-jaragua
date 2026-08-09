'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import {
    Alert,
    Badge,
    Button,
    COR_STATUS_ATIVIDADE,
    Dialog,
    Input,
    Menu,
    NumberInput,
    ROTULO_STATUS_ATIVIDADE,
    Select,
    avisar
} from '@/src/shared/ui'
import { DURACAO_TURNO_HORAS } from '@/src/modules/voluntariado/domain/turno'
import type { LinhaAtividade } from '@/src/modules/voluntariado/presentation/queries/atividades'
import type { Lookup } from '@/src/modules/voluntariado/presentation/queries/lookups'
import { alterarStatusAtividade, criarAtividade } from '@/src/modules/voluntariado/presentation/actions/atividades'

/**
 * CRUD de atividades (VOL-08) com a fragmentação em turnos de 4h (VOL-09).
 *
 * A tela não deixa escolher a duração do turno: a regra de 4h é do domínio
 * (BR-VOL-04), então o formulário pede **quantos** turnos consecutivos criar a
 * partir de um horário inicial — e o servidor recusa qualquer bloco diferente.
 */
export function GestaoAtividades({ atividades, categorias }: { atividades: LinhaAtividade[]; categorias: Lookup[] }) {
    const router = useRouter()
    const [emAndamento, iniciarTransicao] = useTransition()
    const [criando, setCriando] = useState(false)

    const [titulo, setTitulo] = useState('')
    const [categoriaId, setCategoriaId] = useState<string[]>([])
    const [local, setLocal] = useState('')
    const [inicio, setInicio] = useState('')
    const [quantidadeTurnos, setQuantidadeTurnos] = useState('2')
    const [vagasPorTurno, setVagasPorTurno] = useState('5')
    const [erro, setErro] = useState<string | null>(null)

    function limpar() {
        setTitulo('')
        setCategoriaId([])
        setLocal('')
        setInicio('')
        setQuantidadeTurnos('2')
        setVagasPorTurno('5')
        setErro(null)
    }

    function salvar() {
        setErro(null)
        iniciarTransicao(async () => {
            const resultado = await criarAtividade({
                titulo,
                categoriaId: categoriaId[0] ?? '',
                local,
                primeiroTurnoInicio: inicio,
                quantidadeTurnos: Number(quantidadeTurnos),
                vagasPorTurno: Number(vagasPorTurno)
            })

            if (!resultado.ok) {
                setErro(resultado.erro.mensagem)
                return
            }

            avisar.sucesso('Atividade criada', `${quantidadeTurnos} turno(s) de ${DURACAO_TURNO_HORAS}h gerados.`)
            setCriando(false)
            limpar()
            router.refresh()
        })
    }

    function mudarStatus(id: string, status: 'aberta' | 'encerrada' | 'cancelada') {
        iniciarTransicao(async () => {
            const resultado = await alterarStatusAtividade({ id, status })
            if (!resultado.ok) {
                avisar.erro('Não foi possível alterar', resultado.erro.mensagem)
                return
            }
            avisar.sucesso(`Atividade ${ROTULO_STATUS_ATIVIDADE[status].toLowerCase()}`)
            router.refresh()
        })
    }

    return (
        <>
            <div className="flex justify-end">
                <Button iconeInicio={<Plus aria-hidden className="size-5" />} onClick={() => setCriando(true)}>
                    Nova atividade
                </Button>
            </div>

            {atividades.length === 0 ? (
                <Alert tom="info" titulo="Nenhuma atividade cadastrada">
                    Crie uma atividade para começar a montar a escala de voluntários.
                </Alert>
            ) : (
                <ul className="flex flex-col gap-3">
                    {atividades.map((a) => {
                        const deficit = a.vagasPreenchidas < a.vagasTotais
                        return (
                            <li
                                key={a.id}
                                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="flex min-w-0 flex-col gap-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Link
                                            href={`/atividades/${a.id}`}
                                            className="text-lg font-semibold text-foreground underline-offset-4 hover:underline"
                                        >
                                            {a.titulo}
                                        </Link>
                                        <Badge cor={COR_STATUS_ATIVIDADE[a.status]}>
                                            {ROTULO_STATUS_ATIVIDADE[a.status]}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                        {a.categoria} · {a.local} · {a.totalTurnos} turno(s)
                                    </p>
                                    <p
                                        className={
                                            deficit
                                                ? 'text-sm text-danger-700 dark:text-danger-300'
                                                : 'text-sm text-neutral-500'
                                        }
                                    >
                                        {a.vagasPreenchidas} de {a.vagasTotais} vagas preenchidas
                                        {deficit && ` — faltam ${a.vagasTotais - a.vagasPreenchidas}`}
                                    </p>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                    <Link
                                        href={`/atividades/${a.id}`}
                                        className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-base font-medium text-foreground hover:bg-surface-muted"
                                    >
                                        Abrir escala
                                    </Link>
                                    <Menu
                                        gatilho={<Button variant="secondary">Ações</Button>}
                                        itens={[
                                            {
                                                value: 'encerrar',
                                                label: 'Encerrar',
                                                disabled: a.status !== 'aberta',
                                                onSelect: () => mudarStatus(a.id, 'encerrada')
                                            },
                                            {
                                                value: 'cancelar',
                                                label: 'Cancelar atividade',
                                                destrutivo: true,
                                                disabled: a.status === 'cancelada',
                                                onSelect: () => mudarStatus(a.id, 'cancelada')
                                            },
                                            {
                                                value: 'reabrir',
                                                label: 'Reabrir',
                                                disabled: a.status === 'aberta',
                                                onSelect: () => mudarStatus(a.id, 'aberta')
                                            }
                                        ]}
                                    />
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}

            <Dialog
                open={criando}
                onOpenChange={(aberto) => {
                    setCriando(aberto)
                    if (!aberto) limpar()
                }}
                titulo="Nova atividade"
                descricao={`Os turnos são gerados em blocos consecutivos de ${DURACAO_TURNO_HORAS} horas.`}
                tamanho="lg"
                acoes={
                    <>
                        <Button variant="secondary" onClick={() => setCriando(false)}>
                            Cancelar
                        </Button>
                        <Button loading={emAndamento} onClick={salvar}>
                            Criar atividade
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    {erro && <Alert tom="danger" titulo={erro} />}

                    <Input
                        id="titulo"
                        label="Título"
                        obrigatorio
                        value={titulo}
                        onChange={(e) => setTitulo(e.target.value)}
                    />
                    <Select
                        id="categoriaId"
                        label="Categoria"
                        obrigatorio
                        opcoes={categorias.map((c) => ({ value: c.id, label: c.nome }))}
                        value={categoriaId}
                        onValueChange={setCategoriaId}
                    />
                    <Input
                        id="local"
                        label="Local"
                        obrigatorio
                        value={local}
                        onChange={(e) => setLocal(e.target.value)}
                    />
                    <Input
                        id="inicio"
                        label="Início do primeiro turno"
                        type="datetime-local"
                        obrigatorio
                        value={inicio}
                        onChange={(e) => setInicio(e.target.value)}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <NumberInput
                            id="quantidadeTurnos"
                            label="Quantidade de turnos"
                            apoio={`Cada turno tem ${DURACAO_TURNO_HORAS} horas.`}
                            min={1}
                            max={12}
                            casasDecimais={0}
                            value={quantidadeTurnos}
                            onValueChange={setQuantidadeTurnos}
                        />
                        <NumberInput
                            id="vagasPorTurno"
                            label="Vagas por turno"
                            min={1}
                            casasDecimais={0}
                            value={vagasPorTurno}
                            onValueChange={setVagasPorTurno}
                        />
                    </div>
                </div>
            </Dialog>
        </>
    )
}
