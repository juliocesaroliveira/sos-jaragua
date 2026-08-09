import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import {
    Alert,
    Badge,
    COR_STATUS_ATIVIDADE,
    ROTULO_STATUS_ATIVIDADE,
    SkeletonLista,
    ThemeToggle
} from '@/src/shared/ui'
import { exigirRoles } from '@/src/shared/auth/sessao'
import { listarMinhasAtividades } from '@/src/modules/voluntariado/presentation/queries/atividades'

export const metadata: Metadata = {
    title: 'Minhas atividades — SOS Jaraguá'
}

/**
 * Área do voluntário (VOL-13, BRD §2). Fora do shell `(staff)`: um voluntário
 * não tem acesso ao painel interno, só aos próprios turnos.
 *
 * A leitura depende de quem está autenticado, então o segmento não é
 * prerenderizável (DESIGN.md §7 — dados derivados de sessão nunca são cacheados).
 */
export const instant = false

export default function MinhasAtividadesPage() {
    return (
        <div className="flex min-h-dvh flex-col">
            <header className="flex items-center justify-between gap-4 border-b border-border p-4">
                <Link href="/" className="text-lg font-semibold text-foreground">
                    SOS Jaraguá
                </Link>
                <ThemeToggle />
            </header>

            <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 py-8">
                <header className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Minhas atividades</h1>
                    <p className="text-base text-neutral-500 dark:text-neutral-400">
                        Turnos em que você está escalado, do mais próximo ao mais distante.
                    </p>
                </header>

                <Suspense fallback={<SkeletonLista linhas={3} altura="h-24" />}>
                    <Lista />
                </Suspense>
            </main>
        </div>
    )
}

async function Lista() {
    const ator = await exigirRoles(
        ['voluntario', 'membro_defesa_civil', 'coordenador', 'administrador'],
        '/voluntariado/minhas-atividades'
    )
    const atividades = await listarMinhasAtividades(ator.userId)

    if (atividades.length === 0) {
        return (
            <Alert tom="info" titulo="Você ainda não tem turnos atribuídos">
                Quando a coordenação escalar você para uma atividade, ela aparece aqui e você recebe uma notificação.
            </Alert>
        )
    }

    return (
        <ul className="flex flex-col gap-3">
            {atividades.map((a) => (
                <li
                    key={a.alocacaoId}
                    className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4 shadow-sm"
                >
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-foreground">{a.titulo}</p>
                        <Badge cor={COR_STATUS_ATIVIDADE[a.statusAtividade]}>
                            {ROTULO_STATUS_ATIVIDADE[a.statusAtividade]}
                        </Badge>
                    </div>
                    <p className="text-base text-foreground">
                        {formatarDataCompleta(a.inicio)} · {formatarHora(a.inicio)} – {formatarHora(a.fim)}
                    </p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                        {a.categoria} · {a.local}
                    </p>
                </li>
            ))}
        </ul>
    )
}

const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const DATA_COMPLETA = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'America/Sao_Paulo'
})

function formatarHora(iso: string) {
    return HORA.format(new Date(iso))
}

function formatarDataCompleta(iso: string) {
    return DATA_COMPLETA.format(new Date(iso))
}
