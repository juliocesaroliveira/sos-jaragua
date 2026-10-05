'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { RowData } from '@tanstack/react-table'
import { chaveLookup } from '@/src/shared/query/chaves'
import { useListagemLocal } from '@/src/shared/query/use-listagem-local'
import { Alert } from '../alert/alert'
import { Badge } from '../badge/badge'
import { Button } from '../button/button'
import { Dialog } from '../dialog/dialog'
import { Input } from '../input/input'
import { Table, type ColunaTabela } from '../table/table'
import type { FonteLookup, MotivoIndisponivel } from './tipos'

/**
 * Diálogo de pesquisa do Lookup (021, contracts C-07..C-10): filtro por texto
 * e tabela paginada no servidor. Clicar — ou Enter/Espaço — numa linha
 * disponível escolhe o registro e fecha o diálogo; fechar sem escolher não
 * altera nada (FR-009).
 *
 * É montado só enquanto aberto: filtro e página recomeçam a cada abertura, e
 * nenhuma página é buscada com o diálogo fechado.
 */
export interface LookupDialogProps<T extends RowData> {
    fonte: FonteLookup<T>
    motivoIndisponivel?: MotivoIndisponivel<T>
    onAbertoChange: (aberto: boolean) => void
    onEscolher: (registro: T) => void
}

const DEBOUNCE_FILTRO_MS = 250

export function LookupDialog<T extends RowData>({
    fonte,
    motivoIndisponivel,
    onAbertoChange,
    onEscolher
}: LookupDialogProps<T>) {
    const idFiltro = useId()
    const filtroRef = useRef<HTMLInputElement>(null)
    const [filtro, setFiltro] = useState('')
    const [termo, setTermo] = useState('')

    useEffect(() => {
        const timeout = setTimeout(() => setTermo(filtro.trim()), DEBOUNCE_FILTRO_MS)
        return () => clearTimeout(timeout)
    }, [filtro])

    const { rows, carregando, atualizando, erro, refetch, paginacao } = useListagemLocal<T, { termo: string }>({
        chave: (params) => chaveLookup(fonte.chave, 'pagina', params),
        buscar: fonte.listar,
        filtros: { termo }
    })

    const colunas = useMemo<ColunaTabela<T>[]>(() => {
        if (!motivoIndisponivel) return fonte.colunas
        return [
            ...fonte.colunas,
            {
                id: 'situacao',
                header: 'Situação',
                // Texto, e não só a linha atenuada (DESIGN_SYSTEM §1.6).
                cell: ({ row }) => {
                    const motivo = motivoIndisponivel(row.original as T)
                    return motivo ? <Badge cor="warning">{motivo}</Badge> : null
                }
            }
        ]
    }, [fonte.colunas, motivoIndisponivel])

    return (
        <Dialog
            open
            onOpenChange={onAbertoChange}
            titulo={fonte.tituloPesquisa}
            tamanho="lg"
            // Quem abre a pesquisa quer filtrar: o foco começa no filtro (C-07).
            focoInicial={() => filtroRef.current}
        >
            <div className="flex flex-col gap-4">
                <Input
                    ref={filtroRef}
                    id={idFiltro}
                    label="Filtrar"
                    type="search"
                    autoComplete="off"
                    placeholder="Digite parte da descrição…"
                    value={filtro}
                    onChange={(evento) => setFiltro(evento.target.value)}
                />

                {erro ? (
                    <Alert
                        tom="danger"
                        titulo="Não foi possível carregar os registros."
                        acao={
                            <Button variant="secondary" onClick={() => void refetch()}>
                                Tentar de novo
                            </Button>
                        }
                    />
                ) : (
                    <Table
                        titulo={fonte.tituloPesquisa}
                        colunas={colunas}
                        dados={rows}
                        carregando={carregando}
                        atualizando={atualizando}
                        vazio="Nenhum registro encontrado."
                        paginacao={paginacao}
                        linhaDesabilitada={motivoIndisponivel ? (r) => Boolean(motivoIndisponivel(r)) : undefined}
                        onLinhaClick={(registro) => {
                            onEscolher(registro)
                            onAbertoChange(false)
                        }}
                    />
                )}
            </div>
        </Dialog>
    )
}
