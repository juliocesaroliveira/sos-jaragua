'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Eye, Trash2, X } from 'lucide-react'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { aplicarErrosDoServidor, textoObrigatorio, useFormulario } from '@/src/shared/formulario'
import { Alert, Badge, Button, Dialog, Formulario, Textarea, avisar } from '@/src/shared/ui'
import { formatarCep, formatarCpf, formatarTelefone } from '@/src/modules/identidade/domain'
import { ROTULO_DISPONIBILIDADE, ROTULO_TIPO_VEICULO } from '@/src/modules/voluntariado/domain/candidatura'
import type { CandidaturaPendente } from '@/src/modules/voluntariado/presentation/queries/candidaturas'
import { aprovarCandidatura, rejeitarCandidatura } from '@/src/modules/voluntariado/presentation/actions/triagem'

/**
 * Fila de Cadastros Pendentes (BR-VOL-01/02, VOL-04).
 *
 * A lista é renderizada como cards e não como tabela: em campo a triagem é
 * feita no celular, e cada decisão precisa dos dados completos à vista.
 */

/**
 * O mínimo de 5 caracteres é a mesma regra que o domínio aplica
 * (`rejeitar-candidatura.ts`). Repeti-la aqui não é duplicação por descuido: é
 * o que evita que o coordenador escreva "não" e só descubra depois da ida ao
 * servidor que o candidato precisa de um motivo aproveitável para reenviar.
 */
const esquema = z.object({
    motivo: textoObrigatorio('Informe o motivo da rejeição.').min(5, 'Descreva o motivo com ao menos 5 caracteres.')
})

const CAMPOS = Object.keys(esquema.shape)

