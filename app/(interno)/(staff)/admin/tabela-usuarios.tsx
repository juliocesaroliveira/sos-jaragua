'use client'

import { Pencil } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Button, IconButton, Pagination, Table, type ColunaTabela } from '@/src/shared/ui'
import { ROTULO_ROLE } from '@/src/shared/auth/roles'
import type { LinhaUsuario } from '@/src/modules/identidade/presentation/queries/usuarios'
import { UsuarioFormDialog } from './usuario-form-dialog'

/**
 * Listagem paginada de contas (006-user-management-page, US1) + cadastro
 * (US2) + edição (US3). Página vive na URL, não em estado local: a
 * paginação é server-side (NFR §2.1), mesmo padrão de `tabela-voluntarios.tsx`.
 */
export function TabelaUsuarios({
    rows,
    totalCount,
    page,
    pageSize
}: {
    rows: LinhaUsuario[]
    totalCount: number
    page: number
    pageSize: number
}) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [dialogoAberto, setDialogoAberto] = useState(false)
    // `null` = modo cadastro; uma linha = modo edição, pré-preenchido (E-04).
    const [usuarioEditando, setUsuarioEditando] = useState<LinhaUsuario | null>(null)

    function navegar(mudancas: Record<string, string | undefined>) {
        const params = new URLSearchParams(searchParams.toString())
        for (const [chave, valor] of Object.entries(mudancas)) {
            if (valor) params.set(chave, valor)
            else params.delete(chave)
        }
        router.push(`/admin?${params.toString()}`)
    }

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

            <Table titulo="Contas cadastradas" colunas={colunas} dados={rows} vazio="Nenhuma conta cadastrada." />

            <Pagination
                aria-label="Paginação de usuários"
                totalCount={totalCount}
                pageSize={pageSize}
                page={page}
                onPageChange={(p) => navegar({ page: String(p) })}
            />

            <UsuarioFormDialog
                open={dialogoAberto}
                onOpenChange={setDialogoAberto}
                usuario={usuarioEditando ?? undefined}
                onSucesso={() => router.refresh()}
            />
        </div>
    )
}
