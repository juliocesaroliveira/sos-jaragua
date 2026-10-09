import 'server-only'
import type { Collection, Filter, WithId } from 'mongodb'
import {
    colecaoAuditoria,
    type AcaoAuditada,
    type EntidadeAuditada,
    type RegistroAuditoria
} from '@/src/shared/db/mongo/audit-logs'

/**
 * Leitor da trilha de auditoria (specs/023-central-relatorios, US4,
 * research D9).
 *
 * **Somente leitura** (FR-022, BR-AUD-01): só `find` e `countDocuments`. Não
 * existe — e não deve existir — `update`/`delete` aqui; a imutabilidade da
 * trilha depende de nenhum caminho de código oferecê-los.
 *
 * **Falha rápida e tipada** (FR-023): com o Mongo fora do ar, o driver
 * esperaria a seleção de servidor por 30 s (padrão do cliente compartilhado —
 * que não é alterado aqui, para não mexer na política de escrita do
 * `audit-writer`). A leitura corre contra um tempo-limite próprio e vira
 * `AuditoriaIndisponivelError`; só a tela da trilha mostra o erro.
 *
 * A coleção é injetável para o teste de integração usar `audit_logs_teste`:
 * a coleção real não aceita `delete` do usuário da aplicação (DB_SCHEMA.md §9),
 * então um teste que gravasse nela sujaria a trilha para sempre.
 */

export class AuditoriaIndisponivelError extends Error {
    constructor(causa?: unknown) {
        super('Base de auditoria indisponível.', { cause: causa })
        this.name = 'AuditoriaIndisponivelError'
    }
}

export type FiltrosTrilha = {
    intervalo: { inicio: Date; fimExclusivo: Date }
    entidade?: EntidadeAuditada
    acao?: AcaoAuditada
    userId?: string
}

export type RegistroTrilha = Omit<RegistroAuditoria, 'metadata'> & { id: string }

type Opcoes = {
    /** Tempo total de cada leitura, incluindo achar o servidor. */
    tempoLimiteMs?: number
}

const TEMPO_LIMITE_PADRAO_MS = 8_000

export function criarLeitorAuditoria(
    colecao: () => Collection<RegistroAuditoria> = colecaoAuditoria,
    { tempoLimiteMs = TEMPO_LIMITE_PADRAO_MS }: Opcoes = {}
) {
    function filtro(f: FiltrosTrilha): Filter<RegistroAuditoria> {
        return {
            timestamp: { $gte: f.intervalo.inicio, $lt: f.intervalo.fimExclusivo },
            ...(f.entidade ? { entidade: f.entidade } : {}),
            ...(f.acao ? { acao: f.acao } : {}),
            ...(f.userId ? { userId: f.userId } : {})
        }
    }

    async function comTempoLimite<T>(operacao: () => Promise<T>): Promise<T> {
        let temporizador: ReturnType<typeof setTimeout> | undefined
        const esgotado = new Promise<never>((_, rejeitar) => {
            temporizador = setTimeout(() => rejeitar(new AuditoriaIndisponivelError('tempo esgotado')), tempoLimiteMs)
        })
        try {
            return await Promise.race([operacao(), esgotado])
        } catch (erro) {
            throw erro instanceof AuditoriaIndisponivelError ? erro : new AuditoriaIndisponivelError(erro)
        } finally {
            clearTimeout(temporizador)
        }
    }

    return {
        /**
         * Da mais recente para a mais antiga; desempate por `_id` para a
         * paginação não repetir nem pular registros do mesmo instante.
         */
        listar(filtros: FiltrosTrilha, janela: { limite: number; deslocamento: number }): Promise<RegistroTrilha[]> {
            return comTempoLimite(async () => {
                const documentos = await colecao()
                    .find(filtro(filtros), { projection: { metadata: 0 }, maxTimeMS: tempoLimiteMs })
                    .sort({ timestamp: -1, _id: -1 })
                    .skip(janela.deslocamento)
                    .limit(janela.limite)
                    .toArray()
                return documentos.map(paraRegistro)
            })
        },

        contar(filtros: FiltrosTrilha): Promise<number> {
            return comTempoLimite(() => colecao().countDocuments(filtro(filtros), { maxTimeMS: tempoLimiteMs }))
        }
    }
}

/** `metadata` (IP, user agent) já vem fora pela projeção: não entra no relatório. */
function paraRegistro({ _id, ...resto }: WithId<RegistroAuditoria>): RegistroTrilha {
    return { id: _id.toHexString(), ...resto }
}
