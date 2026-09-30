'use client'

import { useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Alert } from '@/src/shared/ui/alert/alert'
import { Button } from '@/src/shared/ui/button/button'
import { IconButton } from '@/src/shared/ui/icon-button/icon-button'
import { Table, type ColunaTabela } from '@/src/shared/ui/table/table'
import { Tooltip } from '@/src/shared/ui/tooltip/tooltip'
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
                cell: ({ row }) => {
                    // Nomear o registro (FR-015): numa tabela de dezenas de
                    // linhas, "Editar" sozinho não diz **qual** conta será
                    // editada. Mesmo rótulo para o nome acessível e a dica.
                    const rotulo = `Editar ${row.original.nome}`
                    return (
                        <Tooltip conteudo={rotulo}>
                            <IconButton
                                aria-label={rotulo}
                                icone={<Pencil aria-hidden className="size-5" />}
                                onClick={() => abrirEdicao(row.original)}
                            />
                        </Tooltip>
                    )
                }
            }
        ],
        []
    )

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-end">
                <Button iconeInicio={<Plus className="size-4" />} onClick={abrirCadastro}>
                    Nova conta
                </Button>
            </div>

            {erro ? (
                <Alert tom="danger" titulo="Não foi possível carregar as contas">
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
                    // A Server Action de escrita já invalidou a tag no servidor,
                    // e o `updateTag` devolve na mesma resposta o render da
                    // página atual — cuja hidratação atualiza a lista visível.
                    // Aqui só marcamos as **outras** páginas em cache como
                    // velhas, sem refazer a consulta agora (`refetchType:
                    // 'none'`): refazê-la seria um segundo POST pelo mesmo dado.
                    void queryClient.invalidateQueries({ queryKey: RAIZ_USUARIOS, refetchType: 'none' })
                }}
            />
        </div>
    )
}
