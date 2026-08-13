import type { UsuarioRepository } from '@/src/modules/identidade/application/ports/usuario-repository'
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

/**
 * Executa `fn` dentro de uma única transação Postgres. É o que garante que
 * `voluntario_perfil.status` e `user.role` mudem juntos (BR-VOL-03).
 *
 * `usuarios` é o port de Identidade (`UsuarioRepository`), não uma cópia
 * local — `voluntariado` não é o dono de `user`, só um consumidor
 * (006-user-management-page, research.md D6).
 */
export interface UnidadeDeTrabalho {
    executar<T>(
        fn: (repos: { voluntarios: VoluntarioRepository; usuarios: UsuarioRepository }) => Promise<T>
    ): Promise<T>
}
