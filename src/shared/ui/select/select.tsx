'use client'

import { Portal } from '@ark-ui/react/portal'
import { Select as Ark, createListCollection } from '@ark-ui/react/select'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useMemo } from 'react'
import { ANEL_FOCO, CLASSE_FLUTUANTE, cn } from '../cn'
import { Campo, bordaControle, idsCampo } from '../campo/campo'

/**
 * Select sobre o primitivo Ark (DESIGN_SYSTEM.md §4.3). O trigger tem a mesma
 * altura/estilo do `Input` (`h-11`, `rounded-lg`) para não quebrar o
 * alinhamento visual dos formulários.
 */
export type OpcaoSelect = { value: string; label: string; disabled?: boolean }

export interface SelectProps {
    id: string
    label: string
    opcoes: readonly OpcaoSelect[]
    apoio?: string
    erro?: string
    obrigatorio?: boolean
    name?: string
    value?: string[]
    defaultValue?: string[]
    onValueChange?: (valores: string[]) => void
    multiple?: boolean
    disabled?: boolean
    placeholder?: string
}

export function Select({
    id,
    label,
    opcoes,
    apoio,
    erro,
    obrigatorio,
    name,
    value,
    defaultValue,
    onValueChange,
    multiple = false,
    disabled,
    placeholder = 'Selecione…'
}: SelectProps) {
    const ids = idsCampo(id, Boolean(erro), Boolean(apoio))
    const collection = useMemo(
        () =>
            createListCollection({
                items: [...opcoes],
                itemToValue: (i) => i.value,
                itemToString: (i) => i.label,
                isItemDisabled: (i) => Boolean(i.disabled)
            }),
        [opcoes]
    )

    return (
        <Campo id={id} label={label} apoio={apoio} erro={erro} obrigatorio={obrigatorio}>
            <Ark.Root
                ids={{ trigger: id }}
                collection={collection}
                name={name}
                value={value}
                defaultValue={defaultValue}
                onValueChange={(detalhe) => onValueChange?.(detalhe.value)}
                multiple={multiple}
                disabled={disabled}
                required={obrigatorio}
            >
                <Ark.Control>
                    <Ark.Trigger
                        aria-invalid={erro ? true : undefined}
                        aria-describedby={ids.describedBy}
                        className={cn(
                            'flex h-11 w-full items-center justify-between gap-2 rounded-lg border bg-surface px-3 text-left text-base text-foreground',
                            'disabled:cursor-not-allowed disabled:opacity-50',
                            bordaControle(Boolean(erro)),
                            ANEL_FOCO
                        )}
                    >
                        <Ark.ValueText placeholder={placeholder} className="truncate" />
                        <ChevronsUpDown aria-hidden className="size-5 shrink-0 text-neutral-500" />
                    </Ark.Trigger>
                </Ark.Control>
                <Portal>
                    <Ark.Positioner className={CLASSE_FLUTUANTE}>
                        <Ark.Content
                            className={cn(
                                'max-h-72 min-w-(--reference-width) overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-md',
                                ANEL_FOCO
                            )}
                        >
                            {collection.items.map((opcao) => (
                                <Ark.Item
                                    key={opcao.value}
                                    item={opcao}
                                    className={cn(
                                        'flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-lg px-3 text-base text-foreground',
                                        'data-highlighted:bg-surface-muted data-disabled:cursor-not-allowed data-disabled:opacity-50'
                                    )}
                                >
                                    <Ark.ItemText>{opcao.label}</Ark.ItemText>
                                    <Ark.ItemIndicator>
                                        <Check aria-hidden className="size-4 text-primary-600 dark:text-primary-400" />
                                    </Ark.ItemIndicator>
                                </Ark.Item>
                            ))}
                        </Ark.Content>
                    </Ark.Positioner>
                </Portal>
                <Ark.HiddenSelect />
            </Ark.Root>
        </Campo>
    )
}
