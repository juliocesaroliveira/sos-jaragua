/**
 * Vocabulário fechado do módulo de Estoque (BRD §4.1). São listas do negócio,
 * não configuráveis — por isso enums de banco, e não tabelas lookup.
 */

export const CATEGORIAS_ITEM = [
    'agua',
    'alimentacao',
    'higiene',
    'limpeza',
    'acomodacao',
    'materiais_construcao',
    'vestuario',
    'outros'
] as const
export type CategoriaItem = (typeof CATEGORIAS_ITEM)[number]

export const UNIDADES_MEDIDA = ['unidade', 'kg', 'litro', 'fardo', 'caixa'] as const
export type UnidadeMedida = (typeof UNIDADES_MEDIDA)[number]

export const CONDICOES_ITEM = ['novo', 'usado_bom_estado', 'necessita_higienizacao'] as const
export type CondicaoItem = (typeof CONDICOES_ITEM)[number]

export const TIPOS_SAIDA = ['avulso', 'kit'] as const
export type TipoSaida = (typeof TIPOS_SAIDA)[number]

export const ROTULO_CATEGORIA_ITEM: Record<CategoriaItem, string> = {
    agua: 'Água',
    alimentacao: 'Alimentação',
    higiene: 'Higiene',
    limpeza: 'Limpeza',
    acomodacao: 'Acomodação',
    materiais_construcao: 'Materiais de construção',
    vestuario: 'Vestuário',
    outros: 'Outros'
}

export const ROTULO_UNIDADE_MEDIDA: Record<UnidadeMedida, string> = {
    unidade: 'Unidade',
    kg: 'Kg',
    litro: 'Litro',
    fardo: 'Fardo',
    caixa: 'Caixa'
}

/** Forma curta, usada junto do número ("12 kg", "3 fardos"). */
export const ABREVIACAO_UNIDADE: Record<UnidadeMedida, string> = {
    unidade: 'un',
    kg: 'kg',
    litro: 'L',
    fardo: 'fardo(s)',
    caixa: 'caixa(s)'
}

export const ROTULO_CONDICAO_ITEM: Record<CondicaoItem, string> = {
    novo: 'Novo',
    usado_bom_estado: 'Usado (bom estado)',
    necessita_higienizacao: 'Necessita higienização'
}
