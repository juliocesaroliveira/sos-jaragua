'use client'

import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { signOut } from '../../auth/client'
import type { ItemNavegacao } from '../../auth/navegacao'
import { SidebarNav } from './sidebar-nav'
import { Topbar } from './topbar'

/**
 * Shell da área autenticada — topbar + navegação lateral, presente em **toda**
 * página que exige sessão, para todos os perfis.
 *
 * `role` chega já validada por `auth.api.getSession` no Server Component pai;
 * nunca é lida de estado do cliente (contracts/app-shell.md, S-01). Esconder um
 * item do menu é ergonomia, não autorização: a proteção está no `proxy.ts` e
 * nos gates de layout (S-03).
 */
export interface AppShellProps {
    /**
     * Destinos já filtrados pelo perfil **no servidor** — a role nunca é lida
     * de estado do cliente, e a lista completa nunca é serializada para quem
     * não tem direito a ela (S-01, S-02).
     */
    itens: readonly ItemNavegacao[]
    nome: string
    rotuloRole: string
    /** Slot do sino de notificações (NOT-09). */
    notificacoes?: ReactNode
    children: ReactNode
}

export function AppShell({ itens, nome, rotuloRole, notificacoes, children }: AppShellProps) {
    const router = useRouter()
    const [menuAberto, setMenuAberto] = useState(false)

    async function sair() {
        await signOut()
        router.push('/login')
        // Sem o refresh, o shell autenticado permaneceria no cache do roteador
        // do cliente depois de a sessão terminar.
        router.refresh()
    }

    return (
        <div className="flex min-h-dvh flex-col lg:flex-row">
            <SidebarNav itens={itens} menuAberto={menuAberto} onNavegar={() => setMenuAberto(false)} />

            <div className="flex min-w-0 flex-1 flex-col">
                <Topbar
                    nome={nome}
                    rotuloRole={rotuloRole}
                    notificacoes={notificacoes}
                    menuAberto={menuAberto}
                    onAlternarMenu={() => setMenuAberto((a) => !a)}
                    mostrarBotaoMenu={itens.length > 0}
                    onSair={sair}
                />

                <main className="min-w-0 flex-1 p-4">{children}</main>
            </div>
        </div>
    )
}
