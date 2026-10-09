import { FUSO_RELATORIOS, formatarDataCivil } from '../domain/periodo'

/**
 * Formatação pt-BR comum às colunas dos relatórios.
 *
 * Datas e horas sempre em Brasília (FR-010): o servidor roda em UTC, e um
 * `toLocaleString()` sem fuso explícito mostraria 02:30 para quem registrou às
 * 23:30.
 */

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: FUSO_RELATORIOS
})

const DATA = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: FUSO_RELATORIOS })

/** Instante (`Date` ou ISO) → `dd/mm/aaaa, hh:mm` em Brasília. */
export function formatarDataHora(instante: Date | string): string
export function formatarDataHora(instante: Date | string | null | undefined): string | null
export function formatarDataHora(instante: Date | string | null | undefined): string | null {
    if (instante === null || instante === undefined) return null
    return DATA_HORA.format(typeof instante === 'string' ? new Date(instante) : instante)
}

/** Instante → `dd/mm/aaaa` em Brasília. */
export function formatarDataDoInstante(instante: Date | string | null | undefined): string | null {
    if (instante === null || instante === undefined) return null
    return DATA.format(typeof instante === 'string' ? new Date(instante) : instante)
}

/** Data civil (`AAAA-MM-DD`, coluna `date`) → `dd/mm/aaaa`, sem fuso. */
export function formatarData(data: string | null | undefined): string | null {
    if (!data) return null
    return formatarDataCivil(data.slice(0, 10))
}

export function simNao(valor: boolean | null | undefined): string | null {
    if (valor === null || valor === undefined) return null
    return valor ? 'Sim' : 'Não'
}

/** Arredonda para `casas` decimais — evita `0.30000000000000004` na planilha. */
export function arredondar(valor: number, casas = 3): number {
    const fator = 10 ** casas
    return Math.round(valor * fator) / fator
}

/** Rótulo de enum, com o próprio valor como fallback (nunca célula vazia por enum novo). */
export function rotulo<K extends string>(
    rotulos: Readonly<Record<K, string>>,
    valor: K | null | undefined
): string | null {
    if (valor === null || valor === undefined) return null
    return rotulos[valor] ?? valor
}

/** "Nome não encontrado" quando o id não resolve (conta removida, research D9). */
export const USUARIO_NAO_ENCONTRADO = 'usuário não encontrado'
