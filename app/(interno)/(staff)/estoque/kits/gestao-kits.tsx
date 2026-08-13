'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useId, useRef, useState, useTransition } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
    Alert,
    Badge,
    Button,
    Dialog,
    IconButton,
    Input,
    NumberInput,
    Select,
    Switch,
    Textarea,
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
type LinhaReceita = { id: string; itemId: string[]; quantidade: string }

export function GestaoKits({ kits, itens }: { kits: KitComReceita[]; itens: ItemComSaldo[] }) {
    const router = useRouter()
    const [enviando, iniciarTransicao] = useTransition()

    /**
     * Ids por instância, com prefixo de `useId` — um contador de módulo
     * persistiria entre requisições no servidor e o SSR divergiria da
     * hidratação, quebrando o `htmlFor` de cada label.
     */
    const idBase = useId()
    const sequencia = useRef(0)
    const proximoId = useCallback(() => `${idBase}${sequencia.current++}`, [idBase])
    const novaLinha = useCallback((): LinhaReceita => ({ id: proximoId(), itemId: [], quantidade: '' }), [proximoId])

    const [editando, setEditando] = useState<KitComReceita | null>(null)
    const [aberto, setAberto] = useState(false)
    const [nome, setNome] = useState('')
    const [descricao, setDescricao] = useState('')
    const [ativo, setAtivo] = useState(true)
    const [receita, setReceita] = useState<LinhaReceita[]>(() => [novaLinha()])
    const [erro, setErro] = useState<string | null>(null)

    const saldos = new Map(itens.map((i) => [i.id, i.saldo]))

    function abrirNovo() {
        setEditando(null)
        setNome('')
        setDescricao('')
        setAtivo(true)
        setReceita([novaLinha()])
        setErro(null)
        setAberto(true)
    }

    function abrirEdicao(kit: KitComReceita) {
        setEditando(kit)
        setNome(kit.nome)
        setDescricao(kit.descricao ?? '')
        setAtivo(kit.ativo)
        setReceita(
            kit.componentes.length > 0
                ? kit.componentes.map((c) => ({
                      id: proximoId(),
                      itemId: [c.itemId],
                      quantidade: String(c.quantidadePorKit)
                  }))
                : [novaLinha()]
        )
        setErro(null)
        setAberto(true)
    }

    function salvar() {
        setErro(null)
        const componentes = receita
            .filter((l) => l.itemId[0] && Number(l.quantidade) > 0)
            .map((l) => ({ itemId: l.itemId[0], quantidadePorKit: Number(l.quantidade) }))

        iniciarTransicao(async () => {
            const resultado = await salvarKit({
                id: editando?.id,
                nome,
                descricao: descricao.trim() || null,
                ativo,
                componentes
            })

            if (!resultado.ok) {
                setErro(resultado.erro.mensagem)
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
                            variant="secondary"
                            iconeInicio={<X className="size-4" />}
                            onClick={() => setAberto(false)}
                        >
                            Cancelar
                        </Button>
                        <Button iconeInicio={<Check className="size-4" />} loading={enviando} onClick={salvar}>
                            Salvar
                        </Button>
                    </>
                }
            >
                <div className="flex flex-col gap-4">
                    {erro && <Alert tom="danger" titulo={erro} />}

                    <Input
                        id="nomeKit"
                        label="Nome do kit"
                        obrigatorio
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                    />
                    <Textarea
                        id="descricaoKit"
                        label="Descrição"
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                    />
                    {editando && (
                        <Switch
                            id="ativoKit"
                            label="Kit ativo"
                            apoio="Kits inativos não aparecem na tela de saída."
                            checked={ativo}
                            onCheckedChange={setAtivo}
                        />
                    )}

                    <div className="flex flex-col gap-3">
                        <h3 className="text-lg font-semibold text-foreground">Receita</h3>

                        {receita.map((linha) => (
                            <div key={linha.id} className="flex items-end gap-2">
                                <div className="min-w-0 flex-1">
                                    <Select
                                        id={`item-${linha.id}`}
                                        label="Item"
                                        opcoes={itens.map((i) => ({ value: i.id, label: i.nome }))}
                                        value={linha.itemId}
                                        onValueChange={(v) =>
                                            setReceita((atuais) =>
                                                atuais.map((l) => (l.id === linha.id ? { ...l, itemId: v } : l))
                                            )
                                        }
                                    />
                                </div>
                                <div className="w-32 shrink-0">
                                    <NumberInput
                                        id={`qtdKit-${linha.id}`}
                                        label="Por kit"
                                        min={0}
                                        value={linha.quantidade}
                                        onValueChange={(v) =>
                                            setReceita((atuais) =>
                                                atuais.map((l) => (l.id === linha.id ? { ...l, quantidade: v } : l))
                                            )
                                        }
                                    />
                                </div>
                                <IconButton
                                    aria-label="Remover componente"
                                    icone={<Trash2 aria-hidden className="size-5" />}
                                    variant="ghost"
                                    disabled={receita.length === 1}
                                    onClick={() => setReceita((atuais) => atuais.filter((l) => l.id !== linha.id))}
                                />
                            </div>
                        ))}

                        <div>
                            <Button
                                variant="secondary"
                                iconeInicio={<Plus aria-hidden className="size-5" />}
                                onClick={() => setReceita((atuais) => [...atuais, novaLinha()])}
                            >
                                Adicionar componente
                            </Button>
                        </div>
                    </div>
                </div>
            </Dialog>
        </>
    )
}
