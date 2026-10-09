import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Autorização da consulta (Server Action) e da exportação (Route Handler) da
 * central de relatórios (specs/023-central-relatorios, FR-002, FR-020, SC-005;
 * contracts/consulta-e-rotas.md e contracts/exportacao-http.md).
 *
 * `rotas.test.ts` e `catalogo.test.ts` provam que a **regra** está certa; este
 * arquivo prova que as duas portas de entrada de dados **aplicam** a regra. Sem
 * ele, um handler que esquecesse o `podeAcessar(relatorio.rota)` continuaria
 * entregando a trilha de auditoria a um membro por URL direta — o proxy só vê
 * o prefixo `/api/relatorios/export`, comum a todos os relatórios.
 *
 * As definições são falsas (registradas com `registrar` de verdade): o que se
 * testa é o gate, não as consultas.
 */
const obterSessao = vi.hoisted(() => vi.fn())
const estado = vi.hoisted(() => ({ auditoriaFora: false, totalSaidas: 3 }))

vi.mock('@/src/shared/auth/sessao', () => ({ obterSessao }))
vi.mock('../application/definicoes', async () => {
    const { definirRelatorio, registrar } = await import('../application/definicao-relatorio')
    const { z } = await import('@/src/shared/validacao/zod-ptbr')
    const { DomainError } = await import('@/src/shared/kernel')

    function falsa(slug: 'saidas' | 'auditoria') {
        return registrar(
            definirRelatorio({
                slug,
                camposFiltro: [],
                esquemaFiltros: z.object({}),
                colunas: [{ cabecalho: 'Número', valor: (n: number) => n }],
                async contar() {
                    if (slug === 'auditoria' && estado.auditoriaFora) {
                        throw new DomainError(
                            'auditoria_indisponivel',
                            'A trilha de auditoria está indisponível no momento.'
                        )
                    }
                    return slug === 'saidas' ? estado.totalSaidas : 1
                },
                async carregar(_c, { limite, deslocamento }) {
                    const total = slug === 'saidas' ? estado.totalSaidas : 1
                    return Array.from({ length: total }, (_, i) => i + 1).slice(deslocamento, deslocamento + limite)
                },
                descreverFiltros: () => []
            })
        )
    }

    const registrados = new Map([
        ['saidas', falsa('saidas')],
        ['auditoria', falsa('auditoria')]
    ])
    return { obterRelatorio: (slug: unknown) => (typeof slug === 'string' ? registrados.get(slug) : undefined) }
})

const { consultarRelatorioAction } = await import('./actions/relatorios')
const { exportarRelatorio } = await import('./http/exportar-relatorio')

function ator(role: string) {
    return { userId: `u-${role}`, role, nome: `Pessoa ${role}`, email: 'x@x', ativo: true, dataNascimento: null }
}

const exportar = (query: string) => exportarRelatorio(new Request(`http://localhost/api/relatorios/export?${query}`))

beforeEach(() => {
    vi.clearAllMocks()
    estado.auditoriaFora = false
    estado.totalSaidas = 3
})

describe('consultarRelatorioAction — gate por relatório', () => {
    it('sem sessão → nao_autorizado', async () => {
        obterSessao.mockResolvedValue(null)
        const resultado = await consultarRelatorioAction({ relatorio: 'saidas' })
        expect(resultado.ok === false && resultado.erro.codigo).toBe('nao_autorizado')
    })

    it('coordenador não consulta nenhum relatório', async () => {
        obterSessao.mockResolvedValue(ator('coordenador'))
        const resultado = await consultarRelatorioAction({ relatorio: 'saidas' })
        expect(resultado.ok === false && resultado.erro.codigo).toBe('nao_autorizado')
    })

    it('membro da Defesa Civil consulta saídas, mas não a trilha de auditoria', async () => {
        obterSessao.mockResolvedValue(ator('membro_defesa_civil'))
        expect((await consultarRelatorioAction({ relatorio: 'saidas' })).ok).toBe(true)

        const trilha = await consultarRelatorioAction({ relatorio: 'auditoria' })
        expect(trilha.ok === false && trilha.erro.codigo).toBe('nao_autorizado')
    })

    it('administrador consulta a trilha de auditoria', async () => {
        obterSessao.mockResolvedValue(ator('administrador'))
        const resultado = await consultarRelatorioAction({ relatorio: 'auditoria' })
        expect(resultado.ok).toBe(true)
    })

    it('relatório desconhecido → relatorio_invalido', async () => {
        obterSessao.mockResolvedValue(ator('administrador'))
        const resultado = await consultarRelatorioAction({ relatorio: 'nao-existe' })
        expect(resultado.ok === false && resultado.erro.codigo).toBe('relatorio_invalido')
    })

    it('a sessão é relida a cada chamada: quem perde o papel perde o acesso na hora', async () => {
        obterSessao.mockResolvedValueOnce(ator('administrador')).mockResolvedValueOnce(ator('membro_defesa_civil'))

        expect((await consultarRelatorioAction({ relatorio: 'auditoria' })).ok).toBe(true)
        const depois = await consultarRelatorioAction({ relatorio: 'auditoria' })
        expect(depois.ok === false && depois.erro.codigo).toBe('nao_autorizado')
    })

    it('base de auditoria fora → auditoria_indisponivel, não erro genérico', async () => {
        obterSessao.mockResolvedValue(ator('administrador'))
        estado.auditoriaFora = true
        const resultado = await consultarRelatorioAction({ relatorio: 'auditoria' })
        expect(resultado.ok === false && resultado.erro.codigo).toBe('auditoria_indisponivel')
    })
})

