import { describe, expect, it, vi } from 'vitest'
import type { Notificacao } from '../application/ports/notificacao-service'
import type { EnviosWhatsapp, TentativaRegistrada, TentativaWhatsapp } from '../application/ports/envios-whatsapp'
import type { MensageriaWhatsapp, ResultadoEnvioWhatsapp } from '../application/ports/mensageria-whatsapp'
import { despacharWhatsapp, type DependenciasDespacho } from './despacho-whatsapp'

/**
 * Despacho do canal WhatsApp com dublês em memória (024, contracts/canal-e-interfaces.md §1).
 */

function notificacao(destinatarioUserId: string, evento: Notificacao['evento'] = 'atividade_atribuida'): Notificacao {
    return { evento, destinatarioUserId, titulo: 'Título', mensagem: 'Mensagem' }
}

function cenario(opcoes: {
    ativos?: Record<string, boolean>
    optIn?: Record<string, boolean>
    telefones?: Record<string, string>
    configurado?: boolean
    resposta?: (destino: string) => ResultadoEnvioWhatsapp | Promise<ResultadoEnvioWhatsapp>
}) {
    const registradas: (TentativaWhatsapp & { id: string })[] = []
    const enviados: { id: string; idExterno: string }[] = []
    const falhas: { id: string; motivo: string; erro: string }[] = []
    const jaRegistradas = new Set<string>()
    const agendadas: Promise<void>[] = []

    const envios: EnviosWhatsapp = {
        async lerPreferencias(ids) {
            return new Map(ids.filter((id) => id in (opcoes.optIn ?? {})).map((id) => [id, opcoes.optIn![id]!]))
        },
        async registrarTentativas(tentativas) {
            const novas: TentativaRegistrada[] = []
            for (const t of tentativas) {
                if (jaRegistradas.has(t.notificacaoId)) continue
                jaRegistradas.add(t.notificacaoId)
                const id = `envio-${t.notificacaoId}`
                registradas.push({ ...t, id })
                novas.push({
                    id,
                    notificacaoId: t.notificacaoId,
                    status: t.status,
                    destino: t.status === 'pendente' ? t.destino : null
                })
            }
            return novas
        },
        async marcarEnviado(id, idExterno) {
            enviados.push({ id, idExterno })
        },
        async marcarFalha(id, motivo, erro) {
            falhas.push({ id, motivo, erro })
        }
    }

    const enviarModelo = vi.fn<MensageriaWhatsapp['enviarModelo']>(async (destino) =>
        opcoes.resposta ? opcoes.resposta(destino) : { ok: true, idExterno: `wamid.${destino}` }
    )

    const deps: DependenciasDespacho = {
        mensageria: {
            configurado: () => opcoes.configurado ?? true,
            enviarModelo,
            enviarTexto: vi.fn()
        },
        envios,
        contatos: {
            async telefonesDe(ids) {
                return new Map(
                    ids.filter((id) => id in (opcoes.telefones ?? {})).map((id) => [id, opcoes.telefones![id]!])
                )
            },
            usuariosPorTelefone: vi.fn()
        },
        situacaoUsuarios: async (ids) => new Map(ids.map((id) => [id, opcoes.ativos?.[id] ?? true])),
        agendar: (tarefa) => {
            agendadas.push(tarefa())
        }
    }

    return {
        deps,
        registradas,
        enviados,
        falhas,
        enviarModelo,
        concluir: () => Promise.all(agendadas)
    }
}

const gravadas = (...pares: [string, string][]) =>
    pares.map(([destinatarioUserId, notificacaoId]) => ({ destinatarioUserId, notificacaoId }))

