import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EntradaRegistrarAutoCadastro } from './registrar-auto-cadastro'

/**
 * Auditoria do auto-cadastro (011-auto-cadastro-provedor, FR-009,
 * contracts/auto-cadastro.md C-06).
 *
 * Três garantias, cada uma com um motivo concreto:
 *
 * 1. **Ator explícito.** No auto-cadastro não existe sessão ainda — o
 *    `AsyncLocalStorage` do `comAtor` está vazio e o `withAudit` cairia no
 *    fallback `sistema`, produzindo um log que não diz quem entrou. O ator é o
 *    próprio usuário recém-criado.
 * 2. **Sem segredos no snapshot.** `dadosNovos` vai para o Mongo de auditoria,
 *    que é imutável — um token vazado ali não pode ser removido depois.
 * 3. **Falha não propaga.** Auditoria indisponível não pode impedir alguém de
 *    entrar no sistema durante uma crise (Princípio V da constituição).
 */
const registrarAuditoria = vi.hoisted(() => vi.fn())

vi.mock('@/src/modules/auditoria/infrastructure/audit-writer', () => ({ registrarAuditoria }))

const { RegistrarAutoCadastroUseCase } = await import('./registrar-auto-cadastro')

const ENTRADA = {
    id: 'user-novo-1',
    nome: 'Fulano de Tal',
    email: 'fulano@example.com',
    role: 'usuario' as const,
    provedor: 'google',
    ip: '203.0.113.10',
    userAgent: 'Mozilla/5.0'
}

function primeiroRegistro() {
    return registrarAuditoria.mock.calls[0]?.[0]
}

describe('RegistrarAutoCadastroUseCase', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registrarAuditoria.mockResolvedValue(true)
    })

    it('registra a criação da conta com entidade, ação e tabela corretas', async () => {
        await new RegistrarAutoCadastroUseCase().executar(ENTRADA)

        expect(registrarAuditoria).toHaveBeenCalledTimes(1)
        expect(primeiroRegistro()).toMatchObject({
            entidade: 'Usuario',
            acao: 'create',
            tabela: 'user',
            entidadeId: 'user-novo-1',
            dadosAnteriores: null
        })
    })

    it('usa o próprio usuário criado como ator, e não o fallback `sistema`', async () => {
        await new RegistrarAutoCadastroUseCase().executar(ENTRADA)

        const registro = primeiroRegistro()
        expect(registro.userId).toBe('user-novo-1')
        expect(registro.userId).not.toBe('sistema')
        expect(registro.userRole).toBe('usuario')
    })

    it('registra o provedor de origem e os metadados de requisição', async () => {
        await new RegistrarAutoCadastroUseCase().executar(ENTRADA)

        const registro = primeiroRegistro()
        expect(registro.dadosNovos).toMatchObject({ provedor: 'google' })
        expect(registro.metadata).toEqual({ ip: '203.0.113.10', userAgent: 'Mozilla/5.0' })
    })

    it('não inclui tokens do provedor nem a imagem de perfil no snapshot', async () => {
        await new RegistrarAutoCadastroUseCase().executar({
            ...ENTRADA,
            // Campos que o better-auth carrega no objeto do usuário e que não
            // podem vazar para um log imutável.
            accessToken: 'ya29.super-secreto',
            refreshToken: '1//refresh-secreto',
            idToken: 'eyJhbGciOi.secreto',
            image: 'https://lh3.googleusercontent.com/foto'
        } as EntradaRegistrarAutoCadastro)

        const dadosNovos = primeiroRegistro().dadosNovos
        expect(Object.keys(dadosNovos).sort()).toEqual(['email', 'id', 'nome', 'provedor', 'role'])
        expect(JSON.stringify(dadosNovos)).not.toContain('secreto')
        expect(dadosNovos).not.toHaveProperty('image')
    })

    it('não propaga exceção quando a escrita de auditoria falha', async () => {
        registrarAuditoria.mockRejectedValue(new Error('mongo indisponível'))

        await expect(new RegistrarAutoCadastroUseCase().executar(ENTRADA)).resolves.toBeUndefined()
    })
})
