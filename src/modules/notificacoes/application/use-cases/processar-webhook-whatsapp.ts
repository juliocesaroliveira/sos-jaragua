import {
    TEXTO_RESPOSTA_AUTOMATICA,
    classificarErroMeta,
    ehPedidoDeDescadastro,
    proximaSituacao,
    situacaoDoWebhook,
    textoConfirmacaoDescadastro
} from '../../domain/whatsapp'
import type { SituacoesEnvioWhatsapp } from '../ports/envios-whatsapp'

/**
 * Evento do webhook já autenticado (assinatura) e parseado pela camada de
 * apresentação (024, contracts/webhook-whatsapp.md).
 */
export type EntradaWebhookWhatsapp = {
    situacoes: { idExterno: string; status: string; codigoErro: number | null; erro: string | null }[]
    /** `texto` é `null` para mensagens que não são texto (áudio, imagem, figurinha). */
    mensagens: { waId: string; texto: string | null }[]
}

export type DependenciasWebhook = {
    situacoes: SituacoesEnvioWhatsapp
    /** userIds cujo telefone casa com o `wa_id` (com e sem o 9º dígito). */
    usuariosPorWaId: (waId: string) => Promise<string[]>
    /** Revoga o opt-in com origem `resposta_whatsapp`. */
    revogar: (userId: string) => Promise<void>
    /** Texto livre como resposta — dentro da janela de 24h aberta pela mensagem recebida. */
    enviarTexto: (waId: string, texto: string) => Promise<void>
    /** Limitador de uma resposta automática por número a cada 24h. */
    podeResponderAutomaticamente: (waId: string) => Promise<boolean>
    /** Base dos links nas mensagens (BETTER_AUTH_URL). */
    urlBase: string
}

/**
 * Processa o que a Meta envia ao webhook (024, US3/US4).
 *
 * Idempotente por construção: a Meta reenvia quando não recebe 2xx, e o mesmo
 * evento pode chegar mais de uma vez. A situação só avança (`proximaSituacao`),
 * revogar quem já está revogado não gera histórico, e a resposta automática é
 * limitada por número.
 *
 * Nunca toca `notificacao.lida`: ler no WhatsApp não é ler no sistema (FR-027).
 */
export class ProcessarWebhookWhatsappUseCase {
    constructor(private readonly deps: DependenciasWebhook) {}

    async executar({ situacoes, mensagens }: EntradaWebhookWhatsapp): Promise<void> {
        // Em ordem: dois eventos do mesmo envio no mesmo POST precisam ver o
        // efeito um do outro.
        for (const s of situacoes) await this.aplicarSituacao(s)
        for (const m of mensagens) await this.responder(m)
    }

    private async aplicarSituacao(s: EntradaWebhookWhatsapp['situacoes'][number]): Promise<void> {
        const recebida = situacaoDoWebhook(s.status)
        if (!recebida) return

        const atual = await this.deps.situacoes.situacaoPorIdExterno(s.idExterno)
        if (!atual) return

        const para = proximaSituacao(atual, recebida)
        if (!para) return

        if (para === 'falhou') {
            const erro =
                s.codigoErro == null ? (s.erro ?? 'falha informada pela Meta') : `${s.codigoErro}: ${s.erro ?? ''}`
            await this.deps.situacoes.atualizarSituacao(s.idExterno, atual, para, {
                motivo: classificarErroMeta(s.codigoErro),
                erro: erro.trim()
            })
            return
        }

        await this.deps.situacoes.atualizarSituacao(s.idExterno, atual, para)
    }

    private async responder(m: EntradaWebhookWhatsapp['mensagens'][number]): Promise<void> {
        if (m.texto !== null && ehPedidoDeDescadastro(m.texto)) {
            const usuarios = await this.deps.usuariosPorWaId(m.waId)
            if (usuarios.length > 0) {
                // Todos os usuários do número: quem pediu para parar não pode
                // continuar recebendo por causa de uma segunda conta.
                for (const userId of usuarios) await this.deps.revogar(userId)
                await this.deps.enviarTexto(m.waId, textoConfirmacaoDescadastro(this.deps.urlBase))
                return
            }
        }

        if (await this.deps.podeResponderAutomaticamente(m.waId)) {
            await this.deps.enviarTexto(m.waId, TEXTO_RESPOSTA_AUTOMATICA)
        }
    }
}
