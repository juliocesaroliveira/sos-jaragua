'use client'

import { useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Alert, Button, IconButton, Table, type ColunaTabela } from '@/src/shared/ui'
import { RAIZ_USUARIOS, chaveUsuarios, useListagemPaginada } from '@/src/shared/query'
import { ROTULO_ROLE } from '@/src/shared/auth/roles'
import { listarUsuariosAction } from '@/src/modules/identidade/presentation/actions/usuarios'
import type { LinhaUsuario } from '@/src/modules/identidade/presentation/queries/usuarios'
import { UsuarioFormDialog } from './usuario-form-dialog'

/**
 * Listagem paginada de contas (006-user-management-page, US1) + cadastro
 * (US2) + edição (US3).
 *
 * A paginação é server-side (NFR §2.1) e cada página é buscada pela Server
 * Function via TanStack Query (007-datatable-server-pagination): a primeira vem
 * hidratada do Server Component, as seguintes não recarregam a rota. Página e
 * tamanho continuam vivendo na URL, então a visão segue compartilhável.
 */
export function TabelaUsuarios() {
    const queryClient = useQueryClient()
    const [dialogoAberto, setDialogoAberto] = useState(false)
    // `null` = modo cadastro; uma linha = modo edição, pré-preenchido (E-04).
    const [usuarioEditando, setUsuarioEditando] = useState<LinhaUsuario | null>(null)

    const { rows, carregando, atualizando, erro, refetch, paginacao } = useListagemPaginada<LinhaUsuario>({
        chave: chaveUsuarios,
        buscar: listarUsuariosAction
    })

    function abrirCadastro() {
        setUsuarioEditando(null)
        setDialogoAberto(true)
    }

    function abrirEdicao(usuario: LinhaUsuario) {
        setUsuarioEditando(usuario)
        setDialogoAberto(true)
    }

    const colunas = useMemo<ColunaTabela<LinhaUsuario>[]>(
        () => [
            { accessorKey: 'nome', header: 'Nome' },
            { accessorKey: 'email', header: 'E-mail' },
            {
                id: 'role',
                header: 'Papel',
                cell: ({ row }) => ROTULO_ROLE[row.original.role]
            },
            {
                id: 'acoes',
                header: 'Ações',
                cell: ({ row }) => (
                    <IconButton
                        aria-label={`Editar ${row.original.nome}`}
                        icone={<Pencil aria-hidden className="size-5" />}
                        onClick={() => abrirEdicao(row.original)}
                    />
                )
            }
        ],
        []
    )

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-end">
                <Button onClick={abrirCadastro}>Nova conta</Button>
            </div>

            {erro ? (
                <Alert tom="danger" titulo="Não foi possível carregar as contas">
                    <div className="flex flex-col items-start gap-3">
                        <p>{erro.message}</p>
                        <Button variant="secondary" onClick={() => void refetch()}>
                            Tentar novamente
                        </Button>
                    </div>
                </Alert>
            ) : (
                <Table
                    titulo="Contas cadastradas"
                    colunas={colunas}
                    dados={rows}
                    carregando={carregando}
                    atualizando={atualizando}
                    vazio="Nenhuma conta cadastrada."
                    paginacao={paginacao}
                />
            )}

            <UsuarioFormDialog
                open={dialogoAberto}
                onOpenChange={setDialogoAberto}
                usuario={usuarioEditando ?? undefined}
                onSucesso={() => {
                    // A Server Action de escrita já invalidou a tag no servidor;
                    // isto invalida o espelho no cliente. Substitui o
                    // `router.refresh()`, que recarregava a rota inteira só para
                    // atualizar a lista.
                    void queryClient.invalidateQueries({ queryKey: RAIZ_USUARIOS })
                }}
            />
        </div>
    )
}
