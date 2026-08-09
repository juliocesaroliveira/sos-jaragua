import { DomainError, ValidacaoError, falha, ok, type Result } from '@/src/shared/kernel'
import type { CategoriaItem, CondicaoItem, UnidadeMedida } from './item'
import { ehQuantidadePositiva } from './quantidade'

/**
 * Regras de domínio da Entrada de doações (BRD §4.1, DESIGN.md §9.1).
 */
export type DadosEntrada = {
    /** Item existente; quando ausente, `novoItem` descreve o item a criar. */
    itemId?: string | null
    novoItem?: { nome: string; categoria: CategoriaItem; unidadeMedida: UnidadeMedida } | null
    quantidade: number
    condicao: CondicaoItem
    perecivel: boolean
    /** `YYYY-MM-DD` */
    dataValidade?: string | null
    /** Destinação **apenas informativa** — não reserva saldo (DESIGN.md §9.1). */
    kitDestinoId?: string | null
}

/**
 * Valida uma entrada. A regra crítica é a validade de perecível: obrigatória e
 * **não retroativa** (BRD §4.1 — "bloquear inserção de data retroativa").
 *
 * `hoje` é injetável para o teste não depender do relógio.
 */
export function validarEntrada(dados: DadosEntrada, hoje: Date = new Date()): Result<DadosEntrada, DomainError> {
    const campos: Record<string, string> = {}

    if (!dados.itemId && !dados.novoItem?.nome?.trim()) {
        campos.item = 'Informe o item.'
    }

    if (!ehQuantidadePositiva(dados.quantidade)) {
        campos.quantidade = 'A quantidade deve ser maior que zero.'
    }

    if (dados.perecivel) {
        if (!dados.dataValidade) {
            campos.dataValidade = 'Item perecível exige data de validade.'
        } else if (validadeEstaVencida(dados.dataValidade, hoje)) {
            campos.dataValidade = 'A data de validade não pode ser retroativa.'
        }
    }

    if (Object.keys(campos).length > 0) {
        return falha(new ValidacaoError('Revise os campos destacados.', { campos }))
    }

    return ok({
        ...dados,
        // Item não perecível nunca guarda validade — evita dado órfão que
        // apareceria em relatório de vencimento.
        dataValidade: dados.perecivel ? dados.dataValidade : null
    })
}

/**
 * Compara apenas a **data** (não o instante): um item que vence hoje ainda é
 * válido hoje.
 */
export function validadeEstaVencida(dataValidade: string, hoje: Date = new Date()): boolean {
    const hojeISO = `${hoje.getFullYear()}-${dois(hoje.getMonth() + 1)}-${dois(hoje.getDate())}`
    return dataValidade.slice(0, 10) < hojeISO
}

function dois(n: number): string {
    return String(n).padStart(2, '0')
}
