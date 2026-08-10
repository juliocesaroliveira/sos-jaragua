'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { Alert, Button, Combobox, DatePicker, NumberInput, Select, Switch, avisar } from '@/src/shared/ui'
import {
    CATEGORIAS_ITEM,
    CONDICOES_ITEM,
    ROTULO_CATEGORIA_ITEM,
    ROTULO_CONDICAO_ITEM,
    ROTULO_UNIDADE_MEDIDA,
    UNIDADES_MEDIDA,
    type CategoriaItem,
    type UnidadeMedida
} from '@/src/modules/estoque/domain/item'
import { camposComErro } from '@/src/shared/kernel'
import { buscarItens, registrarEntrada } from '@/src/modules/estoque/presentation/actions/estoque'

/**
 * Registro de Entrada (BR-EST-01, EST-03/EST-04).
 *
 * O campo "Nome do item" é um Combobox com autocomplete por índice trigram: é a
 * defesa contra cadastro duplicado ("Água Mineral 5L" × "agua mineral 5l"). O
 * operador **pode** cadastrar um item novo — o autocomplete existe para que ele
 * só faça isso quando realmente não achar o existente.
 */
type ItemEncontrado = { id: string; nome: string; categoria: CategoriaItem; unidadeMedida: UnidadeMedida }

