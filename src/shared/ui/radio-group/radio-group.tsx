'use client'

import { RadioGroup as Ark } from '@ark-ui/react/radio-group'
import type { Ref } from 'react'
import { FaixaMensagem, idsCampo } from '../campo/campo'
import { ANEL_FOCO, cn } from '../cn'

/**
 * RadioGroup sobre o primitivo Ark (DESIGN_SYSTEM.md §4.5).
 * Uso: tipo de veículo, condição do item — conjuntos curtos de opções.
 */
export type OpcaoRadio = { value: string; label: string; disabled?: boolean }

export interface RadioGroupProps {
    id: string
    label: string
    opcoes: readonly OpcaoRadio[]
    name?: string
    value?: string
    defaultValue?: string
    onValueChange?: (valor: string) => void
    /** Texto de apoio na mesma faixa do erro, como nos demais campos (FR-008). */
    apoio?: string
    erro?: string
    obrigatorio?: boolean
    disabled?: boolean
    orientacao?: 'vertical' | 'horizontal'
    /** Alvo do foco quando o envio é bloqueado (FR-011) — recebe `field.ref` do `Controller`. */
    ref?: Ref<HTMLDivElement>
}

export function RadioGroup({
    id,
    label,
    opcoes,
    name,
    value,
    defaultValue,
    onValueChange,
    apoio,
    erro,
    obrigatorio,
    disabled,
    orientacao = 'vertical',
    ref
}: RadioGroupProps) {
    /*
      Mesma faixa de mensagem dos campos de texto (016-formularios-rhf-zod,
      research.md D7). O que **não** é compartilhado é a moldura `Campo`
      inteira: ela emite `<label htmlFor>`, e um grupo de rádios não tem um
      controle único para o rótulo apontar — aqui o rótulo é o `Ark.Label` do
      próprio grupo.
    */
    const ids = idsCampo(id, Boolean(erro), Boolean(apoio))
    return (
        <Ark.Root
            ref={ref}
            name={name}
            value={value}
            defaultValue={defaultValue}
            onValueChange={(detalhe) => detalhe.value && onValueChange?.(detalhe.value)}
            disabled={disabled}
            orientation={orientacao}
            aria-describedby={ids.describedBy}
            aria-invalid={erro ? true : undefined}
            className="flex flex-col gap-2"
        >
            <Ark.Label className="text-sm font-medium text-foreground">
                {label}
                {obrigatorio && (
                    <span aria-hidden className="ml-1 text-danger-600 dark:text-danger-400">
                        *
                    </span>
                )}
                {obrigatorio && <span className="sr-only"> (obrigatório)</span>}
            </Ark.Label>
            <div className={cn('flex gap-1', orientacao === 'vertical' ? 'flex-col' : 'flex-wrap')}>
                {opcoes.map((opcao) => (
                    <Ark.Item
                        key={opcao.value}
                        value={opcao.value}
                        disabled={opcao.disabled}
                        className={cn(
                            'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-surface-muted',
                            'data-disabled:cursor-not-allowed data-disabled:opacity-50',
                            ANEL_FOCO
                        )}
                    >
                        <Ark.ItemControl
                            className={cn(
                                "flex size-5 shrink-0 items-center justify-center rounded-full border bg-surface data-[state=checked]:border-primary-600 dark:data-[state=checked]:border-primary-500 data-[state=checked]:after:size-2.5 data-[state=checked]:after:rounded-full data-[state=checked]:after:bg-primary-600 dark:data-[state=checked]:after:bg-primary-500 data-[state=checked]:after:content-['']",
                                erro ? 'border-danger-500' : 'border-border-strong'
                            )}
                        />
                        <Ark.ItemText className="text-base text-foreground">{opcao.label}</Ark.ItemText>
                        <Ark.ItemHiddenInput />
                    </Ark.Item>
                ))}
            </div>
            <FaixaMensagem ids={ids} apoio={apoio} erro={erro} />
        </Ark.Root>
    )
}
