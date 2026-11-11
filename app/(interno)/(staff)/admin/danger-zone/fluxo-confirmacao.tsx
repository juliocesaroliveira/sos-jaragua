'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import { Alert } from '@/src/shared/ui/alert/alert'
import { Badge } from '@/src/shared/ui/badge/badge'
import { Button } from '@/src/shared/ui/button/button'
import { Dialog } from '@/src/shared/ui/dialog/dialog'
import { Input } from '@/src/shared/ui/input/input'
import { SkeletonLista } from '@/src/shared/ui/skeleton/skeleton'
import { avisar } from '@/src/shared/ui/toast/toast'
import { cn } from '@/src/shared/ui/cn'
import { signOut } from '@/src/shared/auth/client'
import {
    cancelarAcaoAction,
    executarAcaoAction,
    gerarPreviaAction
} from '@/src/modules/manutencao/presentation/actions/danger-zone'
import { ROTULO_AMBIENTE } from '@/src/modules/manutencao/presentation/ambiente'
import type { PedidoAcao, Previa, ResultadoExecucao } from '@/src/modules/manutencao/domain/previa'
import type { Modo } from '@/src/modules/manutencao/domain/grafo'
import { RAIZ_DANGER_ZONE } from './chaves'

type Passo = 'carregando' | 'resumo' | 'modo' | 'impacto' | 'confirmacao' | 'resultado' | 'erro'

type Props = {
    pedidoInicial: PedidoAcao
    rotuloTabela: string
    onFechar: () => void
    onConcluido: () => void
}

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

const ROTA = '/admin/danger-zone'

/**
 * Fluxo de confirmação em passos (U-05, FR-010 a FR-015a).
 *
 * Nenhum passo executa nada antes do último: resumo → modo (só com dependentes
 * de histórico) → impacto → confirmação digitada → resultado. Cada avanço que
 * muda o modo pede uma prévia nova ao servidor — o que a tela mostra é sempre
 * o que o servidor calculou, nunca uma conta feita no cliente.
 */
