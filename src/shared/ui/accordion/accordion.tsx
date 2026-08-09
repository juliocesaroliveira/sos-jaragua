'use client'

import { Accordion as Ark } from '@ark-ui/react/accordion'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { ANEL_FOCO, cn } from '../cn'

/**
 * Accordion sobre o primitivo Ark (DESIGN_SYSTEM.md §4.9).
 * Uso: detalhes expansíveis em mobile — por exemplo o detalhe de um turno
 * quando o Kanban colapsa para lista em telas pequenas.
 */
export type ItemAccordion = { value: string; titulo: string; conteudo: ReactNode; disabled?: boolean }

export interface AccordionProps {
    itens: readonly ItemAccordion[]
    value?: string[]
    defaultValue?: string[]
    onValueChange?: (valores: string[]) => void
    multiple?: boolean
}

export function Accordion({ itens, value, defaultValue, onValueChange, multiple = false }: AccordionProps) {
    return (
        <Ark.Root
            value={value}
            defaultValue={defaultValue}
            onValueChange={(detalhe) => onValueChange?.(detalhe.value)}
            multiple={multiple}
            collapsible
            className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface"
        >
            {itens.map((item) => (
                <Ark.Item key={item.value} value={item.value} disabled={item.disabled}>
                    <Ark.ItemTrigger
                        className={cn(
                            'flex min-h-11 w-full items-center justify-between gap-3 p-4 text-left text-base font-medium text-foreground hover:bg-surface-muted',
                            'data-disabled:cursor-not-allowed data-disabled:opacity-50',
                            ANEL_FOCO
                        )}
                    >
                        {item.titulo}
                        <Ark.ItemIndicator className="transition-transform data-[state=open]:rotate-180">
                            <ChevronDown aria-hidden className="size-5 text-neutral-500" />
                        </Ark.ItemIndicator>
                    </Ark.ItemTrigger>
                    <Ark.ItemContent className="px-4 pb-4 text-base text-foreground">{item.conteudo}</Ark.ItemContent>
                </Ark.Item>
            ))}
        </Ark.Root>
    )
}
