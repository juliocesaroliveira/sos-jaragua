'use client'

import { DatePicker as Ark } from '@ark-ui/react/date-picker'
import { Portal } from '@ark-ui/react/portal'
import { parseDate } from '@internationalized/date'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ALTURA_POR_TAMANHO, ANEL_FOCO, cn } from '../cn'
import { Campo, bordaControle, idsCampo } from '../campo/campo'

/**
 * DatePicker sobre o primitivo Ark (DESIGN_SYSTEM.md §4.6).
 *
 * Locale `pt-BR`, exibição `dd/mm/aaaa`. A API externa usa `YYYY-MM-DD` — o
 * mesmo formato da coluna `date` do Postgres — para que a tela não precise
 * converter entre o tipo do calendário e o do banco.
 *
 * As regras de negócio associadas (maioridade em `dataNascimento`, validade não
 * retroativa em item perecível) ficam no `domain`; `min`/`max` aqui são apenas
 * a defesa de usabilidade.
 */
export interface DatePickerProps {
    id: string
    label: string
    apoio?: string
    erro?: string
    obrigatorio?: boolean
    name?: string
    /** `YYYY-MM-DD` */
    value?: string
    defaultValue?: string
    onValueChange?: (valor: string | undefined) => void
    /** `YYYY-MM-DD` */
    min?: string
    max?: string
    disabled?: boolean
    placeholder?: string
}

const DIAS_SEMANA_ABREV: Record<string, string> = {
    dom: 'dom',
    seg: 'seg',
    ter: 'ter',
    qua: 'qua',
    qui: 'qui',
    sex: 'sex',
    sáb: 'sáb'
}

export function DatePicker({
    id,
    label,
    apoio,
    erro,
    obrigatorio,
    name,
    value,
    defaultValue,
    onValueChange,
    min,
    max,
    disabled,
    placeholder = 'dd/mm/aaaa'
}: DatePickerProps) {
    const ids = idsCampo(id, Boolean(erro), Boolean(apoio))

    // O calendário do Ark lê a data de hoje durante o render. Com
    // `cacheComponents: true` (DESIGN.md §7), ler o relógio no prerender é um
    // erro — e o resultado seria congelado no shell estático de qualquer forma.
    // Por isso o componente só monta no cliente; até lá renderiza um campo
    // inerte de mesma altura, para o layout não saltar.
    const [montado, setMontado] = useState(false)
    useEffect(() => setMontado(true), [])

    if (!montado) {
        return (
            <Campo id={id} label={label} apoio={apoio} erro={erro} obrigatorio={obrigatorio}>
                <div
                    className={cn(
                        'flex items-center rounded-lg border bg-surface px-3 text-base text-neutral-400',
                        bordaControle(Boolean(erro)),
                        ALTURA_POR_TAMANHO.md
                    )}
                >
                    {placeholder}
                </div>
            </Campo>
        )
    }

    return (
        <Campo id={id} label={label} apoio={apoio} erro={erro} obrigatorio={obrigatorio}>
            <Ark.Root
                ids={{ input: () => id }}
                locale="pt-BR"
                name={name}
                value={value ? [parseDate(value)] : undefined}
                defaultValue={defaultValue ? [parseDate(defaultValue)] : undefined}
                min={min ? parseDate(min) : undefined}
                max={max ? parseDate(max) : undefined}
                disabled={disabled}
                onValueChange={(detalhe) => onValueChange?.(detalhe.value[0]?.toString())}
                format={(data) =>
                    `${String(data.day).padStart(2, '0')}/${String(data.month).padStart(2, '0')}/${data.year}`
                }
                positioning={{ sameWidth: true }}
            >
                <Ark.Control
                    className={cn(
                        'flex h-11 items-center rounded-lg border bg-surface',
                        bordaControle(Boolean(erro)),
                        'focus-within:ring-2 focus-within:ring-primary-500 dark:focus-within:ring-primary-400'
                    )}
                >
                    <Ark.Input
                        placeholder={placeholder}
                        aria-invalid={erro ? true : undefined}
                        aria-describedby={ids.describedBy}
                        className="w-full bg-transparent px-3 text-base text-foreground outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <Ark.Trigger
                        aria-label="Abrir calendário"
                        className={cn(
                            'flex size-11 shrink-0 items-center justify-center text-neutral-500 hover:text-foreground',
                            ANEL_FOCO
                        )}
                    >
                        <CalendarDays aria-hidden className="size-5" />
                    </Ark.Trigger>
                </Ark.Control>

                <Portal>
                    <Ark.Positioner>
                        <Ark.Content className="z-50 rounded-xl border border-border bg-surface p-3 shadow-md">
                            <Ark.View view="day">
                                <Ark.Context>
                                    {(api) => (
                                        <>
                                            <Ark.ViewControl className="mb-2 flex items-center justify-between gap-2">
                                                <Ark.PrevTrigger
                                                    aria-label="Mês anterior"
                                                    className={cn(
                                                        'flex size-9 items-center justify-center rounded-lg hover:bg-surface-muted',
                                                        ANEL_FOCO
                                                    )}
                                                >
                                                    <ChevronLeft aria-hidden className="size-5" />
                                                </Ark.PrevTrigger>
                                                <Ark.ViewTrigger
                                                    className={cn(
                                                        'rounded-lg px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface-muted',
                                                        ANEL_FOCO
                                                    )}
                                                >
                                                    <Ark.RangeText />
                                                </Ark.ViewTrigger>
                                                <Ark.NextTrigger
                                                    aria-label="Próximo mês"
                                                    className={cn(
                                                        'flex size-9 items-center justify-center rounded-lg hover:bg-surface-muted',
                                                        ANEL_FOCO
                                                    )}
                                                >
                                                    <ChevronRight aria-hidden className="size-5" />
                                                </Ark.NextTrigger>
                                            </Ark.ViewControl>
                                            <Ark.Table className="w-full border-collapse">
                                                <Ark.TableHead>
                                                    <Ark.TableRow>
                                                        {api.weekDays.map((dia) => (
                                                            <Ark.TableHeader
                                                                key={dia.short}
                                                                className="pb-1 text-xs font-semibold text-neutral-500"
                                                            >
                                                                {DIAS_SEMANA_ABREV[dia.short] ?? dia.short}
                                                            </Ark.TableHeader>
                                                        ))}
                                                    </Ark.TableRow>
                                                </Ark.TableHead>
                                                <Ark.TableBody>
                                                    {api.weeks.map((semana, i) => (
                                                        <Ark.TableRow key={i}>
                                                            {semana.map((dia, j) => (
                                                                <Ark.TableCell key={j} value={dia}>
                                                                    <Ark.TableCellTrigger
                                                                        className={cn(
                                                                            'flex size-10 items-center justify-center rounded-lg text-sm text-foreground hover:bg-surface-muted',
                                                                            'data-[selected]:bg-primary-600 data-[selected]:text-primary-foreground dark:data-[selected]:bg-primary-500',
                                                                            'data-[outside-range]:text-neutral-400 data-disabled:cursor-not-allowed data-disabled:opacity-40',
                                                                            ANEL_FOCO
                                                                        )}
                                                                    >
                                                                        {dia.day}
                                                                    </Ark.TableCellTrigger>
                                                                </Ark.TableCell>
                                                            ))}
                                                        </Ark.TableRow>
                                                    ))}
                                                </Ark.TableBody>
                                            </Ark.Table>
                                        </>
                                    )}
                                </Ark.Context>
                            </Ark.View>
                        </Ark.Content>
                    </Ark.Positioner>
                </Portal>
            </Ark.Root>
        </Campo>
    )
}
