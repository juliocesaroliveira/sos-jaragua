import { ABREVIACAO_UNIDADE, formatarQuantidade, type UnidadeMedida } from '@/src/modules/estoque/domain'

/**
 * Texto do alerta `estoque_critico` (BRD §6: "O item [Nome] atingiu o estoque
 * mínimo de segurança").
 *
 * Função pura, sem banco e sem ambiente, para a regra do texto ter teste
 * unitário (Constituição, Princípio III). `avaliarEstoqueCritico` só compõe:
 * `itensCriticos` → esta função → `emitir`. Importa do domínio de estoque
 * apenas funções puras de formatação, sem tabela nem repositório.
 */
export type ItemCritico = {
    nome: string
    saldo: number
    /** Limiar efetivo do item: o mínimo próprio ou o padrão global. */
    limiar: number
    unidadeMedida: UnidadeMedida
}

export type AlertaEstoqueCritico = {
    titulo: string
    mensagem: string
    contexto: { itens: { nome: string; saldo: number; limiar: number }[] }
}

/** Mais que isso vira "e mais N itens": o sino mostra a mensagem inteira. */
const MAXIMO_DE_NOMES = 5

export function mensagemEstoqueCritico(criticos: ItemCritico[]): AlertaEstoqueCritico | null {
    if (criticos.length === 0) return null

    const nomes = criticos
        .slice(0, MAXIMO_DE_NOMES)
        .map((i) => `${i.nome} (mín. ${formatarQuantidade(i.limiar)} ${ABREVIACAO_UNIDADE[i.unidadeMedida]})`)
    const resto = criticos.length - nomes.length
    const lista = `${nomes.join(', ')}${resto > 0 ? ` e mais ${resto} ${resto === 1 ? 'item' : 'itens'}` : ''}`
    // Concordância: um único item "atingiu", vários "atingiram".
    const verbo = criticos.length === 1 ? 'atingiu' : 'atingiram'

    return {
        titulo: 'Estoque crítico',
        mensagem: `${lista} ${verbo} o estoque mínimo de segurança.`,
        // Todos os itens, não só os exibidos: o contexto é o registro completo.
        contexto: { itens: criticos.map(({ nome, saldo, limiar }) => ({ nome, saldo, limiar })) }
    }
}
