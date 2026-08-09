import { relations } from 'drizzle-orm'
import { boolean, index, pgEnum, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * Módulo Identidade (DB_SCHEMA.md §4).
 *
 * As quatro tabelas core (`user`, `session`, `account`, `verification`) seguem o
 * contrato do adapter Drizzle do better-auth, aumentadas com os
 * `additionalFields` de DESIGN.md §6.1 (`user.role`, `user.ativo`,
 * `session.lastActivityAt`). Alterar nomes/tipos das colunas core quebra o
 * adapter — mudanças aqui devem ser conferidas com
 * `npx @better-auth/cli generate`.
 */

/**
 * Valores replicados de `src/shared/auth/roles.ts` de propósito: este arquivo
 * também é carregado por scripts que rodam fora do bundler do Next (seed,
 * drizzle-kit), onde o alias `@/` não resolve. `roles.ts` mantém uma checagem
 * de tipo que quebra a compilação se as duas listas divergirem.
 */
export const ROLES_DB = ['usuario', 'voluntario', 'membro_defesa_civil', 'coordenador', 'administrador'] as const

export const roleEnum = pgEnum('role', ROLES_DB)

export const user = pgTable(
    'user',
    {
        id: text().primaryKey(),
        name: text().notNull(),
        email: text().notNull().unique(),
        emailVerified: boolean().notNull().default(false),
        image: text(),
        // additionalFields (DESIGN.md §6.1)
        role: roleEnum().notNull().default('usuario'),
        ativo: boolean().notNull().default(true),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp({ withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date())
    },
    (t) => [index('user_role_idx').on(t.role)]
)

export const session = pgTable(
    'session',
    {
        id: text().primaryKey(),
        expiresAt: timestamp({ withTimezone: true }).notNull(),
        token: text().notNull().unique(),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp({ withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date()),
        ipAddress: text(),
        userAgent: text(),
        userId: text()
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        // additionalField — base do timeout de inatividade (DESIGN.md §6.3)
        lastActivityAt: timestamp({ withTimezone: true })
    },
    (t) => [index('session_user_id_idx').on(t.userId)]
)

export const account = pgTable(
    'account',
    {
        id: text().primaryKey(),
        accountId: text().notNull(),
        providerId: text().notNull(),
        userId: text()
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        accessToken: text(),
        refreshToken: text(),
        idToken: text(),
        accessTokenExpiresAt: timestamp({ withTimezone: true }),
        refreshTokenExpiresAt: timestamp({ withTimezone: true }),
        scope: text(),
        password: text(),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp({ withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date())
    },
    (t) => [
        index('account_user_id_idx').on(t.userId),
        uniqueIndex('account_provider_account_idx').on(t.providerId, t.accountId)
    ]
)

export const verification = pgTable(
    'verification',
    {
        id: text().primaryKey(),
        identifier: text().notNull(),
        value: text().notNull(),
        expiresAt: timestamp({ withTimezone: true }).notNull(),
        createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp({ withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date())
    },
    (t) => [index('verification_identifier_idx').on(t.identifier)]
)

// -- Relations ----------------------------------------------------------------

export const userRelations = relations(user, ({ many }) => ({
    sessoes: many(session),
    contas: many(account)
}))

export const sessionRelations = relations(session, ({ one }) => ({
    usuario: one(user, { fields: [session.userId], references: [user.id] })
}))

export const accountRelations = relations(account, ({ one }) => ({
    usuario: one(user, { fields: [account.userId], references: [user.id] })
}))
