import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '@/src/shared/db/postgres'
import { account, session, user } from '@/db/schema/identidade'
import { item } from '@/db/schema/estoque'
import { atividadeCategoria } from '@/db/schema/voluntariado'
import { REGISTROS_SISTEMA } from '@/src/shared/kernel/registros-sistema'
import { avaliarElegibilidade } from '@/src/modules/notificacoes/domain/whatsapp'

/**
 * Registros padrão criados pela migração 0012 (026, T051, FR-012a).
 *
 * "Usuário removido" herda o histórico de contas apagadas. Ele não pode virar
 * uma porta de entrada: sem `account` não há credencial para autenticar, e
 * `ativo = false` faz `resolverSessao` encerrar qualquer sessão e o serviço de
 * notificação recusá-lo como `usuario_inativo`.
 */
describe('registros padrão da Danger Zone', () => {
    it('os três existem com os ids de REGISTROS_SISTEMA', async () => {
        const [u] = await db.select().from(user).where(eq(user.id, REGISTROS_SISTEMA.usuario))
        const [i] = await db.select().from(item).where(eq(item.id, REGISTROS_SISTEMA.item))
        const [c] = await db
            .select()
            .from(atividadeCategoria)
            .where(eq(atividadeCategoria.id, REGISTROS_SISTEMA.categoriaAtividade))
        expect(u?.name).toBe('Usuário removido')
        expect(i?.nome).toBe('Item removido')
        expect(c?.nome).toBe('Categoria removida')
    })

    it('"Usuário removido" não autentica: inativo, sem conta de login e sem sessão', async () => {
        const [u] = await db.select().from(user).where(eq(user.id, REGISTROS_SISTEMA.usuario))
        expect(u.ativo).toBe(false)
        expect(u.role).toBe('usuario')
        expect(await db.select().from(account).where(eq(account.userId, REGISTROS_SISTEMA.usuario))).toHaveLength(0)
        expect(await db.select().from(session).where(eq(session.userId, REGISTROS_SISTEMA.usuario))).toHaveLength(0)
    })

    it('"Usuário removido" não recebe notificação externa (usuario_inativo)', async () => {
        const [u] = await db.select({ ativo: user.ativo }).from(user).where(eq(user.id, REGISTROS_SISTEMA.usuario))
        expect(avaliarElegibilidade({ ativo: u.ativo, optIn: true, telefone: '+5547999990000' })).toEqual({
            elegivel: false,
            motivo: 'usuario_inativo'
        })
    })
})
