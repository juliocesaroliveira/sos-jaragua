import type { Metadata } from 'next'
import Link from 'next/link'
import { atalhosDeNavegacao } from '@/src/shared/auth/navegacao'
import { ROTULO_ROLE } from '@/src/shared/auth/roles'
import { exigirSessao } from '@/src/shared/auth/sessao'
import { Alert, ANEL_FOCO, cn } from '@/src/shared/ui'
import { ICONES } from '@/src/shared/ui/shell/icones'

export const metadata: Metadata = {
    title: 'Início — SOS Jaraguá'
}

/**
 * Home autenticada — os cards de acesso rápido saem de `atalhosDeNavegacao`,
 * o mesmo registro que monta o menu lateral. Card e item de menu nunca podem
 * divergir da autorização porque ambos derivam da mesma lista já filtrada pelo
 * perfil (specs/002-role-based-app-shell/contracts/navegacao.md).
 *
 * Topbar e navegação vêm do `(interno)/layout.tsx` — a página é só conteúdo.
 */
export const instant = false

export default async function HomePage() {
    const ator = await exigirSessao()
    const atalhos = atalhosDeNavegacao(ator.role)

    // `exigirSessao` já roda no layout; aqui a chamada é memoizada por request
    // (`obterSessao`), então não custa uma segunda leitura de sessão.
    const primeiroNome = ator.nome.trim().split(/\s+/)[0]

    return (
        <div className="flex flex-col gap-8">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Olá, {primeiroNome}</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Você está conectado como {ROTULO_ROLE[ator.role]}.
                </p>
            </header>

            <section aria-labelledby="acesso-rapido" className="flex flex-col gap-4">
                <h2 id="acesso-rapido" className="text-xl font-semibold text-foreground">
                    Acesso rápido
                </h2>

                {atalhos.length === 0 ? (
                    <Alert tom="info" titulo="Nenhuma ação disponível ainda">
                        Sua conta ainda não tem áreas liberadas. Se você acredita que isso é um engano, fale com um
                        coordenador da Defesa Civil.
                    </Alert>
                ) : (
                    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {atalhos.map((item) => {
                            const Icone = ICONES[item.icone]
                            return (
                                <li key={item.href} className="flex">
                                    <Link
                                        href={item.href}
                                        className={cn(
                                            'flex w-full flex-col gap-2 rounded-xl border border-border bg-surface p-5 shadow-sm',
                                            'hover:bg-surface-muted',
                                            ANEL_FOCO
                                        )}
                                    >
                                        <span className="flex items-center gap-3">
                                            {Icone ? (
                                                <Icone
                                                    aria-hidden
                                                    className="size-6 shrink-0 text-primary-600 dark:text-primary-400"
                                                />
                                            ) : null}
                                            <span className="text-lg font-semibold text-foreground">{item.rotulo}</span>
                                        </span>
                                        <span className="text-sm text-neutral-600 dark:text-neutral-300">
                                            {item.atalho.descricao}
                                        </span>
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </section>
        </div>
    )
}
