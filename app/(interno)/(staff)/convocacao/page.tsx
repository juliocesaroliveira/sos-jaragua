import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import { listarHabilidades } from '@/src/modules/voluntariado/presentation/queries/lookups'
import { listarVoluntarios } from '@/src/modules/voluntariado/presentation/queries/candidaturas'
import { ConvocacaoForm } from './convocacao-form'
import { exigirAcessoA } from '@/src/shared/auth/sessao'

export const metadata: Metadata = {
    title: 'Convocação de urgência — SOS Jaraguá'
}

/** BRD §6 / NOT-05 — broadcast de urgência para a base de voluntários. */
export default function ConvocacaoPage() {
    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                    Convocação de urgência
                </h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Mensagem em massa para os voluntários aprovados.
                </p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={4} altura="h-16" />}>
                <Formulario />
            </Suspense>
        </div>
    )
}

async function Formulario() {
    // Checagem autoritativa: o `proxy.ts` deixa passar quando o cache de
    // sessão em cookie não está disponível, e `(staff)/layout.tsx` só exige
    // ROLES_STAFF (DESIGN.md §6.2).
    await exigirAcessoA('/convocacao')

    const [habilidades, aprovados] = await Promise.all([
        listarHabilidades(),
        listarVoluntarios({ page: 1, pageSize: 1, status: 'aprovado' })
    ])

    return <ConvocacaoForm habilidades={habilidades} totalAprovados={aprovados.totalCount} />
}
