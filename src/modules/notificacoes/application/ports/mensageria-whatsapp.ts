import type { NomeModelo } from '../../domain/whatsapp'

export type ResultadoEnvioWhatsapp =
    { ok: true; idExterno: string } | { ok: false; codigo: number | null; erro: string }

/**
 * Envio pela WhatsApp Cloud API (024, research D1). O adapter concreto
 * (`infrastructure/whatsapp-cloud-api.ts`) fala HTTP com a Meta; os testes usam
 * uma implementação em memória.
 */
export interface MensageriaWhatsapp {
    /** Sem credenciais o canal fica "não configurado" e nada é enviado (FR-018). */
    configurado(): boolean
    /** Mensagem iniciada pelo sistema: só por modelo aprovado. */
    enviarModelo(
        destino: string,
        modelo: NomeModelo,
        parametros: { titulo: string; mensagem: string }
    ): Promise<ResultadoEnvioWhatsapp>
    /** Texto livre — só como resposta a uma mensagem recebida (janela de 24h). */
    enviarTexto(destino: string, texto: string): Promise<ResultadoEnvioWhatsapp>
}
