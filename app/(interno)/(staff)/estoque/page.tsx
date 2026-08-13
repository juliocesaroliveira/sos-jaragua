import { HydrationBoundary } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SkeletonLista } from '@/src/shared/ui'
import { normalizarPaginacao } from '@/src/shared/paginacao/esquema'
import { chaveEstoque } from '@/src/shared/query'
import { estadoHidratado } from '@/src/shared/query/hidratacao'
import { CATEGORIAS_ITEM, type CategoriaItem } from '@/src/modules/estoque/domain/item'
import { listarEstoque } from '@/src/modules/estoque/presentation/queries/estoque'
import { TabelaEstoque } from './tabela-estoque'

export const metadata: Metadata = {
    title: 'Estoque — SOS Jaraguá'
}

type Props = {
    searchParams: Promise<{ page?: string; pageSize?: string; categoria?: string }>
}

/** EST-12 — inventário atual, servido pelo saldo materializado (NFR §4.1). */
export default function EstoquePage({ searchParams }: Props) {
    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Estoque</h1>
                <p className="text-base text-neutral-500 dark:text-neutral-400">
                    Saldo atual por item, atualizado a cada entrada, saída ou descarte.
                </p>
            </header>

            <Suspense fallback={<SkeletonLista linhas={6} />}>
                <Conteudo searchParams={searchParams} />
            </Suspense>
        </div>
    )
}

async function Conteudo({ searchParams }: Props) {
    const params = await searchParams
    const categoria = CATEGORIAS_ITEM.includes(params.categoria as CategoriaItem)
        ? (params.categoria as CategoriaItem)
        : undefined

    const consulta = { ...normalizarPaginacao(params), categoria }
    const pagina = await listarEstoque(consulta)

    return (
        <HydrationBoundary state={estadoHidratado([{ chave: chaveEstoque(consulta), dados: pagina }])}>
            <TabelaEstoque categoria={categoria} />
        </HydrationBoundary>
    )
}
