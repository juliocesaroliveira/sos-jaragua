'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { gruposVisiveis, itemAtivo, type ItemNavegacao } from '../../auth/navegacao'
import { ANEL_FOCO, cn } from '../cn'
import { ICONES } from './icones'

/**
 * Navegação lateral: coluna fixa em `lg+`, gaveta em telas menores
 * (mobile-first, DESIGN_SYSTEM.md §1.7).
 *
 * Recebe os itens **já filtrados no servidor** — o navegador de um voluntário
 * nunca recebe a lista de destinos internos (contracts/app-shell.md, S-02).
 */
export interface SidebarNavProps {
    itens: readonly ItemNavegacao[]
    menuAberto: boolean
    /** Fecha a gaveta ao escolher um destino (FR-022). */
    onNavegar: () => void
}

export function SidebarNav({ itens, menuAberto, onNavegar }: SidebarNavProps) {
    const pathname = usePathname()

    // Sem destinos visíveis, uma coluna vazia só rouba espaço. A topbar
    // permanece — sair, tema e identificação não dependem do menu.
    if (itens.length === 0) return null

    const ativo = itemAtivo(pathname, itens)
    const secoes = gruposVisiveis(itens)

    return (
        <nav
            aria-label="Navegação principal"
            className={cn(
                'flex flex-col gap-1 border-border bg-surface p-3 lg:w-72 lg:shrink-0 lg:border-r',
                menuAberto ? 'border-b' : 'hidden lg:flex'
            )}
        >
            <p className="hidden px-3 py-4 text-lg font-semibold text-foreground lg:block">SOS Jaraguá</p>

            {secoes.map((secao) => (
                <section key={secao.grupo.id} aria-labelledby={`grupo-${secao.grupo.id}`} className="flex flex-col">
                    <h2
                        id={`grupo-${secao.grupo.id}`}
                        className="px-3 pt-4 pb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400"
                    >
                        {secao.grupo.rotulo}
                    </h2>

                    {secao.itens.map((item) => {
                        const Icone = ICONES[item.icone]
                        const ehAtivo = item === ativo
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onNavegar}
                                aria-current={ehAtivo ? 'page' : undefined}
                                className={cn(
                                    'flex min-h-11 items-center gap-3 rounded-lg px-3 text-base',
                                    ANEL_FOCO,
                                    ehAtivo
                                        ? 'bg-primary-600 text-primary-foreground dark:bg-primary-500'
                                        : 'text-foreground hover:bg-surface-muted'
                                )}
                            >
                                {Icone ? <Icone aria-hidden className="size-5 shrink-0" /> : null}
                                {item.rotulo}
                            </Link>
                        )
                    })}
                </section>
            ))}
        </nav>
    )
}
