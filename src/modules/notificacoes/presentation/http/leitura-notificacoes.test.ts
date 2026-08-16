import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Contrato do endpoint de leitura do sino (012-notificacoes-tempo-real,
 * contracts/leitura-notificacoes.md C-02 e C-03).
 *
 * É `presentation`, que a constituição declara fina por design — então o teste
 * cobre o contrato e os casos de erro mais prováveis, não a consulta em si (que
 * pertence às queries já existentes e é exercida pelos testes de integração).
 *
 * O caso do `401` é o que mais importa: é ele que faz o cliente **parar** de
 * consultar quando a sessão acaba. Se um dia este endpoint passar a redirecionar
 * em vez de responder 401, uma aba esquecida aberta consultaria para sempre.
 */
const obterSessao = vi.hoisted(() => vi.fn())
const listarNotificacoes = vi.hoisted(() => vi.fn())
const contarNaoLidas = vi.hoisted(() => vi.fn())

vi.mock('@/src/shared/auth/sessao', () => ({ obterSessao }))
vi.mock('../queries/notificacoes', () => ({ listarNotificacoes, contarNaoLidas }))

const { lerNotificacoesDaSessao: GET } = await import('./leitura-notificacoes')

const ATOR = { userId: 'user-1', role: 'voluntario' as const }

const NOTIFICACAO = {
    id: '11111111-1111-1111-1111-111111111111',
    tipo: 'triagem_concluida' as const,
    titulo: 'Seu cadastro foi aprovado',
    mensagem: 'Bem-vindo.',
    lida: false,
    criadoEm: '2026-08-16T14:31:00.000Z'
}

describe('GET /api/notificacoes — sem sessão', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        obterSessao.mockResolvedValue(null)
    })

    it('responde 401 e não consulta o banco', async () => {
        const resposta = await GET()

        expect(resposta.status).toBe(401)
        expect(listarNotificacoes).not.toHaveBeenCalled()
        expect(contarNaoLidas).not.toHaveBeenCalled()
    })

    it('responde sem corpo — nada a vazar para quem não está autenticado', async () => {
        const resposta = await GET()
        expect(await resposta.text()).toBe('')
    })

    it('não redireciona: o cliente precisa do status para parar de consultar', async () => {
        const resposta = await GET()

        // Fora da faixa 3xx e sem `location`: se um dia isto virar redirect, o
        // `fetch` do cliente o seguiria, receberia o HTML do login com status
        // 200, e nunca pararia de consultar (FR-010).
        const ehRedirecionamento = resposta.status >= 300 && resposta.status < 400
        expect(ehRedirecionamento).toBe(false)
        expect(resposta.headers.get('location')).toBeNull()
    })
})

describe('GET /api/notificacoes — com sessão', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        obterSessao.mockResolvedValue(ATOR)
        listarNotificacoes.mockResolvedValue([NOTIFICACAO])
        contarNaoLidas.mockResolvedValue(7)
    })

    it('devolve lista e contador na mesma resposta', async () => {
        const resposta = await GET()

        expect(resposta.status).toBe(200)
        await expect(resposta.json()).resolves.toEqual({ notificacoes: [NOTIFICACAO], naoLidas: 7 })
    })

    it('consulta sempre pelo usuário da sessão', async () => {
        await GET()

        expect(listarNotificacoes).toHaveBeenCalledWith('user-1')
        expect(contarNaoLidas).toHaveBeenCalledWith('user-1')
    })

    it('devolve o total de não-lidas, e não o tamanho da lista truncada em 30', async () => {
        // A lista tem 1 item; o contador diz 7. Derivar o contador do tamanho da
        // lista mostraria "1" e o sino mentiria para quem tem mais de 30 avisos.
        const { naoLidas, notificacoes } = await (await GET()).json()

        expect(notificacoes).toHaveLength(1)
        expect(naoLidas).toBe(7)
    })

    it('proíbe cache da resposta — é dado por-usuário derivado de sessão', async () => {
        const resposta = await GET()
        expect(resposta.headers.get('cache-control')).toContain('no-store')
    })
})
