import type { Role } from '@/src/shared/auth/roles'
import type { CandidaturaValidada } from '../../domain/candidatura'

/**
 * Ports do módulo de Voluntariado (DESIGN.md §4). A `application` define o
 * contrato; `infrastructure/drizzle` implementa. Nenhum caso de uso importa
 * Drizzle diretamente.
 */

export type StatusVoluntario = 'pendente' | 'aprovado' | 'rejeitado'

export type PerfilVoluntario = {
    id: string
    userId: string
    nomeCompleto: string
    cpf: string
    status: StatusVoluntario
}

export interface VoluntarioRepository {
    /** Busca por CPF — chave de reaproveitamento no reenvio (BR-VOL-01). */
    buscarPorCpf(cpf: string): Promise<PerfilVoluntario | null>
    buscarPorId(id: string): Promise<PerfilVoluntario | null>

    /**
     * Cria ou atualiza o perfil do usuário, sempre deixando
     * `status = 'pendente'` e limpando a decisão de triagem anterior.
     */
    salvarCandidatura(entrada: { userId: string; dados: CandidaturaValidada }): Promise<PerfilVoluntario>

    /** Transição de status da triagem, dentro de uma transação. */
    aprovar(entrada: { perfilId: string; aprovadoPor: string }): Promise<void>
    rejeitar(entrada: { perfilId: string; aprovadoPor: string; motivo: string }): Promise<void>
}

export interface UserRepository {
    atualizarRole(userId: string, role: Role): Promise<void>
    buscarRole(userId: string): Promise<Role | null>
}

/**
 * Executa `fn` dentro de uma única transação Postgres. É o que garante que
 * `voluntario_perfil.status` e `user.role` mudem juntos (BR-VOL-03).
 */
export interface UnidadeDeTrabalho {
    executar<T>(fn: (repos: { voluntarios: VoluntarioRepository; usuarios: UserRepository }) => Promise<T>): Promise<T>
}
