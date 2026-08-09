import type { ReactNode } from 'react'
import { ROLES_STAFF, ROTULO_ROLE } from '@/src/shared/auth/roles'
import { exigirRoles } from '@/src/shared/auth/sessao'
import { StaffShell } from './staff-shell'

/**
 * Layout da área interna (DESIGN.md §6.2) — **defesa em profundidade**.
 *
 * O `proxy.ts` já barrou o acesso a partir do cookie, mas cookies podem estar
 * forjados ou defasados entre o proxy e o render. Esta re-checagem via
 * `auth.api.getSession` é a fonte de verdade; ela também aplica o timeout de
 * inatividade de staff (§6.3), invalidando a sessão quando expirada.
 */
/**
 * A área interna é inteiramente por-usuário: o gate lê a sessão (cookies +
 * banco) e pode redirecionar antes de qualquer render. Não há shell estático a
 * prerenderizar, então o segmento se declara não-instantâneo — as páginas
 * abaixo dele podem, individualmente, voltar a ser `instant`.
 */
export const instant = false

export default async function StaffLayout({ children }: { children: ReactNode }) {
    const ator = await exigirRoles(ROLES_STAFF)

    return (
        <StaffShell nome={ator.nome} role={ator.role} rotuloRole={ROTULO_ROLE[ator.role]}>
            {children}
        </StaffShell>
    )
}
