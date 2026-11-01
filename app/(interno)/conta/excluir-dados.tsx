'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { TriangleAlert } from 'lucide-react'
import { Alert } from '@/src/shared/ui/alert/alert'
import { Button } from '@/src/shared/ui/button/button'
import { Dialog } from '@/src/shared/ui/dialog/dialog'
import { excluirMeusDados } from '@/src/modules/voluntariado/presentation/actions/dados-sensiveis'

/**
 * Eliminação dos próprios dados (feature 024, FR-020 e FR-021) — LGPD art. 18,
 * VI.
 *
 * A confirmação **informa o impacto em números** antes de qualquer coisa
 * acontecer: "isto é irreversível" sem dizer quantos turnos serão cancelados não
 * informa nada, e a pessoa confirmaria sem saber o que perde.
 *
 * Nada é enviado até a confirmação explícita. O servidor recusa de novo sem ela
 * — a interface não é a única barreira.
 */

export type ExcluirMeusDadosProps = {
    turnosFuturosConfirmados: number
    turnosPassados: number
    jaAnonimizado: boolean
}

export function ExcluirMeusDados({
    turnosFuturosConfirmados,
    turnosPassados,
    jaAnonimizado
}: ExcluirMeusDadosProps) {
    const [aberto, setAberto] = useState(false)
    const [erro, setErro] = useState<string | null>(null)
    const [enviando, iniciar] = useTransition()
    const router = useRouter()

    if (jaAnonimizado) {
        return (
            <Alert tom="info" titulo="Seus dados já foram eliminados">
                Não há mais dados pessoais seus neste sistema.
            </Alert>
        )
    }

    function confirmar() {
        setErro(null)
        iniciar(async () => {
            const r = await excluirMeusDados({ confirmacao: true })
            if (!r.ok) {
                setErro(r.erro)
                return
            }
            // A sessão foi encerrada no servidor (FR-028); recarregar leva ao login.
            router.refresh()
            window.location.assign('/login')
        })
    }

    return (
        <section className="flex flex-col gap-3 rounded-lg border border-danger-300 p-4 dark:border-danger-800">
            <h2 className="text-xl font-semibold text-foreground">Excluir meus dados</h2>

            <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Você pode pedir a eliminação de todos os seus dados pessoais. Seu histórico de participação em
                turnos é preservado sem identificar você, porque é o registro operacional da resposta a
                desastres.
            </p>

            <div>
                <Button variant="danger" onClick={() => setAberto(true)}>
                    Excluir meus dados
                </Button>
            </div>

            {erro && (
                <Alert tom="danger" titulo="Não foi possível concluir">
                    {erro}
                </Alert>
            )}

            <Dialog
                open={aberto}
                onOpenChange={setAberto}
                titulo="Excluir todos os seus dados?"
                acoes={
                    <>
                        <Button variant="secondary" onClick={() => setAberto(false)} disabled={enviando}>
                            Cancelar
                        </Button>
                        <Button variant="danger" onClick={confirmar} loading={enviando}>
                            Sim, excluir definitivamente
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-3 text-sm">
                    <p className="inline-flex items-start gap-2 font-semibold text-danger-700 dark:text-danger-400">
                        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                        <span>Esta ação é irreversível. Não há como desfazer.</span>
                    </p>

                    <p>O que será eliminado:</p>
                    <ul className="list-disc pl-5">
                        <li>Seu nome, CPF, data de nascimento, telefone, CEP, bairro e profissão</li>
                        <li>Suas habilidades declaradas e suas notificações</li>
                        <li>Seu acesso: a conta será desativada e você será desconectado</li>
                    </ul>

                    {turnosFuturosConfirmados > 0 && (
                        <p className="font-semibold">
                            {turnosFuturosConfirmados === 1
                                ? '1 turno futuro em que você está escalado será cancelado, e a vaga voltará a ficar disponível.'
                                : `${turnosFuturosConfirmados} turnos futuros em que você está escalado serão cancelados, e as vagas voltarão a ficar disponíveis.`}
                        </p>
                    )}

                    {turnosPassados > 0 && (
                        <p>
                            {turnosPassados === 1
                                ? 'Seu 1 turno já cumprido continua contando nos relatórios, sem identificar você.'
                                : `Seus ${turnosPassados} turnos já cumpridos continuam contando nos relatórios, sem identificar você.`}
                        </p>
                    )}
                </div>
            </Dialog>
        </section>
    )
}
