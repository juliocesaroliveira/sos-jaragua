'use client'

import { useEffect } from 'react'
import { Controller } from 'react-hook-form'
import { Check, X } from 'lucide-react'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { aplicarErrosDoServidor, useFormulario } from '@/src/shared/formulario'
import { Button } from '@/src/shared/ui/button/button'
import { Dialog } from '@/src/shared/ui/dialog/dialog'
import { Formulario } from '@/src/shared/ui/formulario/formulario'
import { NumberInput } from '@/src/shared/ui/number-input/number-input'
import { avisar } from '@/src/shared/ui/toast/toast'
import { ABREVIACAO_UNIDADE } from '@/src/modules/estoque/domain/item'
import { formatarQuantidade } from '@/src/modules/estoque/domain/quantidade'
import { definirEstoqueMinimo } from '@/src/modules/estoque/presentation/actions/estoque'
import type { ItemComSaldo } from '@/src/modules/estoque/presentation/queries/estoque'
import { apoioEstoqueMinimo, campoEstoqueMinimo, paraEstoqueMinimo } from './campo-estoque-minimo'

/**
 * Definir, alterar ou limpar o mínimo de segurança de um item
 * (specs/020-resolver-pendencias, Q3 / I1).
 *
 * `Dialog` já é responsivo (folha em mobile, modal em desktop), como em
 * `admin/usuario-form-dialog.tsx`. Disponível a `membro_defesa_civil`,
 * `coordenador` e `administrador`, os mesmos papéis que acessam `/estoque`. A
 * Server Action confere o papel de novo.
 */
const esquema = z.object({ estoqueMinimo: campoEstoqueMinimo() })

type DadosFormulario = z.infer<typeof esquema>

export interface EstoqueMinimoDialogProps {
    open: boolean
    onOpenChange: (aberto: boolean) => void
    onSucesso?: () => void
    item: ItemComSaldo | null
    limiarGlobal: number
}

export function EstoqueMinimoDialog({ open, onOpenChange, onSucesso, item, limiarGlobal }: EstoqueMinimoDialogProps) {
    const {
        control,
        handleSubmit,
        reset,
        setError,
        formState: { errors, isSubmitting }
    } = useFormulario(esquema, { defaultValues: { estoqueMinimo: '' } })

    // Ao abrir, ou ao trocar de item sem fechar, o campo mostra o valor atual
    // do item: vazio quando ele herda o padrão.
    useEffect(() => {
        if (!open || !item) return
        reset({ estoqueMinimo: item.estoqueMinimo === null ? '' : String(item.estoqueMinimo) })
    }, [open, item, reset])

    if (!item) return null
    const unidade = ABREVIACAO_UNIDADE[item.unidadeMedida]

    async function salvar(dados: DadosFormulario) {
        if (!item) return
        const estoqueMinimo = paraEstoqueMinimo(dados.estoqueMinimo)
        const resultado = await definirEstoqueMinimo({ itemId: item.id, estoqueMinimo })

        if (!resultado.ok) {
            const { mensagemGeral } = aplicarErrosDoServidor({
                erro: resultado.erro,
                camposConhecidos: ['estoqueMinimo'],
                definirErro: (campo, mensagem) => setError(campo as keyof DadosFormulario, { message: mensagem })
            })
            avisar.erro('Não foi possível salvar', mensagemGeral ?? resultado.erro.mensagem)
            return
        }

        avisar.sucesso(
            'Estoque mínimo atualizado',
            estoqueMinimo === null
                ? `${item.nome} passa a usar o padrão (${formatarQuantidade(limiarGlobal)} ${unidade}).`
                : estoqueMinimo === 0
                  ? `${item.nome} não gera mais alerta de estoque crítico.`
                  : `${item.nome}: alerta a partir de ${formatarQuantidade(estoqueMinimo)} ${unidade}.`
        )
        onOpenChange(false)
        onSucesso?.()
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
            titulo="Definir estoque mínimo"
            descricao={`Quando o saldo de ${item.nome} chegar a este valor, a coordenação recebe um alerta.`}
            acoes={
                <>
                    <Button
                        type="button"
                        variant="secondary"
                        iconeInicio={<X className="size-4" />}
                        onClick={() => onOpenChange(false)}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        form="estoque-minimo-form"
                        iconeInicio={<Check className="size-4" />}
                        loading={isSubmitting}
                    >
                        Salvar
                    </Button>
                </>
            }
        >
            <Formulario id="estoque-minimo-form" onSubmit={handleSubmit(salvar)} className="flex flex-col gap-4">
                <Controller
                    control={control}
                    name="estoqueMinimo"
                    render={({ field }) => (
                        <NumberInput
                            ref={field.ref}
                            id="estoqueMinimo"
                            label={`Estoque mínimo (${unidade})`}
                            apoio={apoioEstoqueMinimo(limiarGlobal, unidade)}
                            min={0}
                            value={field.value ?? ''}
                            onValueChange={field.onChange}
                            erro={errors.estoqueMinimo?.message}
                        />
                    )}
                />
            </Formulario>
        </Dialog>
    )
}
