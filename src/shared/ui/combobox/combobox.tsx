'use client'

import { Combobox as Ark, createListCollection } from '@ark-ui/react/combobox'
import { Portal } from '@ark-ui/react/portal'
import { Loader2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'
import { ANEL_FOCO, CLASSE_FLUTUANTE, cn } from '../cn'
import { Campo, bordaControle, idsCampo } from '../campo/campo'
import { Tooltip } from '../tooltip/tooltip'

/** Nome acessível e dica do botão de limpar, de uma expressão só (C-04.3). */
const ROTULO_LIMPAR = 'Limpar seleção'

/**
 * Combobox sobre o primitivo Ark (DESIGN_SYSTEM.md §4.4).
 *
 * Genérico o suficiente para o uso crítico do sistema — autocomplete de "Nome
 * do Item" na Entrada (BR-EST-01), que consulta `item.nome` por índice trigram
 * e evita cadastro duplicado. O debounce de digitação é responsabilidade deste
 * componente (200–300ms), não de cada tela.
 */
export type OpcaoCombobox = {
    value: string
    label: string
    descricao?: string
    /** Exibida, mas não selecionável — o motivo vai em `descricao` (021, FR-013). */
    disabled?: boolean
}

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
    /**
     * Mantém no input o texto digitado que não corresponde a nenhuma opção.
     * Sem isto o primitivo descarta o texto ao fechar a lista — o que impede
     * cadastrar um registro novo a partir do que foi digitado.
     */
    permitirValorLivre?: boolean
    /**
     * Texto escrito no input por quem usa o componente — não pela digitação.
     * Só é aplicado quando `versao` muda, e nunca dispara `onBuscar`: é como o
     * Lookup (021) mostra a descrição de uma seleção feita fora da lista
     * (diálogo, valor carregado em edição). Um `inputValue` controlado a cada
     * render apagaria o texto em digitação; por isso a versão.
     */
    inputValueExterno?: { texto: string; versao: number }
    /**
     * `preserve` mantém o texto do input ao selecionar ou desfazer a seleção,
     * deixando o texto inteiramente a cargo de quem usa (`inputValueExterno`).
     * O padrão do primitivo (`replace`) reescreve o input a partir da collection
     * a cada mudança de valor — e apaga o texto quando o valor selecionado não
     * está entre as opções carregadas.
     */
    selectionBehavior?: 'replace' | 'preserve'
    /** Ação dentro da borda do campo, à direita (ex.: botão de pesquisa do Lookup). */
    acaoFim?: ReactNode
    /** Conteúdo no fim da lista (dica de digitação, erro com "tentar de novo"). */
    rodapeLista?: ReactNode
    /** Alvo do foco quando o envio é bloqueado (FR-011) — recebe `field.ref` do `Controller`. */
    ref?: Ref<HTMLInputElement>
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
    debounceMs = 250,
    permitirValorLivre = false,
    inputValueExterno,
    selectionBehavior,
    acaoFim,
    rodapeLista,
    ref
}: ComboboxProps) {
    const ids = idsCampo(id, Boolean(erro), Boolean(apoio))
    const [termo, setTermo] = useState(inputValueExterno?.texto ?? defaultInputValue ?? '')
    /**
     * Último texto aplicado de fora. Enquanto o input mostrar exatamente ele, o
     * debounce não busca — a descrição de uma seleção não é um termo digitado.
     * Qualquer digitação limpa a marca.
     */
    const externoRef = useRef<string | null>(inputValueExterno?.texto ?? null)
    const versaoExterna = inputValueExterno?.versao
    const textoExternoRef = useRef(inputValueExterno?.texto)
    useEffect(() => {
        textoExternoRef.current = inputValueExterno?.texto
    })
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    /**
     * `onBuscar` fica numa ref, e **não** nas dependências do efeito: a tela
     * costuma declarar a função inline, e o `setState` do resultado da busca
     * recria essa função a cada render. Como dependência, isso vira um laço —
     * busca dispara render, render recria a função, o efeito roda de novo — e o
     * campo fica inutilizável, buscando sem parar enquanto se digita.
     */
    const buscarRef = useRef(onBuscar)
    useEffect(() => {
        buscarRef.current = onBuscar
    })

    /**
     * Só a versão decide quando reescrever o input: no modo valor livre o texto
     * muda a cada tecla sem que isso seja uma escrita externa. O texto é lido da
     * ref atualizada no efeito acima, que roda antes deste no mesmo commit.
     */
    useEffect(() => {
        if (versaoExterna === undefined) return
        const texto = textoExternoRef.current ?? ''
        externoRef.current = texto
        setTermo(texto)
    }, [versaoExterna])

    useEffect(() => {
        if (!buscarRef.current) return
        if (externoRef.current !== null && termo === externoRef.current) return
        clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => buscarRef.current?.(termo), debounceMs)
        return () => clearTimeout(timeoutRef.current)
    }, [termo, debounceMs])

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
                // Ver a nota do `select`: o `id` fixado sobrevive à fusão do
                // `asChild` do tooltip, e é ele que exclui o botão de limpar da
                // detecção de clique-fora.
                ids={{ input: id, clearTrigger: `${id}-limpar` }}
                collection={collection}
                name={name}
                value={value}
                inputValue={termo}
                onInputValueChange={(detalhe) => {
                    // Mudança vinda do primitivo (digitação, revert): deixa de
                    // ser o texto externo e volta a valer como termo de busca.
                    if (detalhe.inputValue !== externoRef.current) externoRef.current = null
                    setTermo(detalhe.inputValue)
                    onInputValueChange?.(detalhe.inputValue)
                }}
                onValueChange={(detalhe) => onValueChange?.(detalhe.value, detalhe.items as OpcaoCombobox[])}
                disabled={disabled}
                allowCustomValue={permitirValorLivre}
                selectionBehavior={selectionBehavior}
                // A filtragem acontece no servidor (índice trigram); o
                // componente só exibe o que recebeu.
                openOnClick
                translations={{ clearTriggerLabel: ROTULO_LIMPAR }}
            >
                <Ark.Control
                    className={cn(
                        'flex h-11 items-center rounded-lg border bg-surface',
                        bordaControle(Boolean(erro)),
                        'focus-within:ring-2 focus-within:ring-primary-500 dark:focus-within:ring-primary-400'
                    )}
                >
                    <Ark.Input
                        ref={ref}
                        placeholder={placeholder}
                        aria-invalid={erro ? true : undefined}
                        aria-describedby={ids.describedBy}
                        // `min-w-0 flex-1` e não `w-full`: com o botão de limpar
                        // como irmão flex, `w-full` empurraria o botão para fora
                        // da borda em vez de dividir a largura.
                        className="min-w-0 flex-1 bg-transparent px-3 text-base text-foreground outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {carregando && <Loader2 aria-hidden className="mr-3 size-5 animate-spin text-neutral-400" />}

                    {/*
                      Limpar só em campo opcional (DESIGN_SYSTEM.md §4.4): num
                      campo obrigatório, esvaziar só produz estado inválido.
                      O primitivo esconde o botão sozinho enquanto não houver
                      valor **selecionado** — texto livre digitado e ainda não
                      escolhido não é "valor selecionado" e continua sendo
                      apagado pelo teclado.
                    */}
                    {!obrigatorio && !disabled && (
                        <Tooltip conteudo={ROTULO_LIMPAR} posicao="left">
                            <Ark.ClearTrigger
                                id={`${id}-limpar`}
                                className={cn(
                                    'flex w-11 shrink-0 items-center justify-center self-stretch rounded-lg',
                                    'text-neutral-500 hover:text-foreground',
                                    ANEL_FOCO
                                )}
                            >
                                <X aria-hidden className="size-4" />
                            </Ark.ClearTrigger>
                        </Tooltip>
                    )}
                    {acaoFim}
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
                                        className="flex min-h-11 cursor-pointer flex-col justify-center rounded-lg px-3 data-highlighted:bg-surface-muted data-disabled:cursor-not-allowed data-disabled:opacity-50"
                                    >
                                        <Ark.ItemText className="text-base text-foreground">{opcao.label}</Ark.ItemText>
                                        {opcao.descricao && (
                                            <span className="text-xs text-neutral-500">{opcao.descricao}</span>
                                        )}
                                    </Ark.Item>
                                ))
                            )}
                            {rodapeLista}
                        </Ark.Content>
                    </Ark.Positioner>
                </Portal>
            </Ark.Root>
        </Campo>
    )
}
