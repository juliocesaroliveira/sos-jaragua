'use client'

import { useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Controller } from 'react-hook-form'
import { Trash2 } from 'lucide-react'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { aplicarErrosDoServidor, quantidadePositiva, textoObrigatorio, useFormulario } from '@/src/shared/formulario'
import { RAIZ_LOOKUP } from '@/src/shared/query/chaves'
import { Alert } from '@/src/shared/ui/alert/alert'
import { Button } from '@/src/shared/ui/button/button'
import { Formulario } from '@/src/shared/ui/formulario/formulario'
import { Lookup } from '@/src/shared/ui/lookup/lookup'
import { NumberInput } from '@/src/shared/ui/number-input/number-input'
import { Textarea } from '@/src/shared/ui/textarea/textarea'
import { avisar } from '@/src/shared/ui/toast/toast'
import { ABREVIACAO_UNIDADE } from '@/src/modules/estoque/domain/item'
import { formatarQuantidade } from '@/src/modules/estoque/domain/quantidade'
import type { ItemComSaldo } from '@/src/modules/estoque/presentation/queries/estoque'
import { registrarDescarte } from '@/src/modules/estoque/presentation/actions/estoque'
import { fonteItens, semSaldo } from '@/src/modules/estoque/presentation/lookups/fontes'

/**
 * Baixa por descarte (BR-EST-05, EST-11).
 *
 * Deduz o saldo como uma saída, mas grava em tabela dedicada — o que garante,
 * por estrutura, que o descarte nunca apareça nos relatórios de "itens
 * entregues à população" (DESIGN.md §9.4).
 *
 * O item é escolhido por Lookup (021): digitação ou pesquisa paginada, sem
 * carregar o catálogo inteiro na tela.
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

export function DescarteForm() {
    const queryClient = useQueryClient()
    const [erroGeral, setErroGeral] = useState<string | null>(null)
    /** Registro escolhido no Lookup — fonte do saldo exibido e validado (FR-019). */
    const [selecionado, setSelecionado] = useState<ItemComSaldo | null>(null)
    /** O esquema lê o saldo no momento da validação, não a cada render. */
    const selecionadoRef = useRef<ItemComSaldo | null>(null)

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
                const item = selecionadoRef.current
                if (!item || item.id !== dados.itemId || !dados.quantidade) return

                if (Number(dados.quantidade) > item.saldo) {
                    ctx.addIssue({
                        code: 'custom',
                        path: ['quantidade'],
                        message: `Saldo disponível: ${formatarQuantidade(item.saldo)} ${ABREVIACAO_UNIDADE[item.unidadeMedida]}.`
                    })
                }
            }),
        []
    )

    const {
        control,
        register,
        handleSubmit,
        setError,
        reset,
        formState: { errors, isSubmitting }
    } = useFormulario(esquema, { defaultValues: VALORES_INICIAIS })

    function selecionar(item: ItemComSaldo | null) {
        selecionadoRef.current = item
        setSelecionado(item)
    }

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
        // Os saldos exibidos nas sugestões e na pesquisa mudaram (contracts L-07).
        void queryClient.invalidateQueries({ queryKey: RAIZ_LOOKUP })
        selecionar(null)
        reset(VALORES_INICIAIS)
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
                    <Lookup
                        ref={field.ref}
                        id="itemId"
                        label="Item"
                        obrigatorio
                        fonte={fonteItens}
                        // Mesma regra do select substituído: sem saldo, nada a descartar (FR-024).
                        motivoIndisponivel={semSaldo}
                        value={field.value}
                        descricao={selecionado?.nome ?? ''}
                        onSelecionar={(item) => {
                            selecionar(item)
                            field.onChange(item?.id ?? '')
                        }}
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
