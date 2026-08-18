'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Controller } from 'react-hook-form'
import { Check } from 'lucide-react'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { aplicarErrosDoServidor, quantidadePositiva, textoObrigatorio, useFormulario } from '@/src/shared/formulario'
import { Alert, Button, Formulario, NumberInput, Select, avisar } from '@/src/shared/ui'
import { BASES_DEMANDA, ROTULO_BASE_DEMANDA, type BaseDemanda } from '@/src/modules/logistica/domain/projecao'
import type {
    CriseVariaveis,
    MetricaKitConfigurada
} from '@/src/modules/logistica/application/ports/logistica-repository'
import {
    atualizarVariaveisCrise,
    definirMetricaKit,
    removerMetricaKit
} from '@/src/modules/logistica/presentation/actions/logistica'

/**
 * Variáveis da crise (BRD §5, LOG-02) e métricas de demanda por kit
 * (BR-INT-01, LOG-03) na mesma tela: são os dois insumos do cálculo de
 * "Kits Necessários", e separá-los faria o operador navegar entre telas para
 * entender de onde o número do painel vem.
 */

/**
 * Contagem de pessoas/famílias: inteiro, não negativo, **e obrigatório**.
 *
 * O obrigatório é o ponto. Antes, campo vazio virava `Number('') === 0` e era
 * enviado como zero — o painel de crise passava a dizer "0 famílias afetadas"
 * porque alguém não preencheu, sem nada na tela indicando isso. Um número
 * ausente e um número que vale zero são coisas diferentes.
 */
const contagem = (mensagem: string) =>
    textoObrigatorio(mensagem).refine(
        (valor) => Number.isInteger(Number(valor)) && Number(valor) >= 0,
        'Informe um número inteiro igual ou maior que zero.'
    )

const esquemaCrise = z.object({
    totalFamiliasAfetadas: contagem('Informe o total de famílias afetadas.'),
    totalPessoasAfetadas: contagem('Informe o total de pessoas afetadas.')
})

const CAMPOS_CRISE = Object.keys(esquemaCrise.shape)

type DadosCrise = z.infer<typeof esquemaCrise>

