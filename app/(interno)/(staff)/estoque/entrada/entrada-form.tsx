'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { Controller } from 'react-hook-form'
import { Check, RotateCcw } from 'lucide-react'
import { z } from '@/src/shared/validacao/zod-ptbr'
import {
    aplicarErrosDoServidor,
    quantidadePositiva,
    selecaoObrigatoria,
    textoObrigatorio,
    useFormulario
} from '@/src/shared/formulario'
import { Alert, Button, Combobox, DatePicker, Formulario, NumberInput, Select, Switch, avisar } from '@/src/shared/ui'
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
import { validadeEstaVencida } from '@/src/modules/estoque/domain/entrada'
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

/**
 * Os nomes dos campos espelham as chaves que o domínio devolve em
 * `detalhes.campos` (`item`, `quantidade`, `dataValidade`, em
 * `src/modules/estoque/domain/entrada.ts`). Não é coincidência: é o que faz a
 * recusa do servidor cair no campo certo, sem tabela de tradução no meio.
 */
const esquemaBase = z.object({
    item: textoObrigatorio('Informe o nome do item.'),
    categoria: selecaoObrigatoria(CATEGORIAS_ITEM, 'Selecione a categoria.'),
    unidadeMedida: selecaoObrigatoria(UNIDADES_MEDIDA, 'Selecione a unidade de medida.'),
    condicao: selecaoObrigatoria(CONDICOES_ITEM, 'Selecione a condição.'),
    quantidade: quantidadePositiva(),
    perecivel: z.boolean(),
    dataValidade: z.string().optional(),
    kitDestinoId: z.string().optional()
})

/**
 * Perecível exige validade, e validade não pode ser retroativa (BRD §4.1).
 *
 * `validadeEstaVencida` é **importada do domínio**, não reescrita aqui. A regra
 * continua sendo do servidor — ele revalida tudo de qualquer forma —, mas
 * duplicar a comparação de datas no cliente é exatamente como as duas versões
 * divergem depois. Reusar a função é o que garante que a mensagem apareça no
 * mesmo caso em que o servidor recusaria.
 */
const esquema = esquemaBase.superRefine((dados, ctx) => {
    if (!dados.perecivel) return

    if (!dados.dataValidade) {
        ctx.addIssue({ code: 'custom', path: ['dataValidade'], message: 'Item perecível exige data de validade.' })
        return
    }

    if (validadeEstaVencida(dados.dataValidade)) {
        ctx.addIssue({ code: 'custom', path: ['dataValidade'], message: 'A data de validade não pode ser retroativa.' })
    }
})

/** Campos que este formulário conhece — usado ao distribuir a recusa do servidor (FR-012). */
const CAMPOS = Object.keys(esquemaBase.shape)

type DadosFormulario = z.infer<typeof esquema>

const VALORES_INICIAIS: DadosFormulario = {
    item: '',
    categoria: 'outros',
    unidadeMedida: 'unidade',
    condicao: 'novo',
    quantidade: '',
    perecivel: false,
    dataValidade: undefined,
    kitDestinoId: undefined
}

