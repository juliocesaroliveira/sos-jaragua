import type { OrigemConsentimento } from '../../domain/whatsapp'

/**
 * Registro de opt-in/opt-out do WhatsApp (024, research D11). Implementado por
 * Notificações e consumido pela candidatura do Voluntariado, que oferece a
 * caixa de opt-in no cadastro.
 */
export interface ConsentimentoWhatsappPort {
    registrar(userId: string, ativo: boolean, origem: OrigemConsentimento): Promise<void>
}
