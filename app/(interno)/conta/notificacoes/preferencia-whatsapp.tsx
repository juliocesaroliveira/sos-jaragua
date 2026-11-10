'use client'

import { useTransition } from 'react'
import { BellOff, BellRing } from 'lucide-react'
import { Button } from '@/src/shared/ui/button/button'
import { avisar } from '@/src/shared/ui/toast/toast'
import { alterarPreferenciaWhatsapp } from '@/src/modules/notificacoes/presentation/actions/preferencia-whatsapp'

/**
 * Botão de ativar/desativar o WhatsApp (024, US2). O estado exibido vem do
 * servidor: depois da ação, `revalidatePath` re-renderiza a página com o valor
 * gravado — a tela nunca mostra um opt-in que o banco não tem.
 */
export function PreferenciaWhatsapp({ ativo, ativoDesde }: { ativo: boolean; ativoDesde: string | null }) {
    const [salvando, iniciarTransicao] = useTransition()

    function alterar(novo: boolean) {
        iniciarTransicao(async () => {
            const resultado = await alterarPreferenciaWhatsapp({ ativo: novo })
            if (!resultado.ok) {
                avisar.erro('Não foi possível salvar', resultado.erro.mensagem)
                return
            }
            avisar.sucesso(
                novo ? 'WhatsApp ativado' : 'WhatsApp desativado',
                novo
                    ? 'Os próximos avisos também chegam pelo WhatsApp.'
                    : 'Você continua recebendo no sino e por e-mail.'
            )
        })
    }

    if (ativo) {
        return (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-base font-medium text-success-700 dark:text-success-300">
                    {ativoDesde ? `Ativo desde ${ativoDesde}` : 'Ativo'}
                </p>
                <Button
                    variant="secondary"
                    size="lg"
                    loading={salvando}
                    iconeInicio={<BellOff aria-hidden className="size-5" />}
                    onClick={() => alterar(false)}
                >
                    Desativar
                </Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-3">
            <p className="text-base text-neutral-600 dark:text-neutral-300">
                Você pode desativar quando quiser, aqui ou respondendo SAIR a qualquer mensagem.
            </p>
            <Button
                size="lg"
                loading={salvando}
                iconeInicio={<BellRing aria-hidden className="size-5" />}
                onClick={() => alterar(true)}
            >
                Ativar avisos pelo WhatsApp
            </Button>
        </div>
    )
}
