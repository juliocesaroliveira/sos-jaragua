'use client'

import { useEffect } from 'react'
import { Check, X } from 'lucide-react'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { aplicarErrosDoServidor, textoObrigatorio, useFormulario } from '@/src/shared/formulario'
import { Button, Dialog, Formulario, Input, avisar } from '@/src/shared/ui'
import { LIMITES_NOME_HABILIDADE } from '@/src/modules/voluntariado/domain/habilidade'
import { criarHabilidade, editarHabilidade } from '@/src/modules/voluntariado/presentation/actions/habilidades'
import type { LinhaHabilidade } from '@/src/modules/voluntariado/presentation/queries/habilidades'

/**
 * Formulário de cadastro/edição de habilidade (017-gestao-habilidades, US2/US3).
 *
 * Um único `Dialog` para os dois modos — já responsivo (folha em mobile, modal
 * em desktop), sem precisar de um `Drawer` separado — e um único componente:
 * a diferença entre cadastrar e editar é o valor inicial e qual Server Action é
 * chamada (contracts/ui-habilidades.md D-01.1).
 *
 * Os limites vêm de `LIMITES_NOME_HABILIDADE`, a mesma constante que o `domain/`
 * usa no servidor. Repetir os números aqui deixaria cliente e servidor livres
 * para divergir sem ninguém perceber.
 */
const { min, max } = LIMITES_NOME_HABILIDADE

const esquema = z.object({
    nome: textoObrigatorio('Informe o nome da habilidade.')
        .min(min, `O nome deve ter ao menos ${min} caracteres.`)
        .max(max, `O nome deve ter no máximo ${max} caracteres.`)
})

type DadosFormulario = z.infer<typeof esquema>

/** Campos que este formulário conhece — usado ao distribuir a recusa do servidor. */
const CAMPOS = ['nome']

export interface HabilidadeFormDialogProps {
    open: boolean
    onOpenChange: (aberto: boolean) => void
    /** Fechado o diálogo após sucesso, a listagem já reflete a mudança. */
    onSucesso?: () => void
    /** Presente = modo edição, pré-preenchido; ausente = modo cadastro. */
    habilidade?: LinhaHabilidade
}

export function HabilidadeFormDialog({ open, onOpenChange, onSucesso, habilidade }: HabilidadeFormDialogProps) {
    const modoEdicao = Boolean(habilidade)

    const {
        register,
        handleSubmit,
        reset,
        setError,
        formState: { errors, isSubmitting }
    } = useFormulario(esquema)

    // Reinicialização única: cobre abrir o diálogo e também alternar de uma
    // habilidade para outra sem fechá-lo — o nome digitado para uma jamais pode
    // alcançar a seguinte (D-01.4).
    useEffect(() => {
        if (!open) return
        reset({ nome: habilidade?.nome ?? '' })
    }, [open, habilidade, reset])

    async function enviar(dados: DadosFormulario) {
        const resultado = modoEdicao
            ? await editarHabilidade({ id: habilidade!.id, nome: dados.nome })
            : await criarHabilidade({ nome: dados.nome })

        if (!resultado.ok) {
            const { mensagemGeral } = aplicarErrosDoServidor({
                erro: resultado.erro,
                camposConhecidos: CAMPOS,
                definirErro: (campo, mensagem) => setError(campo as keyof DadosFormulario, { message: mensagem })
            })
            avisar.erro(
                modoEdicao ? 'Não foi possível salvar' : 'Não foi possível cadastrar',
                mensagemGeral ?? resultado.erro.mensagem
            )

            // Registro removido por outra pessoa com o diálogo aberto: insistir
            // no formulário não leva a lugar nenhum — fecha e deixa a listagem
            // se corrigir (E-01.3).
            if (resultado.erro.codigo === 'nao_encontrado') {
                onOpenChange(false)
                onSucesso?.()
            }
            return
        }

        avisar.sucesso(
            modoEdicao ? 'Habilidade atualizada' : 'Habilidade cadastrada',
            modoEdicao
                ? `"${dados.nome}" foi atualizada.`
                : `"${dados.nome}" já pode ser declarada pelos voluntários.`
        )
        onOpenChange(false)
        onSucesso?.()
    }

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
            titulo={modoEdicao ? 'Editar habilidade' : 'Nova habilidade'}
            descricao={
                modoEdicao
                    ? 'Altere o nome da habilidade. Os voluntários que já a declararam continuam vinculados.'
                    : 'Informe o nome da nova habilidade.'
            }
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
                        form="habilidade-form"
                        iconeInicio={<Check className="size-4" />}
                        loading={isSubmitting}
                    >
                        {modoEdicao ? 'Salvar' : 'Cadastrar'}
                    </Button>
                </>
            }
        >
            <Formulario id="habilidade-form" onSubmit={handleSubmit(enviar)} className="flex flex-col gap-4">
                <Input
                    id="nome"
                    label="Nome"
                    obrigatorio
                    autoComplete="off"
                    apoio={`De ${min} a ${max} caracteres.`}
                    erro={errors.nome?.message}
                    {...register('nome')}
                />
            </Formulario>
        </Dialog>
    )
}
