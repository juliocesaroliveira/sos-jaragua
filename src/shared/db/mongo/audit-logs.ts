import 'server-only'
import type { Collection, Db } from 'mongodb'
import { clienteMongo } from './client'

/**
 * Acessor da coleção `audit_logs` (DB_SCHEMA.md §9, BR-AUD-01).
 *
 * É a **única** coleção do Mongo neste projeto: o Mongo não é fonte de verdade
 * de nenhuma entidade de negócio, só a trilha de auditoria. Nada aqui é lido
 * para reconstruir estado da aplicação.
 */
/**
 * Ações registradas na trilha.
 *
 * `read` e `anonimizar` entraram com a feature 025 (Princípio V da
 * Constituição): uma **revelação** de dado sensível é uma leitura, e uma
 * **anonimização** a pedido do titular não é nenhuma das três ações de escrita.
 * Sem esse vocabulário, FR-017 e FR-024 não teriam como ser registrados.
 */
export type AcaoAuditada = 'create' | 'update' | 'delete' | 'read' | 'anonimizar'

/**
 * Entidades do BRD §7. São abstratas de propósito — o mapeamento para as
 * tabelas concretas está em DB_SCHEMA.md §10:
 * - `Voluntario` → `voluntario_perfil`
 * - `Atividade`  → `atividade`, `turno`, `alocacao`
 * - `Doacao`     → `entrada`, `saida`/`saida_item`, `descarte`, `kit`/`kit_receita_item`
 * - `Usuario`    → `user` (006-user-management-page: cadastro/edição de conta e papel)
 * - `Habilidade` → `habilidade` (017-gestao-habilidades: cadastro/edição/exclusão)
 * - `ManutencaoDados` → qualquer tabela (026-danger-zone-admin): resets e
 *   exclusões em massa da Danger Zone, com um documento por linha atingida
 */
export const ENTIDADES_AUDITADAS = [
    'Voluntario',
    'Atividade',
    'Doacao',
    'Usuario',
    'Habilidade',
    'ManutencaoDados'
] as const
export type EntidadeAuditada = (typeof ENTIDADES_AUDITADAS)[number]

/**
 * Fases de uma execução da Danger Zone (026, research D8). A trilha é
 * append-only: o estado de uma execução é o evento mais recente do seu `id`,
 * nunca um documento atualizado.
 */
export const FASES_EXECUCAO = ['iniciada', 'snapshot', 'concluida', 'falhou', 'recusada', 'cancelada'] as const
export type FaseExecucao = (typeof FASES_EXECUCAO)[number]

/**
 * Campo `manutencao` dos documentos da Danger Zone. Não se chama `execucao`
 * porque os testes de integração da trilha já usam esse nome como etiqueta de
 * limpeza dos próprios documentos.
 */
export type ExecucaoAuditada = {
    execucaoId: string
    fase: FaseExecucao
    /** Só nos eventos (não nos snapshots) — data-model §3. */
    resumo?: Record<string, unknown>
}

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
    /** Presente só nos documentos da Danger Zone (026-danger-zone-admin). */
    manutencao?: ExecucaoAuditada
}

export const NOME_COLECAO = 'audit_logs'

function banco(): Db {
    return clienteMongo().db()
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
        { key: { timestamp: -1 }, name: 'timestamp' },
        // Eventos e snapshots de uma execução da Danger Zone (026, data-model §3).
        // Parcial: os demais documentos não carregam `manutencao`.
        {
            key: { 'manutencao.execucaoId': 1, timestamp: 1 },
            name: 'manutencao_execucao_timestamp',
            partialFilterExpression: { 'manutencao.execucaoId': { $exists: true } }
        }
    ])
}
