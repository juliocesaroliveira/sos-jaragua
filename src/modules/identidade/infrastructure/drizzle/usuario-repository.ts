import { count, desc, eq } from 'drizzle-orm'
import { db, type Transacao } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import type { Role } from '@/src/shared/auth/roles'
import type { LinhaUsuario, UsuarioRepository } from '../../application/ports/usuario-repository'

/**
 * Implementação Drizzle do port de Identidade (DESIGN.md §5).
 *
 * Substitui `criarUserRepository` que vivia em
 * `voluntariado/infrastructure/drizzle/voluntario-repository.ts`
 * (006-user-management-page, research.md D6) — `atualizarRole`/`buscarRole`
 * migraram para aqui como `atualizarNomeERole`/`buscarRole`, e `listar` é
 * novo.
 */
type Executor = typeof db | Transacao

export function criarUsuarioRepository(executor: Executor = db): UsuarioRepository {
    return {
        async listar({ page, pageSize }) {
            const [linhas, [total]] = await Promise.all([
                executor
                    .select({
                        id: user.id,
                        nome: user.name,
                        email: user.email,
                        role: user.role,
                        criadoEm: user.createdAt
                    })
                    .from(user)
                    .orderBy(desc(user.createdAt))
                    .limit(pageSize)
                    .offset((page - 1) * pageSize),
                executor.select({ total: count() }).from(user)
            ])

            return {
                rows: linhas.map((l) => ({ ...l, criadoEm: l.criadoEm.toISOString() })) as LinhaUsuario[],
                totalCount: total?.total ?? 0
            }
        },

        async atualizarNomeERole(userId, { nome, role }) {
            await executor.update(user).set({ name: nome, role }).where(eq(user.id, userId))
        },

        async atualizarRole(userId, role) {
            await executor.update(user).set({ role }).where(eq(user.id, userId))
        },

        async buscarRole(userId) {
            const [linha] = await executor.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1)
            return (linha?.role as Role) ?? null
        }
    }
}
