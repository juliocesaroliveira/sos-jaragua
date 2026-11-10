import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Alert } from '@/src/shared/ui/alert/alert'
import { SkeletonLista } from '@/src/shared/ui/skeleton/skeleton'
import { exigirSessao } from '@/src/shared/auth/sessao'
import { estadoPreferenciaWhatsapp } from '@/src/modules/notificacoes/presentation/queries/preferencia-whatsapp'
import { PreferenciaWhatsapp } from './preferencia-whatsapp'

export const metadata: Metadata = {
    title: 'Notificações — SOS Jaraguá'
}

/**
 * Minha conta → Notificações (024, US2, contracts/canal-e-interfaces.md §3).
 *
 * Visível a todos os papéis: o WhatsApp é de quem tem perfil de voluntário, e
 * há equipe com perfil que recebe convocação. Sem regra em `REGRAS_DE_ROTA` —
 * só sessão.
 *
 * O estado depende de quem está logado, então o segmento não é prerenderizável.
 */
export const instant = false

/** Os avisos que também vão pelo WhatsApp (FR-001), na língua de quem recebe. */
const AVISOS = [
    'Aprovação do seu cadastro de voluntário',
    'Atividade atribuída a você',
    'Mudança de local, horário ou cancelamento de atividade',
    'Lembrete dos seus próximos turnos',
    'Convocações urgentes da Defesa Civil'
]

const CLASSE_LINK = 'font-medium text-primary-700 underline dark:text-primary-300'

export default function NotificacoesPage() {
    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-4">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Notificações</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Os avisos sempre aparecem no sino do sistema. Os mais importantes também vão por e-mail — e, se você
                    quiser, pelo WhatsApp.
                </p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={2} altura="h-24" />}>
                <Conteudo />
            </Suspense>
        </div>
    )
}

async function Conteudo() {
    const ator = await exigirSessao('/conta/notificacoes')
    const estado = await estadoPreferenciaWhatsapp(ator.userId)

    if (!estado.temPerfil) {
        return (
            <Alert tom="info" titulo="O WhatsApp fica disponível depois do cadastro de voluntário">
                <p className="mb-3">É pelo telefone informado no cadastro que os avisos chegam.</p>
                <Link href="/voluntariado/candidatura" className={CLASSE_LINK}>
                    Fazer o cadastro de voluntário
                </Link>
            </Alert>
        )
    }

    // Quem já tinha ativado e trocou o número por um fixo ainda precisa
    // conseguir desligar — por isso o aviso só substitui a tela quando inativo.
    if (!estado.celular && !estado.ativo) {
        return (
            <Alert tom="warning" titulo="É preciso um celular para receber pelo WhatsApp">
                <p className="mb-3">
                    O telefone do seu cadastro ({estado.telefoneMascarado}) é fixo. Atualize a candidatura com um número
                    de celular para poder ativar.
                </p>
                <Link href="/voluntariado/candidatura" className={CLASSE_LINK}>
                    Atualizar meu cadastro
                </Link>
            </Alert>
        )
    }

    return (
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6">
            <div className="flex flex-col gap-1">
                <h2 className="text-xl font-semibold text-foreground">WhatsApp</h2>
                <p className="text-base text-neutral-600 dark:text-neutral-300">
                    Número: <span className="font-medium text-foreground">{estado.telefoneMascarado}</span>
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <p className="text-base text-neutral-600 dark:text-neutral-300">Avisos que chegam pelo WhatsApp:</p>
                <ul className="list-disc pl-5 text-base text-neutral-600 dark:text-neutral-300">
                    {AVISOS.map((a) => (
                        <li key={a}>{a}</li>
                    ))}
                </ul>
            </div>

            <PreferenciaWhatsapp
                ativo={estado.ativo}
                ativoDesde={estado.ativoDesde ? formatarData(estado.ativoDesde) : null}
            />
        </section>
    )
}

const DATA = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo'
})

function formatarData(data: Date): string {
    return DATA.format(data)
}
