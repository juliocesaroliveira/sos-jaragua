'use client'

import { Switch as Ark } from '@ark-ui/react/switch'
import type { Ref } from 'react'
import { FaixaMensagem, idsCampo } from '../campo/campo'
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
    /**
     * 016-formularios-rhf-zod, FR-008: até então o `Switch` era o único
     * controle sem estado de erro — a exceção fazia sentido enquanto nenhum
     * booleano era obrigatório, mas um "aceite os termos" ou um booleano
     * exigido por regra condicional deixaria o formulário sem como dizer o que
     * está errado (research.md D6).
     */
    erro?: string
    /** Alvo do foco quando o envio é bloqueado (FR-011) — recebe `field.ref` do `Controller`. */
    ref?: Ref<HTMLInputElement>
}

export function Switch({
    id,
    label,
    apoio,
    name,
    checked,
    defaultChecked,
    onCheckedChange,
    disabled,
    erro,
    ref
}: SwitchProps) {
    const ids = idsCampo(id, Boolean(erro), Boolean(apoio))
    return (
        /*
          O apoio continua junto ao rótulo, ao lado do controle — é o padrão
          correto para um switch e não muda com esta feature. O erro, ao
          contrário, vai **abaixo da linha inteira**: é onde ele está em todos os
          outros campos, e a consistência de posição é o que a pessoa usa para
          encontrá-lo sem procurar (FR-004).
        */
        <div className="flex flex-col gap-1.5">
            <Ark.Root
                ids={{ hiddenInput: id }}
                name={name}
                checked={checked}
                defaultChecked={defaultChecked}
                onCheckedChange={(detalhe) => onCheckedChange?.(detalhe.checked)}
                disabled={disabled}
                invalid={Boolean(erro)}
                className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-3 data-disabled:cursor-not-allowed data-disabled:opacity-50',
                    ANEL_FOCO
                )}
            >
                <Ark.Control className="flex h-6 w-11 shrink-0 items-center rounded-full bg-neutral-300 p-0.5 transition-colors data-[state=checked]:bg-primary-600 data-invalid:ring-2 data-invalid:ring-danger-500 dark:bg-neutral-700 dark:data-[state=checked]:bg-primary-500">
                    <Ark.Thumb className="size-5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-5" />
                </Ark.Control>
                <div className="flex flex-col">
                    <Ark.Label className="text-base text-foreground">{label}</Ark.Label>
                    {apoio && (
                        <span id={ids.idApoio} className="text-sm text-neutral-500 dark:text-neutral-400">
                            {apoio}
                        </span>
                    )}
                </div>
                <Ark.HiddenInput ref={ref} aria-describedby={ids.describedBy} aria-invalid={erro ? true : undefined} />
            </Ark.Root>

            {/* Só o erro: o apoio já foi renderizado ao lado do controle. */}
            <FaixaMensagem ids={ids} erro={erro} />
        </div>
    )
}