describe('despacharWhatsapp', () => {
    it('evento fora da matriz não gera tentativa', async () => {
        const c = cenario({ optIn: { u1: true }, telefones: { u1: '47999998888' } })

        const resumo = await despacharWhatsapp([notificacao('u1', 'estoque_critico')], gravadas(['u1', 'n1']), c.deps)

        expect(c.registradas).toEqual([])
        expect(resumo).toEqual({ elegiveis: 0, naoAlcancaveis: 0 })
    })

    it('canal explícito sem whatsapp não gera tentativa', async () => {
        const c = cenario({ optIn: { u1: true }, telefones: { u1: '47999998888' } })

        await despacharWhatsapp([{ ...notificacao('u1'), canais: ['plataforma'] }], gravadas(['u1', 'n1']), c.deps)

        expect(c.registradas).toEqual([])
    })

    it('elegível recebe o modelo do evento com os parâmetros normalizados', async () => {
        const c = cenario({ optIn: { u1: true }, telefones: { u1: '47999998888' } })

        const resumo = await despacharWhatsapp(
            [{ ...notificacao('u1', 'lembrete_turno'), mensagem: 'Linha 1\nLinha 2' }],
            gravadas(['u1', 'n1']),
            c.deps
        )
        await c.concluir()

        expect(resumo).toEqual({ elegiveis: 1, naoAlcancaveis: 0 })
        expect(c.enviarModelo).toHaveBeenCalledWith('5547999998888', 'sos_lembrete_turno', {
            titulo: 'Título',
            mensagem: 'Linha 1 — Linha 2'
        })
        expect(c.enviados).toEqual([{ id: 'envio-n1', idExterno: 'wamid.5547999998888' }])
    })

    it('registra os não elegíveis com o motivo', async () => {
        const c = cenario({
            ativos: { inativo: false },
            optIn: { inativo: true, fixo: true },
            telefones: { inativo: '47999998888', semOptIn: '47999998888', fixo: '4733334444' }
        })

        const resumo = await despacharWhatsapp(
            [notificacao('inativo'), notificacao('semOptIn'), notificacao('fixo')],
            gravadas(['inativo', 'n1'], ['semOptIn', 'n2'], ['fixo', 'n3']),
            c.deps
        )
        await c.concluir()

        expect(resumo).toEqual({ elegiveis: 0, naoAlcancaveis: 3 })
        expect(c.registradas.map((r) => (r.status === 'nao_enviado' ? r.motivo : r.status))).toEqual([
            'usuario_inativo',
            'canal_desativado',
            'sem_celular'
        ])
        expect(c.enviarModelo).not.toHaveBeenCalled()
    })

    it('sem configuração, tudo vira não configurado e nada vai para a rede (FR-018)', async () => {
        const c = cenario({ configurado: false, optIn: { u1: true }, telefones: { u1: '47999998888' } })

        const resumo = await despacharWhatsapp([notificacao('u1')], gravadas(['u1', 'n1']), c.deps)
        await c.concluir()

        expect(resumo).toEqual({ elegiveis: 0, naoAlcancaveis: 1 })
        expect(c.registradas[0]).toMatchObject({ status: 'nao_enviado', motivo: 'nao_configurado' })
        expect(c.enviarModelo).not.toHaveBeenCalled()
    })

    it('erro 131026 grava falha por número sem WhatsApp e não tenta de novo (FR-019)', async () => {
        const c = cenario({
            optIn: { u1: true },
            telefones: { u1: '47999998888' },
            resposta: () => ({ ok: false, codigo: 131026, erro: 'Message undeliverable' })
        })
        const lote = [notificacao('u1')]

        await despacharWhatsapp(lote, gravadas(['u1', 'n1']), c.deps)
        await c.concluir()
        // Reprocessar o mesmo lote não gera nova chamada.
        await despacharWhatsapp(lote, gravadas(['u1', 'n1']), c.deps)
        await c.concluir()

        expect(c.falhas).toEqual([
            { id: 'envio-n1', motivo: 'numero_sem_whatsapp', erro: '131026: Message undeliverable' }
        ])
        expect(c.enviarModelo).toHaveBeenCalledTimes(1)
    })

    it('envia no máximo 10 por vez', async () => {
        let emAndamento = 0
        let pico = 0
        const ids = Array.from({ length: 25 }, (_, i) => `u${i}`)
        const c = cenario({
            optIn: Object.fromEntries(ids.map((id) => [id, true])),
            telefones: Object.fromEntries(ids.map((id) => [id, '47999998888'])),
            resposta: async () => {
                emAndamento++
                pico = Math.max(pico, emAndamento)
                await new Promise((r) => setTimeout(r, 5))
                emAndamento--
                return { ok: true, idExterno: 'w' }
            }
        })

        await despacharWhatsapp(
            ids.map((id) => notificacao(id)),
            gravadas(...ids.map((id): [string, string] => [id, `n-${id}`])),
            c.deps
        )
        await c.concluir()

        expect(c.enviarModelo).toHaveBeenCalledTimes(25)
        expect(pico).toBeLessThanOrEqual(10)
    })

    it('o telefone é lido a cada despacho: troca de número vale no próximo envio', async () => {
        const telefones: Record<string, string> = { u1: '47999998888' }
        const c = cenario({ optIn: { u1: true }, telefones })

        await despacharWhatsapp([notificacao('u1')], gravadas(['u1', 'n1']), c.deps)
        telefones.u1 = '47988887777'
        await despacharWhatsapp([notificacao('u1')], gravadas(['u1', 'n2']), c.deps)
        await c.concluir()

        expect(c.enviarModelo.mock.calls.map((chamada) => chamada[0])).toEqual(['5547999998888', '5547988887777'])
    })

    it('exceção do repositório é capturada e não propaga (FR-017)', async () => {
        const c = cenario({ optIn: { u1: true }, telefones: { u1: '47999998888' } })
        c.deps.envios.registrarTentativas = async () => {
            throw new Error('banco fora')
        }
        const erro = vi.spyOn(console, 'error').mockImplementation(() => {})

        await expect(despacharWhatsapp([notificacao('u1')], gravadas(['u1', 'n1']), c.deps)).resolves.toEqual({
            elegiveis: 0,
            naoAlcancaveis: 0
        })
        expect(erro).toHaveBeenCalled()
        erro.mockRestore()
    })
})
