import 'server-only'
import type { Collection, Db } from 'mongodb'
import cliente from './client'

/**
 * Acessor da coleção `audit_logs` (DB_SCHEMA.md §9, BR-AUD-01).
 *
 * É a **única** coleção do Mongo neste projeto: o Mongo não é fonte de verdade
 * de nenhuma entidade de negócio, só a trilha de auditoria. Nada aqui é lido
 * para reconstruir estado da aplicação.
 */
export type AcaoAuditada = 'create' | 'update' | 'delete'

/**
 * Entidades do BRD §7. São abstratas de propósito — o mapeamento para as
 * tabelas concretas está em DB_SCHEMA.md §10:
 * - `Voluntario` → `voluntario_perfil`
 * - `Atividade`  → `atividade`, `turno`, `alocacao`
 * - `Doacao`     → `entrada`, `saida`/`saida_item`, `descarte`, `kit`/`kit_receita_item`
 * - `Usuario`    → `user` (006-user-management-page: cadastro/edição de conta e papel)
 */
export const ENTIDADES_AUDITADAS = ['Voluntario', 'Atividade', 'Doacao', 'Usuario'] as const
export type EntidadeAuditada = (typeof ENTIDADES_AUDITADAS)[number]

export type RegistroAuditoria = {
    timestamp: Date
    entidade: EntidadeAuditada
    /** UUID da linha Postgres afetada. */
    entidadeId: string
    acao: AcaoAuditada
    userId: string
    /** Role no momento da ação — denormalizada, porque roles mudam com o tempo. */
    userRole: string
    /** Tabela concreta afetada — o BRD trabalha com entidades abstratas. */
    tabela?: string
    dadosAnteriores: Record<string, unknown> | null
    dadosNovos: Record<string, unknown> | null
    metadata?: { ip?: string; userAgent?: string }
}

export const NOME_COLECAO = 'audit_logs'

function banco(): Db {
    return cliente.db()
}

export function colecaoAuditoria(): Collection<RegistroAuditoria> {
    return banco().collection<RegistroAuditoria>(NOME_COLECAO)
}

/**
 * Cria os índices de DB_SCHEMA.md §9. Idempotente — `createIndexes` ignora
 * índices já existentes com a mesma definição.
 *
 * Chamado pelo script `npm run mongo:setup`, não em tempo de requisição:
 * garantir índice a cada escrita custaria uma ida ao servidor por operação.
 */
export async function garantirIndicesAuditoria(): Promise<string[]> {
    return colecaoAuditoria().createIndexes([
        // Histórico de uma entidade específica — o acesso mais comum.
        { key: { entidade: 1, entidadeId: 1, timestamp: -1 }, name: 'entidade_entidadeId_timestamp' },
        // Tudo que um ator fez — prestação de contas por pessoa.
        { key: { userId: 1, timestamp: -1 }, name: 'userId_timestamp' },
        // Varredura cronológica geral, alimenta BR-REL-01.
        { key: { timestamp: -1 }, name: 'timestamp' }
    ])
}