describe('GET /api/relatorios/export — gate por relatório', () => {
    it('sem sessão → 403', async () => {
        obterSessao.mockResolvedValue(null)
        expect((await exportar('tipo=saidas')).status).toBe(403)
    })

    it('coordenador → 403 em qualquer relatório', async () => {
        obterSessao.mockResolvedValue(ator('coordenador'))
        expect((await exportar('tipo=saidas')).status).toBe(403)
    })

    it('membro → 403 na trilha de auditoria por URL direta (FR-020)', async () => {
        obterSessao.mockResolvedValue(ator('membro_defesa_civil'))
        const resposta = await exportar('tipo=auditoria&formato=csv')
        expect(resposta.status).toBe(403)
        expect(await resposta.json()).toEqual({ erro: 'Você não tem permissão para exportar este relatório.' })
    })

    it('administrador → 200 na trilha de auditoria', async () => {
        obterSessao.mockResolvedValue(ator('administrador'))
        expect((await exportar('tipo=auditoria&formato=csv')).status).toBe(200)
    })

    it('a sessão é relida a cada download', async () => {
        obterSessao.mockResolvedValueOnce(ator('administrador')).mockResolvedValueOnce(ator('membro_defesa_civil'))
        expect((await exportar('tipo=auditoria&formato=csv')).status).toBe(200)
        expect((await exportar('tipo=auditoria&formato=csv')).status).toBe(403)
    })
})

describe('GET /api/relatorios/export — contrato', () => {
    beforeEach(() => obterSessao.mockResolvedValue(ator('membro_defesa_civil')))

    it('tipo desconhecido → 400', async () => {
        expect((await exportar('tipo=nao-existe')).status).toBe(400)
    })

    it('formato inválido → 400', async () => {
        expect((await exportar('tipo=saidas&formato=pdf')).status).toBe(400)
    })

    it('período inválido → 400 com a mensagem do campo', async () => {
        const resposta = await exportar('tipo=saidas&de=2026-10-06&ate=2026-10-05')
        expect(resposta.status).toBe(400)
        expect(await resposta.json()).toEqual({ erro: 'A data inicial deve ser anterior ou igual à final.' })
    })

    it('acima do limite → 422', async () => {
        estado.totalSaidas = 50_001
        const resposta = await exportar('tipo=saidas')
        expect(resposta.status).toBe(422)
        expect((await resposta.json()).erro).toContain('acima do limite de 50.000')
    })

    it('trilha fora do ar → 503', async () => {
        obterSessao.mockResolvedValue(ator('administrador'))
        estado.auditoriaFora = true
        expect((await exportar('tipo=auditoria')).status).toBe(503)
    })

    it('CSV: anexo sem cache, com cabeçalho do documento e todas as linhas', async () => {
        const resposta = await exportar('tipo=saidas&formato=csv')

        expect(resposta.status).toBe(200)
        expect(resposta.headers.get('content-type')).toBe('text/csv; charset=utf-8')
        expect(resposta.headers.get('cache-control')).toBe('no-store')
        expect(resposta.headers.get('content-disposition')).toMatch(
            /^attachment; filename="saidas-\d{4}-\d{2}-\d{2}-\d{2}h\d{2}\.csv"$/
        )
        // Streaming: o tamanho não é conhecido de antemão (research D8).
        expect(resposta.headers.get('content-length')).toBeNull()

        const corpo = await resposta.text()
        expect(corpo).toContain('Relatório;Histórico de saídas')
        expect(corpo).toContain('Gerado por;Pessoa membro_defesa_civil')
        expect(corpo.trimEnd().split('\r\n').slice(-4)).toEqual(['Número', '1', '2', '3'])
    })

    it('XLSX é o formato padrão', async () => {
        const resposta = await exportar('tipo=saidas')
        expect(resposta.status).toBe(200)
        expect(resposta.headers.get('content-type')).toBe(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        expect(resposta.headers.get('content-disposition')).toMatch(/\.xlsx"$/)
        expect((await resposta.arrayBuffer()).byteLength).toBeGreaterThan(0)
    })
})
