'use client'

import { Checkbox } from '@ark-ui/react/checkbox'
import { Check } from 'lucide-react'
import { ANEL_FOCO, cn } from '../cn'

/**
 * CheckboxGroup sobre o primitivo Ark (DESIGN_SYSTEM.md §4.5).
 * Uso principal: seleção de habilidades no formulário de candidatura.
 */
export type OpcaoCheckbox = { value: string; label: string; disabled?: boolean }

export interface CheckboxGroupProps {
    id: string
    label: string
    opcoes: readonly OpcaoCheckbox[]
    name?: string
    value?: string[]
    defaultValue?: string[]
    onValueChange?: (valores: string[]) => void
    erro?: string
    disabled?: boolean
    /** Layout em grade a partir de `sm` — listas longas ficam navegáveis. */
    colunas?: 1 | 2 | 3
}

const COLUNAS = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3' } as const

export function CheckboxGroup({
    id,
    label,
    opcoes,
    name,
    value,
    defaultValue,
    onValueChange,
    erro,
    disabled,
    colunas = 2
}: CheckboxGroupProps) {
    const idErro = erro ? `${id}-erro` : undefined
    return (
        <fieldset aria-describedby={idErro} className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">{label}</legend>
            <Checkbox.Group
                name={name}
                value={value}
                defaultValue={defaultValue}
                onValueChange={onValueChange}
                disabled={disabled}
                className={cn('grid grid-cols-1 gap-1', COLUNAS[colunas])}
            >
                {opcoes.map((opcao) => (
                    <Checkbox.Root
                        key={opcao.value}
                        value={opcao.value}
                        disabled={opcao.disabled}
                        className={cn(
                            'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-surface-muted',
                            'data-disabled:cursor-not-allowed data-disabled:opacity-50',
                            ANEL_FOCO
                        )}
                    >
                        <Checkbox.Control className="flex size-5 shrink-0 items-center justify-center rounded border border-border-strong bg-surface data-[state=checked]:border-primary-600 data-[state=checked]:bg-primary-600 dark:data-[state=checked]:border-primary-500 dark:data-[state=checked]:bg-primary-500">
                            <Checkbox.Indicator>
                                <Check aria-hidden className="size-4 text-primary-foreground" />
                            </Checkbox.Indicator>
                        </Checkbox.Control>
                        <Checkbox.Label className="text-base text-foreground">{opcao.label}</Checkbox.Label>
                        <Checkbox.HiddenInput />
                    </Checkbox.Root>
                ))}
            </Checkbox.Group>
            {erro && (
                <p id={idErro} role="alert" className="text-sm text-danger-600 dark:text-danger-400">
                    {erro}
                </p>
            )}
        </fieldset>
    )
}
