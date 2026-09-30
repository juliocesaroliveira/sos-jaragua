'use client'

import { useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Alert, Button, IconButton, Table, Tooltip, type ColunaTabela } from '@/src/shared/ui'
import { RAIZ_HABILIDADES, chaveHabilidades, useListagemPaginada } from '@/src/shared/query'
import { listarHabilidadesAction } from '@/src/modules/voluntariado/presentation/actions/habilidades'
import type { LinhaHabilidade } from '@/src/modules/voluntariado/presentation/queries/habilidades'
import { HabilidadeFormDialog } from './habilidade-form-dialog'
import { ExcluirHabilidadeDialog } from './excluir-habilidade-dialog'

/**
 * Listagem paginada de habilidades (017-gestao-habilidades, US1).
 *
 * A paginação é server-side (NFR §2.1) e cada página vem pela Server Function
 * via TanStack Query: a primeira chega hidratada do Server Component, as
 * seguintes não recarregam a rota. Página e tamanho continuam na URL, então a
 * visão segue compartilhável.
 */
const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' })

export function TabelaHabilidades() {
    const queryClient = useQueryClient()
    const [formAberto, setFormAberto] = useState(false)
    // `null` = modo cadastro; uma linha = modo edição, pré-preenchido.
    const [habilidadeEditando, setHabilidadeEditando] = useState<LinhaHabilidade | null>(null)
    const [habilidadeExcluindo, setHabilidadeExcluindo] = useState<LinhaHabilidade | null>(null)

    const { rows, carregando, atualizando, erro, refetch, paginacao } = useListagemPaginada<LinhaHabilidade>({
        chave: chaveHabilidades,
        buscar: listarHabilidadesAction
    })

    /**
     * As Server Actions de escrita já invalidaram as tags no servidor; isto
     * invalida o espelho no cliente. Substitui um `router.refresh()`, que
     * recarregaria a rota inteira só para atualizar a lista.
     */
    function atualizarListagem() {
        void queryClient.invalidateQueries({ queryKey: RAIZ_HABILIDADES })
    }

    function abrirCadastro() {
        setHabilidadeEditando(null)
        setFormAberto(true)
    }

    function abrirEdicao(linha: LinhaHabilidade) {
        setHabilidadeEditando(linha)
        setFormAberto(true)
    }

    const colunas = useMemo<ColunaTabela<LinhaHabilidade>[]>(
        () => [
            { accessorKey: 'nome', header: 'Nome' },
            {
                id: 'voluntarios',
                header: 'Voluntários',
                // A contagem existe para tornar a exclusão previsível: quem vê
                // "3" antes de clicar já sabe que a habilidade está em uso
                // (FR-013).
                cell: ({ row }) => row.original.voluntariosVinculados
            },
            {
                id: 'criadoEm',
                header: 'Cadastrada em',
                cell: ({ row }) => DATA.format(new Date(row.original.criadoEm))
            },
            {
                id: 'acoes',
                header: 'Ações',
                cell: ({ row }) => {
                    // Nomear o registro: numa tabela de dezenas de linhas,
                    // "Editar" sozinho não diz **qual** habilidade. Mesmo rótulo
                    // para o nome acessível e a dica (T-02.2).
                    const rotuloEditar = `Editar ${row.original.nome}`
                    const rotuloExcluir = `Excluir ${row.original.nome}`
                    return (
                        <div className="flex items-center gap-1">
                            <Tooltip conteudo={rotuloEditar}>
                                <IconButton
                                    aria-label={rotuloEditar}
                                    icone={<Pencil aria-hidden className="size-5" />}
                                    onClick={() => abrirEdicao(row.original)}
                                />
                            </Tooltip>
                            {/* Nunca executa direto: sempre passa pela
                                confirmação (FR-011, T-02.3). */}
                            <Tooltip conteudo={rotuloExcluir}>
                                <IconButton
                                    aria-label={rotuloExcluir}
                                    icone={<Trash2 aria-hidden className="size-5" />}
                                    onClick={() => setHabilidadeExcluindo(row.original)}
                                />
                            </Tooltip>
                        </div>
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
                    Nova habilidade
                </Button>
            </div>

            {erro ? (
                <Alert tom="danger" titulo="Não foi possível carregar as habilidades">
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
                    titulo="Habilidades cadastradas"
                    colunas={colunas}
                    dados={rows}
                    carregando={carregando}
                    atualizando={atualizando}
                    vazio="Nenhuma habilidade cadastrada."
                    paginacao={paginacao}
                />
            )}

            <HabilidadeFormDialog
                open={formAberto}
                onOpenChange={setFormAberto}
                habilidade={habilidadeEditando ?? undefined}
                onSucesso={atualizarListagem}
            />

            <ExcluirHabilidadeDialog
                open={habilidadeExcluindo !== null}
                onOpenChange={(aberto) => !aberto && setHabilidadeExcluindo(null)}
                habilidade={habilidadeExcluindo ?? undefined}
                onSucesso={atualizarListagem}
            />
        </div>
    )
}
