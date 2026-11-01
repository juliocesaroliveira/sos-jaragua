import { relations, sql } from 'drizzle-orm'
import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
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
/** Quem criou a alocação: a gestão pelo painel ou o próprio participante (018-inscricao-atividades). */
export const origemAlocacaoEnum = pgEnum('origem_alocacao', ['gestao', 'inscricao_propria'])

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

/**
 * Perfil de voluntário.
 *
 * **Os campos pessoais são nuláveis** (feature 024, FR-022): a eliminação a
 * pedido do titular os esvazia e marca `anonimizadoEm`, mantendo a linha. Apagar
 * a linha não é opção — as FKs de `alocacao`, `atividade` e estoque fariam o
 * `DELETE` falhar para quem tem histórico operacional ou destruiriam o histórico
 * de turnos por cascade (research.md D7). Nulo aqui significa "titular
 * anonimizado", nunca "cadastro incompleto": a candidatura valida os campos como
 * obrigatórios no `domain`.
 */
export const voluntarioPerfil = pgTable(
    'voluntario_perfil',
    {
        id: uuid().primaryKey().defaultRandom(),
        userId: text()
            .notNull()
            .unique()
            .references(() => user.id, { onDelete: 'cascade' }),
        nomeCompleto: text(),
        /**
         * **Protegida** (feature 024, FR-001): guarda o envelope `v1.<iv>.<ct>.<tag>`,
         * não a data civil. `text` e não `date` porque o valor armazenado é
         * ciphertext; o domínio continua operando sobre `'YYYY-MM-DD'`, que é o
         * que a cripto recebe e devolve (research.md D6).
         */
        dataNascimento: text(),
        // Maioridade e dígito verificador são validados no `domain`, não no banco
        // (DESIGN.md §10.1) — mensagens de erro específicas em pt-BR.
        /** **Protegido** (FR-001): envelope, não o CPF. Busca e unicidade vão por `cpfIndice`. */
        cpf: text(),
        /**
         * Índice cego do CPF — `HMAC-SHA256(subchave, cpf)` em base64url
         * (research.md D2).
         *
         * Existe porque a cifra é aleatorizada: o mesmo CPF gera ciphertexts
         * diferentes, então nem índice único nem `buscarPorCpf` funcionariam sobre
         * `cpf`. O HMAC **com chave** é o ponto: um hash simples de 11 dígitos cai
         * por força bruta em segundos.
         *
         * Nulável porque a anonimização a pedido do titular o esvazia (FR-022) — e
         * o índice único do Postgres admite múltiplos nulos, então vários titulares
         * anonimizados coexistem sem colidir.
         */
        cpfIndice: text(),
        telefone: text(),
        /** **Protegido** (FR-001): envelope, não o CEP. */
        cep: text(),
        bairro: text(),
        profissao: text(),
        restricoesSaude: text(),
        veiculoProprio: boolean().notNull(),
        tipoVeiculo: tipoVeiculoEnum(),
        disponibilidade: disponibilidadeEnum().array().notNull(),
        status: statusVoluntarioEnum().notNull().default('pendente'),
        aprovadoPor: text().references(() => user.id, { onDelete: 'set null' }),
        aprovadoEm: timestamp({ withTimezone: true }),
        motivoRejeicao: text(),
        /**
         * Marca o titular que pediu a eliminação dos próprios dados (FR-022).
         *
         * A linha **permanece** e é sobrescrita, nunca apagada: as FKs de
         * `alocacao`, `atividade` e estoque fariam um `DELETE` falhar para quem tem
         * histórico operacional ou destruir o histórico de turnos (research.md D7).
         * É este campo que a apresentação consulta para renderizar "titular anônimo".
         */
        anonimizadoEm: timestamp({ withTimezone: true }),
        criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
        atualizadoEm: timestamp({ withTimezone: true })
            .notNull()
            .defaultNow()
            .$onUpdate(() => new Date())
    },
    (t) => [
        // CPF único: um documento por voluntário; também é a chave de
        // reaproveitamento da linha no reenvio de candidatura (BR-VOL-01).
        //
        // O índice migrou de `cpf` para `cpfIndice` com a feature 024: com a cifra
        // aleatorizada, um índice sobre `cpf` não detectaria duplicata alguma.
        uniqueIndex('voluntario_perfil_cpf_indice_idx').on(t.cpfIndice),
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
        /**
         * Identidade do participante (018-inscricao-atividades, research D1).
         * É `user` e não `voluntario_perfil` porque a equipe interna se
         * inscreve mesmo sem cadastro de voluntário.
         */
        participanteUserId: text()
            .notNull()
            .references(() => user.id, { onDelete: 'cascade' }),
        /** Preenchido quando o participante tem perfil de voluntário. */
        voluntarioPerfilId: uuid().references(() => voluntarioPerfil.id, { onDelete: 'cascade' }),
        status: statusAlocacaoEnum().notNull().default('confirmado'),
        origem: origemAlocacaoEnum().notNull().default('gestao'),
        alocadoPor: text()
            .notNull()
            .references(() => user.id),
        lembreteEnviadoEm: timestamp({ withTimezone: true }),
        criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow()
    },
    (t) => [
        // Uma linha por pessoa por turno — inclusive quem é staff e também tem
        // perfil de voluntário (research D1).
        uniqueIndex('alocacao_turno_participante_idx').on(t.turnoId, t.participanteUserId),
        index('alocacao_voluntario_idx').on(t.voluntarioPerfilId),
        index('alocacao_participante_idx').on(t.participanteUserId)
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
    participante: one(user, { fields: [alocacao.participanteUserId], references: [user.id] }),
    perfil: one(voluntarioPerfil, { fields: [alocacao.voluntarioPerfilId], references: [voluntarioPerfil.id] })
}))