export function EntradaForm({ kits }: { kits: { id: string; nome: string }[] }) {
    const router = useRouter()
    const [enviando, iniciarTransicao] = useTransition()

    const [sugestoes, setSugestoes] = useState<ItemEncontrado[]>([])
    const [buscando, setBuscando] = useState(false)
    const [itemSelecionado, setItemSelecionado] = useState<ItemEncontrado | null>(null)
    const [nomeDigitado, setNomeDigitado] = useState('')

    const [categoria, setCategoria] = useState<string[]>([])
    const [unidade, setUnidade] = useState<string[]>([])
    const [condicao, setCondicao] = useState<string[]>(['novo'])
    const [quantidade, setQuantidade] = useState('')
    const [perecivel, setPerecivel] = useState(false)
    const [dataValidade, setDataValidade] = useState<string | undefined>()
    const [kitDestinoId, setKitDestinoId] = useState<string[]>([])

    const [erros, setErros] = useState<Record<string, string>>({})
    const [erroGeral, setErroGeral] = useState<string | null>(null)

    /** Item novo = digitou um nome que não corresponde a nenhuma sugestão escolhida. */
    const ehItemNovo = itemSelecionado === null && nomeDigitado.trim().length > 0

    /**
     * A busca **não** usa a transição do envio: `useTransition` é compartilhado
     * por todas as chamadas, e uma busca pendente deixaria o botão "Registrar
     * entrada" desabilitado enquanto o operador digita.
     */
    const buscar = useCallback(async (termo: string) => {
        setBuscando(true)
        try {
            setSugestoes((await buscarItens(termo)) as ItemEncontrado[])
        } finally {
            setBuscando(false)
        }
    }, [])

    function limpar() {
        setItemSelecionado(null)
        setNomeDigitado('')
        setSugestoes([])
        setCategoria([])
        setUnidade([])
        setCondicao(['novo'])
        setQuantidade('')
        setPerecivel(false)
        setDataValidade(undefined)
        setKitDestinoId([])
        setErros({})
        setErroGeral(null)
    }

    function salvar() {
        setErros({})
        setErroGeral(null)

        iniciarTransicao(async () => {
            const resultado = await registrarEntrada({
                itemId: itemSelecionado?.id ?? null,
                novoItem: ehItemNovo
                    ? {
                          nome: nomeDigitado.trim(),
                          categoria: (categoria[0] ?? 'outros') as CategoriaItem,
                          unidadeMedida: (unidade[0] ?? 'unidade') as UnidadeMedida
                      }
                    : null,
                quantidade: Number(quantidade),
                condicao: (condicao[0] ?? 'novo') as (typeof CONDICOES_ITEM)[number],
                perecivel,
                dataValidade: perecivel ? (dataValidade ?? null) : null,
                kitDestinoId: kitDestinoId[0] ?? null
            })

            if (!resultado.ok) {
                setErros(camposComErro(resultado.erro))
                setErroGeral(resultado.erro.mensagem)
                avisar.erro('Não foi possível registrar', resultado.erro.mensagem)
                return
            }

            avisar.sucesso('Entrada registrada', 'O saldo do item foi atualizado.')
            limpar()
            router.refresh()
        })
    }

    return (
        <div className="flex max-w-2xl flex-col gap-6">
            {erroGeral && <Alert tom="danger" titulo={erroGeral} />}

            <Combobox
                id="nomeItem"
                label="Nome do item"
                obrigatorio
                apoio="Comece a digitar: sugerimos itens já cadastrados para evitar duplicidade."
                opcoes={sugestoes.map((i) => ({
                    value: i.id,
                    label: i.nome,
                    descricao: `${ROTULO_CATEGORIA_ITEM[i.categoria]} · ${ROTULO_UNIDADE_MEDIDA[i.unidadeMedida]}`
                }))}
                carregando={buscando}
                // Nome não encontrado é o caso normal de item novo: o texto
                // digitado precisa permanecer no campo para virar o cadastro.
                permitirValorLivre
                onBuscar={buscar}
                onInputValueChange={(termo) => {
                    setNomeDigitado(termo)
                    // Editar o texto desfaz a seleção: o que vale é o que está escrito.
                    if (itemSelecionado && termo !== itemSelecionado.nome) setItemSelecionado(null)
                }}
                onValueChange={(_valores, itens) => {
                    const escolhido = sugestoes.find((s) => s.id === itens[0]?.value) ?? null
                    setItemSelecionado(escolhido)
                    if (escolhido) {
                        setNomeDigitado(escolhido.nome)
                        setCategoria([escolhido.categoria])
                        setUnidade([escolhido.unidadeMedida])
                    }
                }}
                erro={erros.item}
                mensagemVazia="Nenhum item parecido. Preencha categoria e unidade para cadastrar um novo."
            />

            {itemSelecionado && (
                <Alert tom="info" titulo={`Item existente: ${itemSelecionado.nome}`}>
                    A entrada será somada ao saldo deste item. Categoria e unidade vêm do cadastro.
                </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
                <Select
                    id="categoria"
                    label="Categoria"
                    obrigatorio
                    disabled={itemSelecionado !== null}
                    opcoes={CATEGORIAS_ITEM.map((c) => ({ value: c, label: ROTULO_CATEGORIA_ITEM[c] }))}
                    value={categoria}
                    onValueChange={setCategoria}
                />
                <Select
                    id="unidadeMedida"
                    label="Unidade de medida"
                    obrigatorio
                    disabled={itemSelecionado !== null}
                    opcoes={UNIDADES_MEDIDA.map((u) => ({ value: u, label: ROTULO_UNIDADE_MEDIDA[u] }))}
                    value={unidade}
                    onValueChange={setUnidade}
                />
                <Select
                    id="condicao"
                    label="Condição"
                    obrigatorio
                    opcoes={CONDICOES_ITEM.map((c) => ({ value: c, label: ROTULO_CONDICAO_ITEM[c] }))}
                    value={condicao}
                    onValueChange={setCondicao}
                />
                <NumberInput
                    id="quantidade"
                    label="Quantidade"
                    obrigatorio
                    min={0}
                    value={quantidade}
                    onValueChange={setQuantidade}
                    erro={erros.quantidade}
                />
            </div>

            <div className="flex flex-col gap-4">
                <Switch
                    id="perecivel"
                    label="Item perecível"
                    apoio="Habilita e obriga a data de validade."
                    checked={perecivel}
                    onCheckedChange={setPerecivel}
                />

                {perecivel && (
                    <DatePicker
                        id="dataValidade"
                        label="Data de validade"
                        obrigatorio
                        apoio="Não é possível registrar item já vencido."
                        value={dataValidade}
                        onValueChange={setDataValidade}
                        erro={erros.dataValidade}
                    />
                )}
            </div>

            <Select
                id="kitDestinoId"
                label="Destinação (kit)"
                placeholder="Sem destinação específica"
                apoio="Informativo: o item entra no saldo geral e pode sair avulso ou via kit."
                opcoes={kits.map((k) => ({ value: k.id, label: k.nome }))}
                value={kitDestinoId}
                onValueChange={setKitDestinoId}
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={limpar} disabled={enviando}>
                    Limpar
                </Button>
                <Button size="lg" loading={enviando} onClick={salvar}>
                    Registrar entrada
                </Button>
            </div>
        </div>
    )
}
