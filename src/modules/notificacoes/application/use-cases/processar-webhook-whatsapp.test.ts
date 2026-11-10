import { describe, expect, it, vi } from 'vitest'
import type { SituacaoEnvio } from '../../domain/whatsapp'
import type { SituacoesEnvioWhatsapp } from '../ports/envios-whatsapp'
import { ProcessarWebhookWhatsappUseCase, type DependenciasWebhook } from './processar-webhook-whatsapp'

/**
 * Webhook do WhatsApp já autenticado e parseado (024, contracts/webhook-whatsapp.md).
 */

function cenario(inicial: Record<string, SituacaoEnvio> = {}) {
    const situacoes = { ...inicial }
    const atualizacoes: { idExterno: string; de: SituacaoEnvio; para: SituacaoEnvio; extras?: unknown }[] = []

    const repo: SituacoesEnvioWhatsapp = {
        async situacaoPorIdExterno(id) {
            return situacoes[id] ?? null
        },
        async atualizarSituacao(idExterno, de, para, extras) {
            atualizacoes.push({ idExterno, de, para, ...(extras ? { extras } : {}) })
            situacoes[idExterno] = para
        }
    }

    const deps: DependenciasWebhook = {
        situacoes: repo,
        usuariosPorWaId: vi.fn(async () => []),
        revogar: vi.fn(async () => {}),
        enviarTexto: vi.fn(async () => {}),
        podeResponderAutomaticamente: vi.fn(async () => true),
        urlBase: 'https://sos.exemplo'
    }

    return { useCase: new ProcessarWebhookWhatsappUseCase(deps), atualizacoes, situacoes, deps }
}

const status = (idExterno: string, s: string, codigoErro: number | null = null) => ({
    idExterno,
    status: s,
    codigoErro,
    erro: codigoErro ? 'erro da Meta' : null
})

describe('ProcessarWebhookWhatsappUseCase — situações', () => {
    it('aplica a transição a partir da situação atual', async () => {
        const c = cenario({ 'wamid.1': 'enviado' })

        await c.useCase.executar({ situacoes: [status('wamid.1', 'delivered')], mensagens: [] })

        expect(c.atualizacoes).toEqual([{ idExterno: 'wamid.1', de: 'enviado', para: 'entregue' }])
    })

    it('falha da Meta grava o motivo classificado', async () => {
        const c = cenario({ 'wamid.1': 'enviado' })

        await c.useCase.executar({ situacoes: [status('wamid.1', 'failed', 131026)], mensagens: [] })

        expect(c.atualizacoes).toEqual([
            {
                idExterno: 'wamid.1',
                de: 'enviado',
                para: 'falhou',
                extras: { motivo: 'numero_sem_whatsapp', erro: '131026: erro da Meta' }
            }
        ])
    })

    it('wamid desconhecido é ignorado', async () => {
        const c = cenario()

        await c.useCase.executar({ situacoes: [status('wamid.x', 'read')], mensagens: [] })

        expect(c.atualizacoes).toEqual([])
    })

    it('"lido" antes de "entregue": o "entregue" atrasado não regride', async () => {
        const c = cenario({ 'wamid.1': 'enviado' })

        await c.useCase.executar({
            situacoes: [status('wamid.1', 'read'), status('wamid.1', 'delivered')],
            mensagens: []
        })

        expect(c.situacoes['wamid.1']).toBe('lido')
        expect(c.atualizacoes).toHaveLength(1)
    })

    it('status desconhecido da Meta é ignorado', async () => {
        const c = cenario({ 'wamid.1': 'enviado' })

        await c.useCase.executar({ situacoes: [status('wamid.1', 'deleted')], mensagens: [] })

        expect(c.atualizacoes).toEqual([])
    })

    it('leitura no WhatsApp não toca o estado lido do sino (FR-027)', async () => {
        const c = cenario({ 'wamid.1': 'entregue' })

        await c.useCase.executar({ situacoes: [status('wamid.1', 'read')], mensagens: [] })

        // O caso de uso só recebe o repositório de envios: não há caminho até
        // `notificacao.lida`. Nenhuma outra dependência é acionada.
        expect(c.atualizacoes).toEqual([{ idExterno: 'wamid.1', de: 'entregue', para: 'lido' }])
        expect(c.deps.revogar).not.toHaveBeenCalled()
        expect(c.deps.enviarTexto).not.toHaveBeenCalled()
    })
})

describe('ProcessarWebhookWhatsappUseCase — mensagens recebidas (US4)', () => {
    it('"Sair" revoga todos os usuários do número e confirma uma vez', async () => {
        const c = cenario()
        vi.mocked(c.deps.usuariosPorWaId).mockResolvedValue(['u1', 'u2'])

        await c.useCase.executar({ situacoes: [], mensagens: [{ waId: '554799998888', texto: 'Sair' }] })

        expect(c.deps.usuariosPorWaId).toHaveBeenCalledWith('554799998888')
        expect(c.deps.revogar).toHaveBeenCalledTimes(2)
        expect(c.deps.revogar).toHaveBeenCalledWith('u1')
        expect(c.deps.revogar).toHaveBeenCalledWith('u2')
        expect(c.deps.enviarTexto).toHaveBeenCalledTimes(1)
        expect(vi.mocked(c.deps.enviarTexto).mock.calls[0]![1]).toContain('https://sos.exemplo/conta/notificacoes')
    })

    it('"Sair" de número desconhecido não revoga nada e recebe só a resposta automática', async () => {
        const c = cenario()

        await c.useCase.executar({ situacoes: [], mensagens: [{ waId: '5511999990000', texto: 'SAIR' }] })

        expect(c.deps.revogar).not.toHaveBeenCalled()
        expect(c.deps.enviarTexto).toHaveBeenCalledWith('5511999990000', expect.stringContaining('só envia avisos'))
    })

    it('qualquer outra mensagem recebe a resposta automática quando o limitador permite', async () => {
        const c = cenario()

        await c.useCase.executar({ situacoes: [], mensagens: [{ waId: '554799998888', texto: 'oi' }] })

        expect(c.deps.enviarTexto).toHaveBeenCalledWith('554799998888', expect.stringContaining('só envia avisos'))
        expect(c.deps.revogar).not.toHaveBeenCalled()
    })

    it('sem permissão do limitador, não responde', async () => {
        const c = cenario()
        vi.mocked(c.deps.podeResponderAutomaticamente).mockResolvedValue(false)

        await c.useCase.executar({ situacoes: [], mensagens: [{ waId: '554799998888', texto: 'oi' }] })

        expect(c.deps.enviarTexto).not.toHaveBeenCalled()
    })

    it('mensagem que não é texto segue a regra de "qualquer outra"', async () => {
        const c = cenario()

        await c.useCase.executar({ situacoes: [], mensagens: [{ waId: '554799998888', texto: null }] })

        expect(c.deps.usuariosPorWaId).not.toHaveBeenCalled()
        expect(c.deps.revogar).not.toHaveBeenCalled()
        expect(c.deps.enviarTexto).toHaveBeenCalledTimes(1)
    })
})
