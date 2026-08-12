import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import { CadastroForm } from './cadastro-form'

export const metadata: Metadata = {
    title: 'Criar conta — SOS Jaraguá'
}

export default function CadastroPage() {
    return (
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 p-4">
            <header className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Criar conta</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Sua conta é o vínculo entre você e a candidatura a voluntário.
                </p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={5} />}>
                <CadastroForm />
            </Suspense>

            <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
                Já tem conta?{' '}
                <Link href="/login" className="font-medium text-primary-600 underline dark:text-primary-400">
                    Entrar
                </Link>
            </p>
        </main>
    )
}
