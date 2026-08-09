'use client'

import { RadioGroup as Ark } from '@ark-ui/react/radio-group'
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
    erro?: string
    disabled?: boolean
    orientacao?: 'vertical' | 'horizontal'
}

export function RadioGroup({
    id,
    label,
    opcoes,
    name,
    value,
    defaultValue,
    onValueChange,
    erro,
    disabled,
    orientacao = 'vertical'
}: RadioGroupProps) {
    const idErro = erro ? `${id}-erro` : undefined
    return (
        <Ark.Root
            name={name}
            value={value}
            defaultValue={defaultValue}
            onValueChange={(detalhe) => detalhe.value && onValueChange?.(detalhe.value)}
            disabled={disabled}
            orientation={orientacao}
            aria-describedby={idErro}
            className="flex flex-col gap-2"
        >
            <Ark.Label className="text-sm font-medium text-foreground">{label}</Ark.Label>
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
                        <Ark.ItemControl className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface data-[state=checked]:border-primary-600 dark:data-[state=checked]:border-primary-500 data-[state=checked]:after:size-2.5 data-[state=checked]:after:rounded-full data-[state=checked]:after:bg-primary-600 dark:data-[state=checked]:after:bg-primary-500 data-[state=checked]:after:content-['']" />
                        <Ark.ItemText className="text-base text-foreground">{opcao.label}</Ark.ItemText>
                        <Ark.ItemHiddenInput />
                    </Ark.Item>
                ))}
            </div>
            {erro && (
                <p id={idErro} role="alert" className="text-sm text-danger-600 dark:text-danger-400">
                    {erro}
                </p>
            )}
        </Ark.Root>
    )
}
