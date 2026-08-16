'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { gruposVisiveis, itemAtivo, type ItemNavegacao } from '../../auth/navegacao'
import { ANEL_FOCO, cn } from '../cn'
import { Drawer } from '../drawer/drawer'
import { ICONES } from './icones'

/**
 * Gaveta de navegação para telas pequenas (013-navegacao-lateral-responsiva,
 * contracts/gaveta-navegacao.md).
 *
 * Substitui `menu-mobile.tsx`, que era construído sobre o `Menu` do Ark — um
 * menu de **ações**. A diferença não é estética: aquele componente aplicava
 * semântica de menu (`role="menu"`/`menuitem`, navegação por setas, typeahead)
 * a links de navegação, e leitores de tela anunciavam um menu onde havia
 * navegação (G-02).
 *
 * Construída sobre o `Drawer` do projeto — o mesmo primitivo `Dialog` já usado
 * pelo sino de notificações — em vez de um painel próprio (G-01, Princípio VI).
 *
 * **Comportamentos que não estão aqui porque vêm do primitivo** (G-03,
 * verificado em `@zag-js/dialog`, todos default `true`): contenção de foco,
 * travamento de rolagem de fundo, devolução de foco ao gatilho, fechamento por
 * Esc e por toque fora. Não reimplementar.
 */
export interface GavetaNavegacaoProps {
    itens: readonly ItemNavegacao[]
    aberta: boolean
    onAbertaChange: (aberta: boolean) => void
}

/** Marca da entrada de histórico empilhada ao abrir a gaveta. */
const ESTADO_HISTORICO = 'gaveta-navegacao'

export function GavetaNavegacao({ itens, aberta, onAbertaChange }: GavetaNavegacaoProps) {
    const pathname = usePathname()

    /**
     * Fechamento pelo gesto/botão de voltar do sistema (G-04, FR-008).
     *
     * Abrir empilha uma entrada de histórico; `popstate` fecha a gaveta. Fechar
     * por qualquer outro caminho **desempilha** a entrada — o par é obrigatório:
     * empilhar sem desempilhar faria o histórico acumular, e o usuário passaria
     * a precisar apertar voltar duas vezes para sair da tela.
     *
     * O uso da API nativa é autorizado pela documentação do Next instalado, que
     * afirma que `pushState` se integra ao roteador
     * (`docs/01-app/01-getting-started/04-linking-and-navigating.md`).
     */
    const empilhouRef = useRef(false)

    useEffect(() => {
        if (!aberta) return

        window.history.pushState({ [ESTADO_HISTORICO]: true }, '')
        empilhouRef.current = true

        function aoVoltar() {
            // O navegador já removeu nossa entrada ao disparar `popstate`;
            // marcar antes de fechar evita que a limpeza abaixo chame
            // `history.back()` de novo e engula a entrada anterior do usuário.
            empilhouRef.current = false
            onAbertaChange(false)
        }

        window.addEventListener('popstate', aoVoltar)

        return () => {
            window.removeEventListener('popstate', aoVoltar)
            // Fechou por destino, fundo ou Esc: a entrada ainda está lá e
            // precisa sair, senão o voltar seguinte só a consumiria sem navegar.
            if (empilhouRef.current) {
                empilhouRef.current = false
                window.history.back()
            }
        }
    }, [aberta, onAbertaChange])

    // Sem destinos visíveis, a topbar não oferece o botão — a gaveta nunca abre.
    if (itens.length === 0) return null

    const ativo = itemAtivo(pathname, itens)
    const secoes = gruposVisiveis(itens)

    return (
        <Drawer open={aberta} onOpenChange={onAbertaChange} lado="left" titulo="SOS Jaraguá" descricao="Navegação">
            {/*
              Landmark de navegação com links de verdade — é o que FR-007 pede
              e o que a implementação anterior não entregava.
            */}
            <nav aria-label="Navegação principal" className="flex flex-col gap-1">
                {secoes.map((secao) => (
                    <section
                        key={secao.grupo.id}
                        aria-labelledby={`gaveta-grupo-${secao.grupo.id}`}
                        className="flex flex-col"
                    >
                        <h2
                            id={`gaveta-grupo-${secao.grupo.id}`}
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
                                    aria-current={ehAtivo ? 'page' : undefined}
                                    onClick={() => onAbertaChange(false)}
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
        </Drawer>
    )
}
