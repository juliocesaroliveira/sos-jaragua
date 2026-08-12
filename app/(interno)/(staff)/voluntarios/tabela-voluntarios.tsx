'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import {
    Badge,
    COR_STATUS_VOLUNTARIO,
    Pagination,
    ROTULO_STATUS_VOLUNTARIO,
    Select,
    Table,
    type ColunaTabela
} from '@/src/shared/ui'
import type { LinhaVoluntario } from '@/src/modules/voluntariado/presentation/queries/candidaturas'
import type { Lookup } from '@/src/modules/voluntariado/presentation/queries/lookups'

/**
 * Listagem paginada de voluntários (VOL-12).
 *
 * Página e filtros vivem na URL, não em estado local: a paginação é
 * server-side (NFR §2.1), então cada mudança é uma nova navegação — e o
 * operador consegue compartilhar/recarregar a visão em que estava.
 */
export function TabelaVoluntarios({
    rows,
    totalCount,
    page,
    pageSize,
    habilidades,
    filtros
}: {
    rows: LinhaVoluntario[]
    totalCount: number
    page: number
    pageSize: number
    habilidades: Lookup[]
    filtros: { status?: string; habilidadeId?: string }
}) {
    const router = useRouter()
    const searchParams = useSearchParams()

    function navegar(mudancas: Record<string, string | undefined>) {
        const params = new URLSearchParams(searchParams.toString())
        for (const [chave, valor] of Object.entries(mudancas)) {
            if (valor) params.set(chave, valor)
            else params.delete(chave)
        }
        router.push(`/voluntarios?${params.toString()}`)
    }

    const colunas = useMemo<ColunaTabela<LinhaVoluntario>[]>(
        () => [
            { accessorKey: 'nomeCompleto', header: 'Nome' },
            { accessorKey: 'email', header: 'E-mail' },
            { accessorKey: 'bairro', header: 'Bairro' },
            {
                id: 'habilidades',
                header: 'Habilidades',
                cell: ({ row }) => (row.original.habilidades.length > 0 ? row.original.habilidades.join(', ') : '—')
            },
            {
                id: 'status',
                header: 'Status',
                cell: ({ row }) => (
                    <Badge cor={COR_STATUS_VOLUNTARIO[row.original.status]}>
                        {ROTULO_STATUS_VOLUNTARIO[row.original.status]}
                    </Badge>
                )
            }
        ],
        []
    )

    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
                <Select
                    id="filtroStatus"
                    label="Status"
                    placeholder="Todos"
                    opcoes={[
                        { value: 'pendente', label: 'Pendente' },
                        { value: 'aprovado', label: 'Aprovado' },
                        { value: 'rejeitado', label: 'Rejeitado' }
                    ]}
                    value={filtros.status ? [filtros.status] : []}
                    onValueChange={(v) => navegar({ status: v[0], page: undefined })}
                />
                <Select
                    id="filtroHabilidade"
                    label="Habilidade"
                    placeholder="Todas"
                    opcoes={habilidades.map((h) => ({ value: h.id, label: h.nome }))}
                    value={filtros.habilidadeId ? [filtros.habilidadeId] : []}
                    onValueChange={(v) => navegar({ habilidade: v[0], page: undefined })}
                />
            </div>

            <Table
                titulo="Voluntários cadastrados"
                colunas={colunas}
                dados={rows}
                vazio="Nenhum voluntário encontrado com estes filtros."
            />

            <Pagination
                aria-label="Paginação de voluntários"
                totalCount={totalCount}
                pageSize={pageSize}
                page={page}
                onPageChange={(p) => navegar({ page: String(p) })}
            />
        </div>
    )
}
