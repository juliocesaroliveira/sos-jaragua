'use client'

import { Portal } from '@ark-ui/react/portal'
import { Tooltip as Ark } from '@ark-ui/react/tooltip'
import type { ReactNode } from 'react'
import { CLASSE_DICA, cn } from '../cn'

/**
 * Tooltip sobre o primitivo Ark (DESIGN_SYSTEM.md §4.10).
 *
 * Texto de apoio em controles sem rótulo visível — **nunca** como único meio de
 * transmitir informação necessária: não existe apontar sem tocar em tela
 * sensível ao toque, e ali a dica jamais aparece. O nome acessível do controle
 * continua sendo a garantia funcional.
 *
 * ## Os dois papéis de uma dica
 *
 * O primitivo escreve `aria-describedby` no gatilho apontando para o conteúdo.
 * Como o `IconButton` exige `aria-label`, passar o mesmo texto aos dois faz o
 * leitor de tela anunciar **duas vezes** — "Sair, Sair". Daí a distinção:
 *
 * - **Repetição visual** (padrão): a dica só repete, na tela, o nome que o
 *   controle já tem. Ela não acrescenta informação, então não deve ser exposta.
 *   Passamos `aria-label` ao `Root`, e o zag responde omitindo `role="tooltip"`
 *   e o `id` do conteúdo — sem id, o `aria-describedby` fica pendurado e é
 *   ignorado. Referência pendurada é inofensiva; anúncio duplicado não é.
 * - **Descrição** (`descricao`): a dica diz algo que o nome não diz — na
 *   prática, o motivo de a ação estar indisponível. Aí ser anunciada é o
 *   objetivo, e o comportamento padrão do primitivo é mantido.
 *
 * Regra de uso: com o papel padrão, `conteudo` e o nome acessível do controle
 * saem da **mesma expressão** no código. Duas strings literais iguais escritas
 * em separado divergem com o tempo.
 *
 * ## O que já vem pronto do primitivo (não reimplementar)
 *
 * Esc dispensa sem mover o foco; rolagem e clique dispensam; o foco de teclado
 * abre a dica mas o foco vindo de clique de mouse não; toque **nunca** abre
 * (o zag descarta `pointerType === 'touch'`); o lado escolhido é preferência e
 * vira sozinho quando não cabe. A camada — acima de diálogos, gavetas, painéis
 * flutuantes e avisos — vem de `CLASSE_DICA`.
 *
 * Sem animação de entrada/saída, de propósito: sem movimento, não há o que
 * suprimir sob `prefers-reduced-motion`.
 */
export interface TooltipProps {
    /** Texto exibido. pt-BR, imperativo curto, sem pontuação final. */
    conteudo: string
    children: ReactNode
    /** Lado preferido; vira sozinho se não couber. */
    posicao?: 'top' | 'bottom' | 'left' | 'right'
    /** Atraso antes de abrir por ponteiro. O foco de teclado abre sem atraso. */
    atrasoMs?: number
    /**
     * `true` quando a dica **acrescenta** informação ao nome acessível do
     * controle — tipicamente o motivo de a ação estar indisponível. Só então
     * ela é exposta a leitores de tela. Ver "Os dois papéis" acima.
     */
    descricao?: boolean
}

export function Tooltip({ conteudo, children, posicao = 'top', atrasoMs = 300, descricao = false }: TooltipProps) {
    return (
        <Ark.Root
            openDelay={atrasoMs}
            closeDelay={100}
            positioning={{ placement: posicao }}
            // Presente = dica puramente visual; ausente = dica exposta como
            // descrição do controle. É o interruptor descrito acima.
            aria-label={descricao ? undefined : conteudo}
        >
            <Ark.Trigger asChild>{children}</Ark.Trigger>
            <Portal>
                <Ark.Positioner className={CLASSE_DICA}>
                    <Ark.Content
                        className={cn(
                            'rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white shadow-md dark:bg-neutral-700',
                            // Sem limite, "Remover João Pedro de Souza do turno"
                            // vira uma faixa atravessando a tela. O limite também
                            // se prende à janela: 16rem já é maior que a área útil
                            // de um celular estreito.
                            'max-w-[min(16rem,calc(100vw-2rem))] break-words'
                        )}
                    >
                        {conteudo}
                    </Ark.Content>
                </Ark.Positioner>
            </Portal>
        </Ark.Root>
    )
}
