import type { MotivoNaoEntrega, SituacaoEnvio } from '../../domain/whatsapp'

/**
 * Tentativa de envio pelo WhatsApp a registrar em `notificacao_envio` (024,
 * data-model.md §2). Elegíveis nascem `pendente` com o destino; os demais
 * nascem `nao_enviado` com o motivo, para aparecerem no relatório (US3).
 */
export type TentativaWhatsapp =
    | { notificacaoId: string; status: 'pendente'; destino: string }
    | { notificacaoId: string; status: 'nao_enviado'; motivo: MotivoNaoEntrega }

export type TentativaRegistrada = {
    id: string
    notificacaoId: string
    status: 'pendente' | 'nao_enviado'
    destino: string | null
}

/** Persistência dos envios do canal WhatsApp. */
export interface EnviosWhatsapp {
    /** userId → opt-in. Quem não tem linha em `preferencia_whatsapp` fica de fora (= desligado). */
    lerPreferencias(userIds: string[]): Promise<Map<string, boolean>>
    /**
     * Insere as tentativas ignorando as que já existem para a mesma notificação
     * no canal, e devolve **só** as inseridas — é o que impede envio duplo
     * quando o mesmo lote é processado de novo (FR-008).
     */
    registrarTentativas(tentativas: TentativaWhatsapp[]): Promise<TentativaRegistrada[]>
    /** Só altera envio ainda `pendente`. */
    marcarEnviado(id: string, idExterno: string): Promise<void>
    /** Só altera envio ainda `pendente`. */
    marcarFalha(id: string, motivo: MotivoNaoEntrega, erro: string): Promise<void>
}

/** Atualização de situação vinda do webhook da Meta (024, US3). */
export interface SituacoesEnvioWhatsapp {
    /** `null` quando o `wamid` não é de nenhum envio conhecido. */
    situacaoPorIdExterno(idExterno: string): Promise<SituacaoEnvio | null>
    /**
     * Grava a nova situação **só se a atual ainda for `de`** — dois webhooks
     * concorrentes do mesmo envio não sobrescrevem um ao outro.
     */
    atualizarSituacao(
        idExterno: string,
        de: SituacaoEnvio,
        para: SituacaoEnvio,
        extras?: { motivo?: MotivoNaoEntrega; erro?: string }
    ): Promise<void>
}
