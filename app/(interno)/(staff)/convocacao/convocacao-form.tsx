'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Megaphone, Send, X } from 'lucide-react'
import { Alert, Button, Dialog, Input, Select, Textarea, avisar } from '@/src/shared/ui'
import type { Lookup } from '@/src/modules/voluntariado/presentation/queries/lookups'
import { enviarBroadcast } from '@/src/modules/notificacoes/presentation/actions/notificacoes'

/**
 * Broadcast de Urgência (BRD §6, NOT-05).
 *
 * A confirmação é obrigatória e mostra o alcance: é o único ponto do sistema
 * que dispara mensagem para toda a base de voluntários de uma vez, e um envio
 * acidental não tem desfazer.
 */
export function ConvocacaoForm({ habilidades, totalAprovados }: { habilidades: Lookup[]; totalAprovados: number }) {
    const router = useRouter()
    const [enviando, iniciarTransicao] = useTransition()

    const [titulo, setTitulo] = useState('')
    const [mensagem, setMensagem] = useState('')
    const [habilidadeId, setHabilidadeId] = useState<string[]>([])
    const [confirmando, setConfirmando] = useState(false)
    const [erro, setErro] = useState<string | null>(null)

    const habilidadeEscolhida = habilidades.find((h) => h.id === habilidadeId[0])

    function enviar() {
        setErro(null)
        iniciarTransicao(async () => {
            const resultado = await enviarBroadcast({
                titulo,
                mensagem,
                habilidadeId: habilidadeId[0] ?? null
            })

            if (!resultado.ok) {
                setErro(resultado.erro.mensagem)
                setConfirmando(false)
                return
            }

            const total = resultado.valor.destinatarios
            avisar.sucesso(
                'Convocação enviada',
                total === 1 ? '1 voluntário foi notificado.' : `${total} voluntários foram notificados.`
            )
            setTitulo('')
            setMensagem('')
            setHabilidadeId([])
            setConfirmando(false)
            router.refresh()
        })
    }

    const podeEnviar = titulo.trim().length > 0 && mensagem.trim().length > 0

    return (
        <div className="flex max-w-2xl flex-col gap-6">
            {erro && <Alert tom="danger" titulo={erro} />}

            <Alert tom="warning" titulo="Esta mensagem vai para muitos voluntários de uma vez">
                Use para convocação de urgência. Todos os destinatários recebem no sino e por e-mail.
            </Alert>

            <Input
                id="titulo"
                label="Título"
                obrigatorio
                apoio="Aparece como assunto do e-mail e título da notificação."
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
            />

            <Textarea
                id="mensagem"
                label="Mensagem"
                obrigatorio
                rows={6}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
            />

            <Select
                id="habilidadeId"
                label="Filtrar por habilidade"
                placeholder={`Todos os voluntários aprovados (${totalAprovados})`}
                apoio="Sem filtro, a convocação vai para toda a base aprovada."
                opcoes={habilidades.map((h) => ({ value: h.id, label: h.nome }))}
                value={habilidadeId}
                onValueChange={setHabilidadeId}
            />

            <div className="flex justify-end">
                <Button
                    size="lg"
                    variant="danger"
                    disabled={!podeEnviar}
                    iconeInicio={<Megaphone aria-hidden className="size-5" />}
                    onClick={() => setConfirmando(true)}
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
                    <p className="text-base font-semibold text-foreground">{titulo}</p>
                    <p className="text-base whitespace-pre-wrap text-neutral-600 dark:text-neutral-300">{mensagem}</p>
                </div>
            </Dialog>
        </div>
    )
}
