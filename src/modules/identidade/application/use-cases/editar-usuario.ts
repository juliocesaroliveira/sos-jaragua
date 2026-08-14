import { DomainError, NaoEncontradoError, ok, falha, type Result, type UseCase } from '@/src/shared/kernel'
import { withAudit } from '@/src/modules/auditoria'
import type { Role } from '@/src/shared/auth/roles'
import type { AutenticacaoService } from '../ports/autenticacao-service'
import type { UsuarioRepository } from '../ports/usuario-repository'

export type EntradaEditarUsuario = {
    id: string
    nome: string
    role: Role
    /**
     * Ausente = a senha não é tocada. Presente = substitui a senha atual
     * (008-admin-password-reset, FR-008/FR-009).
     */
    novaSenha?: string
    /**
     * Token da sessão de quem executa a ação. Preservado ao encerrar as demais
     * sessões, para que quem redefine a própria senha não seja deslogado logo
     * após a confirmação (FR-016).
     */
    sessaoPreservada?: string
}

export type SaidaEditarUsuario = {
    id: string
}

/**
 * FR-008/FR-010 (006-user-management-page) — edita nome e papel de uma
 * conta já existente. Não há e-mail na entrada, por construção do tipo
 * (contracts/gestao-usuarios.md E-01); não há restrição de qual papel
 * pode ser atribuído, inclusive à própria conta de quem edita (E-02).
 *
 * 008-admin-password-reset acrescenta a redefinição de senha. Duas regras
 * moram aqui, e não na tela:
 *
 * 1. **Só redefine quem tem senha própria.** Contas que entram por Google ou
 *    Facebook não ganham senha por esta via. A ausência do botão na interface
 *    é conveniência; esta checagem é a proteção (FR-013).
 * 2. **Senha antes de papel.** As duas escritas não compartilham transação — a
 *    senha passa pelo provedor de autenticação, o papel pelo Postgres. Ordenar
 *    assim faz a escrita mais sujeita a falhar acontecer primeiro: se ela
 *    falhar, nada foi alterado, que é o tudo-ou-nada que FR-015 pede.
 */
export class EditarUsuarioUseCase implements UseCase<EntradaEditarUsuario, SaidaEditarUsuario, DomainError> {
    constructor(
        private readonly usuarios: UsuarioRepository,
        private readonly autenticacao: AutenticacaoService
    ) {}

    async executar({
        id,
        nome,
        role,
        novaSenha,
        sessaoPreservada
    }: EntradaEditarUsuario): Promise<Result<SaidaEditarUsuario, DomainError>> {
        const roleAtual = await this.usuarios.buscarRole(id)
        if (roleAtual === null) return falha(new NaoEncontradoError('Conta não encontrada.'))

        const redefinindoSenha = novaSenha !== undefined

        if (redefinindoSenha) {
            // Antes de qualquer escrita: uma recusa aqui não pode deixar o
            // papel já alterado (FR-015).
            const temSenhaPropria = await this.usuarios.possuiSenhaPropria(id)
            if (!temSenhaPropria) {
                return falha(
                    new DomainError(
                        'senha_nao_aplicavel',
                        'Esta conta acessa o sistema por Google ou Facebook e não possui senha para trocar.'
                    )
                )
            }

            await this.autenticacao.definirSenha(id, novaSenha)
        }

        await withAudit(
            {
                entidade: 'Usuario',
                acao: 'update',
                tabela: 'user',
                dadosAnteriores: async () => ({ role: roleAtual }),
                // `senhaRedefinida` é booleano: o log registra que houve troca,
                // nunca o valor trocado (FR-018/FR-019).
                extrair: () => ({
                    entidadeId: id,
                    dadosNovos: redefinindoSenha ? { nome, role, senhaRedefinida: true } : { nome, role }
                })
            },
            () => this.usuarios.atualizarNomeERole(id, { nome, role })
        )

        if (redefinindoSenha) {
            // A senha nova já é o efeito que a administração pediu. Falhar a
            // operação porque a limpeza de sessão não funcionou deixaria a
            // pessoa sem acesso — mesmo racional da auditoria não bloqueante.
            try {
                await this.autenticacao.encerrarSessoes(id, sessaoPreservada)
            } catch (erro) {
                console.error('[identidade] falha ao encerrar sessões após redefinição de senha', { id, erro })
            }
        }

        return ok({ id })
    }
}
