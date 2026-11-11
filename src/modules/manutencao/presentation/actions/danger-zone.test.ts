import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Autorização das Server Actions (T050, SC-002, contracts A-00.1).
 *
 * A página tem gate próprio, mas Server Actions são endpoints chamáveis
 * diretamente: cada uma relê a sessão e exige `administrador`. Aqui nenhuma
 * dependência de infraestrutura pode ser tocada quando a recusa acontece.
 */
const obterSessao = vi.hoisted(() => vi.fn())
const infra = vi.hoisted(() => ({
    leitor: vi.fn(),
    executor: vi.fn(),
    registro: vi.fn(),
    leitorExecucoes: vi.fn(),
    nomes: vi.fn()
}))

vi.mock('@/src/shared/auth/sessao', () => ({
    obterSessao,
    comAtorDaSessao: (_a: unknown, fn: () => Promise<unknown>) => fn()
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '10.0.0.1' }) }))
vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('../../infrastructure/drizzle/leitor-esquema', () => ({ criarLeitorEsquema: infra.leitor }))
vi.mock('../../infrastructure/drizzle/executor-conjuntos', () => ({ criarExecutorConjuntos: infra.executor }))
vi.mock('@/src/modules/auditoria', () => ({
    criarRegistroExecucaoManutencao: infra.registro,
    criarLeitorExecucoesManutencao: infra.leitorExecucoes
}))
vi.mock('@/src/modules/identidade/presentation/queries/usuarios', () => ({ nomesDeUsuarios: infra.nomes }))

const acoes = await import('./danger-zone')

const PEDIDO = { acao: 'resetar_tabela', tabela: 'item' }
const CHAMADAS: Array<[string, () => Promise<{ ok: boolean; erro?: { codigo: string; mensagem: string } }>]> = [
    ['inventarioAction', () => acoes.inventarioAction()],
    ['listarRegistrosAction', () => acoes.listarRegistrosAction({ tabela: 'item', page: 1, pageSize: 10 })],
    ['gerarPreviaAction', () => acoes.gerarPreviaAction(PEDIDO)],
    [
        'executarAcaoAction',
        () => acoes.executarAcaoAction({ pedido: PEDIDO, impressaoDigital: {}, confirmacao: 'RESETAR item' })
    ],
    ['cancelarAcaoAction', () => acoes.cancelarAcaoAction({ pedido: PEDIDO, impressaoDigital: {} })],
    ['historicoAction', () => acoes.historicoAction({ page: 1, pageSize: 10 })]
]

afterEach(() => vi.clearAllMocks())

describe.each([
    ['sem sessão', null],
    ['coordenador', { userId: 'c1', role: 'coordenador', sessionToken: 't', sessaoCriadaEm: new Date() }],
    [
        'membro da Defesa Civil',
        { userId: 'm1', role: 'membro_defesa_civil', sessionToken: 't', sessaoCriadaEm: new Date() }
    ]
])('%s', (_rotulo, sessao) => {
    it.each(CHAMADAS)('%s → nao_autorizado, sem tocar infraestrutura', async (_nome, chamar) => {
        obterSessao.mockResolvedValue(sessao)
        const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})

        const r = await chamar()

        expect(r.ok).toBe(false)
        expect(r.erro?.codigo).toBe('nao_autorizado')
        // A mensagem não revela nada sobre tabelas nem contagens.
        expect(r.erro?.mensagem).not.toMatch(/item|registro|\d/)
        for (const fabrica of Object.values(infra)) expect(fabrica).not.toHaveBeenCalled()
        // A tentativa vai para o log estruturado, sem conteúdo de linha.
        expect(aviso).toHaveBeenCalledWith(
            '[manutencao] tentativa sem sessão válida',
            expect.objectContaining({ ip: '10.0.0.1' })
        )
    })
})
