import type { ReactNode } from 'react'
import { itensDeNavegacao } from '@/src/shared/auth/navegacao'
import { ROTULO_ROLE } from '@/src/shared/auth/roles'
import { exigirSessao } from '@/src/shared/auth/sessao'
import { AppShell } from '@/src/shared/ui'
import { contarNaoLidas, listarNotificacoes } from '@/src/modules/notificacoes/presentation/queries/notificacoes'
import { SinoNotificacoes } from './sino-notificacoes'

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
 * A área é inteiramente por-usuário: o gate lê a sessão (cookies + banco) e
 * pode redirecionar antes de qualquer render. Não há shell estático a
 * prerenderizar, então o segmento se declara não-instantâneo — as páginas
 * abaixo dele podem, individualmente, voltar a ser `instant`.
 */
export const instant = false

export default async function InternoLayout({ children }: { children: ReactNode }) {
    const ator = await exigirSessao()

    // Notificações são por-usuário e nunca cacheadas (DESIGN.md §7). Ficam no
    // layout para o sino estar presente em toda a área autenticada — e valem
    // para todos os perfis, não só staff: voluntários recebem lembrete de turno
    // e candidatos recebem o resultado da triagem (research.md D5).
    const [notificacoes, naoLidas] = await Promise.all([listarNotificacoes(ator.userId), contarNaoLidas(ator.userId)])

    return (
        <AppShell
            nome={ator.nome}
            // Filtrado aqui, no servidor: o cliente recebe só o que já pode ver.
            itens={itensDeNavegacao(ator.role)}
            rotuloRole={ROTULO_ROLE[ator.role]}
            notificacoes={<SinoNotificacoes notificacoes={notificacoes} naoLidas={naoLidas} />}
        >
            {children}
        </AppShell>
    )
}
