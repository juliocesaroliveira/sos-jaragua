'use client'

import type { ColunaTabela } from '@/src/shared/ui/table/table'
import type { FonteLookup, MotivoIndisponivel } from '@/src/shared/ui/lookup/tipos'
import { ABREVIACAO_UNIDADE, ROTULO_CATEGORIA_ITEM, ROTULO_UNIDADE_MEDIDA } from '../../domain/item'
import { formatarQuantidade } from '../../domain/quantidade'
import {
    listarItensLookupAction,
    listarKitsLookupAction,
    sugerirItensAction,
    sugerirKitsAction
} from '../actions/lookups'
import type { ItemComSaldo, KitLookup } from '../queries/estoque'

/**
 * Fontes de Lookup do módulo Estoque (021-componente-lookup).
 *
 * O componente `Lookup` é genérico; quem sabe de onde ler, o que é a descrição
 * de um item e quais colunas mostrar é o módulo dono dos dados (Princípio I).
 * As regras de "não selecionável" ficam ao lado, mas são escolhidas por cada
 * formulário — a mesma fonte serve à saída, que bloqueia item sem saldo, e à
 * composição de kit, que não bloqueia.
 */

function saldoFormatado(i: ItemComSaldo): string {
    return `${formatarQuantidade(i.saldo)} ${ABREVIACAO_UNIDADE[i.unidadeMedida]}`
}

const COLUNAS_ITENS: ColunaTabela<ItemComSaldo>[] = [
    { accessorKey: 'nome', header: 'Item' },
    { id: 'categoria', header: 'Categoria', cell: ({ row }) => ROTULO_CATEGORIA_ITEM[row.original.categoria] },
    { id: 'unidade', header: 'Unidade', cell: ({ row }) => ROTULO_UNIDADE_MEDIDA[row.original.unidadeMedida] },
    { id: 'saldo', header: 'Saldo', cell: ({ row }) => saldoFormatado(row.original) }
]

export const fonteItens: FonteLookup<ItemComSaldo> = {
    chave: 'estoque-itens',
    sugerir: sugerirItensAction,
    listar: listarItensLookupAction,
    idDe: (i) => i.id,
    descricaoDe: (i) => i.nome,
    detalheDe: (i) => `${ROTULO_CATEGORIA_ITEM[i.categoria]} · ${saldoFormatado(i)} em estoque`,
    colunas: COLUNAS_ITENS,
    tituloPesquisa: 'Pesquisar item'
}

/** Saída e descarte não aceitam item sem saldo — como os selects que o Lookup substitui. */
export const semSaldo: MotivoIndisponivel<ItemComSaldo> = (i) => (i.saldo <= 0 ? 'Sem saldo' : null)

const COLUNAS_KITS: ColunaTabela<KitLookup>[] = [
    { accessorKey: 'nome', header: 'Kit' },
    { id: 'componentes', header: 'Componentes', cell: ({ row }) => String(row.original.totalComponentes) }
]

export const fonteKits: FonteLookup<KitLookup> = {
    chave: 'estoque-kits',
    sugerir: sugerirKitsAction,
    listar: listarKitsLookupAction,
    idDe: (k) => k.id,
    descricaoDe: (k) => k.nome,
    detalheDe: (k) => (k.totalComponentes === 1 ? '1 componente' : `${k.totalComponentes} componentes`),
    colunas: COLUNAS_KITS,
    tituloPesquisa: 'Pesquisar kit'
}

/** Saída por kit exige receita (BR-EST-02): kit sem componentes não tem o que deduzir. */
export const semReceita: MotivoIndisponivel<KitLookup> = (k) => (k.totalComponentes === 0 ? 'Sem receita' : null)
