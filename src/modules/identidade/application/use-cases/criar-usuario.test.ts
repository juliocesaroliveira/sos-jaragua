import { describe, expect, it, vi } from 'vitest'
import type { AutenticacaoService } from '../ports/autenticacao-service'
import type { UsuarioRepository } from '../ports/usuario-repository'
import { CriarUsuarioUseCase } from './criar-usuario'

/**
 * TDD — `CriarUsuarioUseCase` (006-user-management-page).
 *
 * A criação real de senha (`signUpEmail`) é responsabilidade do
 * `AutenticacaoService`; aqui só a orquestração é testada: e-mail
 * duplicado, sucesso, e a falha parcial entre criar a conta e definir o
 * papel (research.md D5, contracts/gestao-usuarios.md C-05).
 */

// A auditoria escreve no Mongo; aqui só interessa que não atrapalhe.
vi.mock('@/src/modules/auditoria', () => ({
    withAudit: <T>(_opcoes: unknown, fn: () => Promise<T>) => fn()
}))

const ENTRADA = {
    nome: 'Ana Beatriz',
    email: 'ana@example.com',
    senha: 'senha-forte-123',
    role: 'coordenador' as const
}

function servicoQueCria(userId = 'user-1') {
    const criarConta = vi.fn<AutenticacaoService['criarConta']>(async () => ({ ok: true, userId }))
    return { autenticacao: { criarConta } satisfies AutenticacaoService, criarConta }
}

function servicoQueRejeitaDuplicado() {
    const criarConta = vi.fn<AutenticacaoService['criarConta']>(async () => ({ ok: false, erro: 'email_duplicado' }))
    return { autenticacao: { criarConta } satisfies AutenticacaoService, criarConta }
}

function repositorioQueAceita() {
    const atualizarNomeERole = vi.fn<UsuarioRepository['atualizarNomeERole']>(async () => undefined)
    const usuarios: UsuarioRepository = {
        listar: vi.fn(),
        atualizarNomeERole,
        atualizarRole: vi.fn(),
        buscarRole: vi.fn()
    }
    return { usuarios, atualizarNomeERole }
}

function repositorioQueFalha() {
    const atualizarNomeERole = vi.fn<UsuarioRepository['atualizarNomeERole']>(async () => {
        throw new Error('conexão perdida')
    })
    const usuarios: UsuarioRepository = {
        listar: vi.fn(),
        atualizarNomeERole,
        atualizarRole: vi.fn(),
        buscarRole: vi.fn()
    }
    return { usuarios, atualizarNomeERole }
}

describe('CriarUsuarioUseCase', () => {
    it('cria a conta e define nome/papel em caso de sucesso', async () => {
        const { autenticacao, criarConta } = servicoQueCria('user-42')
        const { usuarios, atualizarNomeERole } = repositorioQueAceita()
        const useCase = new CriarUsuarioUseCase(autenticacao, usuarios)

        const resultado = await useCase.executar(ENTRADA)

        expect(resultado.ok).toBe(true)
        if (!resultado.ok) return
        expect(resultado.valor).toEqual({ id: 'user-42' })
        expect(criarConta).toHaveBeenCalledWith({ nome: ENTRADA.nome, email: ENTRADA.email, senha: ENTRADA.senha })
        expect(atualizarNomeERole).toHaveBeenCalledWith('user-42', { nome: ENTRADA.nome, role: ENTRADA.role })
    })

    it('rejeita e-mail já cadastrado com erro de campo', async () => {
        const { autenticacao } = servicoQueRejeitaDuplicado()
        const { usuarios, atualizarNomeERole } = repositorioQueAceita()
        const useCase = new CriarUsuarioUseCase(autenticacao, usuarios)

        const resultado = await useCase.executar(ENTRADA)

        expect(resultado.ok).toBe(false)
        if (resultado.ok) return
        const campos = resultado.erro.detalhes?.campos as Record<string, string>
        expect(campos.email).toBeTruthy()
        // Sem tentativa de definir papel para uma conta que não foi criada.
        expect(atualizarNomeERole).not.toHaveBeenCalled()
    })

    it('reporta aviso distinto de falha total quando a conta é criada mas o papel não pôde ser definido', async () => {
        const { autenticacao } = servicoQueCria('user-99')
        const { usuarios } = repositorioQueFalha()
        const useCase = new CriarUsuarioUseCase(autenticacao, usuarios)

        const resultado = await useCase.executar(ENTRADA)

        expect(resultado.ok).toBe(false)
        if (resultado.ok) return
        expect(resultado.erro.codigo).toBe('papel_nao_definido')
        // A conta criada não é apagada — o id existe no detalhe do erro para a
        // Server Action ainda invalidar a listagem (contracts C-05).
        expect(resultado.erro.detalhes?.id).toBe('user-99')
    })
})
