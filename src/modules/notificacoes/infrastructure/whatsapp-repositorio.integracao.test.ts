import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
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
import { whatsappRepositorio } from './whatsapp-repositorio'

/**
 * Repositório do canal WhatsApp contra o Neon de desenvolvimento (024). O que
 * só a integração prova: o índice único `(notificacao_id, canal)` impede a
 * segunda inserção, e as transições só valem a partir de `pendente`.
 */

const criados: string[] = []

async function criarUsuario() {
    const userId = randomUUID()
    const sufixo = userId.slice(0, 8)
    await db.insert(user).values({
        id: userId,
        name: `Teste ${sufixo}`,
        email: `teste-${sufixo}@exemplo.test`,
        emailVerified: true,
        role: 'voluntario'
    })
    criados.push(userId)
    return userId
}

async function criarNotificacao(userId: string) {
    const [linha] = await db
        .insert(notificacao)
        .values({ destinatarioUserId: userId, tipo: 'atividade_atribuida', titulo: 'T', mensagem: 'M' })
        .returning({ id: notificacao.id })
    return linha.id
}

async function enviosWhatsapp(notificacaoId: string) {
    return db
        .select()
        .from(notificacaoEnvio)
        .where(and(eq(notificacaoEnvio.notificacaoId, notificacaoId), eq(notificacaoEnvio.canal, 'whatsapp')))
}

afterEach(async () => {
    // `notificacao`, `notificacao_envio` e `preferencia_whatsapp` caem por cascade.
    for (const userId of criados.splice(0)) {
        await db.delete(user).where(eq(user.id, userId))
    }
})

describe('whatsappRepositorio — envios (integração)', () => {
    it('registra pendentes com destino e não enviados com motivo', async () => {
        const userId = await criarUsuario()
        const [a, b, c] = [
            await criarNotificacao(userId),
            await criarNotificacao(userId),
            await criarNotificacao(userId)
        ]

        const inseridas = await whatsappRepositorio.registrarTentativas([
            { notificacaoId: a, status: 'pendente', destino: '5547999998888' },
            { notificacaoId: b, status: 'pendente', destino: '5547999998888' },
            { notificacaoId: c, status: 'nao_enviado', motivo: 'canal_desativado' }
        ])

        expect(inseridas).toHaveLength(3)
        const [envioA] = await enviosWhatsapp(a)
        expect(envioA).toMatchObject({ status: 'pendente', destino: '5547999998888', motivo: null })
        const [envioC] = await enviosWhatsapp(c)
        expect(envioC).toMatchObject({ status: 'nao_enviado', motivo: 'canal_desativado', destino: null })
    })

    it('a mesma notificação não é registrada duas vezes (FR-008)', async () => {
        const userId = await criarUsuario()
        const id = await criarNotificacao(userId)
        const tentativa = { notificacaoId: id, status: 'pendente' as const, destino: '5547999998888' }

        expect(await whatsappRepositorio.registrarTentativas([tentativa])).toHaveLength(1)
        expect(await whatsappRepositorio.registrarTentativas([tentativa])).toEqual([])
        expect(await enviosWhatsapp(id)).toHaveLength(1)
    })

    it('enviado e falha só alteram envio pendente', async () => {
        const userId = await criarUsuario()
        const id = await criarNotificacao(userId)
        const [registrada] = await whatsappRepositorio.registrarTentativas([
            { notificacaoId: id, status: 'pendente', destino: '5547999998888' }
        ])

        await whatsappRepositorio.marcarEnviado(registrada.id, 'wamid.X')
        // Já não está pendente: a falha tardia não sobrescreve.
        await whatsappRepositorio.marcarFalha(registrada.id, 'falha', 'tarde demais')

        const [envio] = await enviosWhatsapp(id)
        expect(envio).toMatchObject({ status: 'enviado', idExterno: 'wamid.X', motivo: null })
        expect(envio.enviadoEm).not.toBeNull()
    })

    it('lê preferências; ausência de linha não aparece (= desligado)', async () => {
        const comOptIn = await criarUsuario()
        const semLinha = await criarUsuario()
        await db.insert(preferenciaWhatsapp).values({ userId: comOptIn, ativo: true })

        const preferencias = await whatsappRepositorio.lerPreferencias([comOptIn, semLinha])

        expect(preferencias.get(comOptIn)).toBe(true)
        expect(preferencias.has(semLinha)).toBe(false)
    })
})

