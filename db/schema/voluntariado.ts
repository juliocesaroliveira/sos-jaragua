import { relations, sql } from 'drizzle-orm'
import { boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { user } from './identidade'

/**
 * Módulos Identidade (perfil/habilidades — DB_SCHEMA.md §4.2/§4.3) e
 * Voluntariado (atividades/turnos/alocação — DB_SCHEMA.md §5).
 *
 * Ficam no mesmo arquivo físico porque `voluntario_perfil` é a fronteira entre
 * os dois contextos: é a extensão 1:1 de `user` e, ao mesmo tempo, a entidade
 * referenciada por `alocacao`.
 */

// -- Enums --------------------------------------------------------------------

export const tipoVeiculoEnum = pgEnum('tipo_veiculo', ['carro', 'caminhonete', 'moto', 'barco'])
export const disponibilidadeEnum = pgEnum('disponibilidade', ['integral', 'manha', 'tarde', 'noite', 'fim_de_semana'])
export const statusVoluntarioEnum = pgEnum('status_voluntario', ['pendente', 'aprovado', 'rejeitado'])
export const statusAtividadeEnum = pgEnum('status_atividade', ['aberta', 'encerrada', 'cancelada'])
export const statusAlocacaoEnum = pgEnum('status_alocacao', ['confirmado', 'cancelado'])

// -- Tabelas lookup livres (DB_SCHEMA.md §4.3, §5.1) --------------------------

export const habilidade = pgTable(
    'habilidade',
    {
        id: uuid().primaryKey().defaultRandom(),
        nome: text().notNull(),
        criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow()
    },
    (t) => [
        // Único **ignorando caixa**, não o `unique()` simples de antes: com ele,
        // "Motosserra" e "motosserra" coexistiam. A checagem na aplicação sozinha
        // perde a corrida entre duas criações simultâneas — só o índice fecha
        // essa janela (017-gestao-habilidades, research.md D3 / INV-01).
        uniqueIndex('habilidade_nome_lower_idx').on(sql`lower(${t.nome})`)
    ]
)

export const atividadeCategoria = pgTable('atividade_categoria', {
    id: uuid().primaryKey().defaultRandom(),
    nome: text().notNull().unique(),
    criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow()
})

// -- Perfil de voluntário (DB_SCHEMA.md §4.2) ---------------------------------

export const voluntarioPerfil = pgTable(
    'voluntario_perfil',
    {
        id: uuid().primaryKey().defaultRandom(),
        userId: text()
            .notNull()
            .unique()
            .references(() => user.id, { onDelete: 'cascade' }),
        nomeCompleto: text().notNull(),
        dataNascimento: date().notNull(),
        // Maioridade e dígito verificador são validados no `domain`, não no banco
        // (DESIGN.md §10.1) — mensagens de erro específicas em pt-BR.
        cpf: text().notNull(),
        telefone: text().notNull(),
        cep: text().notNull(),
        bairro: text().notNull(),
        profissao: text().notNull(),
        restricoesSaude: text(),
        veiculoProprio: boolean().notNull(),
        tipoVeiculo: tipoVeiculoEnum(),
        disponibilidade: disponibilidadeEnum().array().notNull(),
        status: statusVoluntarioEnum().notNull().default('pendente'),
        aprovadoPor: text().references(() => user.id, { onDelete: 'set null' }),
        aprovadoEm: timestamp({ withTimezone: true }),
        motivoRejeicao: text(),
        criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
        atualizadoEm: timestamp({ withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date())
    },
    (t) => [
        // CPF único: um documento por voluntário; também é a chave de
        // reaproveitamento da linha no reenvio de candidatura (BR-VOL-01).
        uniqueIndex('voluntario_perfil_cpf_idx').on(t.cpf),
        // Fila de Cadastros Pendentes (DB_SCHEMA.md §12)
        index('voluntario_perfil_status_idx').on(t.status)
    ]
)

export const voluntarioHabilidade = pgTable(
    'voluntario_habilidade',
    {
        id: uuid().primaryKey().defaultRandom(),
        voluntarioPerfilId: uuid()
            .notNull()
            .references(() => voluntarioPerfil.id, { onDelete: 'cascade' }),
        /**
         * `restrict`, não `cascade`: excluir uma habilidade apagava em silêncio
         * a declaração de todos os voluntários que a possuíam. A regra "não
         * excluir habilidade vinculada" é do negócio (017, FR-012) e precisa
         * valer para **qualquer** caminho de escrita, não só o caso de uso —
         * daí morar no banco (research.md D4 / INV-04).
         */
        habilidadeId: uuid()
            .notNull()
            .references(() => habilidade.id, { onDelete: 'restrict' })
    },
    (t) => [
        uniqueIndex('voluntario_habilidade_unico_idx').on(t.voluntarioPerfilId, t.habilidadeId),
        // Filtro "voluntários com a habilidade X" na tela de alocação (BR-VOL-05)
        index('voluntario_habilidade_habilidade_idx').on(t.habilidadeId)
    ]
)

// -- Atividades, turnos e alocação (DB_SCHEMA.md §5) --------------------------

export const atividade = pgTable(
    'atividade',
    {
        id: uuid().primaryKey().defaultRandom(),
        titulo: text().notNull(),
        categoriaId: uuid()
            .notNull()
            .references(() => atividadeCategoria.id),
        local: text().notNull(),
        status: statusAtividadeEnum().notNull().default('aberta'),
        criadoPor: text()
            .notNull()
            .references(() => user.id),
        criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
        atualizadoEm: timestamp({ withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date())
    },
    (t) => [index('atividade_status_idx').on(t.status)]
)

export const turno = pgTable(
    'turno',
    {
        id: uuid().primaryKey().defaultRandom(),
        atividadeId: uuid()
            .notNull()
            .references(() => atividade.id, { onDelete: 'cascade' }),
        // Bloco de 4h validado no `domain`, não via CHECK (BR-VOL-04,
        // DESIGN.md §10.2) — permite mensagem específica e flexibilização
        // futura sem migration.
        inicio: timestamp({ withTimezone: true }).notNull(),
        fim: timestamp({ withTimezone: true }).notNull(),
        vagas: integer().notNull(),
        criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow()
    },
    (t) => [
        index('turno_atividade_idx').on(t.atividadeId),
        // Janela de 105–120 min usada pelo cron de lembrete (DESIGN.md §12)
        index('turno_inicio_idx').on(t.inicio)
    ]
)

export const alocacao = pgTable(
    'alocacao',
    {
        id: uuid().primaryKey().defaultRandom(),
        turnoId: uuid()
            .notNull()
            .references(() => turno.id, { onDelete: 'cascade' }),
        voluntarioPerfilId: uuid()
            .notNull()
            .references(() => voluntarioPerfil.id, { onDelete: 'cascade' }),
        status: statusAlocacaoEnum().notNull().default('confirmado'),
        alocadoPor: text()
            .notNull()
            .references(() => user.id),
        lembreteEnviadoEm: timestamp({ withTimezone: true }),
        criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow()
    },
    (t) => [
        uniqueIndex('alocacao_turno_voluntario_idx').on(t.turnoId, t.voluntarioPerfilId),
        index('alocacao_voluntario_idx').on(t.voluntarioPerfilId)
    ]
)

// -- Relations (usadas pelas queries relacionais do Drizzle) ------------------

export const voluntarioPerfilRelations = relations(voluntarioPerfil, ({ one, many }) => ({
    usuario: one(user, { fields: [voluntarioPerfil.userId], references: [user.id] }),
    habilidades: many(voluntarioHabilidade),
    alocacoes: many(alocacao)
}))

export const voluntarioHabilidadeRelations = relations(voluntarioHabilidade, ({ one }) => ({
    perfil: one(voluntarioPerfil, {
        fields: [voluntarioHabilidade.voluntarioPerfilId],
        references: [voluntarioPerfil.id]
    }),
    habilidade: one(habilidade, { fields: [voluntarioHabilidade.habilidadeId], references: [habilidade.id] })
}))

export const atividadeRelations = relations(atividade, ({ one, many }) => ({
    categoria: one(atividadeCategoria, { fields: [atividade.categoriaId], references: [atividadeCategoria.id] }),
    turnos: many(turno)
}))

export const turnoRelations = relations(turno, ({ one, many }) => ({
    atividade: one(atividade, { fields: [turno.atividadeId], references: [atividade.id] }),
    alocacoes: many(alocacao)
}))

export const alocacaoRelations = relations(alocacao, ({ one }) => ({
    turno: one(turno, { fields: [alocacao.turnoId], references: [turno.id] }),
    perfil: one(voluntarioPerfil, { fields: [alocacao.voluntarioPerfilId], references: [voluntarioPerfil.id] })
}))
