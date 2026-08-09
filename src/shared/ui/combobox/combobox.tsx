'use client'

import { Combobox as Ark, createListCollection } from '@ark-ui/react/combobox'
import { Portal } from '@ark-ui/react/portal'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ANEL_FOCO, CLASSE_FLUTUANTE, cn } from '../cn'
import { Campo, bordaControle, idsCampo } from '../campo/campo'

/**
 * Combobox sobre o primitivo Ark (DESIGN_SYSTEM.md §4.4).
 *
 * Genérico o suficiente para o uso crítico do sistema — autocomplete de "Nome
 * do Item" na Entrada (BR-EST-01), que consulta `item.nome` por índice trigram
 * e evita cadastro duplicado. O debounce de digitação é responsabilidade deste
 * componente (200–300ms), não de cada tela.
 */
export type OpcaoCombobox = { value: string; label: string; descricao?: string }

export interface ComboboxProps {
    id: string
    label: string
    opcoes: readonly OpcaoCombobox[]
    apoio?: string
    erro?: string
    obrigatorio?: boolean
    name?: string
    value?: string[]
    defaultInputValue?: string
    /** Disparado com debounce — é aqui que a tela busca no servidor. */
    onBuscar?: (termo: string) => void
    onValueChange?: (valores: string[], itens: OpcaoCombobox[]) => void
    /** Texto livre digitado, sem seleção — permite cadastrar um item novo. */
    onInputValueChange?: (termo: string) => void
    carregando?: boolean
    disabled?: boolean
    placeholder?: string
    /** Texto exibido quando a busca não retorna nada. */
    mensagemVazia?: string
    debounceMs?: number
}

export function Combobox({
    id,
    label,
    opcoes,
    apoio,
    erro,
    obrigatorio,
    name,
    value,
    defaultInputValue,
    onBuscar,
    onValueChange,
    onInputValueChange,
    carregando = false,
    disabled,
    placeholder = 'Digite para buscar…',
    mensagemVazia = 'Nenhum resultado encontrado.',
    debounceMs = 250
}: ComboboxProps) {
    const ids = idsCampo(id, Boolean(erro), Boolean(apoio))
    const [termo, setTermo] = useState(defaultInputValue ?? '')
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    useEffect(() => {
        if (!onBuscar) return
        clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => onBuscar(termo), debounceMs)
        return () => clearTimeout(timeoutRef.current)
    }, [termo, debounceMs, onBuscar])

    const collection = useMemo(
        () =>
            createListCollection({
                items: [...opcoes],
                itemToValue: (i) => i.value,
                itemToString: (i) => i.label
            }),
        [opcoes]
    )

    return (
        <Campo id={id} label={label} apoio={apoio} erro={erro} obrigatorio={obrigatorio}>
            <Ark.Root
                ids={{ input: id }}
                collection={collection}
                name={name}
                value={value}
                inputValue={termo}
                onInputValueChange={(detalhe) => {
                    setTermo(detalhe.inputValue)
                    onInputValueChange?.(detalhe.inputValue)
                }}
                onValueChange={(detalhe) => onValueChange?.(detalhe.value, detalhe.items as OpcaoCombobox[])}
                disabled={disabled}
                // A filtragem acontece no servidor (índice trigram); o
                // componente só exibe o que recebeu.
                openOnClick
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
                    {carregando && <Loader2 aria-hidden className="mr-3 size-5 animate-spin text-neutral-400" />}
                </Ark.Control>
                <Portal>
                    <Ark.Positioner className={CLASSE_FLUTUANTE}>
                        <Ark.Content
                            className={cn(
                                'max-h-72 min-w-(--reference-width) overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-md',
                                ANEL_FOCO
                            )}
                        >
                            {collection.items.length === 0 && !carregando ? (
                                <p className="px-3 py-2 text-sm text-neutral-500">{mensagemVazia}</p>
                            ) : (
                                collection.items.map((opcao) => (
                                    <Ark.Item
                                        key={opcao.value}
                                        item={opcao}
                                        className="flex min-h-11 cursor-pointer flex-col justify-center rounded-lg px-3 data-highlighted:bg-surface-muted"
                                    >
                                        <Ark.ItemText className="text-base text-foreground">{opcao.label}</Ark.ItemText>
                                        {opcao.descricao && (
                                            <span className="text-xs text-neutral-500">{opcao.descricao}</span>
                                        )}
                                    </Ark.Item>
                                ))
                            )}
                        </Ark.Content>
                    </Ark.Positioner>
                </Portal>
            </Ark.Root>
        </Campo>
    )
}