export function FluxoConfirmacao({ pedidoInicial, rotuloTabela, onFechar, onConcluido }: Props) {
    const queryClient = useQueryClient()
    const [passo, setPasso] = useState<Passo>('carregando')
    const [previa, setPrevia] = useState<Previa | null>(null)
    const [erro, setErro] = useState<string | null>(null)
    const [aviso, setAviso] = useState<string | null>(null)
    const [digitado, setDigitado] = useState('')
    const [executando, setExecutando] = useState(false)
    const [reautenticar, setReautenticar] = useState(false)
    const [resultado, setResultado] = useState<ResultadoExecucao | null>(null)
    const iniciou = useRef(false)
    const idConfirmacao = useId()

    async function carregarPrevia(pedido: PedidoAcao, proximo: Passo) {
        setPasso('carregando')
        const r = await gerarPreviaAction(pedido)
        if (!r.ok) {
            setErro(r.erro.mensagem)
            setPasso('erro')
            return
        }
        setPrevia(r.valor)
        setPasso(proximo)
    }

    useEffect(() => {
        if (iniciou.current) return
        iniciou.current = true
        void carregarPrevia(pedidoInicial, 'resumo')
    }, [pedidoInicial])

    function escolherModo(modo: Modo) {
        void carregarPrevia({ ...pedidoInicial, modo }, 'impacto')
    }

    async function cancelar() {
        // Só a partir do impacto há o que registrar: antes disso o
        // administrador ainda não viu o que a ação faria (C-05).
        if (previa && (passo === 'impacto' || passo === 'confirmacao')) {
            void cancelarAcaoAction({ pedido: previa.pedido, impressaoDigital: previa.impressaoDigital })
        }
        onFechar()
    }

    async function executar() {
        if (!previa) return
        setExecutando(true)
        setAviso(null)
        const r = await executarAcaoAction({
            pedido: previa.pedido,
            impressaoDigital: previa.impressaoDigital,
            confirmacao: digitado
        })
        setExecutando(false)

        if (r.ok) {
            setResultado(r.valor)
            setPasso('resultado')
            await queryClient.invalidateQueries({ queryKey: RAIZ_DANGER_ZONE })
            avisar.sucesso('Ação executada', `${rotuloTabela}: concluído e registrado na auditoria.`)
            onConcluido()
            return
        }

        if (r.erro.codigo === 'reautenticacao_necessaria') {
            setReautenticar(true)
            setAviso(r.erro.mensagem)
            return
        }
        if (r.erro.codigo === 'dados_mudaram' && r.erro.detalhes?.previa) {
            setPrevia(r.erro.detalhes.previa as Previa)
            setDigitado('')
            setAviso(r.erro.mensagem)
            setPasso('impacto')
            return
        }
        setAviso(r.erro.mensagem)
    }

    async function entrarNovamente() {
        await signOut()
        window.location.href = `/login?redirecionar=${encodeURIComponent(ROTA)}`
    }

    const titulo =
        pedidoInicial.acao === 'resetar_tabela'
            ? `Resetar ${rotuloTabela}`
            : `Excluir ${pedidoInicial.chaves?.length ?? 0} registro(s) de ${rotuloTabela}`

    const confere = previa !== null && digitado === previa.textoConfirmacao

    return (
        <Dialog
            open
            onOpenChange={(aberto) => {
                if (!aberto && !executando) void cancelar()
            }}
            titulo={titulo}
            descricao="Revise o impacto antes de confirmar. Nada é alterado até o último passo."
            tamanho="lg"
            acoes={
                <Rodape
                    passo={passo}
                    previa={previa}
                    executando={executando}
                    confere={confere}
                    reautenticar={reautenticar}
                    onCancelar={cancelar}
                    onAvancar={() => {
                        if (passo === 'resumo') setPasso(previa?.modo === null ? 'modo' : 'impacto')
                        else if (passo === 'impacto') setPasso('confirmacao')
                    }}
                    onVoltar={() => {
                        if (passo === 'confirmacao') setPasso('impacto')
                        else if (passo === 'impacto' && previa?.temDependentes) setPasso('modo')
                        else setPasso('resumo')
                    }}
                    onExecutar={executar}
                    onEntrarNovamente={entrarNovamente}
                    onFechar={onFechar}
                />
            }
        >
            <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto pr-1">
                {aviso && (
                    <Alert
                        tom={reautenticar ? 'warning' : 'danger'}
                        titulo={reautenticar ? 'Login necessário' : 'Atenção'}
                    >
                        {aviso}
                    </Alert>
                )}

                {passo === 'carregando' && <SkeletonLista linhas={4} />}
                {passo === 'erro' && (
                    <Alert tom="danger" titulo="Não foi possível calcular o impacto">
                        {erro}
                    </Alert>
                )}
                {passo === 'resumo' && previa && <PassoResumo previa={previa} rotuloTabela={rotuloTabela} />}
                {passo === 'modo' && previa && <PassoModo previa={previa} onEscolher={escolherModo} />}
                {passo === 'impacto' && previa && <PassoImpacto previa={previa} />}
                {passo === 'confirmacao' && previa && (
                    <div className="flex flex-col gap-3">
                        <p className="text-sm text-foreground">
                            Você está em <strong>{ROTULO_AMBIENTE[previa.ambiente]}</strong>. Esta ação vai apagar{' '}
                            <strong>{numero.format(previa.totalApagar)}</strong> registro(s)
                            {previa.totalAlterar > 0 && (
                                <>
                                    {' '}
                                    e alterar <strong>{numero.format(previa.totalAlterar)}</strong>
                                </>
                            )}
                            . Não há como desfazer pela aplicação.
                        </p>
                        <Input
                            id={idConfirmacao}
                            label={`Digite ${previa.textoConfirmacao} para confirmar`}
                            value={digitado}
                            onChange={(e) => setDigitado(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                            apoio={
                                confere
                                    ? 'Confere.'
                                    : 'O botão Executar só é liberado com o texto exato, incluindo maiúsculas.'
                            }
                        />
                    </div>
                )}
                {passo === 'resultado' && resultado && <PassoResultado resultado={resultado} />}
            </div>
        </Dialog>
    )
}

function Rodape(props: {
    passo: Passo
    previa: Previa | null
    executando: boolean
    confere: boolean
    reautenticar: boolean
    onCancelar: () => void
    onAvancar: () => void
    onVoltar: () => void
    onExecutar: () => void
    onEntrarNovamente: () => void
    onFechar: () => void
}) {
    const { passo } = props
    if (passo === 'resultado' || passo === 'erro') {
        return <Button onClick={props.onFechar}>Fechar</Button>
    }
    return (
        <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={props.onCancelar} disabled={props.executando}>
                Cancelar
            </Button>
            {(passo === 'impacto' || passo === 'confirmacao' || passo === 'modo') && (
                <Button variant="secondary" onClick={props.onVoltar} disabled={props.executando}>
                    Voltar
                </Button>
            )}
            {(passo === 'resumo' || passo === 'impacto') && (
                <Button onClick={props.onAvancar} disabled={!props.previa}>
                    {passo === 'impacto' ? 'Continuar para confirmação' : 'Ver impacto'}
                </Button>
            )}
            {passo === 'confirmacao' &&
                (props.reautenticar ? (
                    <Button variant="danger" onClick={props.onEntrarNovamente}>
                        Entrar novamente
                    </Button>
                ) : (
                    <Button
                        variant="danger"
                        onClick={props.onExecutar}
                        disabled={!props.confere}
                        loading={props.executando}
                        aria-describedby={props.confere ? undefined : 'dz-motivo-desabilitado'}
                    >
                        Executar
                    </Button>
                ))}
            {passo === 'confirmacao' && !props.confere && (
                <span id="dz-motivo-desabilitado" className="sr-only">
                    Digite o texto de confirmação exatamente como pedido para liberar.
                </span>
            )}
        </div>
    )
}

function PassoResumo({ previa, rotuloTabela }: { previa: Previa; rotuloTabela: string }) {
    const raiz = previa.arvore.find((n) => n.nivel === 0)
    return (
        <div className="flex flex-col gap-3 text-sm text-foreground">
            <p>
                <strong>
                    {previa.pedido.acao === 'resetar_tabela' ? 'Resetar a tabela' : 'Excluir registros selecionados de'}
                </strong>{' '}
                {rotuloTabela} (<code>{previa.pedido.tabela}</code>):{' '}
                <strong>{numero.format(raiz?.apagar ?? 0)}</strong> registro(s) serão apagados.
            </p>
            {previa.alertas.map((a) => (
                <Alert key={a} tom="warning" titulo="Efeito no acesso das pessoas">
                    {a}
                </Alert>
            ))}
            <ul className="list-disc space-y-1 pl-5">
                {previa.consequencias.map((c) => (
                    <li key={c}>{c}</li>
                ))}
            </ul>
            {previa.modo === null && (
                <p className="font-medium">
                    Há registros em outras tabelas que dependem destes. No próximo passo você escolhe o que fazer com
                    eles.
                </p>
            )}
        </div>
    )
}

function PassoModo({ previa, onEscolher }: { previa: Previa; onEscolher: (m: Modo) => void }) {
    const opcoes = previa.opcoes
    const cartao =
        'flex flex-col gap-2 rounded-xl border-2 border-border p-4 text-left hover:border-danger-500 focus-visible:border-danger-500'
    return (
        <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm text-foreground">
                Existem registros que documentam algo que aconteceu (movimentações, turnos, autoria). Escolha:
            </legend>
            <div className="grid gap-3 md:grid-cols-2">
                <button type="button" className={cartao} onClick={() => onEscolher('cascata')}>
                    <span className="font-semibold text-danger-700 dark:text-danger-400">Apagar em cascata</span>
                    <span className="text-sm text-foreground">
                        Apaga também todos os dependentes, em qualquer nível.
                    </span>
                    {opcoes && (
                        <span className="text-sm font-medium tabular-nums">
                            {numero.format(opcoes.cascata.apagar)} registro(s) apagados
                        </span>
                    )}
                </button>
                <button type="button" className={cartao} onClick={() => onEscolher('preservacao')}>
                    <span className="font-semibold text-foreground">Preservar dependentes</span>
                    <span className="text-sm text-foreground">
                        Mantém o histórico: os vínculos passam a apontar para um valor padrão (vazio ou “… removido”).
                    </span>
                    {opcoes && (
                        <span className="text-sm font-medium tabular-nums">
                            {numero.format(opcoes.preservacao.apagar)} apagados ·{' '}
                            {numero.format(opcoes.preservacao.alterar)} alterados
                        </span>
                    )}
                </button>
            </div>
        </fieldset>
    )
}

function PassoImpacto({ previa }: { previa: Previa }) {
    const amostra = new Map(previa.amostras.map((a) => [a.tabela, a]))
    return (
        <div className="flex flex-col gap-5 text-sm text-foreground">
            <p>
                Modo:{' '}
                <Badge cor={previa.modo === 'cascata' ? 'danger' : 'neutral'}>
                    {previa.modo === 'cascata'
                        ? 'Cascata'
                        : previa.modo === 'preservacao'
                          ? 'Preservação'
                          : 'Sem dependentes de histórico'}
                </Badge>
            </p>

            <section className="flex flex-col gap-2">
                <h3 className="font-semibold">Registros que serão apagados</h3>
                <ul className="flex flex-col gap-2">
                    {previa.arvore
                        .filter((n) => n.apagar > 0)
                        .map((n) => (
                            <li
                                key={n.tabela}
                                className={cn('rounded-lg border border-border p-3')}
                                style={{ marginLeft: `${Math.min(n.nivel, 4) * 0.75}rem` }}
                            >
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <span className="font-medium">
                                        {n.rotulo} <code className="text-xs text-neutral-500">{n.tabela}</code>
                                    </span>
                                    <span className="font-semibold tabular-nums text-danger-700 dark:text-danger-400">
                                        {numero.format(n.apagar)}
                                    </span>
                                </div>
                                {n.via && (
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                        via <code>{n.via}</code> ·{' '}
                                        {n.classificacao === 'inseparavel' ? 'inseparável' : 'histórico'}
                                    </p>
                                )}
                                {amostra.get(n.tabela) && (
                                    <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                                        {amostra.get(n.tabela)!.itens.join('; ')}
                                        {amostra.get(n.tabela)!.restante > 0 &&
                                            ` e mais ${numero.format(amostra.get(n.tabela)!.restante)} registro(s)`}
                                    </p>
                                )}
                            </li>
                        ))}
                </ul>
                <p className="font-medium">Total: {numero.format(previa.totalApagar)} registro(s) apagados.</p>
            </section>

            {previa.inseparaveis.length > 0 && (
                <section className="flex flex-col gap-1">
                    <h3 className="font-semibold">Apagados em qualquer modo</h3>
                    <p className="text-neutral-600 dark:text-neutral-300">
                        Estes registros não existem sem o registro principal:{' '}
                        {previa.inseparaveis.map((n) => `${n.rotulo} (${numero.format(n.apagar)})`).join(', ')}.
                    </p>
                </section>
            )}

            {previa.redirecionamentos.length > 0 && (
                <section className="flex flex-col gap-1">
                    <h3 className="font-semibold">Vínculos que passarão a apontar para um valor padrão</h3>
                    <ul className="list-disc pl-5">
                        {previa.redirecionamentos.map((r) => (
                            <li key={r.vinculo}>
                                <code>{r.vinculo}</code>: {numero.format(r.quantidade)} registro(s) →{' '}
                                <strong>{r.valorPadrao}</strong>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {previa.preservados.length > 0 && (
                <section className="flex flex-col gap-1">
                    <h3 className="font-semibold">Registros preservados</h3>
                    <ul className="list-disc pl-5">
                        {previa.preservados.map((p) => (
                            <li key={p.descricao}>
                                {p.descricao} — {p.motivo}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {previa.saldos.length > 0 && (
                <section className="flex flex-col gap-1">
                    <h3 className="font-semibold">Saldos de estoque recalculados</h3>
                    <ul className="flex flex-col gap-1">
                        {previa.saldos.map((s) => (
                            <li
                                key={s.itemId}
                                className={cn(
                                    'flex justify-between gap-2',
                                    s.negativo && 'font-semibold text-danger-700 dark:text-danger-400'
                                )}
                            >
                                <span>{s.item}</span>
                                <span className="tabular-nums">
                                    {numero.format(s.atual)} → {numero.format(s.resultante)}
                                    {s.negativo && ' (negativo)'}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    )
}

function PassoResultado({ resultado }: { resultado: ResultadoExecucao }) {
    const linhas = Object.entries(resultado.contagens)
    return (
        <div className="flex flex-col gap-3 text-sm text-foreground">
            <Alert tom="success" titulo="Ação concluída">
                Registrada na trilha de auditoria (execução <code>{resultado.execucaoId.slice(0, 8)}</code>).
            </Alert>
            <ul className="flex flex-col gap-1">
                {linhas.map(([tabela, c]) => (
                    <li key={tabela} className="flex justify-between gap-2">
                        <code>{tabela}</code>
                        <span className="tabular-nums">
                            {numero.format(c.apagar)} apagado(s)
                            {Object.values(c.redirecionar).reduce((a, n) => a + n, 0) > 0 &&
                                ` · ${numero.format(Object.values(c.redirecionar).reduce((a, n) => a + n, 0))} alterado(s)`}
                        </span>
                    </li>
                ))}
            </ul>
            {resultado.saldos.length > 0 && (
                <p>
                    Saldos recalculados:{' '}
                    {resultado.saldos.map((s) => `${s.item} = ${numero.format(s.resultante)}`).join('; ')}.
                </p>
            )}
        </div>
    )
}
