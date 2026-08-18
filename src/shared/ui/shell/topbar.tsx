'use client'

import Link from 'next/link'
import { LogOut, Menu as MenuIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ANEL_FOCO, cn } from '../cn'
import { Avatar } from '../avatar/avatar'
import { Logo } from '../logo/logo'
import { IconButton } from '../icon-button/icon-button'
import { ThemeToggle } from '../theme/theme-toggle'
import { Tooltip } from '../tooltip/tooltip'

/**
 * Rótulos dos controles só-ícone (015-tooltip-acoes-icone, C-04.3).
 *
 * Ficam em constantes porque cada um alimenta **dois** consumidores — o nome
 * acessível e a dica visual. Duas strings literais iguais escritas em separado
 * divergiriam na primeira vez que alguém ajustasse só uma delas.
 */
const ROTULO_NAVEGACAO = 'Abrir navegação'
const ROTULO_SAIR = 'Sair'

export interface TopbarProps {
    nome: string
    rotuloRole: string
    /** Slot do sino de notificações (NOT-09). Ausente = sino não renderizado. */
    notificacoes?: ReactNode
    /** `false` quando não há itens de navegação — sem gaveta a abrir. */
    mostrarBotaoMenu?: boolean
    /** Abre a gaveta de navegação (013-navegacao-lateral-responsiva). */
    onAbrirNavegacao: () => void
    onSair: () => void
}

/**
 * Barra superior da área autenticada: identificação, notificações, tema,
 * quem está logado e a ação de sair.
 *
 * Presente em **toda** página autenticada, para todos os perfis — sair e
 * alternar tema não podem depender de o usuário ser staff.
 *
 * **Aderente ao topo** (013-navegacao-lateral-responsiva, R-02): permanece
 * visível durante a rolagem do documento, sem ser um contêiner rolante.
 *
 * O botão de navegação é um botão comum. Antes ele era o gatilho de um menu
 * suspenso do Ark, e este componente precisava encaminhar um `ref` para servir
 * de âncora de posicionamento e conhecer o estado `menuAberto`. Uma gaveta se
 * posiciona pela borda da viewport — âncora e estado compartilhado deixaram de
 * existir, e a topbar deixou de ser acoplada à navegação (G-07).
 */
export function Topbar({
    nome,
    rotuloRole,
    notificacoes,
    mostrarBotaoMenu = true,
    onAbrirNavegacao,
    onSair
}: TopbarProps) {
    return (
        <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface p-3">
            <div className="flex items-center gap-2">
                {/* Só abaixo de `lg`: em telas largas a navegação é a coluna. */}
                {mostrarBotaoMenu && (
                    <span className="lg:hidden">
                        <Tooltip conteudo={ROTULO_NAVEGACAO} posicao="bottom">
                            <IconButton
                                aria-label={ROTULO_NAVEGACAO}
                                icone={<MenuIcon aria-hidden className="size-5" />}
                                onClick={onAbrirNavegacao}
                            />
                        </Tooltip>
                    </span>
                )}
                {/*
                  Identificação leva à home — convenção esperada de marca em
                  cabeçalho. `min-h-11` porque vira alvo de toque (§1.3), e a
                  home (`/`) é o destino comum a todos os perfis, sem regra de
                  role.

                  Sem `aria-current`: quem marca a página atual é o item
                  "Página inicial" da navegação. Dois elementos anunciados como
                  atuais confundiriam o leitor de tela.
                */}
                <Link
                    href="/"
                    className={cn(
                        'flex min-h-11 items-center gap-2 rounded-lg px-2 text-lg font-semibold text-foreground lg:hidden',
                        ANEL_FOCO
                    )}
                >
                    {/* `alt` vazio: o nome ao lado já é o texto do link. */}
                    <Logo tamanho="sm" />
                    SOS Jaraguá
                </Link>
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
                {/* `bottom`: a topbar é aderente ao topo — uma dica acima dela
                    sairia da janela e o primitivo teria de virá-la de qualquer
                    forma. Pedir o lado certo evita o salto. */}
                <Tooltip conteudo={ROTULO_SAIR} posicao="bottom">
                    <IconButton
                        aria-label={ROTULO_SAIR}
                        icone={<LogOut aria-hidden className="size-5" />}
                        onClick={onSair}
                    />
                </Tooltip>
            </div>
        </header>
    )
}
