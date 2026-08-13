import { DomainError, ValidacaoError, falha, ok, type Result, type UseCase } from '@/src/shared/kernel'
import { withAudit } from '@/src/modules/auditoria'
import type { Role } from '@/src/shared/auth/roles'
import type { AutenticacaoService } from '../ports/autenticacao-service'
import type { UsuarioRepository } from '../ports/usuario-repository'

export type EntradaCriarUsuario = {
    nome: string
    email: string
    senha: string
    role: Role
}

export type SaidaCriarUsuario = {
    id: string
}

/**
 * FR-004 (006-user-management-page) — cadastro de conta a partir de `/admin`.
 *
 * A senha é hasheada pelo `AutenticacaoService` (`auth.api.signUpEmail`),
 * nunca aqui — `role` é `additionalField` com `input: false` em `auth.ts`,
 * então precisa de uma segunda escrita depois da criação da conta
 * (research.md D5).
 */
export class CriarUsuarioUseCase implements UseCase<EntradaCriarUsuario, SaidaCriarUsuario, DomainError> {
    constructor(
        private readonly autenticacao: AutenticacaoService,
        private readonly usuarios: UsuarioRepository
    ) {}

    async executar({ nome, email, senha, role }: EntradaCriarUsuario): Promise<Result<SaidaCriarUsuario, DomainError>> {
        const criacao = await this.autenticacao.criarConta({ nome, email, senha })

        if (!criacao.ok) {
            return falha(
                new ValidacaoError('Este e-mail já está cadastrado.', {
                    campos: { email: 'Este e-mail já está cadastrado.' }
                })
            )
        }

        try {
            await withAudit(
                {
                    entidade: 'Usuario',
                    acao: 'create',
                    tabela: 'user',
                    // Nunca a senha — só o que a conta passa a ter (DESIGN.md §13).
                    extrair: () => ({ entidadeId: criacao.userId, dadosNovos: { nome, email, role } })
                },
                () => this.usuarios.atualizarNomeERole(criacao.userId, { nome, role })
            )
        } catch {
            // A conta já existe (com o papel padrão) — reportar como aviso
            // específico, não como falha total (research.md D5,
            // contracts/gestao-usuarios.md C-05). `id` vai no detalhe para a
            // Server Action ainda invalidar a listagem.
            return falha(
                new DomainError(
                    'papel_nao_definido',
                    'A conta foi criada, mas não foi possível definir o papel escolhido. Edite a conta para corrigir.',
                    { id: criacao.userId }
                )
            )
        }

        return ok({ id: criacao.userId })
    }
}
