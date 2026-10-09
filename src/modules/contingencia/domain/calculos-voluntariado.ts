/**
 * Regras de R-10 Triagem, R-12 Ocupação de turnos e R-13 Participação
 * (specs/023-central-relatorios, US3, research D11).
 */

/** Confirmados sobre vagas, em % inteiro. Turno sem vagas é 0 — nunca divisão por zero. */
export function ocupacaoPercentual(confirmados: number, vagas: number): number {
    if (vagas <= 0) return 0
    return Math.round((confirmados / vagas) * 100)
}

/**
 * Horas com uma casa decimal. São horas **escaladas** — a soma da duração dos
 * turnos confirmados —, não horas trabalhadas: o sistema não registra presença.
 */
export function horasDeSegundos(segundos: number): number {
    return Math.round((segundos / 3600) * 10) / 10
}

const UM_DIA_MS = 86_400_000

/** Dias corridos completos entre dois instantes. */
export function diasEntre(inicio: Date, fim: Date): number {
    return Math.floor((fim.getTime() - inicio.getTime()) / UM_DIA_MS)
}

export type StatusCandidatura = 'pendente' | 'aprovado' | 'rejeitado'

export type CandidaturaParaResumo = {
    status: StatusCandidatura
    /** `criado_em` da linha: o reenvio reaproveita a linha e não o altera. */
    primeiroEnvio: Date
    decididoEm: Date | null
}

export type ResumoTriagem = {
    pendentes: number
    aprovadas: number
    rejeitadas: number
    /** Média em dias, uma casa; `null` quando nada foi decidido — "0 dia" mentiria. */
    tempoMedioDias: number | null
}

/**
 * Tempo até decisão = decisão − primeiro envio. Um reenvio depois de rejeição
 * zera a decisão anterior (BR-VOL-01), então a candidatura reenviada volta a
 * contar como pendente; o histórico de idas e vindas está na trilha de
 * auditoria.
 */
export function resumoTriagem(candidaturas: readonly CandidaturaParaResumo[]): ResumoTriagem {
    let pendentes = 0
    let aprovadas = 0
    let rejeitadas = 0
    let somaMs = 0
    let decididas = 0

    for (const c of candidaturas) {
        if (c.status === 'pendente') pendentes++
        else if (c.status === 'aprovado') aprovadas++
        else rejeitadas++

        if (c.status !== 'pendente' && c.decididoEm) {
            somaMs += c.decididoEm.getTime() - c.primeiroEnvio.getTime()
            decididas++
        }
    }

    const tempoMedioDias = decididas > 0 ? Math.round((somaMs / decididas / UM_DIA_MS) * 10) / 10 : null
    return { pendentes, aprovadas, rejeitadas, tempoMedioDias }
}
