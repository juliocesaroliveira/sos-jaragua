import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Política de falha da auditoria (BR-AUD-01, DESIGN.md §13):
 * **degradar graciosamente** — se a escrita em `audit_logs` falhar, a operação
 * de negócio original prossegue e a falha vira log estruturado.
 *
 * Este teste existe porque a verificação manual da Seção 8 não conseguiu provar
 * isso: o cliente Mongo fica em cache global (proposital, para o HMR), então
 * trocar a variável de ambiente não derrubava a conexão já aberta. Aqui o
 * escritor é injetado e pode falhar de verdade.
 */
const registrarAuditoria = vi.hoisted(() => vi.fn())

vi.mock('./infrastructure/audit-writer', () => ({ registrarAuditoria }))

const { withAudit } = await import('./index')
const { comAtor } = await import('@/src/shared/contexto/ator')

const ATOR = { userId: 'user-1', role: 'coordenador' as const }

const OPCOES = {
    entidade: 'Doacao' as const,
    acao: 'create' as const,
    tabela: 'descarte',
    extrair: (r: { id: string }) => ({ entidadeId: r.id, dadosNovos: { id: r.id } })
}

describe('withAudit — caminho feliz', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registrarAuditoria.mockResolvedValue(true)
    })

    it('devolve o resultado da operação e registra o log', async () => {
        const resultado = await comAtor(ATOR, () => withAudit(OPCOES, async () => ({ id: 'descarte-1' })))

        expect(resultado).toEqual({ id: 'descarte-1' })
        expect(registrarAuditoria).toHaveBeenCalledOnce()

        const registro = registrarAuditoria.mock.calls[0][0]
        expect(registro).toMatchObject({
            entidade: 'Doacao',
            acao: 'create',
            tabela: 'descarte',
            entidadeId: 'descarte-1',
            userId: 'user-1',
            userRole: 'coordenador'
        })
    })

    it('captura dadosAnteriores antes da mutação', async () => {
        const ordem: string[] = []

        await comAtor(ATOR, () =>
            withAudit(
                {
                    ...OPCOES,
                    acao: 'update',
                    dadosAnteriores: async () => {
                        ordem.push('leitura-anterior')
                        return { status: 'pendente' }
                    }
                },
                async () => {
                    ordem.push('mutacao')
                    return { id: 'x' }
                }
            )
        )

        // A leitura do "antes" só tem valor se acontecer antes da escrita.
        expect(ordem).toEqual(['leitura-anterior', 'mutacao'])
        expect(registrarAuditoria.mock.calls[0][0].dadosAnteriores).toEqual({ status: 'pendente' })
    })

    it('propaga ip e userAgent para metadata', async () => {
        await comAtor({ ...ATOR, ip: '203.0.113.7', userAgent: 'Chrome' }, () =>
            withAudit(OPCOES, async () => ({ id: 'y' }))
        )
        expect(registrarAuditoria.mock.calls[0][0].metadata).toEqual({ ip: '203.0.113.7', userAgent: 'Chrome' })
    })

    it('marca como `sistema` quando não há ator no contexto (cron, scripts)', async () => {
        await withAudit(OPCOES, async () => ({ id: 'z' }))
        expect(registrarAuditoria.mock.calls[0][0]).toMatchObject({ userId: 'sistema', userRole: 'sistema' })
    })
})

describe('withAudit — degradação graciosa (DESIGN.md §13)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('a operação prossegue quando a escrita do log falha', async () => {
        registrarAuditoria.mockRejectedValue(new Error('Mongo indisponível'))

        const resultado = await comAtor(ATOR, () => withAudit(OPCOES, async () => ({ id: 'descarte-2' })))

        // O ponto central: aprovar voluntário / registrar saída não podem ser
        // desfeitos porque o log de auditoria não gravou.
        expect(resultado).toEqual({ id: 'descarte-2' })
        expect(console.error).toHaveBeenCalled()
    })

    it('a operação prossegue quando a leitura de dadosAnteriores falha', async () => {
        registrarAuditoria.mockResolvedValue(true)

        const resultado = await comAtor(ATOR, () =>
            withAudit(
                {
                    ...OPCOES,
                    acao: 'update',
                    dadosAnteriores: async () => {
                        throw new Error('falha ao ler estado anterior')
                    }
                },
                async () => ({ id: 'descarte-3' })
            )
        )

        expect(resultado).toEqual({ id: 'descarte-3' })
        // O log ainda é gravado — só sem o "antes".
        expect(registrarAuditoria.mock.calls[0][0].dadosAnteriores).toBeNull()
    })

    it('a operação prossegue quando `extrair` lança', async () => {
        registrarAuditoria.mockResolvedValue(true)

        const resultado = await comAtor(ATOR, () =>
            withAudit(
                {
                    ...OPCOES,
                    extrair: () => {
                        throw new Error('resultado em formato inesperado')
                    }
                },
                async () => ({ id: 'descarte-4' })
            )
        )

        expect(resultado).toEqual({ id: 'descarte-4' })
        expect(registrarAuditoria).not.toHaveBeenCalled()
        expect(console.error).toHaveBeenCalled()
    })

    it('não engole o erro da própria operação de negócio', async () => {
        registrarAuditoria.mockResolvedValue(true)

        // Falha de negócio precisa continuar subindo — auditoria não é um
        // try/catch geral.
        await expect(
            comAtor(ATOR, () =>
                withAudit(OPCOES, async () => {
                    throw new Error('saldo insuficiente')
                })
            )
        ).rejects.toThrow('saldo insuficiente')

        expect(registrarAuditoria).not.toHaveBeenCalled()
    })
})
