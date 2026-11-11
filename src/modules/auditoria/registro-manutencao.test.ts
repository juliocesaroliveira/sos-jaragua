import { randomBytes } from 'node:crypto'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Porta bloqueante de auditoria da Danger Zone (026, contracts/auditoria-manutencao.md).
 *
 * O contraste com `withAudit` é o ponto: aqui a falha **propaga**, porque a
 * execução só pode prosseguir se o rastro foi aceito (research D8).
 */
vi.mock('@/src/shared/db/mongo/client', () => ({ clienteMongo: vi.fn() }))

const { criarRegistroExecucaoManutencao } = await import('./infrastructure/registro-manutencao')
const { AuditoriaIndisponivelError } = await import('./infrastructure/erros')

beforeAll(() => {
    process.env.DADOS_SENSIVEIS_CHAVE = randomBytes(32).toString('base64')
})

const ATOR = { userId: 'admin-1', role: 'administrador' as const }

const EVENTO = {
    execucaoId: 'exec-1',
    fase: 'iniciada' as const,
    ator: ATOR,
    resumo: { acao: 'resetar_tabela', tabela: 'account', modo: 'cascata' }
}

async function* linhas(n: number) {
    for (let i = 0; i < n; i++) {
        yield {
            tabela: 'account',
            chave: `acc-${i}`,
            acao: 'delete' as const,
            antes: {
                id: `acc-${i}`,
                password: 'hash-secreto',
                access_token: 'tok',
                provider_id: 'credential',
                cpf: '12345678901'
            },
            depois: null,
            colunasOmitidas: ['password', 'access_token'] as const
        }
    }
}

function colecaoFalsa() {
    return {
        insertOne: vi.fn().mockResolvedValue({}),
        insertMany: vi.fn().mockResolvedValue({})
    }
}

describe('registrarInicio', () => {
    let colecao: ReturnType<typeof colecaoFalsa>
    beforeEach(() => {
        colecao = colecaoFalsa()
    })

    it('grava o evento antes dos snapshots e os snapshots em lotes de 500', async () => {
        const porta = criarRegistroExecucaoManutencao({ colecao: () => colecao as never, ping: async () => {} })
        await porta.registrarInicio(EVENTO, linhas(1001))

        expect(colecao.insertOne).toHaveBeenCalledOnce()
        expect(colecao.insertOne.mock.invocationCallOrder[0]).toBeLessThan(
            colecao.insertMany.mock.invocationCallOrder[0]
        )
        expect(colecao.insertMany.mock.calls.map((c) => (c[0] as unknown[]).length)).toEqual([500, 500, 1])

        const evento = colecao.insertOne.mock.calls[0][0]
        expect(evento).toMatchObject({
            entidade: 'ManutencaoDados',
            entidadeId: 'exec-1',
            acao: 'delete',
            userId: 'admin-1'
        })
        expect(evento.manutencao).toMatchObject({ execucaoId: 'exec-1', fase: 'iniciada' })
    })

    it('remove credenciais e redige sensíveis em cada snapshot (AM-01)', async () => {
        const porta = criarRegistroExecucaoManutencao({ colecao: () => colecao as never, ping: async () => {} })
        await porta.registrarInicio(EVENTO, linhas(1))

        const [snapshot] = colecao.insertMany.mock.calls[0][0] as Array<
            { dadosAnteriores: Record<string, unknown> } & Record<string, unknown>
        >
        expect(snapshot.dadosAnteriores).not.toHaveProperty('password')
        expect(snapshot.dadosAnteriores).not.toHaveProperty('access_token')
        expect(snapshot.dadosAnteriores.cpf).toMatch(/^\[redigido:/)
        expect(snapshot.dadosAnteriores.provider_id).toBe('credential')
        expect(snapshot).toMatchObject({
            entidade: 'ManutencaoDados',
            entidadeId: 'acc-0',
            tabela: 'account',
            acao: 'delete'
        })
        expect(snapshot.manutencao).toEqual({ execucaoId: 'exec-1', fase: 'snapshot' })
        expect(JSON.stringify(snapshot)).not.toContain('hash-secreto')
    })

    it('falha no insertMany propaga como AuditoriaIndisponivelError (AM-02)', async () => {
        colecao.insertMany.mockRejectedValueOnce(new Error('rede'))
        const porta = criarRegistroExecucaoManutencao({ colecao: () => colecao as never, ping: async () => {} })
        await expect(porta.registrarInicio(EVENTO, linhas(3))).rejects.toBeInstanceOf(AuditoriaIndisponivelError)
    })

    it('nunca escreve snapshot no console, nem em falha', async () => {
        const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
        const log = vi.spyOn(console, 'log').mockImplementation(() => {})
        colecao.insertMany.mockRejectedValueOnce(new Error('rede'))
        const porta = criarRegistroExecucaoManutencao({ colecao: () => colecao as never, ping: async () => {} })
        await porta.registrarInicio(EVENTO, linhas(1)).catch(() => {})
        const tudo = JSON.stringify([...erro.mock.calls, ...log.mock.calls])
        expect(tudo).not.toContain('hash-secreto')
        expect(tudo).not.toContain('12345678901')
        erro.mockRestore()
        log.mockRestore()
    })
})

describe('verificarDisponibilidade e registrarDesfecho', () => {
    it('ping que falha vira AuditoriaIndisponivelError', async () => {
        const porta = criarRegistroExecucaoManutencao({
            colecao: () => colecaoFalsa() as never,
            ping: async () => {
                throw new Error('fora')
            }
        })
        await expect(porta.verificarDisponibilidade()).rejects.toBeInstanceOf(AuditoriaIndisponivelError)
    })

    it('desfecho grava um evento novo, sem atualizar o anterior (AM-03)', async () => {
        const colecao = colecaoFalsa()
        const porta = criarRegistroExecucaoManutencao({ colecao: () => colecao as never, ping: async () => {} })
        await porta.registrarDesfecho({ ...EVENTO, fase: 'concluida' })
        expect(colecao.insertOne).toHaveBeenCalledOnce()
        expect(colecao.insertOne.mock.calls[0][0].manutencao.fase).toBe('concluida')
    })
})