type DadosRejeicao = z.infer<typeof esquema>
export function FilaTriagem({ candidaturas }: { candidaturas: CandidaturaPendente[] }) {
    const router = useRouter()
    const [emAndamento, iniciarTransicao] = useTransition()
    const [detalhe, setDetalhe] = useState<CandidaturaPendente | null>(null)
    const [aRejeitar, setARejeitar] = useState<CandidaturaPendente | null>(null)
    const [erroGeral, setErroGeral] = useState<string | null>(null)

    const {
        register,
        handleSubmit,
        setError,
        reset,
        formState: { errors }
    } = useFormulario(esquema, { defaultValues: { motivo: '' } })

    // Cada rejeição começa com o campo limpo: o motivo escrito para uma
    // candidatura não pode reaparecer na seguinte (FR-016).
    useEffect(() => {
        if (!aRejeitar) return
        setErroGeral(null)
        reset({ motivo: '' })
    }, [aRejeitar, reset])

    function aprovar(candidatura: CandidaturaPendente) {
        iniciarTransicao(async () => {
            const resultado = await aprovarCandidatura({ perfilId: candidatura.id })
            if (!resultado.ok) {
                avisar.erro('Não foi possível aprovar', resultado.erro.mensagem)
                return
            }
            avisar.sucesso('Candidatura aprovada', `${candidatura.nomeCompleto} agora é voluntário.`)
            setDetalhe(null)
            router.refresh()
        })
    }

    function confirmarRejeicao(dados: DadosRejeicao) {
        if (!aRejeitar) return
        setErroGeral(null)

        iniciarTransicao(async () => {
            const resultado = await rejeitarCandidatura({ perfilId: aRejeitar.id, motivo: dados.motivo })
            if (!resultado.ok) {
                const { mensagemGeral } = aplicarErrosDoServidor({
                    erro: resultado.erro,
                    camposConhecidos: CAMPOS,
                    definirErro: (campo, msg) => setError(campo as keyof DadosRejeicao, { message: msg })
                })
                setErroGeral(mensagemGeral)
                return
            }
            avisar.info('Candidatura rejeitada', `${aRejeitar.nomeCompleto} foi notificado do motivo.`)
            setARejeitar(null)
            setDetalhe(null)
            router.refresh()
        })
    }

    if (candidaturas.length === 0) {
        return <Alert tom="success" titulo="Nenhuma candidatura aguardando triagem" />
    }

    return (
        <>
            <ul className="flex flex-col gap-3">
                {candidaturas.map((c) => (
                    <li
                        key={c.id}
                        className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-lg font-semibold text-foreground">{c.nomeCompleto}</p>
                                <Badge cor="warning">Pendente</Badge>
                            </div>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                {c.bairro} · {formatarTelefone(c.telefone)} · {c.profissao}
                            </p>
                            {c.habilidades.length > 0 && (
                                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                    Habilidades: {c.habilidades.join(', ')}
                                </p>
                            )}
                        </div>

                        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                            <Button
                                variant="secondary"
                                iconeInicio={<Eye className="size-4" />}
                                onClick={() => setDetalhe(c)}
                            >
                                Ver detalhes
                            </Button>
                            <Button
                                iconeInicio={<Check className="size-4" />}
                                loading={emAndamento}
                                onClick={() => aprovar(c)}
                            >
                                Aprovar
                            </Button>
                            <Button
                                variant="danger"
                                iconeInicio={<Trash2 className="size-4" />}
                                onClick={() => setARejeitar(c)}
                            >
                                Rejeitar
                            </Button>
                        </div>
                    </li>
                ))}
            </ul>

            <Dialog
                open={detalhe !== null}
                onOpenChange={(aberto) => !aberto && setDetalhe(null)}
                titulo={detalhe?.nomeCompleto ?? 'Candidatura'}
                descricao="Dados enviados no formulário de candidatura."
                tamanho="lg"
                acoes={
                    detalhe && (
                        <>
                            <Button
                                variant="danger"
                                iconeInicio={<Trash2 className="size-4" />}
                                onClick={() => {
                                    setARejeitar(detalhe)
                                }}
                            >
                                Rejeitar
                            </Button>
                            <Button
                                iconeInicio={<Check className="size-4" />}
                                loading={emAndamento}
                                onClick={() => aprovar(detalhe)}
                            >
                                Aprovar
                            </Button>
                        </>
                    )
                }
            >
                {detalhe && (
                    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                        <Campo rotulo="E-mail" valor={detalhe.email} />
                        <Campo rotulo="CPF" valor={formatarCpf(detalhe.cpf)} />
                        <Campo rotulo="Data de nascimento" valor={formatarData(detalhe.dataNascimento)} />
                        <Campo rotulo="Telefone (WhatsApp)" valor={formatarTelefone(detalhe.telefone)} />
                        <Campo rotulo="CEP" valor={formatarCep(detalhe.cep)} />
                        <Campo rotulo="Bairro" valor={detalhe.bairro} />
                        <Campo rotulo="Profissão / formação" valor={detalhe.profissao} />
                        <Campo
                            rotulo="Veículo próprio"
                            valor={
                                detalhe.veiculoProprio
                                    ? `Sim — ${detalhe.tipoVeiculo ? ROTULO_TIPO_VEICULO[detalhe.tipoVeiculo] : 'não informado'}`
                                    : 'Não'
                            }
                        />
                        <Campo
                            rotulo="Disponibilidade"
                            valor={detalhe.disponibilidade.map((d) => ROTULO_DISPONIBILIDADE[d]).join(', ')}
                        />
                        <Campo
                            rotulo="Habilidades"
                            valor={detalhe.habilidades.length > 0 ? detalhe.habilidades.join(', ') : '—'}
                        />
                        <div className="sm:col-span-2">
                            <Campo rotulo="Restrições de saúde" valor={detalhe.restricoesSaude || '—'} />
                        </div>
                    </dl>
                )}
            </Dialog>

            <Dialog
                open={aRejeitar !== null}
                onOpenChange={(aberto) => {
                    if (!aberto) setARejeitar(null)
                }}
                titulo="Rejeitar candidatura"
                descricao={`O motivo é enviado a ${aRejeitar?.nomeCompleto ?? 'o candidato'}, que pode corrigir e reenviar.`}
                acoes={
                    <>
                        <Button
                            variant="secondary"
                            iconeInicio={<X className="size-4" />}
                            onClick={() => setARejeitar(null)}
                        >
                            Cancelar
                        </Button>
                        {/* Fora do `<form>`: o `form=` é o que liga o botão a ele. */}
                        <Button
                            type="submit"
                            form="rejeicao-form"
                            variant="danger"
                            iconeInicio={<Trash2 className="size-4" />}
                            loading={emAndamento}
                        >
                            Rejeitar
                        </Button>
                    </>
                }
            >
                <Formulario
                    id="rejeicao-form"
                    onSubmit={handleSubmit(confirmarRejeicao)}
                    className="flex flex-col gap-4"
                >
                    {erroGeral && <Alert tom="danger" titulo={erroGeral} />}

                    <Textarea
                        id="motivoRejeicao"
                        label="Motivo da rejeição"
                        obrigatorio
                        apoio="O candidato lê este texto para saber o que corrigir antes de reenviar."
                        erro={errors.motivo?.message}
                        {...register('motivo')}
                    />
                </Formulario>
            </Dialog>
        </>
    )
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
    return (
        <div className="flex flex-col">
            <dt className="text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
                {rotulo}
            </dt>
            <dd className="text-base text-foreground">{valor}</dd>
        </div>
    )
}

function formatarData(iso: string): string {
    const [ano, mes, dia] = iso.slice(0, 10).split('-')
    return `${dia}/${mes}/${ano}`
}
