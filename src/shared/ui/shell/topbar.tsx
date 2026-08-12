'use client'

import type { ReactNode } from 'react'
import { LogOut, Menu as MenuIcon, X } from 'lucide-react'
import { Avatar } from '../avatar/avatar'
import { IconButton } from '../icon-button/icon-button'
import { ThemeToggle } from '../theme/theme-toggle'

export interface TopbarProps {
    nome: string
    rotuloRole: string
    /** Slot do sino de notificações (NOT-09). Ausente = sino não renderizado. */
    notificacoes?: ReactNode
    /** Estado da gaveta, controlado pelo `AppShell`. */
    menuAberto: boolean
    onAlternarMenu: () => void
    /** `false` quando não há itens de navegação — sem menu a abrir. */
    mostrarBotaoMenu?: boolean
    onSair: () => void
}

/**
 * Barra superior da área autenticada: identificação, notificações, tema,
 * quem está logado e a ação de sair.
 *
 * Presente em **toda** página autenticada, para todos os perfis — sair e
 * alternar tema não podem depender de o usuário ser staff.
 */
export function Topbar({
    nome,
    rotuloRole,
    notificacoes,
    menuAberto,
    onAlternarMenu,
    mostrarBotaoMenu = true,
    onSair
}: TopbarProps) {
    return (
        <header className="flex items-center justify-between gap-2 border-b border-border bg-surface p-3">
            <div className="flex items-center gap-2">
                {/* Só abaixo de `lg`: em telas largas a navegação é coluna
                    fixa, e o botão não teria o que alternar (FR-009). */}
                {mostrarBotaoMenu && (
                    <span className="lg:hidden">
                        <IconButton
                            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
                            aria-expanded={menuAberto}
                            icone={
                                menuAberto ? (
                                    <X aria-hidden className="size-5" />
                                ) : (
                                    <MenuIcon aria-hidden className="size-5" />
                                )
                            }
                            onClick={onAlternarMenu}
                        />
                    </span>
                )}
                <span className="text-lg font-semibold text-foreground lg:hidden">SOS Jaraguá</span>
            </div>

            <div className="flex items-center gap-2">
                {notificacoes}
                <ThemeToggle />
                <div className="hidden items-center gap-2 sm:flex">
                    <Avatar nome={nome} tamanho="sm" />
                    <div className="flex flex-col leading-tight">
                        <span className="text-sm font-medium text-foreground">{nome}</span>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">{rotuloRole}</span>
                    </div>
                </div>
                <IconButton aria-label="Sair" icone={<LogOut aria-hidden className="size-5" />} onClick={onSair} />
            </div>
        </header>
    )
}
