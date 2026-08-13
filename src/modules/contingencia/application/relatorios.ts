import 'server-only'
import {
    ROTULO_CATEGORIA_ITEM,
    ROTULO_UNIDADE_MEDIDA,
    type CategoriaItem,
    type UnidadeMedida
} from '@/src/modules/estoque/domain/item'
import {
    inventarioParaExportacao,
    saidasParaExportacao,
    type ItemComSaldo,
    type LinhaSaidaPlana
} from '@/src/modules/estoque/presentation/queries/estoque'
import type { Aba, Coluna } from '../infrastructure/planilha'

/**
 * Relatórios exportáveis (BR-REL-01, DESIGN.md §14).
 *
 * O módulo de Contingência/Relatórios é um **orquestrador read-only**: não tem
 * entidades nem repositórios próprios, só lê Estoque/Voluntariado pelas queries
 * públicas (DESIGN.md §3).
 */
export const TIPOS_RELATORIO = ['inventario', 'saidas'] as const
export type TipoRelatorio = (typeof TIPOS_RELATORIO)[number]

export const FORMATOS = ['csv', 'xlsx'] as const
export type FormatoExportacao = (typeof FORMATOS)[number]

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo'
})

export const COLUNAS_INVENTARIO: Coluna<ItemComSaldo>[] = [
    { cabecalho: 'Item', valor: (i) => i.nome, largura: 34 },
    { cabecalho: 'Categoria', valor: (i) => ROTULO_CATEGORIA_ITEM[i.categoria as CategoriaItem], largura: 22 },
    { cabecalho: 'Unidade', valor: (i) => ROTULO_UNIDADE_MEDIDA[i.unidadeMedida as UnidadeMedida], largura: 12 },
    { cabecalho: 'Saldo atual', valor: (i) => i.saldo, largura: 14 }
]

export const COLUNAS_SAIDAS: Coluna<LinhaSaidaPlana>[] = [
    { cabecalho: 'Data', valor: (s) => DATA_HORA.format(new Date(s.criadoEm)), largura: 18 },
    { cabecalho: 'Tipo', valor: (s) => (s.tipo === 'kit' ? 'Kit' : 'Avulso'), largura: 10 },
    { cabecalho: 'Destino', valor: (s) => s.destino, largura: 30 },
    { cabecalho: 'Responsável pelo transporte', valor: (s) => s.responsavelTransporte, largura: 28 },
    { cabecalho: 'Item', valor: (s) => s.item, largura: 34 },
    { cabecalho: 'Categoria', valor: (s) => ROTULO_CATEGORIA_ITEM[s.categoria], largura: 22 },
    { cabecalho: 'Quantidade', valor: (s) => s.quantidade, largura: 14 },
    { cabecalho: 'Unidade', valor: (s) => ROTULO_UNIDADE_MEDIDA[s.unidadeMedida], largura: 12 }
]

export const ROTULO_TIPO_RELATORIO: Record<TipoRelatorio, string> = {
    inventario: 'Inventário atual',
    saidas: 'Histórico de saídas'
}

/** Monta a aba do relatório pedido, já com os dados carregados. */
export async function montarRelatorio(tipo: TipoRelatorio): Promise<Aba<never>> {
    if (tipo === 'inventario') {
        const linhas = await inventarioParaExportacao()
        return { nome: 'Inventário atual', colunas: COLUNAS_INVENTARIO, linhas } as unknown as Aba<never>
    }

    const linhas = await saidasParaExportacao()
    return { nome: 'Histórico de saídas', colunas: COLUNAS_SAIDAS, linhas } as unknown as Aba<never>
}

export function ehTipoRelatorio(valor: unknown): valor is TipoRelatorio {
    return typeof valor === 'string' && (TIPOS_RELATORIO as readonly string[]).includes(valor)
}

export function ehFormato(valor: unknown): valor is FormatoExportacao {
    return typeof valor === 'string' && (FORMATOS as readonly string[]).includes(valor)
}
