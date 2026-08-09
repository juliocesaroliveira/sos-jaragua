import type { Notificacao, NotificacaoService } from '../application/ports/notificacao-service'
import { gravarNaPlataforma } from './notificacao-plataforma'

/** Tamanho do chunk no envio em lote (broadcast de urgência, DESIGN.md §12). */
const TAMANHO_CHUNK = 50

/**
 * Implementação do port de notificação.
 *
 * Contrato de falha (DESIGN.md §12/§13): notificar nunca derruba a operação de
 * negócio que a disparou. Uma falha aqui é registrada no log estruturado
 * (visível no Log Stream da Vercel) e a chamada retorna normalmente.
 */
export const notificacaoService: NotificacaoService = {
    async enviar(notificacao) {
        await this.enviarEmLote([notificacao])
    },

    async enviarEmLote(notificacoes) {
        for (let i = 0; i < notificacoes.length; i += TAMANHO_CHUNK) {
            const chunk = notificacoes.slice(i, i + TAMANHO_CHUNK)
            try {
                await gravarNaPlataforma(chunk)
            } catch (erro) {
                console.error('[notificacoes] falha ao gravar chunk in-plataforma', {
                    quantidade: chunk.length,
                    eventos: [...new Set(chunk.map((n: Notificacao) => n.evento))],
                    erro
                })
            }
        }
    }
}
