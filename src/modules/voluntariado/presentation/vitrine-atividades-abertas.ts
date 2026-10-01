import { estadoDoTurno, validarDesistencia, type EstadoTurno } from '../domain/inscricao'
import type { AtividadeAberta, MeuTurnoConfirmado, TurnoAberto } from './queries/atividades'

/**
 * Monta a vitrine de "Atividades abertas" a partir da leitura cacheada
 * (igual para todos) e dos turnos do usuário logado (018, research D8).
 *
 * Pura e sem `server-only`: o estado e o prazo de desistência são calculados
 * no servidor com o `agora` da requisição, e o cliente só recebe o resultado.
 */

export type TurnoNaVitrine = TurnoAberto & {
    estado: EstadoTurno
    /** Alocação do próprio usuário neste turno, quando inscrito. */
    alocacaoId: string | null
    /** Inscrito e ainda fora do prazo de 30 minutos (FR-017). */
    podeDesistir: boolean
}

export type AtividadeNaVitrine = Omit<AtividadeAberta, 'turnos'> & { turnos: TurnoNaVitrine[] }

export function montarVitrine(
    atividades: AtividadeAberta[],
    meusTurnos: MeuTurnoConfirmado[],
    agora: Date
): AtividadeNaVitrine[] {
    const minhaAlocacao = new Map(meusTurnos.map((t) => [t.turnoId, t.alocacaoId]))

    return (
        atividades
            .map((a) => ({
                ...a,
                turnos: a.turnos
                    // A leitura é cacheada: um turno pode ter terminado depois
                    // que o cache foi preenchido.
                    .filter((t) => new Date(t.fim).getTime() > agora.getTime())
                    .sort((x, y) => x.inicio.localeCompare(y.inicio))
                    .map((t): TurnoNaVitrine => {
                        const alocacaoId = minhaAlocacao.get(t.id) ?? null
                        const inicio = new Date(t.inicio)
                        return {
                            ...t,
                            alocacaoId,
                            estado: estadoDoTurno({
                                vagas: t.vagas,
                                preenchidas: t.preenchidas,
                                inicio,
                                fim: new Date(t.fim),
                                inscrito: alocacaoId !== null,
                                agora
                            }),
                            podeDesistir: alocacaoId !== null && validarDesistencia({ inicio, agora }).ok
                        }
                    })
            }))
            .filter((a) => a.turnos.length > 0)
            // FR-007 — o turno mais próximo primeiro.
            .sort((x, y) => x.turnos[0].inicio.localeCompare(y.turnos[0].inicio))
    )
}
