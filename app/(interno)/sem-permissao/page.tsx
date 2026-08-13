import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

export const metadata: Metadata = {
    title: 'Sem permissão — SOS Jaraguá'
}

/**
 * Destino de quem está autenticado mas não tem a role exigida pela rota
 * (DESIGN.md §6.2). Separado de `/login` de propósito: autenticar de novo não
 * resolveria, e mandar o usuário para o login sugeriria o contrário.
 */
export default function SemPermissaoPage() {
    return (
        <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-4 py-16 text-center">
            <ShieldAlert aria-hidden className="size-12 text-warning-600 dark:text-warning-400" />
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Acesso não permitido</h1>
            <p className="text-base text-neutral-500 dark:text-neutral-400">
                Sua conta não tem permissão para acessar esta área. Se você acredita que isso é um engano, fale com um
                coordenador da Defesa Civil.
            </p>
            <Link href="/" className="font-medium text-primary-600 underline dark:text-primary-400">
                Voltar para a página inicial
            </Link>
        </div>
    )
}