export function EntradaForm({ kits }: { kits: { id: string; nome: string }[] }) {
    const router = useRouter()

    const [sugestoes, setSugestoes] = useState<ItemEncontrado[]>([])
    const [buscando, setBuscando] = useState(false)
    const [itemSelecionado, setItemSelecionado] = useState<ItemEncontrado | null>(null)
    const [erroGeral, setErroGeral] = useState<string | null>(null)

    const {
        control,
        handleSubmit,
        setValue,
        setError,
        clearErrors,
        reset,
        watch,
        formState: { errors, isSubmitting }
    } = useFormulario(esquema, { defaultValues: VALORES_INICIAIS })

    const nomeDigitado = watch('item')
    const perecivel = watch('perecivel')

    /** Item novo = digitou um nome que não corresponde a nenhuma sugestão escolhida. */
    const ehItemNovo = itemSelecionado === null && nomeDigitado.trim().length > 0

    /**
     * A busca é deliberadamente independente do estado de envio: um `pending`
     * compartilhado deixaria o botão "Registrar entrada" desabilitado enquanto o
     * operador ainda digita o nome do item.
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
        setSugestoes([])
        setErroGeral(null)
        // `reset` zera valores **e** mensagens de erro de uma vez (FR-016).
        reset(VALORES_INICIAIS)
    }

    async function salvar(dados: DadosFormulario) {
        setErroGeral(null)

        const resultado = await registrarEntrada({
            itemId: itemSelecionado?.id ?? null,
            novoItem: ehItemNovo
                ? {
                      nome: dados.item.trim(),
                      categoria: dados.categoria,
                      unidadeMedida: dados.unidadeMedida
                  }
                : null,
            quantidade: Number(dados.quantidade),
            condicao: dados.condicao,
            perecivel: dados.perecivel,
            dataValidade: dados.perecivel ? (dados.dataValidade ?? null) : null,
            kitDestinoId: dados.kitDestinoId ?? null
        })

        if (!resultado.ok) {
            const { mensagemGeral } = aplicarErrosDoServidor({
                erro: resultado.erro,
                camposConhecidos: CAMPOS,
                definirErro: (campo, mensagem) => setError(campo as keyof DadosFormulario, { message: mensagem })
            })
            setErroGeral(mensagemGeral)
            avisar.erro('Não foi possível registrar', resultado.erro.mensagem)
            return
        }

        avisar.sucesso('Entrada registrada', 'O saldo do item foi atualizado.')
        limpar()
        router.refresh()
    }

    return (
        <Formulario onSubmit={handleSubmit(salvar)} className="flex max-w-2xl flex-col gap-6">
            {erroGeral && <Alert tom="danger" titulo={erroGeral} />}

            <Controller
                control={control}
                name="item"
                render={({ field }) => (
                    <Combobox
                        ref={field.ref}
                        id="item"
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
                            field.onChange(termo)
                            // Editar o texto desfaz a seleção: o que vale é o que está escrito.
                            if (itemSelecionado && termo !== itemSelecionado.nome) setItemSelecionado(null)
                        }}
                        onValueChange={(_valores, itens) => {
                            const escolhido = sugestoes.find((s) => s.id === itens[0]?.value) ?? null
                            setItemSelecionado(escolhido)
                            if (escolhido) {
                                field.onChange(escolhido.nome)
                                setValue('categoria', escolhido.categoria)
                                setValue('unidadeMedida', escolhido.unidadeMedida)
                            }
                        }}
                        erro={errors.item?.message}
                        mensagemVazia="Nenhum item parecido. Preencha categoria e unidade para cadastrar um novo."
                    />
                )}
            />

            {itemSelecionado && (
                <Alert tom="info" titulo={`Item existente: ${itemSelecionado.nome}`}>
                    A entrada será somada ao saldo deste item. Categoria e unidade vêm do cadastro.
                </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                    control={control}
                    name="categoria"
                    render={({ field }) => (
                        <Select
                            ref={field.ref}
                            id="categoria"
                            label="Categoria"
                            obrigatorio
                            disabled={itemSelecionado !== null}
                            opcoes={CATEGORIAS_ITEM.map((c) => ({ value: c, label: ROTULO_CATEGORIA_ITEM[c] }))}
                            value={[field.value]}
                            onValueChange={(v) => field.onChange(v[0] as CategoriaItem)}
                            erro={errors.categoria?.message}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="unidadeMedida"
                    render={({ field }) => (
                        <Select
                            ref={field.ref}
                            id="unidadeMedida"
                            label="Unidade de medida"
                            obrigatorio
                            disabled={itemSelecionado !== null}
                            opcoes={UNIDADES_MEDIDA.map((u) => ({ value: u, label: ROTULO_UNIDADE_MEDIDA[u] }))}
                            value={[field.value]}
                            onValueChange={(v) => field.onChange(v[0] as UnidadeMedida)}
                            erro={errors.unidadeMedida?.message}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="condicao"
                    render={({ field }) => (
                        <Select
                            ref={field.ref}
                            id="condicao"
                            label="Condição"
                            obrigatorio
                            opcoes={CONDICOES_ITEM.map((c) => ({ value: c, label: ROTULO_CONDICAO_ITEM[c] }))}
                            value={[field.value]}
                            onValueChange={(v) => field.onChange(v[0] as (typeof CONDICOES_ITEM)[number])}
                            erro={errors.condicao?.message}
                        />
                    )}
                />
                <Controller
                    control={control}
                    name="quantidade"
                    render={({ field }) => (
                        <NumberInput
                            ref={field.ref}
                            id="quantidade"
                            label="Quantidade"
                            obrigatorio
                            min={0}
                            value={field.value}
                            onValueChange={field.onChange}
                            erro={errors.quantidade?.message}
                        />
                    )}
                />
            </div>

            <div className="flex flex-col gap-4">
                <Controller
                    control={control}
                    name="perecivel"
                    render={({ field }) => (
                        <Switch
                            ref={field.ref}
                            id="perecivel"
                            label="Item perecível"
                            apoio="Habilita e obriga a data de validade."
                            checked={field.value}
                            onCheckedChange={(marcado) => {
                                field.onChange(marcado)
                                // O campo sai da tela ao desmarcar; um erro dele
                                // que ficasse para trás bloquearia o envio sem
                                // nada visível para corrigir (FR-014).
                                if (!marcado) clearErrors('dataValidade')
                            }}
                        />
                    )}
                />

                {perecivel && (
                    <Controller
                        control={control}
                        name="dataValidade"
                        render={({ field }) => (
                            <DatePicker
                                ref={field.ref}
                                id="dataValidade"
                                label="Data de validade"
                                obrigatorio
                                apoio="Não é possível registrar item já vencido."
                                value={field.value}
                                onValueChange={field.onChange}
                                erro={errors.dataValidade?.message}
                            />
                        )}
                    />
                )}
            </div>

            <Controller
                control={control}
                name="kitDestinoId"
                render={({ field }) => (
                    <Select
                        ref={field.ref}
                        id="kitDestinoId"
                        label="Destinação (kit)"
                        placeholder="Sem destinação específica"
                        apoio="Informativo: o item entra no saldo geral e pode sair avulso ou via kit."
                        opcoes={kits.map((k) => ({ value: k.id, label: k.nome }))}
                        value={field.value ? [field.value] : []}
                        onValueChange={(v) => field.onChange(v[0])}
                        erro={errors.kitDestinoId?.message}
                    />
                )}
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                    type="button"
                    size="lg"
                    variant="secondary"
                    iconeInicio={<RotateCcw className="size-4" />}
                    onClick={limpar}
                    disabled={isSubmitting}
                >
                    Limpar
                </Button>
                <Button type="submit" size="lg" iconeInicio={<Check className="size-4" />} loading={isSubmitting}>
                    Registrar entrada
                </Button>
            </div>
        </Formulario>
    )
}
