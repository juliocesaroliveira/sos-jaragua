'use client'

import { Portal } from '@ark-ui/react/portal'
import { Select as Ark, createListCollection } from '@ark-ui/react/select'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { useMemo, type Ref } from 'react'
import { ANEL_FOCO, CLASSE_FLUTUANTE, cn } from '../cn'
import { Campo, bordaControle, idsCampo } from '../campo/campo'
import { Tooltip } from '../tooltip/tooltip'

/**
 * Alimenta o nome acessível (via `translations` do primitivo) **e** a dica
 * visual do botão de limpar — uma expressão só para os dois consumidores
 * (015-tooltip-acoes-icone, C-04.3). O rótulo padrão do Ark é "Clear value"; a
 * interface é 100% pt-BR (DESIGN_SYSTEM.md §6).
 */
const ROTULO_LIMPAR = 'Limpar seleção'

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
    /** Rótulo só para leitores de tela — ver `CampoProps.rotuloOculto`. */
    rotuloOculto?: boolean
    /**
     * Sobrepõe a regra padrão do botão de limpar (ver `limpavel` abaixo).
     *
     * Existe para o caso do controle que **sempre tem valor** sem ser um campo
     * de formulário obrigatório — o seletor de registros por página do rodapé
     * da tabela. Marcá-lo como `obrigatorio` esconderia o limpar, mas ao custo
     * de um asterisco e de um " (obrigatório)" anunciado pelo leitor de tela,
     * que ali não significa nada: não há submissão nem validação.
     */
    limpavel?: boolean
    /**
     * Alvo do foco quando o envio é bloqueado (016-formularios-rhf-zod,
     * FR-011) — recebe `field.ref` do `Controller`. Sem isto o
     * `shouldFocusError` do react-hook-form não teria o que focar, e um erro
     * abaixo da dobra ficaria invisível para quem enviou o formulário.
     */
    ref?: Ref<HTMLButtonElement>
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
    placeholder = 'Selecione…',
    rotuloOculto,
    limpavel: limpavelProp,
    ref
}: SelectProps) {
    const ids = idsCampo(id, Boolean(erro), Boolean(apoio))

    /**
     * Botão de limpar apenas em campo **opcional** (DESIGN_SYSTEM.md §4.3).
     *
     * Num campo obrigatório limpar não tem uso: o usuário troca a opção
     * escolhendo outra, e o único efeito de esvaziar seria criar um estado
     * inválido que ele precisaria desfazer. Já no campo opcional — os filtros
     * de listagem, com placeholder "Todos"/"Todas" — sem isto **não existe
     * caminho de volta** para "sem filtro" depois da primeira escolha.
     *
     * O primitivo esconde o botão sozinho quando não há valor selecionado
     * (`hidden: !hasSelectedItems`), então não é preciso condicionar por valor
     * aqui — só por obrigatoriedade.
     */
    const limpavel = (limpavelProp ?? !obrigatorio) && !disabled

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
        <Campo id={id} label={label} apoio={apoio} erro={erro} obrigatorio={obrigatorio} rotuloOculto={rotuloOculto}>
            <Ark.Root
                // `clearTrigger` fixado e repetido no `id` do botão: o `asChild`
                // do tooltip venceria a fusão do `id`, e o `select` usa esse id
                // para excluir o botão de limpar da detecção de clique-fora —
                // sem ele, limpar com a lista aberta fecharia a lista junto.
                ids={{ trigger: id, clearTrigger: `${id}-limpar` }}
                collection={collection}
                name={name}
                value={value}
                defaultValue={defaultValue}
                onValueChange={(detalhe) => onValueChange?.(detalhe.value)}
                multiple={multiple}
                disabled={disabled}
                required={obrigatorio}
                translations={{ clearTriggerLabel: ROTULO_LIMPAR }}
            >
                {/*
                  `Trigger` e `ClearTrigger` são ambos `<button>` e precisam ser
                  irmãos — botão aninhado em botão é HTML inválido. Daí o
                  `relative` aqui e o posicionamento absoluto do limpar: ele
                  fica **antes** do chevron, que é a convenção, sem exigir que o
                  chevron saia de dentro do trigger (onde clicar nele abre a
                  lista).
                */}
                <Ark.Control className="relative flex">
                    <Ark.Trigger
                        ref={ref}
                        aria-invalid={erro ? true : undefined}
                        aria-describedby={ids.describedBy}
                        className={cn(
                            'flex h-11 w-full items-center justify-between gap-2 rounded-lg border bg-surface px-3 text-left text-base text-foreground',
                            'disabled:cursor-not-allowed disabled:opacity-50',
                            bordaControle(Boolean(erro)),
                            ANEL_FOCO
                        )}
                    >
                        {/*
                          A margem reserva a faixa que o botão de limpar ocupa
                          por cima — sem ela, um rótulo longo passaria por baixo
                          dele em vez de ser truncado antes.
                        */}
                        <Ark.ValueText placeholder={placeholder} className={cn('truncate', limpavel && 'mr-11')} />
                        <ChevronsUpDown aria-hidden className="size-5 shrink-0 text-neutral-500" />
                    </Ark.Trigger>

                    {limpavel && (
                        <Tooltip conteudo={ROTULO_LIMPAR} posicao="left">
                            <Ark.ClearTrigger
                                id={`${id}-limpar`}
                                className={cn(
                                    // 44px de alvo de toque (§1.3), sem exceção
                                    // — em filtro de listagem, limpar é o único
                                    // caminho de volta para "sem filtro".
                                    'absolute inset-y-0 right-8 flex w-11 items-center justify-center rounded-lg',
                                    'text-neutral-500 hover:text-foreground',
                                    ANEL_FOCO
                                )}
                            >
                                <X aria-hidden className="size-4" />
                            </Ark.ClearTrigger>
                        </Tooltip>
                    )}
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
