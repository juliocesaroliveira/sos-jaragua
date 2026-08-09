import { notFound } from 'next/navigation'
import { ThemeToggle } from '@/src/shared/ui'
import { Galeria } from './galeria'

/**
 * Galeria do design system (DS-19) — ferramenta de desenvolvimento, não uma
 * tela do produto. Fora de desenvolvimento a rota simplesmente não existe.
 */
export default function DesignSystemPage() {
    if (process.env.NODE_ENV !== 'development') notFound()

    return (
        <div className="min-h-dvh">
            <header className="flex items-center justify-between gap-4 border-b border-border p-4">
                <h1 className="text-xl font-semibold text-foreground">Design System — validação</h1>
                <ThemeToggle />
            </header>
            <Galeria />
        </div>
    )
}
