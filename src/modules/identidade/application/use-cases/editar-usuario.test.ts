import { describe, expect, it, vi } from 'vitest'
import type { Role } from '@/src/shared/auth/roles'
import type { UsuarioRepository } from '../ports/usuario-repository'
import { EditarUsuarioUseCase } from './editar-usuario'

/**
 * TDD — `EditarUsuarioUseCase` (006-user-management-page, US3).
 *
 * FR-008/FR-010: edita nome e papel de uma conta já existente, sem tocar
 * e-mail/senha (nem sequer os recebe — o tipo de entrada não os tem).
 */

vi.mock('@/src/modules/auditoria', () => ({
    withAudit: <T>(_opcoes: unknown, fn: () => Promise<T>) => fn()
}))

function repositorioComConta(roleAtual: Role | null) {
    const buscarRole = vi.fn<UsuarioRepository['buscarRole']>(async () => roleAtual)
    const atualizarNomeERole = vi.fn<UsuarioRepository['atualizarNomeERole']>(async () => undefined)
    const usuarios: UsuarioRepository = {
        listar: vi.fn(),
        atualizarNomeERole,
        atualizarRole: vi.fn(),
        buscarRole
    }
    return { usuarios, buscarRole, atualizarNomeERole }
}

describe('EditarUsuarioUseCase', () => {
    it('atualiza nome e papel de uma conta existente', async () => {
        const { usuarios, atualizarNomeERole } = repositorioComConta('voluntario')
        const useCase = new EditarUsuarioUseCase(usuarios)

        const resultado = await useCase.executar({ id: 'user-1', nome: 'Novo Nome', role: 'coordenador' })

        expect(resultado.ok).toBe(true)
        if (!resultado.ok) return
        expect(resultado.valor).toEqual({ id: 'user-1' })
        expect(atualizarNomeERole).toHaveBeenCalledWith('user-1', { nome: 'Novo Nome', role: 'coordenador' })
    })

    it('devolve erro quando a conta não existe', async () => {
        const { usuarios, atualizarNomeERole } = repositorioComConta(null)
        const useCase = new EditarUsuarioUseCase(usuarios)

        const resultado = await useCase.executar({ id: 'user-inexistente', nome: 'Nome', role: 'usuario' })

        expect(resultado.ok).toBe(false)
        if (resultado.ok) return
        expect(resultado.erro.codigo).toBe('nao_encontrado')
        expect(atualizarNomeERole).not.toHaveBeenCalled()
    })

    it('não restringe qual papel pode ser atribuído (Assumptions da spec, Q2)', async () => {
        const { usuarios, atualizarNomeERole } = repositorioComConta('usuario')
        const useCase = new EditarUsuarioUseCase(usuarios)

        // Inclusive concedendo `administrador`, e inclusive à própria conta de
        // quem edita (o caso de uso não sabe nem precisa saber quem é o ator).
        const resultado = await useCase.executar({ id: 'user-1', nome: 'Nome', role: 'administrador' })

        expect(resultado.ok).toBe(true)
        expect(atualizarNomeERole).toHaveBeenCalledWith('user-1', { nome: 'Nome', role: 'administrador' })
    })
})