describe('whatsappRepositorio — consentimento (integração)', () => {
    it('grava estado e histórico juntos; o histórico só acumula', async () => {
        const userId = await criarUsuario()

        expect(await whatsappRepositorio.lerPreferencia(userId)).toBeNull()

        await whatsappRepositorio.salvarPreferencia(userId, true, 'cadastro', '5547999998888')
        const ativa = await whatsappRepositorio.lerPreferencia(userId)
        expect(ativa?.ativo).toBe(true)
        expect(ativa?.ativoDesde).toBeInstanceOf(Date)

        await whatsappRepositorio.salvarPreferencia(userId, false, 'perfil', '5547999998888')
        expect(await whatsappRepositorio.lerPreferencia(userId)).toEqual({ ativo: false, ativoDesde: null })

        const historico = await db
            .select({
                acao: consentimentoWhatsapp.acao,
                origem: consentimentoWhatsapp.origem,
                telefone: consentimentoWhatsapp.telefone
            })
            .from(consentimentoWhatsapp)
            .where(eq(consentimentoWhatsapp.userId, userId))
            .orderBy(consentimentoWhatsapp.criadoEm)
        expect(historico).toEqual([
            { acao: 'concedido', origem: 'cadastro', telefone: '5547999998888' },
            { acao: 'revogado', origem: 'perfil', telefone: '5547999998888' }
        ])
        expect(await db.select().from(preferenciaWhatsapp).where(eq(preferenciaWhatsapp.userId, userId))).toHaveLength(
            1
        )
    })
})

describe('whatsappRepositorio — situações (integração)', () => {
    it('atualiza só quando a situação atual é a esperada', async () => {
        const userId = await criarUsuario()
        const id = await criarNotificacao(userId)
        const [registrada] = await whatsappRepositorio.registrarTentativas([
            { notificacaoId: id, status: 'pendente', destino: '5547999998888' }
        ])
        await whatsappRepositorio.marcarEnviado(registrada.id, 'wamid.S')

        expect(await whatsappRepositorio.situacaoPorIdExterno('wamid.S')).toBe('enviado')

        await whatsappRepositorio.atualizarSituacao('wamid.S', 'enviado', 'entregue')
        // Concorrente atrasado: ainda acha que está "enviado" — não sobrescreve.
        await whatsappRepositorio.atualizarSituacao('wamid.S', 'enviado', 'falhou', { motivo: 'falha', erro: 'x' })

        const [envio] = await enviosWhatsapp(id)
        expect(envio).toMatchObject({ status: 'entregue', motivo: null })
        expect(envio.atualizadoEm).not.toBeNull()
    })

    it('wamid desconhecido devolve null', async () => {
        expect(await whatsappRepositorio.situacaoPorIdExterno(`wamid.${randomUUID()}`)).toBeNull()
    })
})

describe('whatsappRepositorio — resposta automática (integração)', () => {
    it('permite uma resposta por número a cada 24h', async () => {
        const telefone = `teste-${randomUUID()}`
        try {
            expect(await whatsappRepositorio.podeResponderAutomaticamente(telefone)).toBe(true)
            expect(await whatsappRepositorio.podeResponderAutomaticamente(telefone)).toBe(false)

            // Passadas as 24h, volta a responder.
            await db
                .update(whatsappRespostaAutomatica)
                .set({ ultimaEm: new Date(Date.now() - 25 * 60 * 60 * 1000) })
                .where(eq(whatsappRespostaAutomatica.telefone, telefone))
            expect(await whatsappRepositorio.podeResponderAutomaticamente(telefone)).toBe(true)
        } finally {
            await db.delete(whatsappRespostaAutomatica).where(eq(whatsappRespostaAutomatica.telefone, telefone))
        }
    })
})
