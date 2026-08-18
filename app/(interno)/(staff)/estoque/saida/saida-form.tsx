'use client'

import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { Controller, useFieldArray } from 'react-hook-form'
import { Check, Plus, Trash2 } from 'lucide-react'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { aplicarErrosDoServidor, quantidadePositiva, textoObrigatorio, useFormulario } from '@/src/shared/formulario'
import {
    Alert,
    Button,
    Formulario,
    IconButton,
    Input,
    NumberInput,
    RadioGroup,
    Select,
    Tooltip,
    avisar
} from '@/src/shared/ui'
import { ABREVIACAO_UNIDADE, type TipoSaida } from '@/src/modules/estoque/domain/item'
import { formatarQuantidade } from '@/src/modules/estoque/domain/quantidade'
import type { ItemComSaldo, KitComReceita } from '@/src/modules/estoque/presentation/queries/estoque'
import { registrarSaida } from '@/src/modules/estoque/presentation/actions/estoque'

/**
 * Registro de Saída (BR-EST-04, EST-09).
 *
 * Envia **um único** payload em lote para a Server Action: a validação de saldo
 * e a dedução acontecem numa transação só, e uma saída fatiada em várias
 * chamadas perderia a atomicidade (DESIGN.md §8, §9.3).
 */
const esquemaBase = z.object({
    tipo: z.enum(['avulso', 'kit']),
    destino: textoObrigatorio('Informe o destino.'),
    responsavelTransporte: textoObrigatorio('Informe o responsável pelo transporte.'),
    linhas: z
        .array(
            z.object({
                // A obrigatoriedade e a mensagem vêm do `superRefine` abaixo,
                // porque dependem do tipo de saída escolhido.
                refId: z.string(),
                quantidade: quantidadePositiva()
            })
        )
        .min(1, 'Adicione ao menos uma linha à saída.')
})

/**
 * A mensagem da linha acompanha o tipo de saída — "Selecione o item." quando a
 * saída é avulsa, "Selecione o kit." quando é por kit. É o mesmo campo com dois
 * significados na tela, e uma mensagem genérica obrigaria o operador a olhar o
 * rótulo para entender qual dos dois ele esqueceu.
 */
const esquema = esquemaBase.superRefine((dados, ctx) => {
    dados.linhas.forEach((linha, indice) => {
        if (!linha.refId) {
            ctx.addIssue({
                code: 'custom',
                path: ['linhas', indice, 'refId'],
                message: dados.tipo === 'avulso' ? 'Selecione o item.' : 'Selecione o kit.'
            })
        }
    })
})

/** Campos que este formulário conhece — usado ao distribuir a recusa do servidor (FR-012). */
const CAMPOS = Object.keys(esquemaBase.shape)

type DadosFormulario = z.infer<typeof esquemaBase>

const LINHA_VAZIA = { refId: '', quantidade: '' }

const VALORES_INICIAIS: DadosFormulario = {
    tipo: 'avulso',
    destino: '',
    responsavelTransporte: '',
    linhas: [LINHA_VAZIA]
}

