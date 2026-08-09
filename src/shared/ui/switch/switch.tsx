'use client'

import { Switch as Ark } from '@ark-ui/react/switch'
import { ANEL_FOCO, cn } from '../cn'

/**
 * Switch sobre o primitivo Ark (DESIGN_SYSTEM.md §4.5).
 * Uso: booleanos de formulário — veículo próprio, item perecível.
 */
export interface SwitchProps {
    id: string
    label: string
    apoio?: string
    name?: string
    checked?: boolean
    defaultChecked?: boolean
    onCheckedChange?: (marcado: boolean) => void
    disabled?: boolean
}

export function Switch({ id, label, apoio, name, checked, defaultChecked, onCheckedChange, disabled }: SwitchProps) {
    const idApoio = apoio ? `${id}-apoio` : undefined
    return (
        <Ark.Root
            ids={{ hiddenInput: id }}
            name={name}
            checked={checked}
            defaultChecked={defaultChecked}
            onCheckedChange={(detalhe) => onCheckedChange?.(detalhe.checked)}
            disabled={disabled}
            className={cn(
                'flex min-h-11 cursor-pointer items-center gap-3 data-disabled:cursor-not-allowed data-disabled:opacity-50',
                ANEL_FOCO
            )}
        >
            <Ark.Control className="flex h-6 w-11 shrink-0 items-center rounded-full bg-neutral-300 p-0.5 transition-colors data-[state=checked]:bg-primary-600 dark:bg-neutral-700 dark:data-[state=checked]:bg-primary-500">
                <Ark.Thumb className="size-5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-5" />
            </Ark.Control>
            <div className="flex flex-col">
                <Ark.Label className="text-base text-foreground">{label}</Ark.Label>
                {apoio && (
                    <span id={idApoio} className="text-sm text-neutral-500 dark:text-neutral-400">
                        {apoio}
                    </span>
                )}
            </div>
            <Ark.HiddenInput aria-describedby={idApoio} />
        </Ark.Root>
    )
}
