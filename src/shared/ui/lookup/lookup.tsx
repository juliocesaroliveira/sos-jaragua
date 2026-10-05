'use client'

import { useEffect, useRef, useState, type FocusEvent, type Ref } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { RowData } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import { chaveLookup } from '@/src/shared/query/chaves'
import { Combobox, type OpcaoCombobox } from '../combobox/combobox'
import { IconButton } from '../icon-button/icon-button'
import { Tooltip } from '../tooltip/tooltip'
import { LookupDialog } from './lookup-dialog'
import type { FonteLookup, MotivoIndisponivel } from './tipos'

/**
 * Lookup — campo de referência a um registro de outro cadastro
 * (021-componente-lookup, contracts/lookup-componente.md; DESIGN_SYSTEM §4.4.1).
 *
 * Dois caminhos para a mesma seleção: digitar (até 5 sugestões vindas do
 * servidor) ou o botão de pesquisa (diálogo com tabela paginada no servidor).
 * O campo do formulário guarda só o identificador; a descrição exibida é dada
 * por quem usa, junto do `value`.
 *
 * **O texto do input é responsabilidade deste componente**, e não do
 * primitivo: o `Combobox` roda com `selectionBehavior="preserve"`, e o texto só
 * é reescrito quando a seleção ou a descrição mudam por fora da digitação
 * (C-05). Com o comportamento padrão do Ark, desfazer a seleção ao digitar
 * apagaria o que está sendo digitado, e uma seleção feita pelo diálogo — cujo
 * registro não está entre as sugestões carregadas — esvaziaria o campo.
 */
export interface LookupProps<T extends RowData> {
    id: string
    label: string
    fonte: FonteLookup<T>
    /** Identificador selecionado (`''`, `null` ou `undefined` = vazio). */
    value: string | null | undefined
    /** Texto exibido para `value` — da seleção ou do dado carregado em edição (FR-012). */
    descricao: string
    /** Seleção (sugestão ou diálogo), ou `null` ao desfazer/limpar. */
    onSelecionar: (registro: T | null) => void
    /** Só com `permitirValorLivre`: texto digitado sem seleção (FR-025). */
    onTextoLivre?: (texto: string) => void
    permitirValorLivre?: boolean
    /** Regra do uso (FR-013): motivo ⇒ registro exibido, mas não selecionável. */
    motivoIndisponivel?: MotivoIndisponivel<T>
    obrigatorio?: boolean
    apoio?: string
    erro?: string
    disabled?: boolean
    placeholder?: string
    mensagemVazia?: string
    /** `field.ref` do Controller — foco no erro (016, FR-011). */
    ref?: Ref<HTMLInputElement>
}

/** Abaixo disso nem se consulta o servidor (contracts L-01). */
const MINIMO_CARACTERES = 2

