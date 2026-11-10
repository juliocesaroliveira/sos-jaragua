import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { whatsappCloudApi } from './whatsapp-cloud-api'

/**
 * Contrato do adapter HTTP da Cloud API (024, contracts/modelos-whatsapp.md
 * "Chamada de envio"). `fetch` simulado — nenhuma chamada sai para a rede.
 */

const fetchFalso = vi.fn<typeof fetch>()

function resposta(status: number, corpo: unknown): Response {
    return new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })
}

beforeEach(() => {
    vi.stubGlobal('fetch', fetchFalso)
    vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'token-teste')
    vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123456')
    vi.stubEnv('WHATSAPP_GRAPH_VERSION', 'v23.0')
    vi.stubEnv('WHATSAPP_TEMPLATE_LANG', '')
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    fetchFalso.mockReset()
})

describe('configurado', () => {
    it('exige token e phone number id', () => {
        expect(whatsappCloudApi.configurado()).toBe(true)
        vi.stubEnv('WHATSAPP_ACCESS_TOKEN', '')
        expect(whatsappCloudApi.configurado()).toBe(false)
        vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'token-teste')
        vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '')
        expect(whatsappCloudApi.configurado()).toBe(false)
    })
})

describe('enviarModelo', () => {
    it('faz o POST do contrato e devolve o wamid', async () => {
        fetchFalso.mockResolvedValue(resposta(200, { messages: [{ id: 'wamid.ABC' }] }))

        const r = await whatsappCloudApi.enviarModelo('5547999998888', 'sos_atividade_atribuida', {
            titulo: 'Título',
            mensagem: 'Mensagem'
        })

        expect(r).toEqual({ ok: true, idExterno: 'wamid.ABC' })
        const [url, init] = fetchFalso.mock.calls[0]!
        expect(url).toBe('https://graph.facebook.com/v23.0/123456/messages')
        expect(init?.method).toBe('POST')
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer token-teste')
        expect(JSON.parse(String(init?.body))).toEqual({
            messaging_product: 'whatsapp',
            to: '5547999998888',
            type: 'template',
            template: {
                name: 'sos_atividade_atribuida',
                // Sem WHATSAPP_TEMPLATE_LANG, o padrão é pt_BR.
                language: { code: 'pt_BR' },
                components: [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: 'Título' },
                            { type: 'text', text: 'Mensagem' }
                        ]
                    }
                ]
            }
        })
    })

    it('erro da API devolve código e texto originais', async () => {
        fetchFalso.mockResolvedValue(resposta(400, { error: { code: 131026, message: 'Message undeliverable' } }))

        const r = await whatsappCloudApi.enviarModelo('5547999998888', 'sos_lembrete_turno', {
            titulo: 't',
            mensagem: 'm'
        })

        expect(r).toEqual({ ok: false, codigo: 131026, erro: 'Message undeliverable' })
    })

    it('falha de rede vira erro sem código', async () => {
        fetchFalso.mockRejectedValue(new Error('ECONNRESET'))

        const r = await whatsappCloudApi.enviarModelo('5547999998888', 'sos_lembrete_turno', {
            titulo: 't',
            mensagem: 'm'
        })

        expect(r).toEqual({ ok: false, codigo: null, erro: 'ECONNRESET' })
    })

    it('sem configuração não chama a rede', async () => {
        vi.stubEnv('WHATSAPP_ACCESS_TOKEN', '')

        const r = await whatsappCloudApi.enviarModelo('5547999998888', 'sos_lembrete_turno', {
            titulo: 't',
            mensagem: 'm'
        })

        expect(r.ok).toBe(false)
        expect(fetchFalso).not.toHaveBeenCalled()
    })
})

describe('enviarTexto', () => {
    it('envia texto livre', async () => {
        fetchFalso.mockResolvedValue(resposta(200, { messages: [{ id: 'wamid.T' }] }))

        await whatsappCloudApi.enviarTexto('5547999998888', 'Olá')

        expect(JSON.parse(String(fetchFalso.mock.calls[0]![1]?.body))).toEqual({
            messaging_product: 'whatsapp',
            to: '5547999998888',
            type: 'text',
            text: { body: 'Olá' }
        })
    })
})
