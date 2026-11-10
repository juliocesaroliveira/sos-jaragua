import 'server-only'
import type { MensageriaWhatsapp, ResultadoEnvioWhatsapp } from '../application/ports/mensageria-whatsapp'

/**
 * Adapter da WhatsApp Cloud API (024, research D1). Chamada por `fetch`, sem
 * SDK: a Meta não mantém SDK oficial de Node, e as duas chamadas que o sistema
 * faz (modelo e texto) não justificam uma dependência.
 *
 * As variáveis são lidas a cada chamada, não no carregamento do módulo — é o
 * que permite desligar o canal removendo a variável, sem redeploy de código, e
 * o que deixa os testes trocarem a configuração.
 */

const VERSAO_PADRAO = 'v23.0'
const IDIOMA_PADRAO = 'pt_BR'

/** Uma chamada lenta não pode prender o despacho do lote inteiro. */
const TIMEOUT_MS = 10_000

function configuracao() {
    const token = process.env.WHATSAPP_ACCESS_TOKEN
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    if (!token || !phoneNumberId) return null
    return {
        token,
        url: `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || VERSAO_PADRAO}/${phoneNumberId}/messages`,
        idioma: process.env.WHATSAPP_TEMPLATE_LANG || IDIOMA_PADRAO
    }
}

type RespostaMeta = {
    messages?: { id?: string }[]
    error?: { code?: number; message?: string }
}

async function postar(corpo: (idioma: string) => Record<string, unknown>): Promise<ResultadoEnvioWhatsapp> {
    const config = configuracao()
    if (!config) return { ok: false, codigo: null, erro: 'WhatsApp não configurado' }

    try {
        const resposta = await fetch(config.url, {
            method: 'POST',
            headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', ...corpo(config.idioma) }),
            signal: AbortSignal.timeout(TIMEOUT_MS)
        })
        const json = (await resposta.json().catch(() => ({}))) as RespostaMeta

        const id = json.messages?.[0]?.id
        if (resposta.ok && id) return { ok: true, idExterno: id }

        return {
            ok: false,
            codigo: json.error?.code ?? null,
            erro: json.error?.message ?? `HTTP ${resposta.status}`
        }
    } catch (erro) {
        return { ok: false, codigo: null, erro: erro instanceof Error ? erro.message : String(erro) }
    }
}

export const whatsappCloudApi: MensageriaWhatsapp = {
    configurado() {
        return configuracao() !== null
    },

    enviarModelo(destino, modelo, { titulo, mensagem }) {
        return postar((idioma) => ({
            to: destino,
            type: 'template',
            template: {
                name: modelo,
                language: { code: idioma },
                // O botão "Abrir no SOS Jaraguá" tem URL estática no modelo e não
                // leva parâmetro (research D6).
                components: [
                    {
                        type: 'body',
                        parameters: [
                            { type: 'text', text: titulo },
                            { type: 'text', text: mensagem }
                        ]
                    }
                ]
            }
        }))
    },

    enviarTexto(destino, texto) {
        return postar(() => ({ to: destino, type: 'text', text: { body: texto } }))
    }
}
