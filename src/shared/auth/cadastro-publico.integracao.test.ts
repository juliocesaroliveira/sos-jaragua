import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { auth } from './auth'

/**
 * A rota pública de cadastro por senha está fechada (specs/020-resolver-pendencias,
 * Q2 / FR-011), mas a criação de contas pelo `/admin`, que chama
 * `auth.api.signUpEmail` direto no servidor, continua funcionando.
 *
 * É teste de integração porque só o better-auth real responde se o
 * `disabledPaths` barra o router HTTP sem barrar a chamada de servidor
 * (research.md D2).
 */
vi.mock('@/src/modules/auditoria', () => ({
    withAudit: <T>(_o: unknown, fn: () => Promise<T>) => fn()
}))

const emails: string[] = []

afterEach(async () => {
    // Apaga pelo e-mail: se a rota voltar a abrir, o teste falha **e** não
    // deixa a conta criada para trás. `account`/`session` caem por cascade.
    for (const email of emails.splice(0)) {
        await db.delete(user).where(eq(user.email, email))
    }
})

function emailUnico(prefixo: string): string {
    const email = `${prefixo}-${randomUUID().slice(0, 8)}@exemplo.test`
    emails.push(email)
    return email
}

describe('cadastro público por senha (integração)', () => {
    it('recusa POST /api/auth/sign-up/email com 404 e não cria a conta', async () => {
        const baseUrl = process.env.BETTER_AUTH_URL!
        const email = emailUnico('teste-cadastro-publico')

        const resposta = await auth.handler(
            new Request(`${baseUrl}/api/auth/sign-up/email`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', origin: baseUrl },
                body: JSON.stringify({ name: 'Intruso', email, password: 'senha-forte-123' })
            })
        )

        expect(resposta.status).toBe(404)
        const contas = await db.select({ id: user.id }).from(user).where(eq(user.email, email))
        expect(contas).toHaveLength(0)
    })

    it('continua criando a conta pela chamada de servidor usada no /admin', async () => {
        const email = emailUnico('teste-cadastro-admin')

        const { user: criado } = await auth.api.signUpEmail({
            body: { name: 'Criado pelo admin', email, password: 'senha-forte-123' }
        })

        const [conta] = await db.select({ id: user.id }).from(user).where(eq(user.email, email))
        expect(conta?.id).toBe(criado.id)
    })
})
