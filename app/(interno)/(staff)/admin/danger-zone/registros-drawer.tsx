'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { Alert } from '@/src/shared/ui/alert/alert'
import { Badge } from '@/src/shared/ui/badge/badge'
import { Button } from '@/src/shared/ui/button/button'
import { Drawer } from '@/src/shared/ui/drawer/drawer'
import { Input } from '@/src/shared/ui/input/input'
import { SkeletonLista } from '@/src/shared/ui/skeleton/skeleton'
import { cn } from '@/src/shared/ui/cn'
import { listarRegistrosAction } from '@/src/modules/manutencao/presentation/actions/danger-zone'
import { chaveRegistros } from './chaves'

type Props = {
    tabela: string
    rotulo: string
    onFechar: () => void
    onExcluir: (chaves: string[]) => void
}

const TAMANHO_PAGINA = 20
const LIMITE_SELECAO = 500

/**
 * Registros de uma tabela para exclusão pontual (U-04, US2).
 *
 * A seleção sobrevive à troca de página e à busca — é por chave, não por
 * posição. Registros do sistema aparecem (o administrador precisa saber que
 * existem) mas não podem ser marcados.
 */
export function RegistrosDrawer({ tabela, rotulo, onFechar, onExcluir }: Props) {
    const [pagina, setPagina] = useState(1)
    const [busca, setBusca] = useState('')
    const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
    const idBusca = useId()

    const params = { page: pagina, pageSize: TAMANHO_PAGINA, busca }
    const consulta = useQuery({
        queryKey: chaveRegistros(tabela, params),
        queryFn: async () => {
            const r = await listarRegistrosAction({ tabela, ...params })
            if (!r.ok) throw new Error(r.erro.mensagem)
            return r.valor
        },
        placeholderData: keepPreviousData
    })

    function alternar(chave: string) {
        setSelecionados((atual) => {
            const proximo = new Set(atual)
            if (proximo.has(chave)) proximo.delete(chave)
            else if (proximo.size < LIMITE_SELECAO) proximo.add(chave)
            return proximo
        })
    }

    const totalPaginas = consulta.data ? Math.max(1, Math.ceil(consulta.data.totalCount / TAMANHO_PAGINA)) : 1

    return (
        <Drawer
            open
            lado="right"
            onOpenChange={(aberto) => !aberto && onFechar()}
            titulo={`Registros — ${rotulo}`}
            descricao="Selecione os registros a excluir. A próxima etapa mostra tudo o que será afetado antes de qualquer alteração."
            acoes={
                <Button
                    variant="danger"
                    disabled={selecionados.size === 0}
                    iconeInicio={<Trash2 aria-hidden className="size-4" />}
                    onClick={() => onExcluir([...selecionados])}
                >
                    Excluir selecionados ({selecionados.size})
                </Button>
            }
        >
            <div className="flex flex-col gap-4">
                <Input
                    id={idBusca}
                    label="Buscar"
                    type="search"
                    value={busca}
                    onChange={(e) => {
                        setBusca(e.target.value)
                        setPagina(1)
                    }}
                />

                {selecionados.size >= LIMITE_SELECAO && (
                    <Alert tom="warning" titulo="Limite atingido">
                        Selecione no máximo {LIMITE_SELECAO} registros por vez. Para apagar todos, use o reset da
                        tabela.
                    </Alert>
                )}

                {consulta.isPending && <SkeletonLista linhas={6} />}
                {consulta.isError && (
                    <Alert tom="danger" titulo="Não foi possível carregar">
                        {consulta.error.message}
                    </Alert>
                )}

                {consulta.data && (
                    <ul
                        className={cn('flex flex-col gap-2', consulta.isPlaceholderData && 'opacity-60')}
                        aria-busy={consulta.isFetching}
                    >
                        {consulta.data.rows.length === 0 && (
                            <li className="text-sm text-neutral-500 dark:text-neutral-400">
                                Nenhum registro encontrado.
                            </li>
                        )}
                        {consulta.data.rows.map((linha) => {
                            const idCaixa = `sel-${tabela}-${linha.chave}`
                            return (
                                <li key={linha.chave} className="flex gap-3 rounded-lg border border-border p-3">
                                    <input
                                        id={idCaixa}
                                        type="checkbox"
                                        className="mt-1 size-5 shrink-0 accent-danger-600"
                                        checked={selecionados.has(linha.chave)}
                                        disabled={linha.sistema}
                                        onChange={() => alternar(linha.chave)}
                                    />
                                    <label htmlFor={idCaixa} className="flex min-w-0 flex-col gap-1 text-sm">
                                        <span className="font-medium text-foreground">
                                            {linha.rotulo}{' '}
                                            {linha.sistema && <Badge cor="info">registro do sistema</Badge>}
                                        </span>
                                        <span className="break-words text-xs text-neutral-500 dark:text-neutral-400">
                                            {consulta.data.colunas
                                                .filter((c) => linha.valores[c] !== null)
                                                .map((c) => `${c}: ${linha.valores[c]}`)
                                                .join(' · ')}
                                        </span>
                                    </label>
                                </li>
                            )
                        })}
                    </ul>
                )}

                <div className="flex items-center justify-between gap-2 text-sm">
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={pagina <= 1}
                        onClick={() => setPagina((p) => p - 1)}
                        iconeInicio={<ChevronLeft aria-hidden className="size-4" />}
                    >
                        Anterior
                    </Button>
                    <span className="tabular-nums text-neutral-600 dark:text-neutral-300">
                        Página {pagina} de {totalPaginas}
                    </span>
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={pagina >= totalPaginas}
                        onClick={() => setPagina((p) => p + 1)}
                        iconeFim={<ChevronRight aria-hidden className="size-4" />}
                    >
                        Próxima
                    </Button>
                </div>
            </div>
        </Drawer>
    )
}
