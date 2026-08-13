/**
 * Papéis de acesso — matriz de atores do BRD §2 / DESIGN.md §6.1.
 * `role` vive em `user` (não em tabela separada) para que `session.user.role`
 * esteja disponível sem query extra em cada checagem do `proxy.ts`.
 */
export const ROLES = ['usuario', 'voluntario', 'membro_defesa_civil', 'coordenador', 'administrador'] as const

export type Role = (typeof ROLES)[number]

export const ROLE_PADRAO: Role = 'usuario'

/** Rótulos em pt-BR para exibição na UI (NFR §2.2). */
export const ROTULO_ROLE: Record<Role, string> = {
    usuario: 'Usuário',
    voluntario: 'Voluntário',
    membro_defesa_civil: 'Membro da Defesa Civil',
    coordenador: 'Coordenador',
    administrador: 'Administrador'
}

/** Roles com acesso à área interna `(staff)`. */
export const ROLES_STAFF: readonly Role[] = ['membro_defesa_civil', 'coordenador', 'administrador']

/** Roles sujeitas ao timeout de inatividade do NFR §3 (DESIGN.md §6.3). */
export const ROLES_COM_TIMEOUT_INATIVIDADE: readonly Role[] = ['membro_defesa_civil', 'coordenador']

/**
 * Trava de consistência com o enum físico (`db/schema/identidade.ts`
 * `ROLES_DB`): se as listas divergirem, isto quebra o `tsc`. Só o **tipo** é
 * importado, então nada do schema entra no bundle do cliente.
 */
type RolesDb = (typeof import('@/db/schema/identidade'))['ROLES_DB'][number]
type Identicos<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never
const _rolesEmSincronia: Identicos<Role, RolesDb> = true
void _rolesEmSincronia

export function ehRole(valor: unknown): valor is Role {
    return typeof valor === 'string' && (ROLES as readonly string[]).includes(valor)
}
