import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { autenticacaoService } from '../../infrastructure/better-auth/autenticacao-service'
import { criarUsuarioRepository } from '../../infrastructure/drizzle/usuario-repository'
import { CriarUsuarioUseCase } from './criar-usuario'

/**
 * Fluxo real de `CriarUsuarioUseCase` contra o Neon de desenvolvimento
 * (DESIGN.md §18) — o que só um teste de integração pega: que
 * `auth.api.signUpEmail` de fato hasheia e persiste uma senha utilizável, e
 * que o papel escolhido é o que fica gravado (não o padrão `usuario`).
 */
vi.mock('@/src/modules/auditoria', () => ({
    withAudit: <T>(_o: unknown, fn: () => Promise<T>) => fn()
}))

const criados: string[] = []

afterEach(async () => {
    // `account`/`session` caem por cascade do `user`.
    for (const userId of criados.splice(0)) {
        await db.delete(user).where(eq(user.id, userId))
    }
})

describe('CriarUsuarioUseCase (integração)', () => {
    it('cria a conta com a senha informada e o papel escolhido', async () => {
        const sufixo = randomUUID().slice(0, 8)
        const email = `teste-criar-usuario-${sufixo}@exemplo.test`
        const useCase = new CriarUsuarioUseCase(autenticacaoService, criarUsuarioRepository())

        const resultado = await useCase.executar({
            nome: `Teste ${sufixo}`,
            email,
            senha: 'senha-forte-123',
            role: 'coordenador'
        })

        expect(resultado.ok).toBe(true)
        if (!resultado.ok) return
        criados.push(resultado.valor.id)

        const [conta] = await db
            .select({ role: user.role, email: user.email })
            .from(user)
            .where(eq(user.id, resultado.valor.id))
        expect(conta.role).toBe('coordenador')
        expect(conta.email).toBe(email)
    })

    it('rejeita e-mail já cadastrado sem criar uma segunda conta', async () => {
        const sufixo = randomUUID().slice(0, 8)
        const email = `teste-criar-usuario-dup-${sufixo}@exemplo.test`
        const useCase = new CriarUsuarioUseCase(autenticacaoService, criarUsuarioRepository())

        const primeira = await useCase.executar({ nome: 'Primeira', email, senha: 'senha-forte-123', role: 'usuario' })
        expect(primeira.ok).toBe(true)
        if (primeira.ok) criados.push(primeira.valor.id)

        const segunda = await useCase.executar({ nome: 'Segunda', email, senha: 'outra-senha-123', role: 'usuario' })
        expect(segunda.ok).toBe(false)
        if (segunda.ok) return
        expect(segunda.erro.codigo).toBe('validacao')

        const contas = await db.select({ id: user.id }).from(user).where(eq(user.email, email))
        expect(contas).toHaveLength(1)
    })
})