export function Lookup<T extends RowData>({
    id,
    label,
    fonte,
    value,
    descricao,
    onSelecionar,
    onTextoLivre,
    permitirValorLivre = false,
    motivoIndisponivel,
    obrigatorio,
    apoio,
    erro,
    disabled,
    placeholder = 'Digite para buscar…',
    mensagemVazia = 'Nenhum registro encontrado.',
    ref
}: LookupProps<T>) {
    const valorAtual = value || null
    const [termoBusca, setTermoBusca] = useState('')
    const [texto, setTexto] = useState(descricao)
    const [externo, setExterno] = useState({ texto: descricao, versao: 0 })
    const [dialogoAberto, setDialogoAberto] = useState(false)

    const textoRef = useRef(descricao)
    const inputRef = useRef<HTMLInputElement | null>(null)
    const dialogoAbertoRef = useRef(false)
    /** A seleção foi desfeita pela digitação: o texto em tela é o que vale. */
    const desfeitoPorDigitacao = useRef(false)

    function escreverTexto(novo: string) {
        textoRef.current = novo
        setTexto(novo)
        setExterno((anterior) => ({ texto: novo, versao: anterior.versao + 1 }))
    }

    /**
     * Seleção ou descrição mudaram por fora da digitação (sugestão escolhida,
     * diálogo, carga em edição, `reset` do formulário): o input passa a mostrar
     * a descrição. Se foi a própria digitação que desfez a seleção, nada muda —
     * reescrever aqui apagaria o que o operador está digitando (FR-010).
     */
    useEffect(() => {
        if (desfeitoPorDigitacao.current) {
            desfeitoPorDigitacao.current = false
            return
        }
        if (descricao !== textoRef.current) escreverTexto(descricao)
    }, [valorAtual, descricao])

    const sugestoes = useQuery({
        queryKey: chaveLookup(fonte.chave, 'sugestoes', { termo: termoBusca }),
        queryFn: async () => {
            const resultado = await fonte.sugerir({ termo: termoBusca })
            if (!resultado.ok) throw new Error(resultado.erro.mensagem)
            // Defensivo: o servidor já limita a 5 (L-02).
            return resultado.valor.slice(0, 5)
        },
        enabled: termoBusca.trim().length >= MINIMO_CARACTERES,
        staleTime: 30_000
    })

    const textoCurto = texto.trim().length < MINIMO_CARACTERES
    const registros = textoCurto ? [] : (sugestoes.data ?? [])

    const opcoes: OpcaoCombobox[] = registros.map((registro) => {
        const motivo = motivoIndisponivel?.(registro) ?? null
        const detalhe = [fonte.detalheDe?.(registro), motivo].filter(Boolean).join(' · ')
        return {
            value: fonte.idDe(registro),
            label: fonte.descricaoDe(registro),
            descricao: detalhe || undefined,
            disabled: Boolean(motivo)
        }
    })

    function selecionarPorId(idSelecionado: string | undefined) {
        if (!idSelecionado) {
            onSelecionar(null)
            return
        }
        const registro = registros.find((r) => fonte.idDe(r) === idSelecionado)
        if (registro) onSelecionar(registro)
    }

    /**
     * Sem o modo valor livre, texto que não virou seleção não vale nada: ao sair
     * do campo ele é descartado, como no `Combobox` padrão. Ir para a lista de
     * sugestões, para o botão de pesquisa ou para o diálogo não é "sair".
     */
    function aoPerderFoco(evento: FocusEvent<HTMLDivElement>) {
        if (permitirValorLivre || valorAtual || dialogoAbertoRef.current) return
        const destino = evento.relatedTarget as HTMLElement | null
        if (destino && (evento.currentTarget.contains(destino) || destino.closest('[data-scope="combobox"]'))) return
        if (textoRef.current !== '') escreverTexto('')
    }

    function abrirDialogo(aberto: boolean) {
        dialogoAbertoRef.current = aberto
        setDialogoAberto(aberto)
    }

    function refInput(elemento: HTMLInputElement | null) {
        inputRef.current = elemento
        if (typeof ref === 'function') ref(elemento)
        else if (ref) ref.current = elemento
    }

    const rotuloPesquisa = `Pesquisar ${label.toLowerCase()}`

    return (
        <div onBlur={aoPerderFoco}>
            <Combobox
                ref={refInput}
                id={id}
                label={label}
                apoio={apoio}
                erro={erro}
                obrigatorio={obrigatorio}
                disabled={disabled}
                placeholder={placeholder}
                opcoes={opcoes}
                value={valorAtual ? [valorAtual] : []}
                inputValueExterno={externo}
                selectionBehavior="preserve"
                permitirValorLivre={permitirValorLivre}
                carregando={sugestoes.isFetching}
                mensagemVazia={
                    textoCurto
                        ? `Digite ao menos ${MINIMO_CARACTERES} caracteres.`
                        : sugestoes.isError
                          ? 'Não foi possível buscar.'
                          : mensagemVazia
                }
                onBuscar={setTermoBusca}
                onInputValueChange={(novo) => {
                    textoRef.current = novo
                    setTexto(novo)
                    if (valorAtual) {
                        desfeitoPorDigitacao.current = true
                        onSelecionar(null)
                    }
                    if (permitirValorLivre) onTextoLivre?.(novo)
                }}
                onValueChange={(valores) => selecionarPorId(valores[0])}
                rodapeLista={
                    sugestoes.isError && !textoCurto ? (
                        <button
                            type="button"
                            onClick={() => void sugestoes.refetch()}
                            className="flex min-h-11 w-full items-center rounded-lg px-3 text-sm font-medium text-primary-700 hover:bg-surface-muted dark:text-primary-400"
                        >
                            Tentar de novo
                        </button>
                    ) : undefined
                }
                acaoFim={
                    <Tooltip conteudo={rotuloPesquisa} posicao="left">
                        <IconButton
                            aria-label={rotuloPesquisa}
                            icone={<Search aria-hidden className="size-4" />}
                            disabled={disabled}
                            onClick={() => abrirDialogo(true)}
                        />
                    </Tooltip>
                }
            />
            {dialogoAberto && (
                <LookupDialog
                    fonte={fonte}
                    motivoIndisponivel={motivoIndisponivel}
                    onAbertoChange={abrirDialogo}
                    onEscolher={(registro) => {
                        onSelecionar(registro)
                        // O diálogo devolve o foco a quem o abriu (o botão); o
                        // próximo passo natural é o campo, não a lupa.
                        requestAnimationFrame(() => inputRef.current?.focus())
                    }}
                />
            )}
        </div>
    )
}
