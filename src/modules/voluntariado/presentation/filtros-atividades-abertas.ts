import type { AtividadeNaVitrine } from './vitrine-atividades-abertas'

/**
 * Filtros da tela "Atividades abertas" (018, US5 / contrato U-01.19–21).
 *
 * Aplicados no cliente sobre a lista já carregada — o volume é limitado por
 * natureza e cada filtro precisa responder na hora em rede móvel ruim
 * (research D8, plan.md Complexity Tracking).
 */

export type FiltrosAtividadesAbertas = {
    categoriaId?: string
    /** Dia civil em Brasília, `YYYY-MM-DD`. */
    dia?: string
    somenteComVagas: boolean
}

const DIA_BRASILIA = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
})

/** `YYYY-MM-DD` do início do turno no fuso de Brasília — chave do filtro de dia. */
export function diaDoTurno(inicioIso: string): string {
    return DIA_BRASILIA.format(new Date(inicioIso))
}

/**
 * "Somente com vagas" esconde turnos lotados e em andamento, mas nunca o turno
 * em que a pessoa já está inscrita. Atividades que ficam sem turno somem.
 */
export function filtrarAtividadesAbertas(
    atividades: AtividadeNaVitrine[],
    { categoriaId, dia, somenteComVagas }: FiltrosAtividadesAbertas
): AtividadeNaVitrine[] {
    return atividades
        .filter((a) => !categoriaId || a.categoriaId === categoriaId)
        .map((a) => ({
            ...a,
            turnos: a.turnos.filter(
                (t) =>
                    (!dia || diaDoTurno(t.inicio) === dia) &&
                    (!somenteComVagas ||
                        t.estado === 'com_vagas' ||
                        t.estado === 'ultimas_vagas' ||
                        t.estado === 'inscrito')
            )
        }))
        .filter((a) => a.turnos.length > 0)
}
