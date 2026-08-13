import { NaoEncontradoError, ok, falha, type DomainError, type Result, type UseCase } from '@/src/shared/kernel'
import { withAudit } from '@/src/modules/auditoria'
import type { Role } from '@/src/shared/auth/roles'
import type { UsuarioRepository } from '../ports/usuario-repository'

export type EntradaEditarUsuario = {
    id: string
    nome: string
    role: Role
}

export type SaidaEditarUsuario = {
    id: string
}

/**
 * FR-008/FR-010 (006-user-management-page) — edita nome e papel de uma
 * conta já existente. Não há e-mail nem senha na entrada, por construção do
 * tipo (contracts/gestao-usuarios.md E-01); não há restrição de qual papel
 * pode ser atribuído, inclusive à própria conta de quem edita (E-02).
 */
export class EditarUsuarioUseCase implements UseCase<EntradaEditarUsuario, SaidaEditarUsuario, DomainError> {
    constructor(private readonly usuarios: UsuarioRepository) {}

    async executar({ id, nome, role }: EntradaEditarUsuario): Promise<Result<SaidaEditarUsuario, DomainError>> {
        const roleAtual = await this.usuarios.buscarRole(id)
        if (roleAtual === null) return falha(new NaoEncontradoError('Conta não encontrada.'))

        await withAudit(
            {
                entidade: 'Usuario',
                acao: 'update',
                tabela: 'user',
                dadosAnteriores: async () => ({ role: roleAtual }),
                extrair: () => ({ entidadeId: id, dadosNovos: { nome, role } })
            },
            () => this.usuarios.atualizarNomeERole(id, { nome, role })
        )

        return ok({ id })
    }
}
