'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { gruposVisiveis, itemAtivo, type ItemNavegacao } from '../../auth/navegacao'
import { ANEL_FOCO, cn } from '../cn'
import { Logo } from '../logo/logo'
import { Tooltip } from '../tooltip/tooltip'
import { ICONES } from './icones'
import { aplicarPreferenciaColuna, lerPreferenciaAplicada, PREFERENCIA_PADRAO } from './preferencia-coluna'

/**
 * Navegação lateral: coluna aderente, exclusiva de `lg+`. Abaixo de `lg`, a
 * navegação é a gaveta de `gaveta-navegacao.tsx`
 * (013-navegacao-lateral-responsiva) — este componente não tem variante mobile.
 *
 * Recebe os itens **já filtrados no servidor** — o navegador de um voluntário
 * nunca recebe a lista de destinos internos (contracts/app-shell.md, S-02).
 *
 * Dois estados de apresentação (contracts/coluna-recolhivel.md C-01):
 * `expandida` com ícone e rótulo, `recolhida` como trilha de ícones. A escolha
 * é lembrada entre telas e visitas.
 */
export interface SidebarNavProps {
    itens: readonly ItemNavegacao[]
}

export function SidebarNav({ itens }: SidebarNavProps) {
    const pathname = usePathname()

    /**
     * Começa **sempre** no padrão, inclusive no cliente, para que o primeiro
     * render bata com o HTML do servidor; o valor real já está no atributo do
     * `<html>`, aplicado pelo script inline, então não há salto visual. Ler o
     * armazenamento no inicializador do `useState` causaria erro de hidratação
     * — mesmo cuidado documentado em `theme-provider.tsx` (C-02, R2).
     */
    const [preferencia, setPreferencia] = useState(PREFERENCIA_PADRAO)

    useEffect(() => {
        setPreferencia(lerPreferenciaAplicada())
    }, [])

    // Sem destinos visíveis, uma coluna vazia só rouba espaço. A topbar
    // permanece — sair, tema e identificação não dependem do menu.
    if (itens.length === 0) return null

    const recolhida = preferencia === 'recolhida'
    const ativo = itemAtivo(pathname, itens)
    const secoes = gruposVisiveis(itens)

    function alternar() {
        const proxima = recolhida ? 'expandida' : 'recolhida'
        setPreferencia(proxima)
        aplicarPreferenciaColuna(proxima)
    }

    return (
        <nav
            aria-label="Navegação principal"
            className={cn(
                // `sticky` + altura de viewport, e **não** contêiner rolante da
                // página (R-02/R-03). `self-start` é necessário: sem ele o item
                // flex esticaria até a altura do documento inteiro e o `sticky`
                // não teria dentro de quê grudar.
                //
                // O `overflow-y-auto` aqui é legítimo e não viola FR-001: rola
                // o conteúdo **da própria coluna**, só quando os destinos
                // excedem a altura da janela.
                'hidden flex-col gap-1 border-r border-border bg-surface p-3',
                'lg:sticky lg:top-0 lg:flex lg:h-dvh lg:shrink-0 lg:self-start lg:overflow-y-auto',
                recolhida ? 'lg:w-16 lg:items-center overflow-hidden' : 'lg:w-72'
            )}
        >
            {/*
              Identificação da aplicação nos **dois** estados (C-05, R5): a
              topbar a esconde em `lg+` justamente porque a coluna a exibe. Sem
              a versão reduzida abaixo, a coluna recolhida deixaria a aplicação
              sem identificação alguma.
            */}
            <div className={cn('flex items-center', recolhida ? 'justify-center py-2' : 'justify-between py-2')}>
                {/*
                  Identificação leva à home — convenção esperada de marca em
                  cabeçalho. Sem `aria-current`: quem marca a página atual é o
                  item "Página inicial" logo abaixo; dois elementos anunciados
                  como atuais confundiriam o leitor de tela.
                */}
                <Link
                    href="/"
                    className={cn(
                        'flex min-h-11 items-center rounded-lg',
                        recolhida ? 'w-11 justify-center' : 'px-3',
                        ANEL_FOCO
                    )}
                >
                    {recolhida ? (
                        <>
                            <Logo tamanho="sm" />
                            {/*
                              A marca visível não serve de nome acessível — um
                              link anunciado como "SOS" não diz para onde vai.
                            */}
                            <span className="sr-only">SOS Jaraguá — página inicial</span>
                        </>
                    ) : (
                        <span className="flex items-center gap-2 text-lg font-semibold text-foreground">
                            <Logo tamanho="sm" />
                            SOS Jaraguá
                        </span>
                    )}
                </Link>
            </div>

            <Tooltip conteudo={recolhida ? 'Expandir navegação' : 'Recolher navegação'} posicao="right">
                <button
                    type="button"
                    onClick={alternar}
                    aria-label={recolhida ? 'Expandir navegação' : 'Recolher navegação'}
                    aria-expanded={!recolhida}
                    className={cn(
                        'flex min-h-11 items-center gap-3 rounded-lg px-3 text-neutral-500 hover:bg-surface-muted dark:text-neutral-400',
                        ANEL_FOCO,
                        recolhida ? 'justify-center' : 'justify-start'
                    )}
                >
                    {recolhida ? (
                        <PanelLeftOpen aria-hidden className="size-5 shrink-0" />
                    ) : (
                        <PanelLeftClose aria-hidden className="size-5 shrink-0" />
                    )}
                    {!recolhida && <span className="text-sm">Recolher</span>}
                </button>
            </Tooltip>

            {secoes.map((secao) => (
                <section key={secao.grupo.id} aria-labelledby={`grupo-${secao.grupo.id}`} className="flex flex-col">
                    {/*
                      Recolhida, o rótulo do grupo não cabe — mas a separação
                      entre grupos precisa continuar perceptível (C-06,
                      FR-021). Uma linha divisória assume esse papel, e o rótulo
                      permanece no DOM para leitores de tela.
                    */}
                    <h2
                        id={`grupo-${secao.grupo.id}`}
                        className={cn(
                            'text-xs font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400',
                            recolhida ? 'sr-only' : 'px-3 pt-4 pb-1'
                        )}
                    >
                        {secao.grupo.rotulo}
                    </h2>
                    {recolhida && <hr aria-hidden className="my-2 w-8 self-center border-border" />}

                    {secao.itens.map((item) => {
                        const Icone = ICONES[item.icone]
                        const ehAtivo = item === ativo

                        const destino = (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={ehAtivo ? 'page' : undefined}
                                className={cn(
                                    'flex min-h-11 items-center gap-3 rounded-lg text-base',
                                    ANEL_FOCO,
                                    recolhida ? 'w-11 justify-center px-0' : 'px-3',
                                    ehAtivo
                                        ? 'bg-primary-600 text-primary-foreground dark:bg-primary-500'
                                        : 'text-foreground hover:bg-surface-muted'
                                )}
                            >
                                {Icone ? <Icone aria-hidden className="size-5 shrink-0" /> : null}
                                {/*
                                  Recolhida, o rótulo sai da vista mas **não** do
                                  DOM: dica visual não é nome acessível e não
                                  aparece em toque. Um ícone sem texto associado
                                  seria anunciado como link sem nome (C-04, R3,
                                  FR-019).
                                */}
                                <span className={cn(recolhida && 'sr-only')}>{item.rotulo}</span>
                            </Link>
                        )

                        // A dica visual (FR-018) só faz sentido recolhida —
                        // expandida, o rótulo já está à vista.
                        return recolhida ? (
                            <Tooltip key={item.href} conteudo={item.rotulo} posicao="right">
                                {destino}
                            </Tooltip>
                        ) : (
                            destino
                        )
                    })}
                </section>
            ))}
        </nav>
    )
}
