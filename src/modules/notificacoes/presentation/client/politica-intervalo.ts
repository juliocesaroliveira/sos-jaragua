/**
 * Política de intervalo do sino (012-notificacoes-tempo-real,
 * contracts/sino-cliente.md C-12, data-model.md R4).
 *
 * Função pura, separada do hook para poder ser testada sem montar um
 * `QueryClient`. É a única lógica de decisão da feature.
 */

/** Intervalo normal entre consultas, com a aba visível (SC-001). */
export const INTERVALO_MS = 30_000

/**
 * Teto do recuo progressivo. Cinco minutos é longo o bastante para não gastar
 * bateria de quem está sem sinal, e curto o bastante para que a volta da rede
 * seja percebida rápido — o `refetchOnReconnect` do TanStack ainda pega o caso
 * em que o navegador detecta a reconexão antes disso.
 */
export const INTERVALO_MAXIMO_MS = 5 * 60_000

export type EstadoDoCiclo = {
    /** Falhas seguidas desde a última consulta bem-sucedida. */
    falhasConsecutivas: number
    /** `true` depois de um 401 — a sessão acabou. */
    sessaoEncerrada: boolean
}

/**
 * Decide quando será a próxima consulta, ou `false` para não haver próxima.
 *
 * A distinção central: **`401` para, falha de rede espaça**. Tratar as duas
 * igual deixaria o usuário sem atualização depois de um túnel, ou uma aba
 * esquecida martelando para sempre um endpoint que já a rejeitou.
 */
export function proximoIntervalo({ falhasConsecutivas, sessaoEncerrada }: EstadoDoCiclo): number | false {
    // Precedência sobre tudo: sem sessão, nenhuma quantidade de espera torna a
    // próxima consulta útil.
    if (sessaoEncerrada) return false

    if (falhasConsecutivas <= 0) return INTERVALO_MS

    // Dobra a cada falha, com teto. `Math.min` antes da multiplicação não
    // serviria: o expoente cresce sem limite e estouraria para `Infinity`.
    const comRecuo = INTERVALO_MS * 2 ** falhasConsecutivas
    return Math.min(comRecuo, INTERVALO_MAXIMO_MS)
}
