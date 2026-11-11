import 'server-only'
import type { Collection } from 'mongodb'
import type { Ator } from '@/src/shared/contexto/ator'
import type { FaseExecucao, RegistroAuditoria } from '@/src/shared/db/mongo/audit-logs'
import { redigirCamposSensiveis } from '../redacao'
import { AuditoriaIndisponivelError } from './erros'

/**
 * Porta de auditoria **bloqueante** da Danger Zone (026-danger-zone-admin,
 * contracts/auditoria-manutencao.md, research D8).
 *
 * É a exceção restrita ao Princípio V decidida na clarificação (Q4): aqui a
 * falha **propaga**. `withAudit` continua sendo o caminho de toda escrita de
 * negócio, com degradação graciosa — nada daquele contrato muda.
 *
 * Diferenças deliberadas em relação a `registrarAuditoria`:
 * - nenhum retry silencioso nem `return false`: quem chama precisa saber;
 * - nada vai para `console.*` — o log de contingência de `registrarAuditoria`
 *   copia o registro inteiro, e aqui o registro é a linha apagada (AM-01).
 *
 * Append-only (AM-03): só `insertOne`/`insertMany`. O estado de uma execução é o
 * evento mais recente do seu `manutencao.execucaoId`.
 */

export type FaseEvento = Exclude<FaseExecucao, 'snapshot'>

export type EventoExecucao = {
    execucaoId: string
    fase: FaseEvento
    ator: Ator
    resumo: Record<string, unknown>
}

export type SnapshotLinha = {
    tabela: string
    /** Chave primária serializada; composta → `a|b`. */
    chave: string
    acao: 'delete' | 'update'
    antes: Record<string, unknown>
    /** Só a coluna redirecionada, em `update`. */
    depois: Record<string, unknown> | null
    /** Colunas de credencial do catálogo — removidas, não marcadas (research D9). */
    colunasOmitidas: readonly string[]
}

export interface RegistroExecucaoManutencao {
    verificarDisponibilidade(): Promise<void>
    registrarInicio(evento: EventoExecucao, snapshots: AsyncIterable<SnapshotLinha>): Promise<void>
    registrarDesfecho(evento: EventoExecucao): Promise<void>
}

const TAMANHO_LOTE = 500
const TEMPO_LIMITE_PING_MS = 5_000

type ColecaoEscrita = Pick<Collection<RegistroAuditoria>, 'insertOne' | 'insertMany'>

type Dependencias = {
    colecao?: () => ColecaoEscrita | Promise<ColecaoEscrita>
    ping?: () => Promise<void>
}

/*
 * Cliente e coleção carregados sob demanda: o índice do módulo reexporta esta
 * porta, e importar o cliente Mongo no topo exigiria `MONGODB_URI` de todo
 * consumidor do índice — inclusive dos testes unitários de `withAudit`.
 */
async function colecaoPadrao(): Promise<ColecaoEscrita> {
    const { colecaoAuditoria } = await import('@/src/shared/db/mongo/audit-logs')
    return colecaoAuditoria()
}

async function pingPadrao(): Promise<void> {
    const { clienteMongo } = await import('@/src/shared/db/mongo/client')
    let temporizador: ReturnType<typeof setTimeout> | undefined
    const esgotado = new Promise<never>((_, rejeitar) => {
        temporizador = setTimeout(() => rejeitar(new Error('tempo esgotado')), TEMPO_LIMITE_PING_MS)
    })
    try {
        await Promise.race([clienteMongo().db().command({ ping: 1 }), esgotado])
    } finally {
        clearTimeout(temporizador)
    }
}

function semColunas(linha: Record<string, unknown>, omitir: readonly string[]): Record<string, unknown> {
    if (omitir.length === 0) return linha
    return Object.fromEntries(Object.entries(linha).filter(([coluna]) => !omitir.includes(coluna)))
}

function documentoEvento(evento: EventoExecucao): RegistroAuditoria {
    return {
        timestamp: new Date(),
        entidade: 'ManutencaoDados',
        entidadeId: evento.execucaoId,
        acao: 'delete',
        userId: evento.ator.userId,
        userRole: evento.ator.role,
        tabela: typeof evento.resumo.tabela === 'string' ? evento.resumo.tabela : undefined,
        dadosAnteriores: null,
        dadosNovos: null,
        metadata:
            evento.ator.ip || evento.ator.userAgent
                ? { ip: evento.ator.ip, userAgent: evento.ator.userAgent }
                : undefined,
        manutencao: { execucaoId: evento.execucaoId, fase: evento.fase, resumo: evento.resumo }
    }
}

function documentoSnapshot(evento: EventoExecucao, linha: SnapshotLinha): RegistroAuditoria {
    return {
        timestamp: new Date(),
        entidade: 'ManutencaoDados',
        entidadeId: linha.chave,
        acao: linha.acao,
        userId: evento.ator.userId,
        userRole: evento.ator.role,
        tabela: linha.tabela,
        dadosAnteriores: redigirCamposSensiveis(semColunas(linha.antes, linha.colunasOmitidas)),
        dadosNovos: linha.depois ? redigirCamposSensiveis(semColunas(linha.depois, linha.colunasOmitidas)) : null,
        manutencao: { execucaoId: evento.execucaoId, fase: 'snapshot' }
    }
}

