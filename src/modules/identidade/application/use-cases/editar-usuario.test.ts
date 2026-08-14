import { describe, expect, it, vi } from 'vitest'
import type { Role } from '@/src/shared/auth/roles'
import type { AutenticacaoService } from '../ports/autenticacao-service'
import type { UsuarioRepository } from '../ports/usuario-repository'
import { EditarUsuarioUseCase } from './editar-usuario'

/**
 * TDD — `EditarUsuarioUseCase` (006-user-management-page, US3).
 *
 * FR-008/FR-010: edita nome e papel de uma conta já existente, sem tocar no
 * e-mail (que o tipo de entrada nem recebe).
 *
 * 008-admin-password-reset acrescenta `novaSenha` opcional: os testes de
 * senha abaixo cobrem a regra de que só conta com senha própria pode ser
 * redefinida, e que uma recusa não deixa nada alterado pela metade.
 */

vi.mock('@/src/modules/auditoria', () => ({
    withAudit: <T>(_opcoes: unknown, fn: () => Promise<T>) => fn()
}))

function repositorioComConta(roleAtual: Role | null, temSenhaPropria = true) {
    const buscarRole = vi.fn<UsuarioRepository['buscarRole']>(async () => roleAtual)
    const atualizarNomeERole = vi.fn<UsuarioRepository['atualizarNomeERole']>(async () => undefined)
    const possuiSenhaPropria = vi.fn<UsuarioRepository['possuiSenhaPropria']>(async () => temSenhaPropria)
    const usuarios: UsuarioRepository = {
        listar: vi.fn(),
        atualizarNomeERole,
        atualizarRole: vi.fn(),
        buscarRole,
        possuiSenhaPropria
    }
    return { usuarios, buscarRole, atualizarNomeERole, possuiSenhaPropria }
}

function servicoDeAutenticacao(aoEncerrarSessoes?: () => Promise<void>) {
    const definirSenha = vi.fn<AutenticacaoService['definirSenha']>(async () => undefined)
    const encerrarSessoes = vi.fn<AutenticacaoService['encerrarSessoes']>(aoEncerrarSessoes ?? (async () => undefined))
    const autenticacao: AutenticacaoService = { criarConta: vi.fn(), definirSenha, encerrarSessoes }
    return { autenticacao, definirSenha, encerrarSessoes }
}

