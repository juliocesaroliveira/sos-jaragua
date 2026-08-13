import type { Role } from '@/src/shared/auth/roles'

/**
 * Ports do módulo de Identidade (DESIGN.md §4). A `application` define o
 * contrato; `infrastructure/drizzle` implementa. Nenhum caso de uso importa
 * Drizzle diretamente.
 *
 * Único ponto de leitura/escrita de `user.role` no projeto
 * (006-user-management-page, research.md D6) — `voluntariado` importa este
 * port em vez de manter uma cópia própria.
 */

export type LinhaUsuario = {
    id: string
    nome: string
    email: string
    role: Role
    criadoEm: string
}

export type FiltrosUsuarios = {
    page: number
    pageSize: number
}

export interface UsuarioRepository {
    /** Listagem paginada de todas as contas (FR-001, FR-002). */
    listar(filtros: FiltrosUsuarios): Promise<{ rows: LinhaUsuario[]; totalCount: number }>

    /**
     * Atualiza nome e papel juntos — a tela de edição de `/admin` nunca
     * chama um método por campo, para não deixar a decisão de ordem para
     * quem chama (contracts/gestao-usuarios.md, R-02).
     */
    atualizarNomeERole(userId: string, dados: { nome: string; role: Role }): Promise<void>

    /**
     * Atualiza só o papel — usado por fluxos que promovem role como efeito
     * colateral de outra regra de negócio (ex.: `AprovarCandidaturaUseCase`),
     * sem precisar buscar e re-enviar o nome atual só para satisfazer uma
     * assinatura de dois campos.
     */
    atualizarRole(userId: string, role: Role): Promise<void>

    buscarRole(userId: string): Promise<Role | null>
}