export function criarRegistroExecucaoManutencao({
    colecao = colecaoPadrao,
    ping = pingPadrao
}: Dependencias = {}): RegistroExecucaoManutencao {
    async function bloqueante<T>(operacao: () => Promise<T>): Promise<T> {
        try {
            return await operacao()
        } catch (erro) {
            // A causa fica no erro (para o log estruturado de quem chama), mas
            // sem o conteúdo de nenhuma linha.
            throw erro instanceof AuditoriaIndisponivelError ? erro : new AuditoriaIndisponivelError(erro)
        }
    }

    return {
        verificarDisponibilidade: () => bloqueante(ping),

        registrarInicio: (evento, snapshots) =>
            bloqueante(async () => {
                await (await colecao()).insertOne(documentoEvento(evento))
                let lote: RegistroAuditoria[] = []
                for await (const linha of snapshots) {
                    lote.push(documentoSnapshot(evento, linha))
                    if (lote.length === TAMANHO_LOTE) {
                        await (await colecao()).insertMany(lote, { ordered: true })
                        lote = []
                    }
                }
                if (lote.length > 0) await (await colecao()).insertMany(lote, { ordered: true })
            }),

        registrarDesfecho: (evento) =>
            bloqueante(async () => {
                await (await colecao()).insertOne(documentoEvento(evento))
            })
    }
}

// -- Leitura do histórico (AM-05, US3) ----------------------------------------

export type SituacaoExecucao = 'concluida' | 'falhou' | 'recusada' | 'cancelada' | 'desfecho_nao_confirmado'

export type ExecucaoManutencao = {
    execucaoId: string
    userId: string
    /** ISO 8601 — atravessa a fronteira de Server Action. */
    inicio: string
    situacao: SituacaoExecucao
    acao: string | null
    tabela: string | null
    modo: string | null
    motivo: string | null
    /** Reais quando concluída; previstas (impressão digital) nos demais casos. */
    contagens: Record<string, { apagar: number; redirecionar: Record<string, number> }>
}

const TEMPO_LIMITE_LEITURA_MS = 8_000

type ColecaoLeitura = Pick<Collection<RegistroAuditoria>, 'aggregate'>

type Agrupado = {
    _id: string
    inicio: Date
    userId: string
    ultimaFase: FaseExecucao
    resumoInicial?: Record<string, unknown>
    resumoFinal?: Record<string, unknown>
}

/**
 * Execuções da Danger Zone agrupadas por `manutencao.execucaoId`, mais recentes
 * primeiro. A situação é a **última fase** gravada — a trilha é append-only, e
 * uma execução com `iniciada` sem desfecho aparece como "desfecho não
 * confirmado" (research D8): o rastro existe, o resultado precisa ser conferido.
 *
 * Os snapshots ficam fora: o histórico lista ações, não linhas.
 */
async function colecaoLeituraPadrao(): Promise<ColecaoLeitura> {
    const { colecaoAuditoria } = await import('@/src/shared/db/mongo/audit-logs')
    return colecaoAuditoria()
}

export function criarLeitorExecucoesManutencao(
    colecao: () => ColecaoLeitura | Promise<ColecaoLeitura> = colecaoLeituraPadrao
) {
    const base = [
        { $match: { entidade: 'ManutencaoDados', 'manutencao.fase': { $ne: 'snapshot' } } },
        { $sort: { timestamp: 1 } },
        {
            $group: {
                _id: '$manutencao.execucaoId',
                inicio: { $first: '$timestamp' },
                userId: { $first: '$userId' },
                ultimaFase: { $last: '$manutencao.fase' },
                resumoInicial: { $first: '$manutencao.resumo' },
                resumoFinal: { $last: '$manutencao.resumo' }
            }
        }
    ]

    async function comTempoLimite<T>(operacao: () => Promise<T>): Promise<T> {
        let temporizador: ReturnType<typeof setTimeout> | undefined
        const esgotado = new Promise<never>((_, rejeitar) => {
            temporizador = setTimeout(
                () => rejeitar(new AuditoriaIndisponivelError('tempo esgotado')),
                TEMPO_LIMITE_LEITURA_MS
            )
        })
        try {
            return await Promise.race([operacao(), esgotado])
        } catch (erro) {
            throw erro instanceof AuditoriaIndisponivelError ? erro : new AuditoriaIndisponivelError(erro)
        } finally {
            clearTimeout(temporizador)
        }
    }

    const texto = (v: unknown) => (typeof v === 'string' ? v : null)

    return {
        listar(janela: { limite: number; deslocamento: number }): Promise<ExecucaoManutencao[]> {
            return comTempoLimite(async () => {
                const docs = (await (
                    await colecao()
                )
                    .aggregate(
                        [...base, { $sort: { inicio: -1 } }, { $skip: janela.deslocamento }, { $limit: janela.limite }],
                        {
                            maxTimeMS: TEMPO_LIMITE_LEITURA_MS
                        }
                    )
                    .toArray()) as Agrupado[]
                return docs.map((d) => {
                    const final = d.resumoFinal ?? {}
                    const inicial = d.resumoInicial ?? {}
                    const contagens = (final.contagensReais ??
                        final.impressaoDigital ??
                        inicial.impressaoDigital ??
                        {}) as ExecucaoManutencao['contagens']
                    return {
                        execucaoId: d._id,
                        userId: d.userId,
                        inicio: new Date(d.inicio).toISOString(),
                        situacao:
                            d.ultimaFase === 'iniciada'
                                ? 'desfecho_nao_confirmado'
                                : (d.ultimaFase as SituacaoExecucao),
                        acao: texto(final.acao ?? inicial.acao),
                        tabela: texto(final.tabela ?? inicial.tabela),
                        modo: texto(final.modo ?? inicial.modo),
                        motivo: texto(final.motivo),
                        contagens
                    }
                })
            })
        },

        contar(): Promise<number> {
            return comTempoLimite(async () => {
                const [r] = (await (
                    await colecao()
                )
                    .aggregate([...base, { $count: 'n' }], { maxTimeMS: TEMPO_LIMITE_LEITURA_MS })
                    .toArray()) as Array<{ n: number }>
                return r?.n ?? 0
            })
        }
    }
}