describe('EditarUsuarioUseCase', () => {
    it('atualiza nome e papel de uma conta existente', async () => {
        const { usuarios, atualizarNomeERole } = repositorioComConta('voluntario')
        const useCase = new EditarUsuarioUseCase(usuarios, servicoDeAutenticacao().autenticacao)

        const resultado = await useCase.executar({ id: 'user-1', nome: 'Novo Nome', role: 'coordenador' })

        expect(resultado.ok).toBe(true)
        if (!resultado.ok) return
        expect(resultado.valor).toEqual({ id: 'user-1' })
        expect(atualizarNomeERole).toHaveBeenCalledWith('user-1', { nome: 'Novo Nome', role: 'coordenador' })
    })

    it('devolve erro quando a conta não existe', async () => {
        const { usuarios, atualizarNomeERole } = repositorioComConta(null)
        const useCase = new EditarUsuarioUseCase(usuarios, servicoDeAutenticacao().autenticacao)

        const resultado = await useCase.executar({ id: 'user-inexistente', nome: 'Nome', role: 'usuario' })

        expect(resultado.ok).toBe(false)
        if (resultado.ok) return
        expect(resultado.erro.codigo).toBe('nao_encontrado')
        expect(atualizarNomeERole).not.toHaveBeenCalled()
    })

    it('não restringe qual papel pode ser atribuído (Assumptions da spec, Q2)', async () => {
        const { usuarios, atualizarNomeERole } = repositorioComConta('usuario')
        const useCase = new EditarUsuarioUseCase(usuarios, servicoDeAutenticacao().autenticacao)

        // Inclusive concedendo `administrador`, e inclusive à própria conta de
        // quem edita (o caso de uso não sabe nem precisa saber quem é o ator).
        const resultado = await useCase.executar({ id: 'user-1', nome: 'Nome', role: 'administrador' })

        expect(resultado.ok).toBe(true)
        expect(atualizarNomeERole).toHaveBeenCalledWith('user-1', { nome: 'Nome', role: 'administrador' })
    })

    describe('redefinição de senha (008-admin-password-reset)', () => {
        it('sem novaSenha, não consulta nem toca a senha', async () => {
            const { usuarios, possuiSenhaPropria, atualizarNomeERole } = repositorioComConta('usuario')
            const { autenticacao, definirSenha, encerrarSessoes } = servicoDeAutenticacao()
            const useCase = new EditarUsuarioUseCase(usuarios, autenticacao)

            const resultado = await useCase.executar({ id: 'user-1', nome: 'Nome', role: 'coordenador' })

            expect(resultado.ok).toBe(true)
            expect(atualizarNomeERole).toHaveBeenCalledWith('user-1', { nome: 'Nome', role: 'coordenador' })
            expect(possuiSenhaPropria).not.toHaveBeenCalled()
            expect(definirSenha).not.toHaveBeenCalled()
            expect(encerrarSessoes).not.toHaveBeenCalled()
        })

        it('recusa por inteiro quando a conta não tem senha própria — nem o papel muda', async () => {
            const { usuarios, atualizarNomeERole } = repositorioComConta('usuario', false)
            const { autenticacao, definirSenha } = servicoDeAutenticacao()
            const useCase = new EditarUsuarioUseCase(usuarios, autenticacao)

            const resultado = await useCase.executar({
                id: 'user-social',
                nome: 'Nome',
                role: 'coordenador',
                novaSenha: 'senha-nova-123'
            })

            expect(resultado.ok).toBe(false)
            if (resultado.ok) return
            expect(resultado.erro.codigo).toBe('senha_nao_aplicavel')
            // FR-015: a recusa é total. Uma implementação que trocasse o papel
            // antes de descobrir que a senha não se aplica passaria no teste
            // acima e falharia aqui.
            expect(definirSenha).not.toHaveBeenCalled()
            expect(atualizarNomeERole).not.toHaveBeenCalled()
        })

        it('define a senha antes do papel e encerra as sessões da conta', async () => {
            const { usuarios, atualizarNomeERole } = repositorioComConta('usuario')
            const { autenticacao, definirSenha, encerrarSessoes } = servicoDeAutenticacao()
            const useCase = new EditarUsuarioUseCase(usuarios, autenticacao)

            const resultado = await useCase.executar({
                id: 'user-1',
                nome: 'Nome',
                role: 'coordenador',
                novaSenha: 'senha-nova-123',
                sessaoPreservada: 'token-do-ator'
            })

            expect(resultado.ok).toBe(true)
            expect(definirSenha).toHaveBeenCalledWith('user-1', 'senha-nova-123')
            expect(encerrarSessoes).toHaveBeenCalledWith('user-1', 'token-do-ator')
            // Ordem importa: se a senha falhar, nada pode ter sido alterado.
            expect(definirSenha.mock.invocationCallOrder[0]).toBeLessThan(
                atualizarNomeERole.mock.invocationCallOrder[0]
            )
        })

        it('falha ao encerrar sessões não derruba a operação', async () => {
            const { usuarios, atualizarNomeERole } = repositorioComConta('usuario')
            const { autenticacao } = servicoDeAutenticacao(async () => {
                throw new Error('storage indisponível')
            })
            const useCase = new EditarUsuarioUseCase(usuarios, autenticacao)

            const resultado = await useCase.executar({
                id: 'user-1',
                nome: 'Nome',
                role: 'coordenador',
                novaSenha: 'senha-nova-123'
            })

            // A senha nova já é o efeito pedido; recusar tudo por causa da
            // limpeza de sessão deixaria a pessoa sem acesso (research D5).
            expect(resultado.ok).toBe(true)
            expect(atualizarNomeERole).toHaveBeenCalled()
        })
    })
})
