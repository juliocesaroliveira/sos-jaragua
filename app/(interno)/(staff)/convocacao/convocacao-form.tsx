'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Controller } from 'react-hook-form'
import { Megaphone, Send, X } from 'lucide-react'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { aplicarErrosDoServidor, textoObrigatorio, useFormulario } from '@/src/shared/formulario'
import { Alert, Button, Dialog, Formulario, Input, Select, Textarea, avisar } from '@/src/shared/ui'
import type { Lookup } from '@/src/modules/voluntariado/presentation/queries/lookups'
import { enviarBroadcast } from '@/src/modules/notificacoes/presentation/actions/notificacoes'

/**
 * Broadcast de Urgência (BRD §6, NOT-05).
 *
 * A confirmação é obrigatória e mostra o alcance: é o único ponto do sistema
 * que dispara mensagem para toda a base de voluntários de uma vez, e um envio
 * acidental não tem desfazer.
 */
const esquema = z.object({
    titulo: textoObrigatorio('Informe o título da convocação.'),
    mensagem: textoObrigatorio('Escreva a mensagem da convocação.'),
    habilidadeId: z.string().optional()
})

/** Campos que este formulário conhece — usado ao distribuir a recusa do servidor (FR-012). */
const CAMPOS = Object.keys(esquema.shape)

type DadosFormulario = z.infer<typeof esquema>

const VALORES_INICIAIS: DadosFormulario = { titulo: '', mensagem: '', habilidadeId: undefined }

export function ConvocacaoForm({ habilidades, totalAprovados }: { habilidades: Lookup[]; totalAprovados: number }) {
    const router = useRouter()
    const [enviando, iniciarTransicao] = useTransition()

    const [confirmando, setConfirmando] = useState(false)
    const [erro, setErro] = useState<string | null>(null)

    const {
        control,
        register,
        handleSubmit,
        getValues,
        setError,
        reset,
        watch,
        formState: { errors }
    } = useFormulario(esquema, { defaultValues: VALORES_INICIAIS })

    const habilidadeEscolhida = habilidades.find((h) => h.id === watch('habilidadeId'))

    /**
     * Submeter o formulário **valida e abre a confirmação** — nunca dispara a
     * convocação direto. O envio real só acontece no botão do diálogo.
     *
     * Antes, o botão de envio ficava `disabled` enquanto título ou mensagem
     * estivessem vazios. Botão desabilitado não diz o que falta; agora o envio é
     * bloqueado com a mensagem sob o campo que precisa ser preenchido.
     */
    function confirmar() {
        setErro(null)
        setConfirmando(true)
    }

    function enviar() {
        const dados = getValues()
        setErro(null)
        iniciarTransicao(async () => {
            const resultado = await enviarBroadcast({
                titulo: dados.titulo,
                mensagem: dados.mensagem,
                habilidadeId: dados.habilidadeId ?? null
            })

            if (!resultado.ok) {
                const { mensagemGeral } = aplicarErrosDoServidor({
                    erro: resultado.erro,
                    camposConhecidos: CAMPOS,
                    definirErro: (campo, msg) => setError(campo as keyof DadosFormulario, { message: msg })
                })
                setErro(mensagemGeral)
                setConfirmando(false)
                return
            }

            const total = resultado.valor.destinatarios
            avisar.sucesso(
                'Convocação enviada',
                total === 1 ? '1 voluntário foi notificado.' : `${total} voluntários foram notificados.`
            )
            reset(VALORES_INICIAIS)
            setConfirmando(false)
            router.refresh()
        })
    }

    return (
        <Formulario onSubmit={handleSubmit(confirmar)} className="flex max-w-2xl flex-col gap-6">
            {erro && <Alert tom="danger" titulo={erro} />}

            <Alert tom="warning" titulo="Esta mensagem vai para muitos voluntários de uma vez">
                Use para convocação de urgência. Todos os destinatários recebem no sino e por e-mail.
            </Alert>

            <Input
                id="titulo"
                label="Título"
                obrigatorio
                apoio="Aparece como assunto do e-mail e título da notificação."
                erro={errors.titulo?.message}
                {...register('titulo')}
            />

            <Textarea
                id="mensagem"
                label="Mensagem"
                obrigatorio
                rows={6}
                erro={errors.mensagem?.message}
                {...register('mensagem')}
            />

            <Controller
                control={control}
                name="habilidadeId"
                render={({ field }) => (
                    <Select
                        ref={field.ref}
                        id="habilidadeId"
                        label="Filtrar por habilidade"
                        placeholder={`Todos os voluntários aprovados (${totalAprovados})`}
                        apoio="Sem filtro, a convocação vai para toda a base aprovada."
                        opcoes={habilidades.map((h) => ({ value: h.id, label: h.nome }))}
                        value={field.value ? [field.value] : []}
                        onValueChange={(v) => field.onChange(v[0])}
                        erro={errors.habilidadeId?.message}
                    />
                )}
            />

            <div className="flex justify-end">
                <Button
                    type="submit"
                    size="lg"
                    variant="danger"
                    iconeInicio={<Megaphone aria-hidden className="size-5" />}
                >
                    Enviar convocação
                </Button>
            </div>

            <Dialog
                open={confirmando}
                onOpenChange={setConfirmando}
                titulo="Confirmar convocação"
                descricao={
                    habilidadeEscolhida
                        ? `Será enviada aos voluntários com a habilidade "${habilidadeEscolhida.nome}".`
                        : totalAprovados === 1
                          ? 'Será enviada ao único voluntário aprovado.'
                          : `Será enviada a todos os ${totalAprovados} voluntários aprovados.`
                }
                acoes={
                    <>
                        <Button
                            variant="secondary"
                            iconeInicio={<X className="size-4" />}
                            onClick={() => setConfirmando(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="danger"
                            iconeInicio={<Send className="size-4" />}
                            loading={enviando}
                            onClick={enviar}
                        >
                            Enviar agora
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-2">
                    <p className="text-base font-semibold text-foreground">{watch('titulo')}</p>
                    <p className="text-base whitespace-pre-wrap text-neutral-600 dark:text-neutral-300">
                        {watch('mensagem')}
                    </p>
                </div>
            </Dialog>
        </Formulario>
    )
}
