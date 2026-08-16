import { withAudit } from '@/src/modules/auditoria'
import type { Role } from '@/src/shared/auth/roles'

export type EntradaRegistrarAutoCadastro = {
    id: string
    nome: string
    email: string
    role: Role
    /** `google`, `facebook` ou `credential` (cadastro por e-mail e senha). */
    provedor: string
    ip?: string
    userAgent?: string
}

/**
 * Auditoria da criação automática de conta (011-auto-cadastro-provedor, FR-009,
 * contracts/auto-cadastro.md C-06).
 *
 * Chamado pelo `databaseHooks.user.create.after` do better-auth — depois que a
 * linha existe, nunca no `before`, que auditaria uma criação que ainda pode
 * falhar.
 *
 * **Ator explícito, não `atorAtual()`**: no auto-cadastro não há sessão ainda,
 * então o `AsyncLocalStorage` está vazio e o `withAudit` cairia no fallback
 * `sistema` — um log que registra a criação mas não diz de quem. O parâmetro
 * `ator` de `OpcoesAuditoria` existe exatamente para escopos sem sessão.
 *
 * A operação de negócio (criar a conta) **já aconteceu** quando chegamos aqui;
 * a `fn` passada ao `withAudit` é só o portador do snapshot. Isso mantém o
 * formato do registro idêntico ao das demais escritas auditadas, em vez de
 * abrir um caminho paralelo de log (Princípio V).
 */
export class RegistrarAutoCadastroUseCase {
    async executar(entrada: EntradaRegistrarAutoCadastro): Promise<void> {
        // Lista de campos explícita, não spread do objeto do better-auth: o
        // usuário que chega no hook carrega tokens do provedor e imagem de
        // perfil, e `audit_logs` é imutável — o que vaza ali não sai mais.
        const dadosNovos = {
            id: entrada.id,
            nome: entrada.nome,
            email: entrada.email,
            role: entrada.role,
            provedor: entrada.provedor
        }

        try {
            await withAudit(
                {
                    entidade: 'Usuario',
                    acao: 'create',
                    tabela: 'user',
                    ator: {
                        userId: entrada.id,
                        role: entrada.role,
                        ip: entrada.ip,
                        userAgent: entrada.userAgent
                    },
                    extrair: () => ({ entidadeId: entrada.id, dadosNovos })
                },
                async () => dadosNovos
            )
        } catch (erro) {
            // O `withAudit` já degrada graciosamente por dentro; esta rede
            // existe para o caso de a própria montagem do registro falhar.
            // Um login não pode ser derrubado por um problema de auditoria.
            console.error('[auto-cadastro] falha ao auditar criação de conta', {
                userId: entrada.id,
                provedor: entrada.provedor,
                erro
            })
        }
    }
}
