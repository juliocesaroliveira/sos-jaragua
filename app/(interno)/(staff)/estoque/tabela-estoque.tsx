'use client'

import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RotateCcw, ShieldAlert } from 'lucide-react'
import { Alert } from '@/src/shared/ui/alert/alert'
import { Badge, COR_ESTOQUE_ITEM } from '@/src/shared/ui/badge/badge'
import { Button } from '@/src/shared/ui/button/button'
import { IconButton } from '@/src/shared/ui/icon-button/icon-button'
import { Select } from '@/src/shared/ui/select/select'
import { Table, type ColunaTabela } from '@/src/shared/ui/table/table'
import { Tooltip } from '@/src/shared/ui/tooltip/tooltip'
import { RAIZ_ESTOQUE, chaveEstoque, useListagemPaginada } from '@/src/shared/query'
import {
    ABREVIACAO_UNIDADE,
    CATEGORIAS_ITEM,
    ROTULO_CATEGORIA_ITEM,
    type CategoriaItem
} from '@/src/modules/estoque/domain/item'
import { limiarDoItem } from '@/src/modules/estoque/domain/estoque-minimo'
import { formatarQuantidade } from '@/src/modules/estoque/domain/quantidade'
import { listarEstoqueAction } from '@/src/modules/estoque/presentation/actions/listagens'
import type { ItemComSaldo } from '@/src/modules/estoque/presentation/queries/estoque'
import { EstoqueMinimoDialog } from './estoque-minimo-dialog'

/**
 * Listagem paginada de estoque (EST-12). Paginação e filtro vivem na URL — a
 * paginação é server-side (NFR §2.1) e o operador consegue recarregar ou
 * compartilhar a visão em que estava. Cada página é buscada pela Server
 * Function via TanStack Query (007-datatable-server-pagination).
 */
export function TabelaEstoque({ categoria, limiarGlobal }: { categoria?: CategoriaItem; limiarGlobal: number }) {
    const queryClient = useQueryClient()
    const [itemEditando, setItemEditando] = useState<ItemComSaldo | null>(null)

    const { rows, carregando, atualizando, erro, refetch, paginacao, navegar } = useListagemPaginada<
        ItemComSaldo,
        { categoria?: CategoriaItem }
    >({
        chave: chaveEstoque,
        buscar: listarEstoqueAction,
        filtros: { categoria }
    })

    const colunas = useMemo<ColunaTabela<ItemComSaldo>[]>(
        () => [
            { accessorKey: 'nome', header: 'Item' },
            {
                id: 'categoria',
                header: 'Categoria',
                cell: ({ row }) => ROTULO_CATEGORIA_ITEM[row.original.categoria]
            },
            {
                id: 'saldo',
                header: 'Saldo',
                cell: ({ row }) => {
                    const { saldo, estoqueMinimo, unidadeMedida } = row.original
                    const limiar = limiarDoItem(estoqueMinimo, limiarGlobal)
                    // Mesma regra do alerta (`itensCriticos`): `<=` o limiar efetivo.
                    const abaixoDoMinimo = limiar !== null && saldo <= limiar
                    return (
                        <span className="inline-flex flex-wrap items-center gap-2">
                            <span className={saldo <= 0 ? 'text-danger-700 dark:text-danger-400' : 'text-foreground'}>
                                {formatarQuantidade(saldo)} {ABREVIACAO_UNIDADE[unidadeMedida]}
                            </span>
                            {/* Texto, e não só cor (DESIGN_SYSTEM §1.6). */}
                            {abaixoDoMinimo && (
                                <Badge cor={COR_ESTOQUE_ITEM.abaixo_do_minimo}>
                                    <ShieldAlert aria-hidden className="size-3.5" />
                                    Abaixo do mínimo
                                </Badge>
                            )}
                        </span>
                    )
                }
            },
            {
                id: 'estoqueMinimo',
                header: 'Mínimo',
                cell: ({ row }) => {
                    const { estoqueMinimo, unidadeMedida } = row.original
                    const unidade = ABREVIACAO_UNIDADE[unidadeMedida]
                    if (estoqueMinimo === null) {
                        return (
                            <span className="text-neutral-500 dark:text-neutral-400">
                                Padrão ({formatarQuantidade(limiarGlobal)} {unidade})
                            </span>
                        )
                    }
                    if (estoqueMinimo === 0) {
                        return <span className="text-neutral-500 dark:text-neutral-400">Sem alerta</span>
                    }
                    return `${formatarQuantidade(estoqueMinimo)} ${unidade}`
                }
            },
            {
                id: 'acoes',
                header: 'Ações',
                cell: ({ row }) => {
                    // Nomear o item no rótulo: numa tabela longa, "Definir estoque
                    // mínimo" sozinho não diz de qual linha (feature 015).
                    const rotulo = `Definir estoque mínimo de ${row.original.nome}`
                    return (
                        <Tooltip conteudo={rotulo}>
                            <IconButton
                                aria-label={rotulo}
                                icone={<ShieldAlert aria-hidden className="size-5" />}
                                onClick={() => setItemEditando(row.original)}
                            />
                        </Tooltip>
                    )
                }
            }
        ],
        [limiarGlobal]
    )

    return (
        <div className="flex flex-col gap-4">
            <div className="max-w-xs">
                <Select
                    id="filtroCategoria"
                    label="Categoria"
                    placeholder="Todas"
                    opcoes={CATEGORIAS_ITEM.map((c) => ({ value: c, label: ROTULO_CATEGORIA_ITEM[c] }))}
                    value={categoria ? [categoria] : []}
                    onValueChange={(v) => navegar({ categoria: v[0], page: undefined })}
                />
            </div>

            {erro ? (
                <Alert tom="danger" titulo="Não foi possível carregar o estoque">
                    <div className="flex flex-col items-start gap-3">
                        <p>{erro.message}</p>
                        <Button
                            variant="secondary"
                            iconeInicio={<RotateCcw className="size-4" />}
                            onClick={() => void refetch()}
                        >
                            Tentar novamente
                        </Button>
                    </div>
                </Alert>
            ) : (
                <Table
                    titulo="Itens em estoque"
                    colunas={colunas}
                    dados={rows}
                    carregando={carregando}
                    atualizando={atualizando}
                    vazio="Nenhum item encontrado com este filtro."
                    paginacao={paginacao}
                />
            )}

            <EstoqueMinimoDialog
                open={itemEditando !== null}
                onOpenChange={(aberto) => {
                    if (!aberto) setItemEditando(null)
                }}
                item={itemEditando}
                limiarGlobal={limiarGlobal}
                onSucesso={() => {
                    // Mesmo padrão de `admin/tabela-usuarios.tsx`: a action já
                    // invalidou a tag, e a página atual volta no mesmo render.
                    // As outras páginas em cache só são marcadas como velhas.
                    void queryClient.invalidateQueries({ queryKey: RAIZ_ESTOQUE, refetchType: 'none' })
                }}
            />
        </div>
    )
}
