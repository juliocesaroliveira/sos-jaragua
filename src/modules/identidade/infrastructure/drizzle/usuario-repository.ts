import { and, count, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { db, type Transacao } from '@/src/shared/db/postgres'
import { account, user } from '@/db/schema/identidade'
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

/**
 * Provedor de credencial do better-auth para contas com senha própria — as
 * criadas manualmente em `/admin`. Contas sociais gravam `google`/`facebook`
 * (008-admin-password-reset, D2).
 */
const PROVEDOR_SENHA = 'credential'

/**
 * Subconsulta correlacionada em vez de uma consulta por linha: a listagem de
 * `/admin` já é paginada e um N+1 aqui apareceria justamente na tela de
 * administração durante uma crise. Mesmo padrão de `HABILIDADES_DO_PERFIL`
 * em `voluntariado`.
 */
const POSSUI_SENHA_PROPRIA = sql<boolean>`exists (
    select 1 from "account"
    where "account"."user_id" = "user"."id"
      and "account"."provider_id" = ${PROVEDOR_SENHA}
      and "account"."password" is not null
)`

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
                        criadoEm: user.createdAt,
                        podeTrocarSenha: POSSUI_SENHA_PROPRIA
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

        async possuiSenhaPropria(userId) {
            const [linha] = await executor
                .select({ id: account.id })
                .from(account)
                .where(
                    and(eq(account.userId, userId), eq(account.providerId, PROVEDOR_SENHA), isNotNull(account.password))
                )
                .limit(1)

            return linha !== undefined
        },

        async buscarRole(userId) {
            const [linha] = await executor.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1)
            return (linha?.role as Role) ?? null
        },

        async definirDataNascimentoSeAusente(userId, data) {
            // `isNull` no WHERE, e não um `select` antes: é o que torna a
            // escrita idempotente e imune a corrida entre dois envios
            // simultâneos, sem precisar de lock explícito.
            await executor
                .update(user)
                .set({ dataNascimento: data })
                .where(and(eq(user.id, userId), isNull(user.dataNascimento)))
        },

        async buscarDataNascimento(userId) {
            const [linha] = await executor
                .select({ dataNascimento: user.dataNascimento })
                .from(user)
                .where(eq(user.id, userId))
                .limit(1)

            return linha?.dataNascimento ?? null
        }
    }
}
