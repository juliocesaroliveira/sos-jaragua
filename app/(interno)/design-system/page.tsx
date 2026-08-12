import { notFound } from 'next/navigation'
import { Galeria } from './galeria'

/**
 * Galeria do design system (DS-19) — ferramenta de desenvolvimento, não uma
 * tela do produto. Fora de desenvolvimento a rota simplesmente não existe.
 *
 * Fica sob `(interno)` porque o `proxy.ts` já exige sessão para ela (modelo
 * deny-by-default); herdar o shell mantém a regra "toda página autenticada tem
 * navegação" sem exceção. Não entra no menu: não é destino de produto.
 */
export default function DesignSystemPage() {
    if (process.env.NODE_ENV !== 'development') notFound()

    return (
        <div>
            <header className="mb-4 border-b border-border pb-4">
                <h1 className="text-xl font-semibold text-foreground">Design System — validação</h1>
            </header>
            <Galeria />
        </div>
    )
}
