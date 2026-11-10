import type { OrigemConsentimento } from '../../domain/whatsapp'

export type PreferenciaWhatsapp = {
    ativo: boolean
    /** Momento da última concessão — exibido como "Ativo desde". `null` quando desligado. */
    ativoDesde: Date | null
}

/**
 * Estado atual do opt-in e seu histórico (024, data-model.md §3–§4).
 */
export interface PreferenciasWhatsapp {
    /** `null` quando o usuário nunca escolheu — equivale a desligado (FR-013). */
    lerPreferencia(userId: string): Promise<PreferenciaWhatsapp | null>
    /**
     * Grava o estado atual **e** um evento no histórico, na mesma transação.
     * Só deve ser chamado quando o estado muda.
     */
    salvarPreferencia(
        userId: string,
        ativo: boolean,
        origem: OrigemConsentimento,
        telefone: string | null
    ): Promise<void>
}
