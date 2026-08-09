import type { Role } from './roles'

/**
 * Mapa rota → roles permitidas, espelhando a matriz de atores do BRD §2
 * (DESIGN.md §6.2). Os prefixos são os **paths públicos**: o route group
 * `(staff)` não aparece na URL.
 *
 * A ordem importa — o primeiro prefixo que casar decide. Rotas mais
 * específicas (`/estoque/descarte`) vêm antes das mais genéricas
 * (`/estoque`).
 */
export const REGRAS_DE_ROTA: ReadonlyArray<{ prefixo: string; roles: readonly Role[] }> = [
    // Estoque — descarte e receita de kit são restritos a coordenação
    { prefixo: '/estoque/descarte', roles: ['coordenador', 'administrador'] },
    { prefixo: '/estoque/kits', roles: ['coordenador', 'administrador'] },
    { prefixo: '/estoque', roles: ['membro_defesa_civil', 'coordenador', 'administrador'] },

    // Gestão de usuários/permissões
    { prefixo: '/admin', roles: ['administrador'] },

    // Convocação em massa — alcance grande demais para operação de campo
    { prefixo: '/convocacao', roles: ['coordenador', 'administrador'] },

    // Relatórios e exportações
    { prefixo: '/relatorios', roles: ['coordenador', 'administrador'] },
    { prefixo: '/api/relatorios/export', roles: ['coordenador', 'administrador'] },
    { prefixo: '/api/contingencia/export', roles: ['coordenador', 'administrador'] },

    // Triagem, atividades e dashboard
    { prefixo: '/cadastros-pendentes', roles: ['membro_defesa_civil', 'coordenador', 'administrador'] },
    { prefixo: '/voluntarios', roles: ['membro_defesa_civil', 'coordenador', 'administrador'] },
    { prefixo: '/atividades', roles: ['membro_defesa_civil', 'coordenador', 'administrador'] },
    { prefixo: '/dashboard', roles: ['membro_defesa_civil', 'coordenador', 'administrador'] },
    { prefixo: '/crise', roles: ['membro_defesa_civil', 'coordenador', 'administrador'] },

    // Área do voluntário
    {
        prefixo: '/voluntariado/minhas-atividades',
        roles: ['voluntario', 'membro_defesa_civil', 'coordenador', 'administrador']
    }
]

/** Roles exigidas para `pathname`, ou `null` se a rota não é protegida. */
export function rolesExigidas(pathname: string): readonly Role[] | null {
    const regra = REGRAS_DE_ROTA.find((r) => pathname === r.prefixo || pathname.startsWith(`${r.prefixo}/`))
    return regra?.roles ?? null
}

export function podeAcessar(pathname: string, role: Role | undefined): boolean {
    const exigidas = rolesExigidas(pathname)
    if (!exigidas) return true
    return role !== undefined && exigidas.includes(role)
}
