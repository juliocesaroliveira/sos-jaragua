import { somarDias } from './periodo'

/**
 * Regras de R-05 Estoque crítico e R-06 Validades (specs/023-central-relatorios,
 * US2, research D11).
 *
 * Quem decide **se** um item é crítico é `estoque/domain/estoque-minimo.ts`
 * (`itensCriticos`), a mesma regra do alerta. Aqui fica só o que o relatório
 * acrescenta: a ordem de urgência e a leitura das validades.
 */

/**
 * Quanto falta para o mínimo, como fração do mínimo: 0 (no mínimo) a 1 (zerado).
 * Proporcional, e não absoluto, porque "faltam 10" é urgente para um item de
 * mínimo 12 e irrelevante para um de mínimo 5.000.
 */
export function faltaProporcional(saldo: number, limiar: number): number {
    if (limiar <= 0) return 0
    return Math.max(0, (limiar - saldo) / limiar)
}

/** Do mais crítico ao menos crítico; empate pelo nome, para a ordem ser estável. */
export function ordenarCriticos<T extends { nome: string; saldo: number; limiar: number }>(itens: readonly T[]): T[] {
    return [...itens].sort(
        (a, b) =>
            faltaProporcional(b.saldo, b.limiar) - faltaProporcional(a.saldo, a.limiar) ||
            a.nome.localeCompare(b.nome, 'pt-BR')
    )
}

export const HORIZONTE_PADRAO = 30
export const HORIZONTE_MINIMO = 1
export const HORIZONTE_MAXIMO = 365

export function ehHorizonteValido(dias: number): boolean {
    return Number.isInteger(dias) && dias >= HORIZONTE_MINIMO && dias <= HORIZONTE_MAXIMO
}

export type SituacaoValidade = 'vencida' | 'a_vencer'

/**
 * Datas civis (`AAAA-MM-DD`) comparadas como texto — o formato ISO ordena
 * igual ao calendário, e não há fuso a errar. Vencer hoje ainda é "a vencer":
 * a doação pode ser distribuída hoje.
 */
export function situacaoValidade(validade: string, hoje: string, horizonte: number): SituacaoValidade | null {
    if (validade < hoje) return 'vencida'
    if (validade <= somarDias(hoje, horizonte)) return 'a_vencer'
    return null
}

/** Data limite de validade incluída no relatório: hoje + horizonte. */
export function limiteDeValidade(hoje: string, horizonte: number): string {
    return somarDias(hoje, horizonte)
}

const UM_DIA_MS = 86_400_000

/** Dias de `hoje` até `validade`; negativo para vencidas. */
export function diasAteVencer(validade: string, hoje: string): number {
    return Math.round((Date.parse(`${validade}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / UM_DIA_MS)
}
