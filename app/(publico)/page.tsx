import Link from 'next/link'
import { HandHeart, LogIn, PackageSearch } from 'lucide-react'
import { ThemeToggle } from '@/src/shared/ui'

/**
 * Landing pública (DESIGN.md §5). Excluída do matcher do `proxy.ts` — é a única
 * porta de entrada para quem ainda não tem conta.
 */
export default function Home() {
    return (
        <div className="flex min-h-dvh flex-col">
            <header className="flex items-center justify-between gap-4 border-b border-border p-4">
                <p className="text-lg font-semibold text-foreground">SOS Jaraguá</p>
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <Link
                        href="/login"
                        className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-4 text-base font-medium text-foreground hover:bg-surface-muted"
                    >
                        <LogIn aria-hidden className="size-5" />
                        Entrar
                    </Link>
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 p-4 py-16">
                <div className="flex flex-col gap-4">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                        Gestão e mobilização em situações de emergência
                    </h1>
                    <p className="text-lg text-neutral-600 dark:text-neutral-300">
                        Plataforma da Defesa Civil de Jaraguá do Sul para organizar voluntários, doações e a logística
                        de atendimento à população durante uma crise.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Link
                        href="/voluntariado/candidatura"
                        className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-6 shadow-sm hover:bg-surface-muted"
                    >
                        <HandHeart aria-hidden className="size-6 text-primary-600 dark:text-primary-400" />
                        <h2 className="text-xl font-semibold text-foreground">Quero ser voluntário</h2>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            Preencha a candidatura. A Defesa Civil faz a triagem e entra em contato.
                        </p>
                    </Link>

                    <Link
                        href="/login"
                        className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-6 shadow-sm hover:bg-surface-muted"
                    >
                        <PackageSearch aria-hidden className="size-6 text-primary-600 dark:text-primary-400" />
                        <h2 className="text-xl font-semibold text-foreground">Sou da equipe</h2>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            Acesse o painel de estoque, atividades e indicadores de crise.
                        </p>
                    </Link>
                </div>
            </main>

            <footer className="border-t border-border p-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
                Defesa Civil de Jaraguá do Sul
            </footer>
        </div>
    )
}
