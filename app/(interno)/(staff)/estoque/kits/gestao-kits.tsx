'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useState, useTransition } from 'react'
import { Controller, useFieldArray } from 'react-hook-form'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { aplicarErrosDoServidor, quantidadePositiva, textoObrigatorio, useFormulario } from '@/src/shared/formulario'
import {
    Alert,
    Badge,
    Button,
    Dialog,
    Formulario,
    IconButton,
    Input,
    NumberInput,
    Select,
    Switch,
    Textarea,
    Tooltip,
    avisar
} from '@/src/shared/ui'
import { ABREVIACAO_UNIDADE } from '@/src/modules/estoque/domain/item'
import { formatarQuantidade, kitsPossiveis } from '@/src/modules/estoque/domain'
import type { ItemComSaldo, KitComReceita } from '@/src/modules/estoque/presentation/queries/estoque'
import { salvarKit } from '@/src/modules/estoque/presentation/actions/estoque'

/**
 * CRUD de Kits e composição da receita (BR-EST-02, BR-EST-03 — EST-06).
 *
 * Cada card mostra quantos kits o saldo atual permite montar, calculado pelo
 * mesmo `kitsPossiveis` do domínio que alimenta o painel de crise — a
 * coordenação vê o efeito da receita sobre a capacidade sem trocar de tela.
 */
const esquemaBase = z.object({
    nome: textoObrigatorio('Informe o nome do kit.'),
    descricao: z.string().optional(),
    ativo: z.boolean(),
    componentes: z
        .array(
            z.object({
                itemId: textoObrigatorio('Selecione o item.'),
                quantidade: quantidadePositiva('Informe a quantidade por kit.')
            })
        )
        .min(1, 'O kit precisa de ao menos um componente.')
})

/**
 * O mesmo item não pode aparecer duas vezes na receita: duas linhas do mesmo
 * item significam duas verdades sobre quanto o kit consome dele, e o cálculo de
 * "kits montáveis" passaria a depender de qual das duas o servidor considerou.
 */
const esquema = esquemaBase.superRefine((dados, ctx) => {
    const vistos = new Map<string, number>()
    dados.componentes.forEach((componente, indice) => {
        if (!componente.itemId) return
        if (vistos.has(componente.itemId)) {
            ctx.addIssue({
                code: 'custom',
                path: ['componentes', indice, 'itemId'],
                message: 'Este item já está na receita.'
            })
        }
        vistos.set(componente.itemId, indice)
    })
})

const CAMPOS = Object.keys(esquemaBase.shape)

type DadosFormulario = z.infer<typeof esquemaBase>

const COMPONENTE_VAZIO = { itemId: '', quantidade: '' }

const VALORES_INICIAIS: DadosFormulario = {
    nome: '',
    descricao: '',
    ativo: true,
    componentes: [COMPONENTE_VAZIO]
}

