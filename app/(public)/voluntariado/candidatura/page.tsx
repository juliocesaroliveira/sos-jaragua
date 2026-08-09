import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { obterSessao } from '@/src/shared/auth/sessao'
import { Alert, SkeletonLista, ThemeToggle } from '@/src/shared/ui'
import { listarHabilidades } from '@/src/modules/voluntariado/presentation/queries/lookups'
import { buscarMinhaCandidatura } from '@/src/modules/voluntariado/presentation/queries/atividades'
import { CandidaturaForm } from './candidatura-form'

export const metadata: Metadata = {
    title: 'Quero ser voluntário — SOS Jaraguá'
}

/**
 * Formulário público de candidatura (VOL-02, BRD §3.1).
 *
 * A página é pública, mas o envio exige conta: `voluntario_perfil` é uma
 * extensão 1:1 de `user` (DB_SCHEMA.md §4.2), e é o `user.id` que a triagem
 * promove a `voluntario`. Quem chega deslogado vê o convite a entrar/criar
 * conta em vez de um formulário que não teria como ser salvo.
 */
export default function CandidaturaPage() {
    return (
        <div className="flex min-h-dvh flex-col">
            <header className="flex items-center justify-between gap-4 border-b border-border p-4">
                <Link href="/" className="text-lg font-semibold text-foreground">
                    SOS Jaraguá
                </Link>
                <ThemeToggle />
            </header>

            <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 py-8">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                        Quero ser voluntário
                    </h1>
                    <p className="text-base text-neutral-600 dark:text-neutral-300">
                        Preencha seus dados. A Defesa Civil de Jaraguá do Sul faz a triagem e entra em contato pelo
                        e-mail cadastrado.
                    </p>
                </div>

                <Suspense fallback={<SkeletonLista linhas={6} altura="h-16" />}>
                    <ConteudoCandidatura />
                </Suspense>
            </main>
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
