import { cn } from '../cn'

/**
 * Skeleton — componente próprio (DESIGN_SYSTEM.md §4.15). Usado nos fallbacks
 * de Suspense das listagens e do dashboard.
 */
export interface SkeletonProps {
    /** Classe de altura do Tailwind (ex.: `h-12`, `h-32`). */
    altura?: string
    /** Classe de largura do Tailwind (ex.: `w-full`, `w-32`). */
    largura?: string
    /** `full` para avatares/pills. */
    formato?: 'lg' | 'full'
}

export function Skeleton({ altura = 'h-4', largura = 'w-full', formato = 'lg' }: SkeletonProps) {
    return (
        <div
            aria-hidden
            className={cn(
                'animate-pulse bg-neutral-200 dark:bg-neutral-800',
                formato === 'full' ? 'rounded-full' : 'rounded-lg',
                altura,
                largura
            )}
        />
    )
}

/** Bloco de várias linhas — atalho comum em listagens. */
export function SkeletonLista({ linhas = 5, altura = 'h-12' }: { linhas?: number; altura?: string }) {
    return (
        <div className="flex flex-col gap-2">
            {Array.from({ length: linhas }, (_, i) => (
                <Skeleton key={i} altura={altura} />
            ))}
        </div>
    )
}