export function GestaoKits({ kits, itens }: { kits: KitComReceita[]; itens: ItemComSaldo[] }) {
    const router = useRouter()
    const [enviando, iniciarTransicao] = useTransition()

    const [editando, setEditando] = useState<KitComReceita | null>(null)
    const [aberto, setAberto] = useState(false)
    const [erro, setErro] = useState<string | null>(null)

    /** Prefixo de `id` estável entre servidor e cliente — ver `saida-form.tsx`. */
    const idBase = useId()

    const saldos = new Map(itens.map((i) => [i.id, i.saldo]))

    const {
        control,
        register,
        handleSubmit,
        setError,
        reset,
        formState: { errors }
    } = useFormulario(esquema, { defaultValues: VALORES_INICIAIS })

    const { fields, append, remove } = useFieldArray({ control, name: 'componentes' })

    /**
     * Reinicialização ao abrir: cobre tanto "Novo kit" quanto trocar de um kit
     * para outro sem fechar o diálogo. Sem isto, a receita de um kit vazaria
     * para a edição do seguinte, e mensagens de erro do envio anterior
     * continuariam na tela (FR-016).
     */
    useEffect(() => {
        if (!aberto) return
        setErro(null)
        reset(
            editando
                ? {
                      nome: editando.nome,
                      descricao: editando.descricao ?? '',
                      ativo: editando.ativo,
                      componentes:
                          editando.componentes.length > 0
                              ? editando.componentes.map((c) => ({
                                    itemId: c.itemId,
                                    quantidade: String(c.quantidadePorKit)
                                }))
                              : [COMPONENTE_VAZIO]
                  }
                : VALORES_INICIAIS
        )
    }, [aberto, editando, reset])

    function abrirNovo() {
        setEditando(null)
        setAberto(true)
    }

    function abrirEdicao(kit: KitComReceita) {
        setEditando(kit)
        setAberto(true)
    }

    function salvar(dados: DadosFormulario) {
        setErro(null)

        iniciarTransicao(async () => {
            const resultado = await salvarKit({
                id: editando?.id,
                nome: dados.nome,
                descricao: dados.descricao?.trim() || null,
                ativo: dados.ativo,
                componentes: dados.componentes.map((c) => ({
                    itemId: c.itemId,
                    quantidadePorKit: Number(c.quantidade)
                }))
            })

            if (!resultado.ok) {
                const { mensagemGeral } = aplicarErrosDoServidor({
                    erro: resultado.erro,
                    camposConhecidos: CAMPOS,
                    definirErro: (campo, msg) => setError(campo as keyof DadosFormulario, { message: msg })
                })
                setErro(mensagemGeral)
                return
            }

            avisar.sucesso(editando ? 'Kit atualizado' : 'Kit criado')
            setAberto(false)
            router.refresh()
        })
    }

    return (
        <>
            <div className="flex justify-end">
                <Button iconeInicio={<Plus aria-hidden className="size-5" />} onClick={abrirNovo}>
                    Novo kit
                </Button>
            </div>

            {kits.length === 0 ? (
                <Alert tom="info" titulo="Nenhum kit cadastrado">
                    Cadastre um kit e sua receita para poder registrar saídas por kit.
                </Alert>
            ) : (
                <ul className="grid gap-3 lg:grid-cols-2">
                    {kits.map((kit) => {
                        const montaveis = kitsPossiveis(
                            kit.componentes.map((c) => ({ itemId: c.itemId, quantidadePorKit: c.quantidadePorKit })),
                            saldos
                        )
                        return (
                            <li
                                key={kit.id}
                                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex min-w-0 flex-col gap-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-lg font-semibold text-foreground">{kit.nome}</p>
                                            <Badge cor={kit.ativo ? 'success' : 'neutral'}>
                                                {kit.ativo ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </div>
                                        {kit.descricao && (
                                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                                {kit.descricao}
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        variant="secondary"
                                        iconeInicio={<Pencil className="size-3" />}
                                        size="sm"
                                        onClick={() => abrirEdicao(kit)}
                                    >
                                        Editar
                                    </Button>
                                </div>

                                {kit.componentes.length === 0 ? (
                                    <p className="text-sm text-warning-700 dark:text-warning-400">
                                        Sem receita — este kit não pode ser usado em uma saída.
                                    </p>
                                ) : (
                                    <>
                                        <ul className="flex flex-col gap-1">
                                            {kit.componentes.map((c) => (
                                                <li
                                                    key={c.itemId}
                                                    className="flex justify-between gap-2 text-sm text-foreground"
                                                >
                                                    <span className="truncate">{c.nome}</span>
                                                    <span className="shrink-0 text-neutral-500">
                                                        {formatarQuantidade(c.quantidadePorKit)}{' '}
                                                        {ABREVIACAO_UNIDADE[c.unidadeMedida]} / kit
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                        <p
                                            className={
                                                montaveis === 0
                                                    ? 'text-sm font-medium text-danger-700 dark:text-danger-400'
                                                    : 'text-sm font-medium text-foreground'
                                            }
                                        >
                                            {montaveis} kit(s) montável(is) com o saldo atual
                                        </p>
                                    </>
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}

            <Dialog
                open={aberto}
                onOpenChange={setAberto}
                titulo={editando ? 'Editar kit' : 'Novo kit'}
                descricao="A receita define quanto de cada item uma unidade do kit consome."
                tamanho="lg"
                acoes={
                    <>
                        <Button
                            type="button"
                            variant="secondary"
                            iconeInicio={<X className="size-4" />}
                            onClick={() => setAberto(false)}
                        >
                            Cancelar
                        </Button>
                        {/* Fora do `<form>`: o `form=` é o que liga o botão a ele. */}
                        <Button
                            type="submit"
                            form="kit-form"
                            iconeInicio={<Check className="size-4" />}
                            loading={enviando}
                        >
                            Salvar
                        </Button>
                    </>
                }
            >
                <Formulario id="kit-form" onSubmit={handleSubmit(salvar)} className="flex flex-col gap-4">
                    {erro && <Alert tom="danger" titulo={erro} />}

                    <Input
                        id="nomeKit"
                        label="Nome do kit"
                        obrigatorio
                        erro={errors.nome?.message}
                        {...register('nome')}
                    />
                    <Textarea
                        id="descricaoKit"
                        label="Descrição"
                        erro={errors.descricao?.message}
                        {...register('descricao')}
                    />
                    {editando && (
                        <Controller
                            control={control}
                            name="ativo"
                            render={({ field }) => (
                                <Switch
                                    ref={field.ref}
                                    id="ativoKit"
                                    label="Kit ativo"
                                    apoio="Kits inativos não aparecem na tela de saída."
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    erro={errors.ativo?.message}
                                />
                            )}
                        />
                    )}

                    <div className="flex flex-col gap-3">
                        <h3 className="text-lg font-semibold text-foreground">Receita</h3>

                        {errors.componentes?.root?.message && (
                            <Alert tom="danger" titulo={errors.componentes.root.message} />
                        )}

                        {fields.map((campo, indice) => {
                            // Um kit sem componente algum não consumiria nada.
                            const ultimoComponente = fields.length === 1
                            return (
                                <div key={campo.id} className="flex items-start gap-2">
                                    <div className="min-w-0 flex-1">
                                        <Controller
                                            control={control}
                                            name={`componentes.${indice}.itemId`}
                                            render={({ field }) => (
                                                <Select
                                                    ref={field.ref}
                                                    id={`item-${idBase}-${indice}`}
                                                    label="Item"
                                                    obrigatorio
                                                    opcoes={itens.map((i) => ({ value: i.id, label: i.nome }))}
                                                    value={field.value ? [field.value] : []}
                                                    onValueChange={(v) => field.onChange(v[0] ?? '')}
                                                    erro={errors.componentes?.[indice]?.itemId?.message}
                                                />
                                            )}
                                        />
                                    </div>
                                    <div className="w-32 shrink-0">
                                        <Controller
                                            control={control}
                                            name={`componentes.${indice}.quantidade`}
                                            render={({ field }) => (
                                                <NumberInput
                                                    ref={field.ref}
                                                    id={`qtdKit-${idBase}-${indice}`}
                                                    label="Por kit"
                                                    obrigatorio
                                                    min={0}
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                    erro={errors.componentes?.[indice]?.quantidade?.message}
                                                />
                                            )}
                                        />
                                    </div>
                                    {/* Mesma condição de antes; agora ela se explica (A-05). */}
                                    <div className="mt-7 shrink-0">
                                        <Tooltip
                                            conteudo={
                                                ultimoComponente
                                                    ? 'O kit precisa de ao menos um componente'
                                                    : 'Remover componente'
                                            }
                                            descricao={ultimoComponente}
                                        >
                                            <IconButton
                                                aria-label="Remover componente"
                                                icone={<Trash2 aria-hidden className="size-5" />}
                                                variant="ghost"
                                                inativo={ultimoComponente}
                                                onClick={() => remove(indice)}
                                            />
                                        </Tooltip>
                                    </div>
                                </div>
                            )
                        })}

                        <div>
                            <Button
                                type="button"
                                variant="secondary"
                                iconeInicio={<Plus aria-hidden className="size-5" />}
                                onClick={() => append(COMPONENTE_VAZIO)}
                            >
                                Adicionar componente
                            </Button>
                        </div>
                    </div>
                </Formulario>
            </Dialog>
        </>
    )
}
