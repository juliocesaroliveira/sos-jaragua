import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
    title: 'Entrar — SOS Jaraguá'
}

export default function LoginPage() {
    return (
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 p-4">
            <header className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Entrar</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Acesse o painel de gestão da Defesa Civil de Jaraguá do Sul.
                </p>
            </header>

            {/* `useSearchParams` no formulário exige um limite de Suspense. */}
            <Suspense fallback={<SkeletonLista linhas={4} />}>
                <LoginForm />
            </Suspense>

            <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
                Quer ser voluntário?{' '}
                <Link
                    href="/voluntariado/candidatura"
                    className="font-medium text-primary-600 underline dark:text-primary-400"
                >
                    Preencha a candidatura
                </Link>
            </p>
        </main>
    )
}
