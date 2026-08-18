'use client'

import { NumberInput as Ark } from '@ark-ui/react/number-input'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { ANEL_FOCO, cn } from '../cn'
import { Campo, bordaControle, idsCampo } from '../campo/campo'
import { Tooltip } from '../tooltip/tooltip'

/**
 * NumberInput sobre o primitivo Ark (DESIGN_SYSTEM.md §4.2). Usado nas
 * quantidades de estoque — decimais (kg/litro) e nunca negativas.
 */
export interface NumberInputProps {
    id: string
    label: string
    apoio?: string
    erro?: string
    obrigatorio?: boolean
    name?: string
    value?: string
    defaultValue?: string
    onValueChange?: (valor: string) => void
    min?: number
    max?: number
    step?: number
    /** Casas decimais exibidas; `3` acompanha a precisão de `saldo_estoque`. */
    casasDecimais?: number
    disabled?: boolean
}

export function NumberInput({
    id,
    label,
    apoio,
    erro,
    obrigatorio,
    name,
    value,
    defaultValue,
    onValueChange,
    min = 0,
    max,
    step = 1,
    casasDecimais = 3,
    disabled
}: NumberInputProps) {
    const ids = idsCampo(id, Boolean(erro), Boolean(apoio))
    return (
        <Campo id={id} label={label} apoio={apoio} erro={erro} obrigatorio={obrigatorio}>
            <Ark.Root
                /*
                  Os ids dos dois gatilhos são **fixados de propósito** e
                  repetidos no `id` de cada botão abaixo.

                  Motivo: o `Tooltip` envolve os gatilhos com `asChild`, e a
                  fusão de props do Ark faz o último vencer para o `id` — o id
                  do tooltip sobrescreveria o que o primitivo gera. O
                  `number-input` localiza o botão pressionado por id para
                  observar seu `disabled` e interromper o auto-repetir ao
                  chegar no limite; sem o id certo, segurar o botão passaria do
                  máximo. Fixando dos dois lados, o vencedor da fusão é o valor
                  correto. O tooltip não se prejudica: ele acha o próprio
                  gatilho por atributo (`data-part`) quando o id não bate.
                */
                ids={{ input: id, incrementTrigger: `${id}-aumentar`, decrementTrigger: `${id}-diminuir` }}
                name={name}
                value={value}
                defaultValue={defaultValue}
                onValueChange={(detalhe) => onValueChange?.(detalhe.value)}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                locale="pt-BR"
                formatOptions={{ maximumFractionDigits: casasDecimais }}
                allowMouseWheel={false}
                className="flex"
            >
                <Ark.Control
                    className={cn(
                        'flex h-11 w-full items-stretch overflow-hidden rounded-lg border bg-surface',
                        bordaControle(Boolean(erro)),
                        'focus-within:ring-2 focus-within:ring-primary-500 dark:focus-within:ring-primary-400'
                    )}
                >
                    <Ark.Input
                        aria-invalid={erro ? true : undefined}
                        aria-describedby={ids.describedBy}
                        className="w-full bg-transparent px-3 text-base text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <div className="flex flex-col border-l border-border">
                        <Tooltip conteudo="Aumentar" posicao="right">
                            <Ark.IncrementTrigger
                                id={`${id}-aumentar`}
                                aria-label="Aumentar"
                                className={cn(
                                    'flex h-1/2 w-11 items-center justify-center text-neutral-500 hover:bg-surface-muted',
                                    ANEL_FOCO
                                )}
                            >
                                <ChevronUp aria-hidden className="size-4" />
                            </Ark.IncrementTrigger>
                        </Tooltip>
                        <Tooltip conteudo="Diminuir" posicao="right">
                            <Ark.DecrementTrigger
                                id={`${id}-diminuir`}
                                aria-label="Diminuir"
                                className={cn(
                                    'flex h-1/2 w-11 items-center justify-center border-t border-border text-neutral-500 hover:bg-surface-muted',
                                    ANEL_FOCO
                                )}
                            >
                                <ChevronDown aria-hidden className="size-4" />
                            </Ark.DecrementTrigger>
                        </Tooltip>
                    </div>
                </Ark.Control>
            </Ark.Root>
        </Campo>
    )
}
