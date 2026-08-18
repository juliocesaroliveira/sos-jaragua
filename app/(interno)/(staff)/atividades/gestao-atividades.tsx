'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Controller } from 'react-hook-form'
import { ClipboardList, MoreVertical, Plus, X } from 'lucide-react'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { aplicarErrosDoServidor, textoObrigatorio, useFormulario } from '@/src/shared/formulario'
import {
    Alert,
    Badge,
    Button,
    COR_STATUS_ATIVIDADE,
    Dialog,
    Formulario,
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
const inteiroEntre = (minimo: number, maximo: number, mensagem: string) =>
    textoObrigatorio(mensagem).refine((valor) => {
        const numero = Number(valor)
        return Number.isInteger(numero) && numero >= minimo && numero <= maximo
    }, `Informe um número inteiro entre ${minimo} e ${maximo}.`)

const esquema = z.object({
    titulo: textoObrigatorio('Informe o título da atividade.'),
    categoriaId: textoObrigatorio('Selecione a categoria.'),
    local: textoObrigatorio('Informe o local.'),
    primeiroTurnoInicio: textoObrigatorio('Informe o início do primeiro turno.'),
    quantidadeTurnos: inteiroEntre(1, 12, 'Informe a quantidade de turnos.'),
    vagasPorTurno: inteiroEntre(1, 999, 'Informe as vagas por turno.')
})

/** Campos que este formulário conhece — usado ao distribuir a recusa do servidor (FR-012). */
const CAMPOS = Object.keys(esquema.shape)

type DadosFormulario = z.infer<typeof esquema>

const VALORES_INICIAIS: DadosFormulario = {
    titulo: '',
    categoriaId: '',
    local: '',
    primeiroTurnoInicio: '',
    quantidadeTurnos: '2',
    vagasPorTurno: '5'
}
export function GestaoAtividades({ atividades, categorias }: { atividades: LinhaAtividade[]; categorias: Lookup[] }) {
    const router = useRouter()
    const [emAndamento, iniciarTransicao] = useTransition()
    const [criando, setCriando] = useState(false)

    const [erro, setErro] = useState<string | null>(null)

    const {
        control,
        register,
        handleSubmit,
        setError,
        reset,
        formState: { errors }
    } = useFormulario(esquema, { defaultValues: VALORES_INICIAIS })

    // Reabrir o diálogo recomeça do zero, sem valores nem mensagens de erro do
    // envio anterior (FR-016).
    useEffect(() => {
        if (!criando) return
        setErro(null)
        reset(VALORES_INICIAIS)
    }, [criando, reset])

    function salvar(dados: DadosFormulario) {
        setErro(null)
        iniciarTransicao(async () => {
            const resultado = await criarAtividade({
                titulo: dados.titulo,
                categoriaId: dados.categoriaId,
                local: dados.local,
                primeiroTurnoInicio: dados.primeiroTurnoInicio,
                quantidadeTurnos: Number(dados.quantidadeTurnos),
                vagasPorTurno: Number(dados.vagasPorTurno)
            })

            if (!resultado.ok) {
                const { mensagemGeral } = aplicarErrosDoServidor({
                    erro: resultado.erro,
                    camposConhecidos: CAMPOS,
                    definirErro: (campo, msg) => setError(campo as keyof DadosFormulario, { message: msg })
                })
                setErro(mensagemGeral)
                return
            }

            avisar.sucesso('Atividade criada', `${dados.quantidadeTurnos} turno(s) de ${DURACAO_TURNO_HORAS}h gerados.`)
            setCriando(false)
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
                                    <Link href={`/atividades/${a.id}`}>
                                        <Button
                                            variant="secondary"
                                            iconeInicio={<ClipboardList aria-hidden className="size-4" />}
                                        >
                                            Abrir escala
                                        </Button>
                                    </Link>
                                    <Menu
                                        gatilho={
                                            <Button
                                                variant="secondary"
                                                iconeInicio={<MoreVertical className="size-4" />}
                                            />
                                        }
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
                onOpenChange={setCriando}
                titulo="Nova atividade"
                descricao={`Os turnos são gerados em blocos consecutivos de ${DURACAO_TURNO_HORAS} horas.`}
                tamanho="lg"
                acoes={
                    <>
                        <Button
                            variant="secondary"
                            iconeInicio={<X className="size-4" />}
                            onClick={() => setCriando(false)}
                        >
                            Cancelar
                        </Button>
                        {/* Fora do `<form>`: o `form=` é o que liga o botão a ele. */}
                        <Button
                            type="submit"
                            form="atividade-form"
                            iconeInicio={<Plus className="size-4" />}
                            loading={emAndamento}
                        >
                            Criar atividade
                        </Button>
                    </>
                }
            >
                <Formulario id="atividade-form" onSubmit={handleSubmit(salvar)} className="flex flex-col gap-4">
                    {erro && <Alert tom="danger" titulo={erro} />}

                    <Input
                        id="titulo"
                        label="Título"
                        obrigatorio
                        erro={errors.titulo?.message}
                        {...register('titulo')}
                    />
                    <Controller
                        control={control}
                        name="categoriaId"
                        render={({ field }) => (
                            <Select
                                ref={field.ref}
                                id="categoriaId"
                                label="Categoria"
                                obrigatorio
                                opcoes={categorias.map((c) => ({ value: c.id, label: c.nome }))}
                                value={field.value ? [field.value] : []}
                                onValueChange={(v) => field.onChange(v[0] ?? '')}
                                erro={errors.categoriaId?.message}
                            />
                        )}
                    />
                    <Input id="local" label="Local" obrigatorio erro={errors.local?.message} {...register('local')} />
                    <Input
                        id="inicio"
                        label="Início do primeiro turno"
                        type="datetime-local"
                        obrigatorio
                        erro={errors.primeiroTurnoInicio?.message}
                        {...register('primeiroTurnoInicio')}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Controller
                            control={control}
                            name="quantidadeTurnos"
                            render={({ field }) => (
                                <NumberInput
                                    ref={field.ref}
                                    id="quantidadeTurnos"
                                    label="Quantidade de turnos"
                                    obrigatorio
                                    apoio={`Cada turno tem ${DURACAO_TURNO_HORAS} horas.`}
                                    min={1}
                                    max={12}
                                    casasDecimais={0}
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    erro={errors.quantidadeTurnos?.message}
                                />
                            )}
                        />
                        <Controller
                            control={control}
                            name="vagasPorTurno"
                            render={({ field }) => (
                                <NumberInput
                                    ref={field.ref}
                                    id="vagasPorTurno"
                                    label="Vagas por turno"
                                    obrigatorio
                                    min={1}
                                    casasDecimais={0}
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    erro={errors.vagasPorTurno?.message}
                                />
                            )}
                        />
                    </div>
                </Formulario>
            </Dialog>
        </>
    )
}
