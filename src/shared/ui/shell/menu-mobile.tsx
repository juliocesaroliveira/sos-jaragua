'use client'

import { Menu as Ark } from '@ark-ui/react/menu'
import { Portal } from '@ark-ui/react/portal'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { gruposVisiveis, itemAtivo, type ItemNavegacao } from '../../auth/navegacao'
import { ANEL_FOCO, CLASSE_FLUTUANTE, cn } from '../cn'
import { ICONES } from './icones'

/**
 * Painel de navegação mobile/tablet (abaixo de `lg`), ancorado ao `Topbar`
 * via o mesmo menu Ark UI controlado por `AppShell` (005-mobile-menu-panel).
 *
 * Consome o menu compartilhado por contexto — precisa ser renderizado dentro
 * de `<Ark.RootProvider>` (`app-shell.tsx`). O gatilho (botão de hambúrguer)
 * vive em `Topbar`, não aqui: `Ark.Trigger` e este conteúdo compartilham o
 * mesmo estado por estarem sob o mesmo provider (contracts/mobile-menu-panel.md,
 * M-01, M-03).
 */
export interface MenuMobileProps {
    itens: readonly ItemNavegacao[]
}

export function MenuMobile({ itens }: MenuMobileProps) {
    const pathname = usePathname()

    // Sem destinos visíveis, `Topbar` não renderiza o botão de menu
    // (`mostrarBotaoMenu`) — sem gatilho, este painel nunca abre.
    if (itens.length === 0) return null

    const ativo = itemAtivo(pathname, itens)
    const secoes = gruposVisiveis(itens)

    return (
        <Portal>
            <Ark.Positioner className={cn(CLASSE_FLUTUANTE, 'lg:hidden')}>
                <Ark.Content
                    className={cn(
                        'flex max-h-[70dvh] flex-col gap-1 overflow-y-auto border-b border-border bg-surface p-3 shadow-md',
                        ANEL_FOCO
                    )}
                >
                    {secoes.map((secao) => (
                        <Ark.ItemGroup key={secao.grupo.id} className="flex flex-col">
                            <Ark.ItemGroupLabel className="px-3 pt-4 pb-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
                                {secao.grupo.rotulo}
                            </Ark.ItemGroupLabel>

                            {secao.itens.map((item) => {
                                const Icone = ICONES[item.icone]
                                const ehAtivo = item === ativo
                                return (
                                    <Ark.Item key={item.href} value={item.href} asChild>
                                        <Link
                                            href={item.href}
                                            aria-current={ehAtivo ? 'page' : undefined}
                                            className={cn(
                                                'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-base',
                                                'data-highlighted:bg-surface-muted',
                                                ehAtivo
                                                    ? 'bg-primary-600 text-primary-foreground dark:bg-primary-500'
                                                    : 'text-foreground'
                                            )}
                                        >
                                            {Icone ? <Icone aria-hidden className="size-5 shrink-0" /> : null}
                                            {item.rotulo}
                                        </Link>
                                    </Ark.Item>
                                )
                            })}
                        </Ark.ItemGroup>
                    ))}
                </Ark.Content>
            </Ark.Positioner>
        </Portal>
    )
}
