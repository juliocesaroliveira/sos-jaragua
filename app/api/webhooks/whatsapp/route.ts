import { processarWebhookWhatsapp } from '@/src/modules/notificacoes/infrastructure/webhook-whatsapp'
import { criarWebhookWhatsapp } from '@/src/modules/notificacoes/presentation/http/webhook-whatsapp'

/**
 * Webhook do WhatsApp (024-notificacoes-whatsapp, contracts/webhook-whatsapp.md).
 *
 * Ponto de entrada apenas — a autenticação por assinatura e o parse vivem em
 * `src/modules/notificacoes/presentation/http/`, onde o `vitest` enxerga o
 * teste de contrato. Rota pública: isenta do `proxy.ts` (DESIGN.md §6.2).
 */
const webhook = criarWebhookWhatsapp(processarWebhookWhatsapp)

export function GET(request: Request): Response {
    return webhook.verificar(request)
}

export function POST(request: Request): Promise<Response> {
    return webhook.receber(request)
}
