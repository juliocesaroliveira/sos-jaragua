import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { obterSessao } from '@/src/shared/auth/sessao'
import { AREA_PADRAO } from '@/src/shared/auth/rotas'
import { Logo, SkeletonLista } from '@/src/shared/ui'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
    title: 'Entrar — SOS Jaraguá'
}

/**
 * Checa sessão a cada requisição para redirecionar quem já está autenticado
 * (FR-003) — dado derivado de sessão, não prerenderizável (DESIGN.md §7).
 */
export const instant = false

export default async function LoginPage() {
    // Usuário já autenticado não deve ver o formulário de login (FR-003).
    const ator = await obterSessao()
    if (ator) redirect(AREA_PADRAO)

    return (
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 p-4">
            <header className="flex flex-col gap-2">
                {/*
                  Única identificação visual da tela — não há shell autenticado
                  aqui —, então a marca leva texto alternativo de verdade.
                */}
                <Logo tamanho="lg" alt="SOS Jaraguá — Defesa Civil de Jaraguá do Sul" className="mb-2" />
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Entrar</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Acesse o painel de gestão da Defesa Civil de Jaraguá do Sul.
                </p>
            </header>

            {/* `useSearchParams` no formulário exige um limite de Suspense. */}
            <Suspense fallback={<SkeletonLista linhas={4} />}>
                <LoginForm />
            </Suspense>
        </main>
    )
}
