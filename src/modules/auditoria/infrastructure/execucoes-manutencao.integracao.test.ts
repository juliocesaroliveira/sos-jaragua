import { randomUUID } from 'node:crypto'
import type { Collection } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { clienteMongo } from '@/src/shared/db/mongo/client'
import type { RegistroAuditoria } from '@/src/shared/db/mongo/audit-logs'
import { criarLeitorExecucoesManutencao, criarRegistroExecucaoManutencao } from './registro-manutencao'

/**
 * Histórico da Danger Zone contra o Mongo de desenvolvimento (026, T041).
 *
 * Coleção própria de teste, nunca a `audit_logs` real (imutável — DB_SCHEMA.md
 * §9). Os documentos levam um marcador da rodada e são removidos ao final.
 */
const NOME_COLECAO = 'audit_logs_teste_danger_zone'
const rodada = randomUUID()
type Doc = RegistroAuditoria & { rodada: string }
let colecao: Collection<Doc>

const ator = { userId: `admin-${rodada.slice(0, 6)}`, role: 'administrador' as const }

beforeAll(async () => {
    colecao = clienteMongo().db().collection<Doc>(NOME_COLECAO)
    // Etiqueta cada documento com a rodada, para a limpeza e o filtro abaixo.
    const escrita = {
        insertOne: (d: RegistroAuditoria) => colecao.insertOne({ ...d, rodada }),
        insertMany: (ds: RegistroAuditoria[]) => colecao.insertMany(ds.map((d) => ({ ...d, rodada })))
    }
    const porta = criarRegistroExecucaoManutencao({ colecao: () => escrita as never, ping: async () => {} })
    const evento = (
        execucaoId: string,
        fase: 'iniciada' | 'concluida' | 'falhou' | 'recusada' | 'cancelada',
        extra = {}
    ) => ({
        execucaoId,
        fase,
        ator,
        resumo: {
            acao: 'resetar_tabela',
            tabela: 'kit',
            modo: 'preservacao',
            impressaoDigital: { kit: { apagar: 2, redirecionar: {} } },
            ...extra
        }
    })
    async function* umaLinha() {
        yield {
            tabela: 'kit',
            chave: 'k1',
            acao: 'delete' as const,
            antes: { id: 'k1', nome: 'Cesta' },
            depois: null,
            colunasOmitidas: []
        }
    }

    await porta.registrarInicio(evento('e-concluida', 'iniciada'), umaLinha())
    await porta.registrarDesfecho(
        evento('e-concluida', 'concluida', { contagensReais: { kit: { apagar: 2, redirecionar: {} } } })
    )
    await porta.registrarInicio(evento('e-falhou', 'iniciada'), umaLinha())
    await porta.registrarDesfecho(evento('e-falhou', 'falhou', { motivo: 'falha_execucao' }))
    await porta.registrarDesfecho(evento('e-recusada', 'recusada', { motivo: 'dados_mudaram' }))
    await porta.registrarDesfecho(evento('e-cancelada', 'cancelada'))
    await porta.registrarInicio(evento('e-sem-desfecho', 'iniciada'), umaLinha())
})

afterAll(async () => {
    await colecao.deleteMany({ rodada })
})

describe('listarExecucoesManutencao', () => {
    it('situação vem do último evento; snapshots não entram', async () => {
        const leitor = criarLeitorExecucoesManutencao(
            () =>
                ({
                    aggregate: (pipeline: object[], opcoes?: object) =>
                        colecao.aggregate([{ $match: { rodada } }, ...pipeline], opcoes)
                }) as never
        )

        const execucoes = await leitor.listar({ limite: 50, deslocamento: 0 })
        const porId = Object.fromEntries(execucoes.map((e) => [e.execucaoId, e]))

        expect(Object.keys(porId).sort()).toEqual([
            'e-cancelada',
            'e-concluida',
            'e-falhou',
            'e-recusada',
            'e-sem-desfecho'
        ])
        expect(porId['e-concluida'].situacao).toBe('concluida')
        expect(porId['e-falhou'].situacao).toBe('falhou')
        expect(porId['e-recusada'].motivo).toBe('dados_mudaram')
        expect(porId['e-cancelada'].situacao).toBe('cancelada')
        expect(porId['e-sem-desfecho'].situacao).toBe('desfecho_nao_confirmado')
        expect(porId['e-concluida'].contagens).toEqual({ kit: { apagar: 2, redirecionar: {} } })
        expect(await leitor.contar()).toBe(5)
    })
})
