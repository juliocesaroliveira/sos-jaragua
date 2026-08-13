import { arredondar } from './quantidade'

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
