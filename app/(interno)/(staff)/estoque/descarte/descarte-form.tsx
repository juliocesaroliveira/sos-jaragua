'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Controller } from 'react-hook-form'
import { Trash2 } from 'lucide-react'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { aplicarErrosDoServidor, quantidadePositiva, textoObrigatorio, useFormulario } from '@/src/shared/formulario'
import { Alert, Button, Formulario, NumberInput, Select, Textarea, avisar } from '@/src/shared/ui'
import { ABREVIACAO_UNIDADE } from '@/src/modules/estoque/domain/item'
import { formatarQuantidade } from '@/src/modules/estoque/domain/quantidade'
import type { ItemComSaldo } from '@/src/modules/estoque/presentation/queries/estoque'
import { registrarDescarte } from '@/src/modules/estoque/presentation/actions/estoque'

/**
 * Baixa por descarte (BR-EST-05, EST-11).
 *
 * Deduz o saldo como uma saída, mas grava em tabela dedicada — o que garante,
 * por estrutura, que o descarte nunca apareça nos relatórios de "itens
 * entregues à população" (DESIGN.md §9.4).
 */
const esquemaBase = z.object({
    // O nome do campo espelha a chave devolvida pelo caso de uso em
    // `detalhes.campos` — é o que leva a recusa do servidor ao campo certo.
    itemId: textoObrigatorio('Selecione o item.'),
    quantidade: quantidadePositiva('Informe a quantidade a descartar.'),
    motivo: z.string().optional()
})

/** Campos que este formulário conhece — usado ao distribuir a recusa do servidor (FR-012). */
const CAMPOS = Object.keys(esquemaBase.shape)

type DadosFormulario = z.infer<typeof esquemaBase>

const VALORES_INICIAIS: DadosFormulario = { itemId: '', quantidade: '', motivo: '' }

export function DescarteForm({ itens }: { itens: ItemComSaldo[] }) {
    const router = useRouter()
    const [erroGeral, setErroGeral] = useState<string | null>(null)

    /**
     * O saldo do item escolhido entra na validação, então o esquema depende de
     * dados que só existem em tempo de execução — daí ser construído aqui, e
     * não no módulo. Sem isto, pedir baixa de 50 unidades de um item com 3 em
     * estoque só seria recusado depois da ida ao servidor, com a mensagem
     * genérica de "descarte bloqueado".
     */
    const esquema = useMemo(
        () =>
            esquemaBase.superRefine((dados, ctx) => {
                const item = itens.find((i) => i.id === dados.itemId)
                if (!item || !dados.quantidade) return

                if (Number(dados.quantidade) > item.saldo) {
                    ctx.addIssue({
                        code: 'custom',
                        path: ['quantidade'],
                        message: `Saldo disponível: ${formatarQuantidade(item.saldo)} ${ABREVIACAO_UNIDADE[item.unidadeMedida]}.`
                    })
                }
            }),
        [itens]
    )

    const {
        control,
        register,
        handleSubmit,
        setError,
        reset,
        watch,
        formState: { errors, isSubmitting }
    } = useFormulario(esquema, { defaultValues: VALORES_INICIAIS })

    const selecionado = itens.find((i) => i.id === watch('itemId'))

    async function salvar(dados: DadosFormulario) {
        setErroGeral(null)

        const resultado = await registrarDescarte({
            itemId: dados.itemId,
            quantidade: Number(dados.quantidade),
            motivo: dados.motivo?.trim() || null
        })

        if (!resultado.ok) {
            const { mensagemGeral } = aplicarErrosDoServidor({
                erro: resultado.erro,
                camposConhecidos: CAMPOS,
                definirErro: (campo, mensagem) => setError(campo as keyof DadosFormulario, { message: mensagem })
            })
            setErroGeral(mensagemGeral)
            avisar.erro('Descarte não registrado', resultado.erro.mensagem)
            return
        }

        avisar.sucesso('Descarte registrado', 'O saldo foi deduzido do estoque.')
        reset(VALORES_INICIAIS)
        router.refresh()
    }

    return (
        <Formulario onSubmit={handleSubmit(salvar)} className="flex max-w-2xl flex-col gap-6">
            <Alert tom="warning" titulo="Esta baixa não conta como entrega">
                Itens descartados saem do saldo, mas ficam fora dos relatórios de itens entregues à população.
            </Alert>

            {erroGeral && <Alert tom="danger" titulo={erroGeral} />}

            <Controller
                control={control}
                name="itemId"
                render={({ field }) => (
                    <Select
                        ref={field.ref}
                        id="itemId"
                        label="Item"
                        obrigatorio
                        opcoes={itens.map((i) => ({
                            value: i.id,
                            label: `${i.nome} — ${formatarQuantidade(i.saldo)} ${ABREVIACAO_UNIDADE[i.unidadeMedida]} em estoque`,
                            disabled: i.saldo <= 0
                        }))}
                        value={field.value ? [field.value] : []}
                        onValueChange={(v) => field.onChange(v[0] ?? '')}
                        erro={errors.itemId?.message}
                    />
                )}
            />

            <Controller
                control={control}
                name="quantidade"
                render={({ field }) => (
                    <NumberInput
                        ref={field.ref}
                        id="quantidade"
                        label="Quantidade a descartar"
                        obrigatorio
                        min={0}
                        max={selecionado?.saldo}
                        value={field.value}
                        onValueChange={field.onChange}
                        apoio={
                            selecionado
                                ? `Saldo disponível: ${formatarQuantidade(selecionado.saldo)} ${ABREVIACAO_UNIDADE[selecionado.unidadeMedida]}.`
                                : undefined
                        }
                        erro={errors.quantidade?.message}
                    />
                )}
            />

            <Textarea
                id="motivo"
                label="Motivo"
                apoio="Ex.: vencido, avariado, embalagem inutilizada. Opcional, mas recomendado."
                erro={errors.motivo?.message}
                {...register('motivo')}
            />

            <div className="flex justify-end">
                <Button
                    type="submit"
                    variant="danger"
                    iconeInicio={<Trash2 className="size-4" />}
                    size="lg"
                    loading={isSubmitting}
                >
                    Registrar descarte
                </Button>
            </div>
        </Formulario>
    )
}
