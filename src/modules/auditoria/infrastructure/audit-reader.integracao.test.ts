import { randomUUID } from 'node:crypto'
import { MongoClient, type Collection } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { clienteMongo } from '@/src/shared/db/mongo/client'
import type { RegistroAuditoria } from '@/src/shared/db/mongo/audit-logs'
import { AuditoriaIndisponivelError, criarLeitorAuditoria } from './audit-reader'

/**
 * Leitor da trilha de auditoria contra o Mongo de desenvolvimento
 * (specs/023-central-relatorios, T043).
 *
 * Usa a coleção **`audit_logs_teste`**, nunca a `audit_logs` real: a trilha é
 * imutável e o usuário da aplicação não tem `delete` nela (DB_SCHEMA.md §9) —
 * um teste que gravasse lá a sujaria para sempre. Os documentos levam um
 * marcador da execução e são removidos ao final.
 */

const NOME_COLECAO = 'audit_logs_teste'
const execucao = randomUUID()

type RegistroDeTeste = RegistroAuditoria & { execucao: string }

let colecao: Collection<RegistroDeTeste>

function registro(
    timestamp: string,
    dados: Partial<RegistroAuditoria> & Pick<RegistroAuditoria, 'entidade' | 'acao' | 'userId'>
): RegistroDeTeste {
    return {
        timestamp: new Date(timestamp),
        entidadeId: randomUUID(),
        userRole: 'membro_defesa_civil',
        tabela: 'entrada',
        dadosAnteriores: null,
        dadosNovos: { quantidade: 1 },
        ...dados,
        execucao
    }
}

beforeAll(async () => {
    colecao = clienteMongo().db().collection<RegistroDeTeste>(NOME_COLECAO)
    await colecao.insertMany([
        registro('2020-05-02T12:00:00Z', { entidade: 'Doacao', acao: 'create', userId: 'u-ana' }),
        registro('2020-05-03T12:00:00Z', {
            entidade: 'Voluntario',
            acao: 'update',
            userId: 'u-bruno',
            dadosAnteriores: { status: 'pendente' },
            dadosNovos: { status: 'aprovado' }
        }),
        registro('2020-05-04T12:00:00Z', { entidade: 'Doacao', acao: 'update', userId: 'u-ana' }),
        registro('2020-06-10T12:00:00Z', { entidade: 'Doacao', acao: 'create', userId: 'u-ana' }) // fora
    ])
})

afterAll(async () => {
    await colecao.deleteMany({ execucao })
})

const leitor = () =>
    criarLeitorAuditoria(() => colecao as unknown as Collection<RegistroAuditoria>, { tempoLimiteMs: 15_000 })

const MAIO_2020 = { inicio: new Date('2020-05-01T03:00:00Z'), fimExclusivo: new Date('2020-06-01T03:00:00Z') }
const TUDO = { limite: 1_000, deslocamento: 0 }

describe('criarLeitorAuditoria', () => {
    it('filtra pelo período e ordena do mais recente para o mais antigo', async () => {
        const registros = await leitor().listar({ intervalo: MAIO_2020 }, TUDO)
        const doTeste = registros.filter((r) => (r as unknown as RegistroDeTeste).execucao === execucao)

        expect(doTeste.map((r) => r.timestamp.toISOString())).toEqual([
            '2020-05-04T12:00:00.000Z',
            '2020-05-03T12:00:00.000Z',
            '2020-05-02T12:00:00.000Z'
        ])
        expect(typeof doTeste[0].id).toBe('string')
        expect(doTeste[1]).toMatchObject({
            dadosAnteriores: { status: 'pendente' },
            dadosNovos: { status: 'aprovado' }
        })
    })

    it('filtra por entidade, ação e autor, e conta igual', async () => {
        const l = leitor()
        expect(await l.contar({ intervalo: MAIO_2020, userId: 'u-ana' })).toBe(2)
        expect(await l.contar({ intervalo: MAIO_2020, entidade: 'Voluntario' })).toBe(1)
        expect(await l.contar({ intervalo: MAIO_2020, entidade: 'Doacao', acao: 'update' })).toBe(1)
    })

    it('pagina sem repetir', async () => {
        const l = leitor()
        const primeira = await l.listar({ intervalo: MAIO_2020, userId: 'u-ana' }, { limite: 1, deslocamento: 0 })
        const segunda = await l.listar({ intervalo: MAIO_2020, userId: 'u-ana' }, { limite: 1, deslocamento: 1 })
        expect(primeira).toHaveLength(1)
        expect(segunda).toHaveLength(1)
        expect(primeira[0].id).not.toBe(segunda[0].id)
    })

    it('Mongo inalcançável → AuditoriaIndisponivelError dentro do tempo-limite', async () => {
        const inalcancavel = new MongoClient('mongodb://127.0.0.1:1/teste', { serverSelectionTimeoutMS: 30_000 })
        const leitorFora = criarLeitorAuditoria(() => inalcancavel.db().collection<RegistroAuditoria>(NOME_COLECAO), {
            tempoLimiteMs: 1_000
        })

        const inicio = Date.now()
        await expect(leitorFora.contar({ intervalo: MAIO_2020 })).rejects.toBeInstanceOf(AuditoriaIndisponivelError)
        // O tempo-limite próprio corta os 30 s de seleção de servidor do driver.
        expect(Date.now() - inicio).toBeLessThan(5_000)
        await inalcancavel.close()
    })
})
