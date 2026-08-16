'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { signOut } from '../../auth/client'
import type { ItemNavegacao } from '../../auth/navegacao'
import { GavetaNavegacao } from './gaveta-navegacao'
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

/** Mesmo limiar do `lg:` do Tailwind, onde a coluna substitui a gaveta. */
const LARGURA_COLUNA_PX = 1024

export function AppShell({ itens, nome, rotuloRole, notificacoes, children }: AppShellProps) {
    const router = useRouter()
    const [gavetaAberta, setGavetaAberta] = useState(false)

    /**
     * Ao cruzar o limiar para telas grandes, a gaveta fecha
     * (013-navegacao-lateral-responsiva, data-model.md E2): a coluna assume, e
     * as duas formas de navegação nunca coexistem.
     */
    useEffect(() => {
        if (!gavetaAberta) return

        const consulta = window.matchMedia(`(min-width: ${LARGURA_COLUNA_PX}px)`)
        if (consulta.matches) {
            setGavetaAberta(false)
            return
        }

        function aoMudar(evento: MediaQueryListEvent) {
            if (evento.matches) setGavetaAberta(false)
        }

        consulta.addEventListener('change', aoMudar)
        return () => consulta.removeEventListener('change', aoMudar)
    }, [gavetaAberta])

    async function sair() {
        await signOut()
        router.push('/login')
        // Sem o refresh, o shell autenticado permaneceria no cache do roteador
        // do cliente depois de a sessão terminar.
        router.refresh()
    }

    return (
        <>
            {/*
              `min-h-dvh` e **não** `h-dvh` + `overflow-hidden`
              (013-navegacao-lateral-responsiva, contracts/arquitetura-rolagem.md R-01).

              A caixa travada na altura da janela com o `<main>` rolando por
              dentro era a origem dos três sintomas relatados: a barra de
              endereço do celular nunca se recolhia (só rolagem de **documento**
              a aciona), o travamento de rolagem de fundo dos diálogos não fazia
              efeito (ele age sobre o documento, que não era quem rolava), e
              conteúdo longo podia exibir duas barras ao mesmo tempo.

              `min-h-dvh` deixa a página crescer além da janela — quem rola
              passa a ser o documento. Não reintroduzir `overflow-y-auto` aqui
              nem no `<main>`.
            */}
            <div className="flex min-h-dvh flex-col lg:flex-row">
                <SidebarNav itens={itens} />

                <div className="flex min-w-0 flex-1 flex-col">
                    <Topbar
                        nome={nome}
                        rotuloRole={rotuloRole}
                        notificacoes={notificacoes}
                        mostrarBotaoMenu={itens.length > 0}
                        onAbrirNavegacao={() => setGavetaAberta(true)}
                        onSair={sair}
                    />

                    <main className="min-w-0 flex-1 p-4">{children}</main>
                </div>
            </div>

            <GavetaNavegacao itens={itens} aberta={gavetaAberta} onAbertaChange={setGavetaAberta} />
        </>
    )
}
