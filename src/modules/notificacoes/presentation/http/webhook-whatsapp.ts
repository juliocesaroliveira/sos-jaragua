import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from '@/src/shared/validacao/zod-ptbr'
import type { EntradaWebhookWhatsapp } from '../../application/use-cases/processar-webhook-whatsapp'

/**
 * Webhook do WhatsApp (024, contracts/webhook-whatsapp.md, research D13).
 *
 * Rota **pública** por desenho: a Meta não tem sessão, e por isso
 * `api/webhooks` fica fora do matcher do `proxy.ts`. A autenticação é a
 * assinatura `X-Hub-Signature-256` — HMAC-SHA256 do corpo **bruto** com o app
 * secret. Sem o segredo configurado, a rota recusa tudo (mesmo padrão do
 * `CRON_SECRET`): uma rota que revoga consentimento não pode ficar aberta por
 * esquecimento de configuração.
 *
 * Fábrica com o processamento injetado: o contrato (assinatura, handshake,
 * parse) é testado sem banco, e a rota monta a versão real.
 */
export function criarWebhookWhatsapp(processar: (entrada: EntradaWebhookWhatsapp) => Promise<void>) {
    return {
        /** Handshake `GET` feito pela Meta ao cadastrar o webhook. */
        verificar(request: Request): Response {
            const params = new URL(request.url).searchParams
            const esperado = process.env.WHATSAPP_VERIFY_TOKEN
            const desafio = params.get('hub.challenge')

            if (!esperado || params.get('hub.mode') !== 'subscribe' || params.get('hub.verify_token') !== esperado) {
                return new Response(null, { status: 403 })
            }
            return new Response(desafio ?? '', { status: 200, headers: { 'content-type': 'text/plain' } })
        },

        async receber(request: Request): Promise<Response> {
            // O corpo bruto é lido **antes** de qualquer parse: a assinatura é
            // sobre os bytes exatos que a Meta enviou.
            const corpo = await request.text()
            if (!assinaturaValida(corpo, request.headers.get('x-hub-signature-256'))) {
                return new Response(null, { status: 401 })
            }

            const entrada = extrairEventos(corpo)
            // Assinado mas irreconhecível: 200, senão a Meta reenviaria para sempre.
            if (!entrada || (entrada.situacoes.length === 0 && entrada.mensagens.length === 0)) {
                return new Response(null, { status: 200 })
            }

            try {
                await processar(entrada)
                return new Response(null, { status: 200 })
            } catch (erro) {
                // 500 faz a Meta reenviar; reenviar é seguro porque o
                // processamento é idempotente.
                console.error('[notificacoes] whatsapp: falha ao processar webhook', { erro })
                return new Response(null, { status: 500 })
            }
        }
    }
}

function assinaturaValida(corpo: string, cabecalho: string | null): boolean {
    const segredo = process.env.WHATSAPP_APP_SECRET
    if (!segredo || !cabecalho?.startsWith('sha256=')) return false

    const esperada = Buffer.from(createHmac('sha256', segredo).update(corpo).digest('hex'))
    const recebida = Buffer.from(cabecalho.slice('sha256='.length))
    // Comparação em tempo constante — e `timingSafeEqual` exige o mesmo tamanho.
    return esperada.length === recebida.length && timingSafeEqual(esperada, recebida)
}

/** Só os campos usados; o resto do payload da Meta é descartado pelo Zod. */
const esquema = z.object({
    entry: z.array(
        z.object({
            changes: z.array(
                z.object({
                    field: z.string(),
                    value: z.object({
                        statuses: z
                            .array(
                                z.object({
                                    id: z.string(),
                                    status: z.string(),
                                    errors: z
                                        .array(z.object({ code: z.number().optional(), title: z.string().optional() }))
                                        .optional()
                                })
                            )
                            .optional(),
                        messages: z
                            .array(
                                z.object({
                                    from: z.string(),
                                    type: z.string(),
                                    text: z.object({ body: z.string() }).optional()
                                })
                            )
                            .optional()
                    })
                })
            )
        })
    )
})

function extrairEventos(corpo: string): EntradaWebhookWhatsapp | null {
    let json: unknown
    try {
        json = JSON.parse(corpo)
    } catch {
        return null
    }

    const parse = esquema.safeParse(json)
    if (!parse.success) return null

    const entrada: EntradaWebhookWhatsapp = { situacoes: [], mensagens: [] }
    for (const entry of parse.data.entry) {
        for (const change of entry.changes) {
            if (change.field !== 'messages') continue
            for (const s of change.value.statuses ?? []) {
                const erro = s.errors?.[0]
                entrada.situacoes.push({
                    idExterno: s.id,
                    status: s.status,
                    codigoErro: erro?.code ?? null,
                    erro: erro?.title ?? null
                })
            }
            for (const m of change.value.messages ?? []) {
                entrada.mensagens.push({ waId: m.from, texto: m.type === 'text' ? (m.text?.body ?? null) : null })
            }
        }
    }
    return entrada
}
