import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { notificacao, notificacaoEnvio } from '@/db/schema/notificacoes'
import type { Notificacao } from '../application/ports/notificacao-service'
import { despacharWhatsapp, type DependenciasDespacho } from './despacho-whatsapp'
import { whatsappRepositorio } from './whatsapp-repositorio'

/**
 * SC-002 / FR-017 — broadcast de 200 contra o Neon real (024, T023).
 *
 * A Meta é simulada com 300 ms de latência por chamada. O que se prova: o
 * registro (a parte que roda dentro da ação do coordenador) não depende da
 * latência da Meta, e o envio conclui com no máximo 10 chamadas simultâneas.
 */

const TOTAL = 200
const LATENCIA_META_MS = 300

const criados: string[] = []

afterEach(async () => {
    for (const userId of criados.splice(0)) {
        await db.delete(user).where(eq(user.id, userId))
    }
})

describe('despacharWhatsapp — broadcast de 200 (integração)', () => {
    it('registra rápido e envia tudo com concorrência limitada', async () => {
        const userId = randomUUID()
        await db.insert(user).values({
            id: userId,
            name: 'Teste broadcast',
            email: `teste-${userId.slice(0, 8)}@exemplo.test`,
            emailVerified: true,
            role: 'voluntario'
        })
        criados.push(userId)

        const linhas = await db
            .insert(notificacao)
            .values(
                Array.from({ length: TOTAL }, () => ({
                    destinatarioUserId: userId,
                    tipo: 'broadcast_urgencia' as const,
                    titulo: 'Convocação',
                    mensagem: 'Compareçam ao ginásio.'
                }))
            )
            .returning({ id: notificacao.id })

        let emAndamento = 0
        let pico = 0
        let agendada: (() => Promise<void>) | null = null

        const deps: DependenciasDespacho = {
            mensageria: {
                configurado: () => true,
                async enviarModelo() {
                    emAndamento++
                    pico = Math.max(pico, emAndamento)
                    await new Promise((r) => setTimeout(r, LATENCIA_META_MS))
                    emAndamento--
                    return { ok: true, idExterno: `wamid.${randomUUID()}` }
                },
                async enviarTexto() {
                    return { ok: true, idExterno: 'x' }
                }
            },
            envios: {
                ...whatsappRepositorio,
                // O opt-in não é o que está sob teste aqui.
                lerPreferencias: async (ids) => new Map(ids.map((id) => [id, true]))
            },
            contatos: {
                telefonesDe: async (ids) => new Map(ids.map((id) => [id, '47999998888'])),
                usuariosPorTelefone: async () => []
            },
            situacaoUsuarios: async (ids) => new Map(ids.map((id) => [id, true])),
            // Como o `after()`: guarda a tarefa e devolve sem esperar.
            agendar: (tarefa) => {
                agendada = tarefa
            }
        }

        const lote: Notificacao[] = linhas.map(() => ({
            evento: 'broadcast_urgencia',
            destinatarioUserId: userId,
            titulo: 'Convocação',
            mensagem: 'Compareçam ao ginásio.'
        }))
        const gravadas = linhas.map((l) => ({ notificacaoId: l.id, destinatarioUserId: userId }))

        // (a) O que roda dentro da ação: registrar 200 tentativas.
        const inicioRegistro = performance.now()
        const resumo = await despacharWhatsapp(lote, gravadas, deps)
        const duracaoRegistro = performance.now() - inicioRegistro

        expect(resumo).toEqual({ elegiveis: TOTAL, naoAlcancaveis: 0 })
        expect(duracaoRegistro).toBeLessThan(2_000)
        expect(agendada).not.toBeNull()

        // (b) O que roda depois da resposta.
        const inicioEnvio = performance.now()
        await agendada!()
        const duracaoEnvio = performance.now() - inicioEnvio

        expect(duracaoEnvio).toBeLessThan(60_000)
        // (c)
        expect(pico).toBeLessThanOrEqual(10)

        const pendentes = await db
            .select({ id: notificacaoEnvio.id })
            .from(notificacaoEnvio)
            .where(
                and(
                    inArray(
                        notificacaoEnvio.notificacaoId,
                        linhas.map((l) => l.id)
                    ),
                    eq(notificacaoEnvio.canal, 'whatsapp'),
                    eq(notificacaoEnvio.status, 'pendente')
                )
            )
        expect(pendentes).toHaveLength(0)
    }, 120_000)
})
