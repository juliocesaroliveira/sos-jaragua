import type { ReactNode } from 'react'
import { exigirSessao } from '@/src/shared/auth/sessao'
import { ShellAutenticado } from '../_shell/shell-autenticado'

/**
 * Layout de **toda** a área autenticada (specs/002-role-based-app-shell).
 *
 * Dois papéis, ambos válidos para qualquer perfil:
 *
 * 1. **Gate de sessão** — `exigirSessao` é a fonte de verdade que complementa a
 *    barreira rápida do `proxy.ts` (defesa em profundidade, DESIGN.md §6.2).
 *    Cobre também as páginas de `usuario`/`voluntario`, que antes dependiam
 *    apenas do proxy. O gate de role de staff continua existindo, um nível
 *    abaixo, em `(staff)/layout.tsx`.
 * 2. **Shell** — topbar + navegação lateral. Uma página autenticada nova nasce
 *    com ambos, sem que quem a cria precise fazer nada (FR-004).
 *
 * A montagem do shell vive em `app/_shell/` porque a página de endereço não
 * encontrado da raiz também precisa dela (specs/003-not-found-page).
 *
 * A área é inteiramente por-usuário: o gate lê a sessão (cookies + banco) e
 * pode redirecionar antes de qualquer render. Não há shell estático a
 * prerenderizar, então o segmento se declara não-instantâneo — as páginas
 * abaixo dele podem, individualmente, voltar a ser `instant`.
 */
export const instant = false

export default async function InternoLayout({ children }: { children: ReactNode }) {
    const ator = await exigirSessao()

    return <ShellAutenticado ator={ator}>{children}</ShellAutenticado>
}
