'use client'

import { Checkbox } from '@ark-ui/react/checkbox'
import { Check } from 'lucide-react'
import type { Ref } from 'react'
import { FaixaMensagem, idsCampo } from '../campo/campo'
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
    /** Texto de apoio na mesma faixa do erro, como nos demais campos (FR-008). */
    apoio?: string
    erro?: string
    obrigatorio?: boolean
    disabled?: boolean
    /** Layout em grade a partir de `sm` — listas longas ficam navegáveis. */
    colunas?: 1 | 2 | 3
    /** Alvo do foco quando o envio é bloqueado (FR-011) — recebe `field.ref` do `Controller`. */
    ref?: Ref<HTMLFieldSetElement>
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
    apoio,
    erro,
    obrigatorio,
    disabled,
    colunas = 2,
    ref
}: CheckboxGroupProps) {
    /*
      Faixa de mensagem compartilhada com os campos de texto
      (016-formularios-rhf-zod, research.md D7). A moldura `Campo` inteira não
      serve: seu `<label htmlFor>` apontaria para um controle que não existe —
      o rótulo de um grupo de checkboxes é o `<legend>` do `<fieldset>`.
    */
    const ids = idsCampo(id, Boolean(erro), Boolean(apoio))
    return (
        <fieldset
            ref={ref}
            /*
              `tabIndex={-1}` para que o foco no primeiro erro tenha onde pousar
              (FR-011): um `<fieldset>` não é focável por padrão, e sem isto o
              react-hook-form chamaria `.focus()` sem efeito nenhum. O valor
              negativo mantém o grupo fora da navegação por Tab — quem tabula
              continua indo direto para as opções.
            */
            tabIndex={-1}
            aria-describedby={ids.describedBy}
            aria-invalid={erro ? true : undefined}
            className="flex flex-col gap-2 focus:outline-none"
        >
            <legend className="text-sm font-medium text-foreground">
                {label}
                {obrigatorio && (
                    <span aria-hidden className="ml-1 text-danger-600 dark:text-danger-400">
                        *
                    </span>
                )}
                {obrigatorio && <span className="sr-only"> (obrigatório)</span>}
            </legend>
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
                        <Checkbox.Control
                            className={cn(
                                'flex size-5 shrink-0 items-center justify-center rounded border bg-surface data-[state=checked]:border-primary-600 data-[state=checked]:bg-primary-600 dark:data-[state=checked]:border-primary-500 dark:data-[state=checked]:bg-primary-500',
                                erro ? 'border-danger-500' : 'border-border-strong'
                            )}
                        >
                            <Checkbox.Indicator>
                                <Check aria-hidden className="size-4 text-primary-foreground" />
                            </Checkbox.Indicator>
                        </Checkbox.Control>
                        <Checkbox.Label className="text-base text-foreground">{opcao.label}</Checkbox.Label>
                        <Checkbox.HiddenInput />
                    </Checkbox.Root>
                ))}
            </Checkbox.Group>
            <FaixaMensagem ids={ids} apoio={apoio} erro={erro} />
        </fieldset>
    )
}
