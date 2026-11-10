import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import {
    consentimentoWhatsapp,
    notificacao,
    notificacaoEnvio,
    preferenciaWhatsapp,
    whatsappRespostaAutomatica
} from '@/db/schema/notificacoes'
import { criarUsuarioRepository } from './usuario-repository'

/**
 * Eliminação a pedido do titular × canal WhatsApp, contra o Neon real.
 *
 * As duas features nasceram em paralelo; este teste trava a emenda: a
 * anonimização da conta tem de levar junto o telefone que o canal WhatsApp
 * gravou em quatro lugares diferentes — um deles (`whatsapp_resposta_automatica`)
 * sem `user_id`, alcançável só pelo número.
 */

const criados: { userIds: string[]; telefones: string[] } = { userIds: [], telefones: [] }

afterEach(async () => {
    if (criados.telefones.length > 0) {
        await db.delete(whatsappRespostaAutomatica).where(inArray(whatsappRespostaAutomatica.telefone, criados.telefones))
    }
    for (const id of criados.userIds) {
        await db.delete(user).where(eq(user.id, id))
    }
    criados.userIds = []
    criados.telefones = []
})

async function criarConta(): Promise<string> {
    const id = `teste-anon-wa-${randomUUID()}`
    await db.insert(user).values({ id, name: 'Teste anonimização', email: `${id}@exemplo.test`, role: 'usuario' })
    criados.userIds.push(id)
    return id
}

function telefoneAleatorio(): string {
    const numero = `55479${Math.floor(10_000_000 + Math.random() * 89_999_999)}`
    criados.telefones.push(numero)
    return numero
}

describe('anonimizarConta — dados do canal WhatsApp', () => {
    it('apaga preferência e respostas automáticas e anula o telefone, preservando a evidência de consentimento', async () => {
        const userId = await criarConta()
        const doConsentimento = telefoneAleatorio()
        const doEnvio = telefoneAleatorio()

        await db.insert(preferenciaWhatsapp).values({ userId, ativo: true })
        await db.insert(consentimentoWhatsapp).values({
            userId,
            acao: 'concedido',
            origem: 'cadastro',
            telefone: doConsentimento
        })
        const [n] = await db
            .insert(notificacao)
            .values({ destinatarioUserId: userId, tipo: 'triagem_concluida', titulo: 't', mensagem: 'm' })
            .returning({ id: notificacao.id })
        await db.insert(notificacaoEnvio).values({ notificacaoId: n!.id, canal: 'whatsapp', destino: doEnvio })
        await db.insert(whatsappRespostaAutomatica).values([
            { telefone: doConsentimento, ultimaEm: new Date() },
            { telefone: doEnvio, ultimaEm: new Date() }
        ])

        await criarUsuarioRepository().anonimizarConta(userId)

        expect(await db.select().from(preferenciaWhatsapp).where(eq(preferenciaWhatsapp.userId, userId))).toEqual([])
        expect(
            await db
                .select()
                .from(whatsappRespostaAutomatica)
                .where(inArray(whatsappRespostaAutomatica.telefone, [doConsentimento, doEnvio]))
        ).toEqual([])
        expect(await db.select().from(notificacaoEnvio).where(eq(notificacaoEnvio.notificacaoId, n!.id))).toEqual([])

        const consentimentos = await db
            .select({ acao: consentimentoWhatsapp.acao, telefone: consentimentoWhatsapp.telefone })
            .from(consentimentoWhatsapp)
            .where(eq(consentimentoWhatsapp.userId, userId))
        expect(consentimentos).toEqual([{ acao: 'concedido', telefone: null }])
    })

    it('titular que nunca usou o WhatsApp é anonimizado sem erro', async () => {
        const userId = await criarConta()
        await expect(criarUsuarioRepository().anonimizarConta(userId)).resolves.toBeUndefined()
    })
})
