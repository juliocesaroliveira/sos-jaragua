'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import {
    Boxes,
    ClipboardList,
    FileSpreadsheet,
    LayoutDashboard,
    LogOut,
    Menu as MenuIcon,
    PackageMinus,
    PackagePlus,
    Trash2,
    TriangleAlert,
    UserCheck,
    Users,
    X
} from 'lucide-react'
import { signOut } from '@/src/shared/auth/client'
import type { Role } from '@/src/shared/auth/roles'
import { podeAcessar } from '@/src/shared/auth/rotas'
import { Avatar, IconButton, ThemeToggle, cn } from '@/src/shared/ui'

/**
 * Shell da área interna: navegação lateral em `lg+`, gaveta em telas menores
 * (mobile-first, DESIGN_SYSTEM.md §1.7).
 *
 * Os itens são filtrados pela mesma tabela rota→roles usada pelo `proxy.ts`
 * (`podeAcessar`), para que menu e gate nunca divirjam. Esconder o link não é
 * a proteção — é só ergonomia; a proteção está no proxy e no layout servidor.
 */
type ItemNav = { href: string; label: string; icone: ReactNode }

const NAV: ItemNav[] = [
    { href: '/dashboard', label: 'Painel', icone: <LayoutDashboard aria-hidden className="size-5" /> },
    { href: '/cadastros-pendentes', label: 'Cadastros pendentes', icone: <Users aria-hidden className="size-5" /> },
    { href: '/voluntarios', label: 'Voluntários', icone: <UserCheck aria-hidden className="size-5" /> },
    { href: '/atividades', label: 'Atividades', icone: <ClipboardList aria-hidden className="size-5" /> },
    { href: '/estoque/entrada', label: 'Entrada de doações', icone: <PackagePlus aria-hidden className="size-5" /> },
    { href: '/estoque/saida', label: 'Saída de itens', icone: <PackageMinus aria-hidden className="size-5" /> },
    { href: '/estoque/kits', label: 'Kits', icone: <Boxes aria-hidden className="size-5" /> },
    { href: '/estoque/descarte', label: 'Descarte', icone: <Trash2 aria-hidden className="size-5" /> },
    { href: '/crise', label: 'Variáveis da crise', icone: <TriangleAlert aria-hidden className="size-5" /> },
    { href: '/relatorios', label: 'Relatórios', icone: <FileSpreadsheet aria-hidden className="size-5" /> }
]

export interface StaffShellProps {
    nome: string
    role: Role
    rotuloRole: string
    /** Slot do sino de notificações (NOT-09). */
    notificacoes?: ReactNode
    children: ReactNode
}

export function StaffShell({ nome, role, rotuloRole, notificacoes, children }: StaffShellProps) {
    const pathname = usePathname()
    const router = useRouter()
    const [menuAberto, setMenuAberto] = useState(false)

    const itens = NAV.filter((item) => podeAcessar(item.href, role))

    async function sair() {
        await signOut()
        router.push('/login')
        router.refresh()
    }

    return (
        <div className="flex min-h-dvh flex-col lg:flex-row">
            {/* Navegação — gaveta em telas pequenas, coluna fixa em lg+ */}
            <nav
                aria-label="Navegação principal"
                className={cn(
                    'flex flex-col gap-1 border-border bg-surface p-3 lg:w-72 lg:shrink-0 lg:border-r',
                    menuAberto ? 'border-b' : 'hidden lg:flex'
                )}
            >
                <p className="hidden px-3 py-4 text-lg font-semibold text-foreground lg:block">SOS Jaraguá</p>
                {itens.map((item) => {
                    const ativo = pathname === item.href || pathname.startsWith(`${item.href}/`)
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMenuAberto(false)}
                            aria-current={ativo ? 'page' : undefined}
                            className={cn(
                                'flex min-h-11 items-center gap-3 rounded-lg px-3 text-base',
                                ativo
                                    ? 'bg-primary-600 text-primary-foreground dark:bg-primary-500'
                                    : 'text-foreground hover:bg-surface-muted'
                            )}
                        >
                            {item.icone}
                            {item.label}
                        </Link>
                    )
                })}
            </nav>

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex items-center justify-between gap-2 border-b border-border bg-surface p-3">
                    <div className="flex items-center gap-2">
                        <IconButton
                            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
                            icone={
                                menuAberto ? (
                                    <X aria-hidden className="size-5" />
                                ) : (
                                    <MenuIcon aria-hidden className="size-5" />
                                )
                            }
                            onClick={() => setMenuAberto((a) => !a)}
                        />
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
                        <IconButton
                            aria-label="Sair"
                            icone={<LogOut aria-hidden className="size-5" />}
                            onClick={sair}
                        />
                    </div>
                </header>

                <main className="min-w-0 flex-1 p-4">{children}</main>
            </div>
        </div>
    )
}
