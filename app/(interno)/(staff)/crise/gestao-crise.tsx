'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Alert, Button, NumberInput, Select, avisar } from '@/src/shared/ui'
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
    const [enviando, iniciarTransicao] = useTransition()

    const [familias, setFamilias] = useState(String(vigente?.totalFamiliasAfetadas ?? ''))
    const [pessoas, setPessoas] = useState(String(vigente?.totalPessoasAfetadas ?? ''))
    const [erro, setErro] = useState<string | null>(null)

    function salvarCrise() {
        setErro(null)
        iniciarTransicao(async () => {
            const resultado = await atualizarVariaveisCrise({
                totalFamiliasAfetadas: Number(familias),
                totalPessoasAfetadas: Number(pessoas)
            })

            if (!resultado.ok) {
                setErro(resultado.erro.mensagem)
                return
            }

            avisar.sucesso('Números atualizados', 'O painel de crise já reflete os novos valores.')
            router.refresh()
        })
    }

    return (
        <div className="flex flex-col gap-8">
            <section className="flex max-w-2xl flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">Números oficiais</h2>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        Cada atualização registra uma nova linha — o histórico anterior é preservado.
                    </p>
                </div>

                {erro && <Alert tom="danger" titulo={erro} />}

                <div className="grid gap-4 sm:grid-cols-2">
                    <NumberInput
                        id="familias"
                        label="Total de famílias afetadas"
                        min={0}
                        casasDecimais={0}
                        value={familias}
                        onValueChange={setFamilias}
                    />
                    <NumberInput
                        id="pessoas"
                        label="Total de pessoas afetadas"
                        min={0}
                        casasDecimais={0}
                        value={pessoas}
                        onValueChange={setPessoas}
                    />
                </div>

                <div className="flex justify-end">
                    <Button loading={enviando} onClick={salvarCrise}>
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
            </section>

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
    const [base, setBase] = useState<string[]>(metrica ? [metrica.baseDemanda] : [])
    const [proporcao, setProporcao] = useState(String(metrica?.proporcao ?? '1'))

    return (
        <li className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-lg font-semibold text-foreground">
                {kit.nome}
                {!kit.ativo && <span className="ml-2 text-sm font-normal text-neutral-500">(inativo)</span>}
            </p>

            <div className="grid items-end gap-3 sm:grid-cols-[1fr_10rem_auto]">
                <Select
                    id={`base-${kit.id}`}
                    label="Base de demanda"
                    placeholder="Sem métrica"
                    opcoes={BASES_DEMANDA.map((b) => ({ value: b, label: ROTULO_BASE_DEMANDA[b] }))}
                    value={base}
                    onValueChange={setBase}
                />
                <NumberInput
                    id={`prop-${kit.id}`}
                    label="Kits por unidade"
                    apoio="Ex.: 1 = um kit por família."
                    min={0}
                    value={proporcao}
                    onValueChange={setProporcao}
                    disabled={base.length === 0}
                />
                <Button
                    variant="secondary"
                    loading={enviando}
                    onClick={() => onSalvar(kit.id, (base[0] as BaseDemanda) ?? null, proporcao)}
                >
                    Salvar
                </Button>
            </div>
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
