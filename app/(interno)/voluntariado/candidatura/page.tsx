import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { obterSessao } from '@/src/shared/auth/sessao'
import { Alert, SkeletonLista } from '@/src/shared/ui'
import { listarHabilidades } from '@/src/modules/voluntariado/presentation/queries/lookups'
import { buscarMinhaCandidatura } from '@/src/modules/voluntariado/presentation/queries/atividades'
import { CandidaturaForm } from './candidatura-form'

export const metadata: Metadata = {
    title: 'Quero ser voluntário — SOS Jaraguá'
}

/**
 * Formulário de candidatura (VOL-02, BRD §3.1).
 *
 * O envio exige conta: `voluntario_perfil` é uma extensão 1:1 de `user`
 * (DB_SCHEMA.md §4.2), e é o `user.id` que a triagem promove a `voluntario`.
 * O caminho de visitante deslogado permanece como defesa, mas hoje não é
 * alcançável: a rota está sob `(interno)`, e o `proxy.ts` já a protegia pelo
 * modelo deny-by-default.
 *
 * Topbar e navegação vêm do `(interno)/layout.tsx` — a página é só conteúdo.
 */
export default function CandidaturaPage() {
    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-4">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Quero ser voluntário</h1>
                <p className="text-base text-neutral-600 dark:text-neutral-300">
                    Preencha seus dados. A Defesa Civil de Jaraguá do Sul faz a triagem e entra em contato pelo e-mail
                    cadastrado.
                </p>
            </div>

            <Suspense fallback={<SkeletonLista linhas={6} altura="h-16" />}>
                <ConteudoCandidatura />
            </Suspense>
        </div>
    )
}

async function ConteudoCandidatura() {
    const ator = await obterSessao()

    if (!ator) {
        return (
            <Alert tom="info" titulo="Entre na sua conta para continuar">
                <p className="mb-3">
                    A candidatura fica vinculada à sua conta — é por ela que avisamos o resultado da triagem e as
                    atividades atribuídas.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Link
                        href="/login?redirecionar=%2Fvoluntariado%2Fcandidatura"
                        className="inline-flex h-11 items-center justify-center rounded-lg bg-primary-600 px-4 font-medium text-primary-foreground dark:bg-primary-500"
                    >
                        Entrar
                    </Link>
                    <Link
                        href="/cadastro?redirecionar=%2Fvoluntariado%2Fcandidatura"
                        className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-4 font-medium text-foreground"
                    >
                        Criar conta
                    </Link>
                </div>
            </Alert>
        )
    }

    const [habilidades, candidatura] = await Promise.all([listarHabilidades(), buscarMinhaCandidatura(ator.userId)])

    return (
        <CandidaturaForm
            habilidades={habilidades}
            statusAtual={candidatura?.status}
            motivoRejeicao={candidatura?.motivoRejeicao}
        />
    )
}
