import type { ReactNode } from 'react'
import { ROLES_STAFF } from '@/src/shared/auth/roles'
import { exigirRoles } from '@/src/shared/auth/sessao'

/**
 * Gate de role da área interna (DESIGN.md §6.2) — **defesa em profundidade**.
 *
 * O `proxy.ts` já barrou o acesso a partir do cookie, mas cookies podem estar
 * forjados ou defasados entre o proxy e o render. Esta re-checagem via
 * `auth.api.getSession` é a fonte de verdade; ela também aplica o timeout de
 * inatividade de staff (§6.3), invalidando a sessão quando expirada.
 *
 * A sessão em si e o shell já vêm do `(interno)/layout.tsx` acima — aqui só se
 * acrescenta a exigência de role. Sem shell e sem notificações: nada disso é
 * responsabilidade deste nível.
 */
/**
 * O segmento lê sessão para checar a role, então não é prerenderizável — e
 * precisa declarar isso por si, não herdar do pai: o insight do Next aponta o
 * segmento onde a leitura acontece. A leitura em si é memoizada por request
 * (`obterSessao`), então esta checagem não custa um segundo hit ao banco.
 */
export const instant = false

export default async function StaffLayout({ children }: { children: ReactNode }) {
    await exigirRoles(ROLES_STAFF)
    return children
}
