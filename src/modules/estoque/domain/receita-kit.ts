import { DomainError, ValidacaoError, falha, ok, type Result } from '@/src/shared/kernel'
import { validarEstoqueMinimo } from './estoque-minimo'
import type { CategoriaItem, UnidadeMedida } from './item'
import { arredondar, ehQuantidadePositiva } from './quantidade'

/**
 * Expansão de receita de kit (BR-EST-04, DESIGN.md §9.3).
 *
 * Função pura, isolada do banco de propósito: é a peça mais fácil de errar em
 * uma saída de kit e a mais barata de testar (TEST-03 — múltiplos kits na mesma
 * saída consolidando o mesmo item).
 */
export type ComponenteReceita = {
    itemId: string
    /** Quantidade do item por **uma** unidade de kit. */
    quantidadePorKit: number
}

export type KitSolicitado = {
    kitId: string
    quantidade: number
    componentes: ComponenteReceita[]
}

export type ItemConsolidado = {
    itemId: string
    quantidade: number
}

/**
 * Expande cada kit (`receita × quantidade de kits`) e **consolida por item**:
 * dois kits diferentes que usam arroz viram uma única necessidade de arroz.
 *
 * Sem a consolidação, a validação de saldo seria feita duas vezes contra o mesmo
 * estoque e deixaria passar uma saída que o estoque não cobre.
 */
export function expandirKits(kits: KitSolicitado[]): ItemConsolidado[] {
    const porItem = new Map<string, number>()

    for (const kit of kits) {
        for (const componente of kit.componentes) {
            const necessario = componente.quantidadePorKit * kit.quantidade
            porItem.set(componente.itemId, (porItem.get(componente.itemId) ?? 0) + necessario)
        }
    }

    return [...porItem.entries()].map(([itemId, quantidade]) => ({
        itemId,
        quantidade: arredondar(quantidade)
    }))
}

/** Consolida itens avulsos repetidos no mesmo formulário de saída. */
export function consolidarAvulsos(itens: ItemConsolidado[]): ItemConsolidado[] {
    const porItem = new Map<string, number>()
    for (const item of itens) {
        porItem.set(item.itemId, (porItem.get(item.itemId) ?? 0) + item.quantidade)
    }
    return [...porItem.entries()].map(([itemId, quantidade]) => ({ itemId, quantidade: arredondar(quantidade) }))
}

/**
 * Quantos kits completos o saldo permite montar (BR-INT-02): o mínimo, entre os
 * componentes, de `floor(saldo / quantidade por kit)`.
 *
 * Kit sem receita devolve `0` — e não "infinitos": um kit sem componentes não é
 * montável, é um cadastro incompleto.
 */
export function kitsPossiveis(componentes: ComponenteReceita[], saldoPorItem: Map<string, number>): number {
    if (componentes.length === 0) return 0

    let minimo = Infinity
    for (const componente of componentes) {
        if (componente.quantidadePorKit <= 0) continue
        const saldo = saldoPorItem.get(componente.itemId) ?? 0
        minimo = Math.min(minimo, Math.floor(saldo / componente.quantidadePorKit))
    }

    return Number.isFinite(minimo) ? Math.max(0, minimo) : 0
}

// -- Composição com item novo (feature 022) -----------------------------------

/** Item a cadastrar junto com o kit — os mesmos dados do item novo da Entrada. */
export type NovoItem = {
    nome: string
    categoria: CategoriaItem
    unidadeMedida: UnidadeMedida
    /** `null` herda o padrão global (feature 020). */
    estoqueMinimo: number | null
}

/** Componente como o formulário do kit o informa: item escolhido ou item a criar. */
export type ComponenteInformado =
    | { tipo: 'existente'; itemId: string; quantidadePorKit: number }
    | { tipo: 'novo'; novoItem: NovoItem; quantidadePorKit: number }

/**
 * Forma de comparar nomes de item "sem diferença de maiúsculas, acentos e
 * espaços nas pontas" (FR-009, FR-010). É o espelho em TS do
 * `lower(f_unaccent(nome))` que o repositório usa ao vincular um nome novo a um
 * item existente — as duas pontas precisam concordar, senão o formulário
 * aceitaria uma receita que o servidor recusa (ou o contrário).
 */
export function normalizarNomeItem(nome: string): string {
    return nome
        .trim()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLocaleLowerCase('pt-BR')
}

/**
 * Regras da receita do kit (data-model V1–V5). As chaves de erro são os
 * caminhos do formulário (`componentes.N.campo`): é o que faz a recusa do
 * servidor cair na linha certa, sem tabela de tradução no meio.
 *
 * A duplicidade compara o id do item escolhido **ou** o nome normalizado do
 * item novo: duas linhas "Feijão" e "feijao" seriam dois itens criados com o
 * mesmo nome e duas verdades sobre quanto o kit consome.
 */
export function validarReceita(componentes: ComponenteInformado[]): Result<ComponenteInformado[], DomainError> {
    const campos: Record<string, string> = {}

    if (componentes.length === 0) {
        campos.componentes = 'O kit precisa de ao menos um componente.'
    }

    const normalizados = componentes.map((componente): ComponenteInformado =>
        componente.tipo === 'novo'
            ? { ...componente, novoItem: { ...componente.novoItem, nome: componente.novoItem.nome.trim() } }
            : componente
    )

    const vistos = new Set<string>()
    normalizados.forEach((componente, indice) => {
        const prefixo = `componentes.${indice}`

        if (!ehQuantidadePositiva(componente.quantidadePorKit)) {
            campos[`${prefixo}.quantidade`] = 'Informe a quantidade por kit.'
        }

        let chave: string
        if (componente.tipo === 'novo') {
            if (!componente.novoItem.nome) {
                campos[`${prefixo}.itemId`] = 'Selecione ou digite o item.'
                return
            }
            const erroMinimo = validarEstoqueMinimo(componente.novoItem.estoqueMinimo)
            if (erroMinimo) campos[`${prefixo}.estoqueMinimo`] = erroMinimo
            chave = `novo:${normalizarNomeItem(componente.novoItem.nome)}`
        } else {
            chave = componente.itemId
        }

        if (vistos.has(chave)) campos[`${prefixo}.itemId`] = 'Este item já está na receita.'
        vistos.add(chave)
    })

    if (Object.keys(campos).length > 0) {
        return falha(new ValidacaoError('Revise os campos destacados.', { campos }))
    }
    return ok(normalizados)
}
