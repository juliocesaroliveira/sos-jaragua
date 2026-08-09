import { relations } from 'drizzle-orm'
import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from './identidade'

/** Módulo Notificações (DB_SCHEMA.md §8). */

/** Catálogo 1:1 com a matriz de comunicação do BRD §6. */
export const tipoNotificacaoEnum = pgEnum('tipo_notificacao', [
    'triagem_concluida',
    'atividade_atribuida',
    'alteracao_atividade',
    'lembrete_turno',
    'broadcast_urgencia',
    'cadastros_acumulados',
    'estoque_critico',
    'deficit_atendimento'
])

/** Sem push real no MVP (decisão confirmada, DESIGN.md §12). */
export const canalEnvioEnum = pgEnum('canal_envio', ['email', 'plataforma'])
export const statusEnvioEnum = pgEnum('status_envio', ['pendente', 'enviado', 'falhou'])

export const notificacao = pgTable(
    'notificacao',
    {
        id: uuid().primaryKey().defaultRandom(),
        destinatarioUserId: text()
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        tipo: tipoNotificacaoEnum().notNull(),
        titulo: text().notNull(),
        mensagem: text().notNull(),
        lida: boolean().notNull().default(false),
        /** Payload adicional (ex.: id da atividade/turno referenciado). */
        contexto: jsonb().$type<Record<string, unknown>>(),
        criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow()
    },
    (t) => [
        // Contador de não-lidas do sino in-app (DB_SCHEMA.md §12)
        index('notificacao_destinatario_lida_idx').on(t.destinatarioUserId, t.lida),
        // Dedupe idempotente dos alertas de coordenador (DESIGN.md §12)
        index('notificacao_tipo_criado_idx').on(t.tipo, t.criadoEm)
    ]
)

/**
 * Separado de `notificacao` para que uma falha de entrega em um canal (bounce
 * de e-mail) não corrompa o estado lido/não-lido in-app.
 */
export const notificacaoEnvio = pgTable(
    'notificacao_envio',
    {
        id: uuid().primaryKey().defaultRandom(),
        notificacaoId: uuid()
            .notNull()
            .references(() => notificacao.id, { onDelete: 'cascade' }),
        canal: canalEnvioEnum().notNull(),
        status: statusEnvioEnum().notNull().default('pendente'),
        enviadoEm: timestamp({ withTimezone: true }),
        erro: text()
    },
    (t) => [index('notificacao_envio_notificacao_idx').on(t.notificacaoId)]
)

export const notificacaoRelations = relations(notificacao, ({ one, many }) => ({
    destinatario: one(user, { fields: [notificacao.destinatarioUserId], references: [user.id] }),
    envios: many(notificacaoEnvio)
}))

export const notificacaoEnvioRelations = relations(notificacaoEnvio, ({ one }) => ({
    notificacao: one(notificacao, { fields: [notificacaoEnvio.notificacaoId], references: [notificacao.id] })
}))
