import Link from 'next/link'
import { Compass } from 'lucide-react'
import { ANEL_FOCO, cn } from '../cn'

/**
 * Conteúdo da página de endereço não encontrado
 * (specs/003-not-found-page/contracts/nao-encontrado.md).
 *
 * **Não recebe o ator nem a lista de navegação.** A ausência de vazamento
 * (FR-009/FR-015) é propriedade do tipo, não disciplina de quem edita: a
 * variante sem sessão simplesmente não tem por onde receber identidade ou
 * destinos internos.
 *
 * Também não recebe o endereço solicitado (FR-017) — ecoá-lo na tela
 * convidaria a injeção de conteúdo pela URL, sem benefício algum para quem
 * está tentando se reencontrar.
 */
export interface ConteudoNaoEncontradoProps {
    /** Vem de `destinoDeRetorno(temSessao)`; o componente não decide. */
    destino: string
    rotuloBotao: string
}

export function ConteudoNaoEncontrado({ destino, rotuloBotao }: ConteudoNaoEncontradoProps) {
    return (
        <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-4 py-16 text-center">
            <Compass aria-hidden className="size-12 text-neutral-400 dark:text-neutral-500" />

            {/* A condição é comunicada por texto, não só pelo ícone (FR-021). */}
            <p className="text-sm font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
                Erro 404
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Endereço não encontrado</h1>

            {/* Sem distinguir "nunca existiu" de "foi removido" (FR-015). */}
            <p className="text-base text-neutral-500 dark:text-neutral-400">
                A página que você tentou abrir não existe. Ela pode ter sido movida, ou o endereço pode ter sido
                digitado com algum erro.
            </p>

            <Link
                href={destino}
                className={cn(
                    'inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-base font-medium',
                    'bg-primary-600 text-primary-foreground hover:bg-primary-700',
                    'dark:bg-primary-500 dark:hover:bg-primary-600',
                    ANEL_FOCO
                )}
            >
                {rotuloBotao}
            </Link>
        </div>
    )
}
