import type { UsuarioRepository } from '@/src/modules/identidade/application/ports/usuario-repository'
import type { CandidaturaValidada } from '../../domain/candidatura'

/**
 * Ports do módulo de Voluntariado (DESIGN.md §4). A `application` define o
 * contrato; `infrastructure/drizzle` implementa. Nenhum caso de uso importa
 * Drizzle diretamente.
 */

export type StatusVoluntario = 'pendente' | 'aprovado' | 'rejeitado'

/** Números que a confirmação de exclusão precisa mostrar (FR-021). */
export type ImpactoExclusao = {
    turnosFuturosConfirmados: number
    turnosPassados: number
    temPerfilVoluntario: boolean
    jaAnonimizado: boolean
}

/** Valores sensíveis em claro, com o dono e o estado de anonimização. */
export type DadosSensiveisPerfil = {
    userId: string
    cpf: string | null
    dataNascimento: string | null
    cep: string | null
    anonimizadoEm: Date | null
}

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
    /** Perfil do usuário, se houver — elegibilidade da inscrição própria (FR-011). */
    buscarPorUserId(userId: string): Promise<PerfilVoluntario | null>

    /**
     * Valores sensíveis **em claro** de um perfil, para o caminho de revelação
     * (feature 024, FR-016).
     *
     * Devolve em claro porque decifrar é responsabilidade de `infrastructure`; a
     * autorização — quem pode ver qual campo — é decidida no caso de uso, contra
     * a Matriz de Visibilidade. Pode lançar `ValorIlegivelError` quando a chave
     * não confere ou o dado foi alterado (FR-014).
     */
    buscarDadosSensiveis(perfilId: string): Promise<DadosSensiveisPerfil | null>

    /**
     * Cria ou atualiza o perfil do usuário, sempre deixando
     * `status = 'pendente'` e limpando a decisão de triagem anterior.
     */
    salvarCandidatura(entrada: { userId: string; dados: CandidaturaValidada }): Promise<PerfilVoluntario>

    /**
     * Impacto da eliminação, para a confirmação exigida por FR-021.
     *
     * A tela precisa dizer **quantos** turnos futuros serão cancelados antes de
     * a pessoa confirmar — "isto é irreversível" sem número não informa nada.
     */
    impactoDaExclusao(userId: string): Promise<ImpactoExclusao>

    /**
     * Anonimiza o perfil e trata as alocações (FR-022 a FR-025).
     *
     * Esvazia os campos pessoais, marca `anonimizadoEm`, remove as habilidades
     * declaradas e cancela as alocações **futuras** confirmadas, liberando vaga.
     * As alocações passadas ficam intactas: são o registro operacional da
     * resposta a desastres que FR-024 manda preservar.
     *
     * Devolve `null` quando não há perfil — o titular pode ter conta sem
     * cadastro de voluntário (FR-025, cenário 7 da US4).
     */
    anonimizarPerfil(userId: string): Promise<{ perfilId: string } | null>

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
