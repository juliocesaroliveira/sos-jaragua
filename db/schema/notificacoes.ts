import { relations, sql } from 'drizzle-orm'
import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
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
    'deficit_atendimento',
    // 018-inscricao-atividades: aviso à gestão de inscrição/desistência própria (só plataforma)
    'inscricao_turno'
])

/**
 * Sem push do navegador (decisão confirmada, DESIGN.md §12). `whatsapp` desde a
 * 024-notificacoes-whatsapp.
 */
export const canalEnvioEnum = pgEnum('canal_envio', ['email', 'plataforma', 'whatsapp'])

/**
 * `entregue`/`lido` vêm do webhook da Meta; `nao_enviado` é a decisão do próprio
 * sistema de não enviar (sem opt-in, sem celular, canal não configurado), que
 * não pode aparecer como falha técnica no relatório (024, US3).
 */
export const statusEnvioEnum = pgEnum('status_envio', [
    'pendente',
    'enviado',
    'falhou',
    'entregue',
    'lido',
    'nao_enviado'
])

/** Por que um envio de WhatsApp não chegou (024, data-model.md §1). */
export const motivoNaoEntregaEnum = pgEnum('motivo_nao_entrega', [
    'canal_desativado',
    'sem_celular',
    'usuario_inativo',
    'nao_configurado',
    'numero_sem_whatsapp',
    'limite_envio',
    'modelo_indisponivel',
    'falha'
])

export const acaoConsentimentoEnum = pgEnum('acao_consentimento', ['concedido', 'revogado'])
export const origemConsentimentoEnum = pgEnum('origem_consentimento', ['cadastro', 'perfil', 'resposta_whatsapp'])

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
        index('notificacao_tipo_criado_idx').on(t.tipo, t.criadoEm),
        // Relatório de envio de notificações por período (023, research D12):
        // o índice acima começa por `tipo`, e o broadcast faz a tabela crescer
        // rápido numa crise.
        index('notificacao_criado_idx').on(t.criadoEm)
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
        erro: text(),
        // Colunas do canal `whatsapp` (024, data-model.md §2)
        motivo: motivoNaoEntregaEnum(),
        /** Número E.164 sem `+` usado no envio. */
        destino: text(),
        /** `wamid` devolvido pela Meta — casa os webhooks de situação. */
        idExterno: text(),
        atualizadoEm: timestamp({ withTimezone: true })
    },
    (t) => [
        // Um registro por canal por notificação. Para o WhatsApp é o que impede
        // envio duplo quando o mesmo lote é processado de novo (024, FR-008):
        // a inserção usa `ON CONFLICT DO NOTHING` e só despacha o que entrou.
        //
        // Composto em vez de parcial (`WHERE canal = 'whatsapp'`): o literal do
        // enum não pode ser usado na mesma transação em que o valor foi criado,
        // e o cast `canal::text` não é IMMUTABLE, o que o Postgres exige no
        // predicado de um índice. Substitui `notificacao_envio_notificacao_idx`,
        // que tinha a mesma coluna à esquerda (research D4b).
        uniqueIndex('notificacao_envio_notificacao_canal_unico').on(t.notificacaoId, t.canal),
        uniqueIndex('notificacao_envio_id_externo_idx')
            .on(t.idExterno)
            .where(sql`${t.idExterno} is not null`)
    ]
)

/**
 * Opt-in do WhatsApp (024). **Ausência de linha = desligado** — é o que deixa o
 * canal desligado para quem já estava cadastrado, sem migração de dados (FR-013).
 */
export const preferenciaWhatsapp = pgTable('preferencia_whatsapp', {
    userId: text()
        .primaryKey()
        .references(() => user.id, { onDelete: 'cascade' }),
    ativo: boolean().notNull(),
    atualizadoEm: timestamp({ withTimezone: true }).notNull().defaultNow()
})

/**
 * Histórico append-only de concessões e revogações (024, FR-011) — evidência de
 * consentimento para a LGPD. A aplicação nunca atualiza nem apaga linhas aqui.
 */
export const consentimentoWhatsapp = pgTable(
    'consentimento_whatsapp',
    {
        id: uuid().primaryKey().defaultRandom(),
        userId: text()
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        acao: acaoConsentimentoEnum().notNull(),
        origem: origemConsentimentoEnum().notNull(),
        /** Número E.164 vigente no momento da ação. */
        telefone: text(),
        criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow()
    },
    (t) => [index('consentimento_whatsapp_user_criado_idx').on(t.userId, t.criadoEm)]
)

/**
 * Limita a resposta automática a uma por número a cada 24h (024, research D15):
 * evita laço com outro robô e o custo de responder a cada figurinha.
 */
export const whatsappRespostaAutomatica = pgTable('whatsapp_resposta_automatica', {
    telefone: text().primaryKey(),
    ultimaEm: timestamp({ withTimezone: true }).notNull()
})

export const notificacaoRelations = relations(notificacao, ({ one, many }) => ({
    destinatario: one(user, { fields: [notificacao.destinatarioUserId], references: [user.id] }),
    envios: many(notificacaoEnvio)
}))

export const notificacaoEnvioRelations = relations(notificacaoEnvio, ({ one }) => ({
    notificacao: one(notificacao, { fields: [notificacaoEnvio.notificacaoId], references: [notificacao.id] })
}))

export const preferenciaWhatsappRelations = relations(preferenciaWhatsapp, ({ one }) => ({
    usuario: one(user, { fields: [preferenciaWhatsapp.userId], references: [user.id] })
}))

export const consentimentoWhatsappRelations = relations(consentimentoWhatsapp, ({ one }) => ({
    usuario: one(user, { fields: [consentimentoWhatsapp.userId], references: [user.id] })
}))