export function SaidaForm({ itens, kits }: { itens: ItemComSaldo[]; kits: KitComReceita[] }) {
    const router = useRouter()
    const [erroDeficit, setErroDeficit] = useState<string | null>(null)
    const [erroGeral, setErroGeral] = useState<string | null>(null)

    /**
     * Prefixo de `id` estável entre servidor e cliente. Não se usa o `id` que o
     * `useFieldArray` gera: ele é sorteado a cada render, então o SSR e a
     * hidratação produziriam valores diferentes e o `htmlFor` de cada rótulo
     * apontaria para um campo inexistente. O índice da linha é estável nos dois
     * lados.
     */
    const idBase = useId()

    const {
        control,
        register,
        handleSubmit,
        setError,
        reset,
        watch,
        formState: { errors, isSubmitting }
    } = useFormulario(esquema, { defaultValues: VALORES_INICIAIS })

    const { fields, append, remove, replace } = useFieldArray({ control, name: 'linhas' })

    const tipo = watch('tipo')

    function trocarTipo(novoTipo: string, aoMudar: (valor: TipoSaida) => void) {
        aoMudar(novoTipo as TipoSaida)
        // As linhas referenciam entidades diferentes (item × kit) — recomeçar
        // evita enviar um id de kit no lugar de um id de item.
        replace([LINHA_VAZIA])
        setErroDeficit(null)
    }

    async function salvar(dados: DadosFormulario) {
        setErroDeficit(null)
        setErroGeral(null)

        const linhas = dados.linhas.map((l) => ({ refId: l.refId, quantidade: Number(l.quantidade) }))

        const resultado = await registrarSaida({
            tipo: dados.tipo,
            destino: dados.destino,
            responsavelTransporte: dados.responsavelTransporte,
            avulsos:
                dados.tipo === 'avulso'
                    ? linhas.map((l) => ({ itemId: l.refId, quantidade: l.quantidade }))
                    : undefined,
            kits: dados.tipo === 'kit' ? linhas.map((l) => ({ kitId: l.refId, quantidade: l.quantidade })) : undefined
        })

        if (!resultado.ok) {
            // O déficit ganha um alerta persistente, não só um toast: o
            // operador precisa do texto à vista para saber o que buscar.
            if (resultado.erro.codigo === 'saida_bloqueada') {
                setErroDeficit(resultado.erro.mensagem)
            } else {
                const { mensagemGeral } = aplicarErrosDoServidor({
                    erro: resultado.erro,
                    camposConhecidos: CAMPOS,
                    definirErro: (campo, mensagem) => setError(campo as keyof DadosFormulario, { message: mensagem })
                })
                setErroGeral(mensagemGeral)
            }
            avisar.erro('Saída não registrada', resultado.erro.mensagem)
            return
        }

        avisar.sucesso('Saída registrada', 'O saldo foi deduzido do estoque.')
        reset(VALORES_INICIAIS)
        router.refresh()
    }

    const opcoes =
        tipo === 'avulso'
            ? itens.map((i) => ({
                  value: i.id,
                  label: `${i.nome} — ${formatarQuantidade(i.saldo)} ${ABREVIACAO_UNIDADE[i.unidadeMedida]} em estoque`,
                  disabled: i.saldo <= 0
              }))
            : kits.map((k) => ({
                  value: k.id,
                  label: k.componentes.length > 0 ? k.nome : `${k.nome} (sem receita)`,
                  disabled: k.componentes.length === 0
              }))

    return (
        <Formulario onSubmit={handleSubmit(salvar)} className="flex max-w-3xl flex-col gap-6">
            {erroDeficit && (
                <Alert tom="danger" titulo="Saída bloqueada">
                    {erroDeficit}
                </Alert>
            )}

            {erroGeral && <Alert tom="danger" titulo={erroGeral} />}

            <Controller
                control={control}
                name="tipo"
                render={({ field }) => (
                    <RadioGroup
                        ref={field.ref}
                        id="tipo"
                        label="Tipo de saída"
                        orientacao="horizontal"
                        opcoes={[
                            { value: 'avulso', label: 'Itens avulsos' },
                            { value: 'kit', label: 'Kits' }
                        ]}
                        value={field.value}
                        onValueChange={(v) => trocarTipo(v, field.onChange)}
                        erro={errors.tipo?.message}
                    />
                )}
            />

            <div className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold text-foreground">{tipo === 'avulso' ? 'Itens' : 'Kits'}</h2>

                {/* Erro do array inteiro (nenhuma linha) — os erros de cada
                    linha ficam abaixo dos respectivos controles. */}
                {errors.linhas?.root?.message && <Alert tom="danger" titulo={errors.linhas.root.message} />}

                {fields.map((campo, indice) => {
                    // Uma saída sem nenhuma linha não teria o que registrar.
                    const ultimaLinha = fields.length === 1
                    return (
                        <div key={campo.id} className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                                <Controller
                                    control={control}
                                    name={`linhas.${indice}.refId`}
                                    render={({ field }) => (
                                        <Select
                                            ref={field.ref}
                                            id={`ref-${idBase}-${indice}`}
                                            label={tipo === 'avulso' ? 'Item' : 'Kit'}
                                            obrigatorio
                                            opcoes={opcoes}
                                            value={field.value ? [field.value] : []}
                                            onValueChange={(v) => field.onChange(v[0] ?? '')}
                                            erro={errors.linhas?.[indice]?.refId?.message}
                                        />
                                    )}
                                />
                            </div>
                            <div className="w-32 shrink-0">
                                <Controller
                                    control={control}
                                    name={`linhas.${indice}.quantidade`}
                                    render={({ field }) => (
                                        <NumberInput
                                            ref={field.ref}
                                            id={`qtd-${idBase}-${indice}`}
                                            label="Quantidade"
                                            obrigatorio
                                            min={0}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            erro={errors.linhas?.[indice]?.quantidade?.message}
                                        />
                                    )}
                                />
                            </div>
                            {/*
                              Antes o botão apenas esmaecia e ficava mudo quando
                              sobrava uma linha só. A condição é a mesma; o que
                              muda é que agora ela se explica — `inativo` mantém
                              o botão focável e sensível ao ponteiro para que a
                              dica possa aparecer (015-tooltip-acoes-icone, A-05).

                              O `mt-7` do contêiner alinha o botão ao controle,
                              não ao topo do bloco: os campos ao lado têm rótulo
                              acima, e a faixa de mensagem embaixo agora pode
                              crescer.
                            */}
                            <div className="mt-7 shrink-0">
                                <Tooltip
                                    conteudo={ultimaLinha ? 'A saída precisa de ao menos uma linha' : 'Remover linha'}
                                    descricao={ultimaLinha}
                                >
                                    <IconButton
                                        aria-label="Remover linha"
                                        icone={<Trash2 aria-hidden className="size-5" />}
                                        variant="ghost"
                                        inativo={ultimaLinha}
                                        onClick={() => remove(indice)}
                                    />
                                </Tooltip>
                            </div>
                        </div>
                    )
                })}

                <div>
                    <Button
                        type="button"
                        variant="secondary"
                        iconeInicio={<Plus aria-hidden className="size-5" />}
                        onClick={() => append(LINHA_VAZIA)}
                    >
                        Adicionar {tipo === 'avulso' ? 'item' : 'kit'}
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Input
                    id="destino"
                    label="Destino"
                    obrigatorio
                    apoio="Bairro, abrigo ou família."
                    erro={errors.destino?.message}
                    {...register('destino')}
                />
                <Input
                    id="responsavel"
                    label="Responsável pelo transporte"
                    obrigatorio
                    erro={errors.responsavelTransporte?.message}
                    {...register('responsavelTransporte')}
                />
            </div>

            <div className="flex justify-end">
                <Button type="submit" size="lg" iconeInicio={<Check className="size-4" />} loading={isSubmitting}>
                    Registrar saída
                </Button>
            </div>
        </Formulario>
    )
}
