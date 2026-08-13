'use client'

import { useMemo } from 'react'
import {
    Alert,
    Badge,
    Button,
    COR_STATUS_VOLUNTARIO,
    ROTULO_STATUS_VOLUNTARIO,
    Select,
    Table,
    type ColunaTabela
} from '@/src/shared/ui'
import { chaveVoluntarios, useListagemPaginada } from '@/src/shared/query'
import { listarVoluntariosAction } from '@/src/modules/voluntariado/presentation/actions/voluntarios'
import type { LinhaVoluntario } from '@/src/modules/voluntariado/presentation/queries/candidaturas'
import type { Lookup } from '@/src/modules/voluntariado/presentation/queries/lookups'

/**
 * Listagem paginada de voluntários (VOL-12).
 *
 * Filtros e página vivem na URL e cada página é buscada no servidor pela Server
 * Function (007-datatable-server-pagination): trocar de página não recarrega a
 * rota, mas a visão continua compartilhável e recarregável. Os filtros entram
 * na `queryKey` e sobrevivem à navegação entre páginas (FR-019).
 */
export function TabelaVoluntarios({
    habilidades,
    filtros
}: {
    habilidades: Lookup[]
    filtros: { status?: string; habilidadeId?: string }
}) {
    const { rows, carregando, atualizando, erro, refetch, paginacao, navegar } = useListagemPaginada<
        LinhaVoluntario,
        { status?: string; habilidadeId?: string }
    >({
        chave: chaveVoluntarios,
        buscar: listarVoluntariosAction,
        filtros
    })

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
                    // Trocar filtro volta para a primeira página: manter `page`
                    // levaria a um resultado vazio sempre que o novo filtro
                    // tiver menos páginas que o anterior.
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

            {erro ? (
                <Alert tom="danger" titulo="Não foi possível carregar os voluntários">
                    <div className="flex flex-col items-start gap-3">
                        <p>{erro.message}</p>
                        <Button variant="secondary" onClick={() => void refetch()}>
                            Tentar novamente
                        </Button>
                    </div>
                </Alert>
            ) : (
                <Table
                    titulo="Voluntários cadastrados"
                    colunas={colunas}
                    dados={rows}
                    carregando={carregando}
                    atualizando={atualizando}
                    vazio="Nenhum voluntário encontrado com estes filtros."
                    paginacao={paginacao}
                />
            )}
        </div>
    )
}
