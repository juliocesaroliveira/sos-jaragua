/**
 * Período dos relatórios em horário de Brasília (specs/023-central-relatorios,
 * research D6).
 *
 * A pessoa escolhe **datas civis** (`AAAA-MM-DD`, inclusivas) — "de 01/10 a
 * 05/10". O banco guarda **instantes** (`timestamptz`) e o Mongo também. A
 * conversão entre os dois mora aqui, num lugar só e testável, porque errar o
 * fuso não dá erro nenhum: só move silenciosamente os registros das 21h às 24h
 * para o dia seguinte.
 *
 * O deslocamento do fuso vem do `Intl`, não de uma constante `-03:00`: se o
 * horário de verão voltar, o cálculo continua certo sem mudança de código.
 */

export const FUSO_RELATORIOS = 'America/Sao_Paulo'

/** Datas civis inclusivas, `AAAA-MM-DD`. */
export type Periodo = { de: string; ate: string }

/** Intervalo semiaberto em UTC: `inicio <= t < fimExclusivo`. */
export type IntervaloUtc = { inicio: Date; fimExclusivo: Date }

export const ATALHOS_PERIODO = ['hoje', '7dias', '30dias'] as const
export type AtalhoPeriodo = (typeof ATALHOS_PERIODO)[number]

export const ROTULO_ATALHO_PERIODO: Record<AtalhoPeriodo, string> = {
    hoje: 'Hoje',
    '7dias': '7 dias',
    '30dias': '30 dias'
}

/** Dias além de hoje em cada atalho — "7 dias" são hoje e os 6 anteriores. */
const DIAS_ATRAS: Record<AtalhoPeriodo, number> = { hoje: 0, '7dias': 6, '30dias': 29 }

export type ResultadoPeriodo = { ok: true; periodo: Periodo } | { ok: false; campo: 'de' | 'ate'; erro: string }

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** `sv-SE` formata como `AAAA-MM-DD`, que é exatamente a data civil ISO. */
const DATA_CIVIL_SP = new Intl.DateTimeFormat('sv-SE', { timeZone: FUSO_RELATORIOS })

const DESLOCAMENTO_SP = new Intl.DateTimeFormat('en-US', { timeZone: FUSO_RELATORIOS, timeZoneName: 'longOffset' })

export function hojeEmSaoPaulo(agora: Date = new Date()): string {
    return DATA_CIVIL_SP.format(agora)
}

/** Aritmética de calendário pura — em UTC para não depender do fuso da máquina. */
export function somarDias(data: string, dias: number): string {
    const [ano, mes, dia] = partes(data)
    return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10)
}

export function periodoDoAtalho(atalho: AtalhoPeriodo, agora: Date = new Date()): Periodo {
    const hoje = hojeEmSaoPaulo(agora)
    return { de: somarDias(hoje, -DIAS_ATRAS[atalho]), ate: hoje }
}

/** Padrão de todo relatório de histórico (FR-005): últimos 30 dias, incluindo hoje. */
export function periodoPadrao(agora: Date = new Date()): Periodo {
    return periodoDoAtalho('30dias', agora)
}

/**
 * Valida o período vindo da URL.
 *
 * Erro é erro, não correção silenciosa (caso de borda da spec): um início
 * depois do fim quase sempre é engano de digitação, e "consertar" para algum
 * período plausível entregaria um relatório que a pessoa não pediu. Data
 * ausente, por outro lado, é só "não filtrei" — vira o padrão.
 */
export function validarPeriodo(entrada: { de?: string; ate?: string }, agora: Date = new Date()): ResultadoPeriodo {
    const hoje = hojeEmSaoPaulo(agora)
    const deBruto = entrada.de?.trim() || undefined
    const ateBruto = entrada.ate?.trim() || undefined

    if (deBruto !== undefined && !ehDataValida(deBruto))
        return { ok: false, campo: 'de', erro: 'Informe uma data válida.' }
    if (ateBruto !== undefined && !ehDataValida(ateBruto)) {
        return { ok: false, campo: 'ate', erro: 'Informe uma data válida.' }
    }

    const ate = ateBruto ?? hoje
    const de = deBruto ?? somarDias(ate, -DIAS_ATRAS['30dias'])

    if (de > hoje) return { ok: false, campo: 'de', erro: 'A data inicial não pode ser futura.' }
    if (de > ate) return { ok: false, campo: 'de', erro: 'A data inicial deve ser anterior ou igual à final.' }

    return { ok: true, periodo: { de, ate } }
}

export function intervaloUtc(periodo: Periodo): IntervaloUtc {
    return { inicio: inicioDoDia(periodo.de), fimExclusivo: inicioDoDia(somarDias(periodo.ate, 1)) }
}

const DATA_BR = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' })

/** `AAAA-MM-DD` → `dd/mm/aaaa`, sem passar por fuso (é data civil). */
export function formatarDataCivil(data: string): string {
    const [ano, mes, dia] = partes(data)
    return DATA_BR.format(new Date(Date.UTC(ano, mes - 1, dia)))
}

export function formatarPeriodo(periodo: Periodo): string {
    if (periodo.de === periodo.ate) return formatarDataCivil(periodo.de)
    return `${formatarDataCivil(periodo.de)} a ${formatarDataCivil(periodo.ate)}`
}

export function ehDataValida(valor: string): boolean {
    const casou = DATA_ISO.exec(valor)
    if (!casou) return false
    const [ano, mes, dia] = [Number(casou[1]), Number(casou[2]), Number(casou[3])]
    const data = new Date(Date.UTC(ano, mes - 1, dia))
    // `Date.UTC` normaliza 30/02 para 02/03; a volta denuncia a data inexistente.
    return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
}

function partes(data: string): [number, number, number] {
    const [ano, mes, dia] = data.split('-').map(Number)
    return [ano, mes, dia]
}

/** Minutos a somar ao UTC para obter a hora de Brasília naquele instante (ex.: -180). */
function deslocamentoMinutos(instante: Date): number {
    const nome = DESLOCAMENTO_SP.formatToParts(instante).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
    const casou = /GMT([+-])(\d{2}):(\d{2})/.exec(nome)
    if (!casou) return 0
    const minutos = Number(casou[2]) * 60 + Number(casou[3])
    return casou[1] === '-' ? -minutos : minutos
}

/** Instante UTC da meia-noite de Brasília em `data`. */
function inicioDoDia(data: string): Date {
    const [ano, mes, dia] = partes(data)
    const meiaNoiteUtc = Date.UTC(ano, mes - 1, dia)
    const palpite = new Date(meiaNoiteUtc - deslocamentoMinutos(new Date(meiaNoiteUtc)) * 60_000)
    // Segunda passada: se o palpite caiu do outro lado de uma troca de horário,
    // o deslocamento certo é o do próprio palpite.
    return new Date(meiaNoiteUtc - deslocamentoMinutos(palpite) * 60_000)
}
