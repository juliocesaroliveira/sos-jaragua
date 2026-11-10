import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EntradaWebhookWhatsapp } from '../../application/use-cases/processar-webhook-whatsapp'
import { criarWebhookWhatsapp } from './webhook-whatsapp'

/**
 * Contrato do webhook do WhatsApp (024, contracts/webhook-whatsapp.md).
 *
 * A rota é pública — a Meta não tem sessão. O que mais importa aqui é que
 * nenhum efeito aconteça sem assinatura válida (FR-016).
 */

const SEGREDO = 'segredo-do-app'
const processar = vi.fn<(e: EntradaWebhookWhatsapp) => Promise<void>>(async () => {})
const { verificar, receber } = criarWebhookWhatsapp(processar)

beforeEach(() => {
    vi.stubEnv('WHATSAPP_APP_SECRET', SEGREDO)
    vi.stubEnv('WHATSAPP_VERIFY_TOKEN', 'token-verificacao')
})

afterEach(() => {
    vi.unstubAllEnvs()
    processar.mockReset()
    processar.mockImplementation(async () => {})
})

function assinar(corpo: string, segredo = SEGREDO) {
    return `sha256=${createHmac('sha256', segredo).update(corpo).digest('hex')}`
}

function post(corpo: unknown, assinatura?: string | null) {
    const texto = typeof corpo === 'string' ? corpo : JSON.stringify(corpo)
    const headers = new Headers({ 'content-type': 'application/json' })
    const valor = assinatura === undefined ? assinar(texto) : assinatura
    if (valor !== null) headers.set('x-hub-signature-256', valor)
    return receber(new Request('http://localhost/api/webhooks/whatsapp', { method: 'POST', headers, body: texto }))
}

function evento(value: Record<string, unknown>) {
    return { object: 'whatsapp_business_account', entry: [{ id: 'waba', changes: [{ field: 'messages', value }] }] }
}

describe('GET — verificação do endpoint', () => {
    const get = (query: string) => verificar(new Request(`http://localhost/api/webhooks/whatsapp?${query}`))

    it('token certo devolve o challenge em texto puro', async () => {
        const r = get('hub.mode=subscribe&hub.verify_token=token-verificacao&hub.challenge=12345')
        expect(r.status).toBe(200)
        expect(await r.text()).toBe('12345')
    })

    it('token errado → 403', () => {
        expect(get('hub.mode=subscribe&hub.verify_token=outro&hub.challenge=1').status).toBe(403)
    })

    it('sem WHATSAPP_VERIFY_TOKEN configurado → 403', () => {
        vi.stubEnv('WHATSAPP_VERIFY_TOKEN', '')
        expect(get('hub.mode=subscribe&hub.verify_token=&hub.challenge=1').status).toBe(403)
    })
})

describe('POST — autenticação', () => {
    it('sem assinatura → 401 e nada é processado', async () => {
        const r = await post(evento({ statuses: [] }), null)
        expect(r.status).toBe(401)
        expect(processar).not.toHaveBeenCalled()
    })

    it('assinatura de outro corpo → 401', async () => {
        const r = await post(evento({ statuses: [] }), assinar('outro corpo'))
        expect(r.status).toBe(401)
        expect(processar).not.toHaveBeenCalled()
    })

    it('assinatura com outro segredo → 401', async () => {
        const corpo = JSON.stringify(evento({ statuses: [] }))
        const r = await post(corpo, assinar(corpo, 'segredo-falso'))
        expect(r.status).toBe(401)
    })

    it('sem WHATSAPP_APP_SECRET configurado, recusa tudo', async () => {
        vi.stubEnv('WHATSAPP_APP_SECRET', '')
        const r = await post(evento({ statuses: [] }))
        expect(r.status).toBe(401)
        expect(processar).not.toHaveBeenCalled()
    })
})

describe('POST — eventos assinados', () => {
    it('statuses viram situações, com o código de erro da Meta', async () => {
        const r = await post(
            evento({
                statuses: [
                    { id: 'wamid.1', status: 'delivered', timestamp: '1', recipient_id: '5547999998888' },
                    {
                        id: 'wamid.2',
                        status: 'failed',
                        errors: [{ code: 131026, title: 'Message undeliverable' }]
                    }
                ]
            })
        )

        expect(r.status).toBe(200)
        expect(processar).toHaveBeenCalledWith({
            situacoes: [
                { idExterno: 'wamid.1', status: 'delivered', codigoErro: null, erro: null },
                { idExterno: 'wamid.2', status: 'failed', codigoErro: 131026, erro: 'Message undeliverable' }
            ],
            mensagens: []
        })
    })

    it('mensagens de texto e de outros tipos', async () => {
        await post(
            evento({
                messages: [
                    { from: '554799998888', type: 'text', text: { body: 'Parar' } },
                    { from: '554799998888', type: 'sticker' }
                ]
            })
        )

        expect(processar).toHaveBeenCalledWith({
            situacoes: [],
            mensagens: [
                { waId: '554799998888', texto: 'Parar' },
                { waId: '554799998888', texto: null }
            ]
        })
    })

    it('JSON inválido assinado → 200 sem efeito', async () => {
        const r = await post('{não é json')
        expect(r.status).toBe(200)
        expect(processar).not.toHaveBeenCalled()
    })

    it('outro campo de webhook é ignorado', async () => {
        const corpo = {
            object: 'whatsapp_business_account',
            entry: [{ id: 'waba', changes: [{ field: 'message_template_status_update', value: {} }] }]
        }
        const r = await post(corpo)
        expect(r.status).toBe(200)
        expect(processar).not.toHaveBeenCalled()
    })

    it('erro interno → 500, para a Meta reenviar', async () => {
        processar.mockRejectedValue(new Error('banco fora'))
        const erro = vi.spyOn(console, 'error').mockImplementation(() => {})

        const r = await post(evento({ statuses: [{ id: 'wamid.1', status: 'read' }] }))

        expect(r.status).toBe(500)
        erro.mockRestore()
    })
})