export function GestaoCrise({
    vigente,
    historico,
    kits,
    metricas
}: {
    vigente: CriseVariaveis | null
    historico: CriseVariaveis[]
    kits: { id: string; nome: string; ativo: boolean }[]
    metricas: MetricaKitConfigurada[]
}) {
    const router = useRouter()
    const [erro, setErro] = useState<string | null>(null)

    const {
        control,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting }
    } = useFormulario(esquemaCrise, {
        defaultValues: {
            totalFamiliasAfetadas: vigente ? String(vigente.totalFamiliasAfetadas) : '',
            totalPessoasAfetadas: vigente ? String(vigente.totalPessoasAfetadas) : ''
        }
    })

    async function salvarCrise(dados: DadosCrise) {
        setErro(null)

        const resultado = await atualizarVariaveisCrise({
            totalFamiliasAfetadas: Number(dados.totalFamiliasAfetadas),
            totalPessoasAfetadas: Number(dados.totalPessoasAfetadas)
        })

        if (!resultado.ok) {
            const { mensagemGeral } = aplicarErrosDoServidor({
                erro: resultado.erro,
                camposConhecidos: CAMPOS_CRISE,
                definirErro: (campo, msg) => setError(campo as keyof DadosCrise, { message: msg })
            })
            setErro(mensagemGeral)
            return
        }

        avisar.sucesso('Números atualizados', 'O painel de crise já reflete os novos valores.')
        router.refresh()
    }

    return (
        <div className="flex flex-col gap-8">
            <Formulario onSubmit={handleSubmit(salvarCrise)} className="flex max-w-2xl flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">Números oficiais</h2>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        Cada atualização registra uma nova linha — o histórico anterior é preservado.
                    </p>
                </div>

                {erro && <Alert tom="danger" titulo={erro} />}

                <div className="grid gap-4 sm:grid-cols-2">
                    <Controller
                        control={control}
                        name="totalFamiliasAfetadas"
                        render={({ field }) => (
                            <NumberInput
                                ref={field.ref}
                                id="familias"
                                label="Total de famílias afetadas"
                                obrigatorio
                                min={0}
                                casasDecimais={0}
                                value={field.value}
                                onValueChange={field.onChange}
                                erro={errors.totalFamiliasAfetadas?.message}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="totalPessoasAfetadas"
                        render={({ field }) => (
                            <NumberInput
                                ref={field.ref}
                                id="pessoas"
                                label="Total de pessoas afetadas"
                                obrigatorio
                                min={0}
                                casasDecimais={0}
                                value={field.value}
                                onValueChange={field.onChange}
                                erro={errors.totalPessoasAfetadas?.message}
                            />
                        )}
                    />
                </div>

                <div className="flex justify-end">
                    <Button type="submit" iconeInicio={<Check className="size-4" />} loading={isSubmitting}>
                        Atualizar números
                    </Button>
                </div>

                {historico.length > 0 && (
                    <details className="rounded-xl border border-border bg-surface p-4">
                        <summary className="cursor-pointer text-sm font-medium text-foreground">
                            Histórico de atualizações ({historico.length})
                        </summary>
                        <ul className="mt-3 flex flex-col gap-2">
                            {historico.map((h) => (
                                <li key={h.id} className="flex justify-between gap-2 text-sm">
                                    <span className="text-neutral-500 dark:text-neutral-400">
                                        {formatarDataHora(h.atualizadoEm)}
                                    </span>
                                    <span className="text-foreground">
                                        {h.totalFamiliasAfetadas} famílias · {h.totalPessoasAfetadas} pessoas
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </details>
                )}
            </Formulario>

            <MetricasKit kits={kits} metricas={metricas} />
        </div>
    )
}

function MetricasKit({
    kits,
    metricas
}: {
    kits: { id: string; nome: string; ativo: boolean }[]
    metricas: MetricaKitConfigurada[]
}) {
    const router = useRouter()
    const [enviando, iniciarTransicao] = useTransition()
    const [erro, setErro] = useState<string | null>(null)

    const porKit = new Map(metricas.map((m) => [m.kitId, m]))

    function salvar(kitId: string, baseDemanda: BaseDemanda | null, proporcao: string) {
        setErro(null)

        iniciarTransicao(async () => {
            const resultado = !baseDemanda
                ? await removerMetricaKit({ kitId })
                : await definirMetricaKit({ kitId, baseDemanda, proporcao: Number(proporcao) })

            if (!resultado.ok) {
                setErro(resultado.erro.mensagem)
                avisar.erro('Não foi possível salvar', resultado.erro.mensagem)
                return
            }

            avisar.sucesso('Métrica atualizada')
            router.refresh()
        })
    }

    return (
        <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">Métrica de demanda por kit</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Define quantos kits são necessários por família ou por pessoa afetada. Kits sem métrica não entram
                    no cálculo de demanda.
                </p>
            </div>

            {erro && <Alert tom="danger" titulo={erro} />}

            {kits.length === 0 ? (
                <Alert tom="info" titulo="Nenhum kit cadastrado">
                    Cadastre um kit e sua receita para poder configurar a demanda.
                </Alert>
            ) : (
                <ul className="flex flex-col gap-3">
                    {kits.map((kit) => (
                        <LinhaMetrica
                            key={kit.id}
                            kit={kit}
                            metrica={porKit.get(kit.id) ?? null}
                            enviando={enviando}
                            onSalvar={salvar}
                        />
                    ))}
                </ul>
            )}
        </section>
    )
}

/**
 * A proporção só é exigida quando existe base de demanda: sem base, salvar
 * significa **remover** a métrica do kit, e cobrar um número nesse caso
 * bloquearia justamente a ação de limpar.
 */
const esquemaMetrica = z
    .object({
        base: z.string().optional(),
        proporcao: z.string().optional()
    })
    .superRefine((dados, ctx) => {
        if (!dados.base) return

        const problema = quantidadePositiva('Informe quantos kits por unidade.').safeParse(dados.proporcao ?? '')
        if (!problema.success) {
            ctx.addIssue({ code: 'custom', path: ['proporcao'], message: problema.error.issues[0].message })
        }
    })

type DadosMetrica = z.infer<typeof esquemaMetrica>

function LinhaMetrica({
    kit,
    metrica,
    enviando,
    onSalvar
}: {
    kit: { id: string; nome: string; ativo: boolean }
    metrica: MetricaKitConfigurada | null
    enviando: boolean
    onSalvar: (kitId: string, baseDemanda: BaseDemanda | null, proporcao: string) => void
}) {
    const {
        control,
        handleSubmit,
        watch,
        formState: { errors }
    } = useFormulario(esquemaMetrica, {
        defaultValues: {
            base: metrica?.baseDemanda ?? '',
            proporcao: String(metrica?.proporcao ?? '1')
        }
    })

    const base = watch('base')

    function salvar(dados: DadosMetrica) {
        onSalvar(kit.id, (dados.base as BaseDemanda) || null, dados.proporcao ?? '')
    }

    return (
        <li className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <Formulario onSubmit={handleSubmit(salvar)} className="flex flex-col gap-3">
                <p className="text-lg font-semibold text-foreground">
                    {kit.nome}
                    {!kit.ativo && <span className="ml-2 text-sm font-normal text-neutral-500">(inativo)</span>}
                </p>

                <div className="grid items-start gap-3 sm:grid-cols-[1fr_10rem_auto]">
                    <Controller
                        control={control}
                        name="base"
                        render={({ field }) => (
                            <Select
                                ref={field.ref}
                                id={`base-${kit.id}`}
                                label="Base de demanda"
                                placeholder="Sem métrica"
                                opcoes={BASES_DEMANDA.map((b) => ({ value: b, label: ROTULO_BASE_DEMANDA[b] }))}
                                value={field.value ? [field.value] : []}
                                onValueChange={(v) => field.onChange(v[0] ?? '')}
                                erro={errors.base?.message}
                            />
                        )}
                    />
                    <Controller
                        control={control}
                        name="proporcao"
                        render={({ field }) => (
                            <NumberInput
                                ref={field.ref}
                                id={`prop-${kit.id}`}
                                label="Kits por unidade"
                                apoio="Ex.: 1 = um kit por família."
                                min={0}
                                value={field.value ?? ''}
                                onValueChange={field.onChange}
                                disabled={!base}
                                erro={errors.proporcao?.message}
                            />
                        )}
                    />
                    <Button
                        type="submit"
                        variant="secondary"
                        iconeInicio={<Check className="size-4" />}
                        loading={enviando}
                    >
                        Salvar
                    </Button>
                </div>
            </Formulario>
        </li>
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
