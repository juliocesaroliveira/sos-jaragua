import 'server-only'
import type { ReactNode } from 'react'
import { itensDeNavegacao } from '@/src/shared/auth/navegacao'
import { ROTULO_ROLE } from '@/src/shared/auth/roles'
import type { SessaoAtor } from '@/src/shared/auth/sessao'
import { AppShell } from '@/src/shared/ui'
import { contarNaoLidas, listarNotificacoes } from '@/src/modules/notificacoes/presentation/queries/notificacoes'
import { SinoNotificacoes } from '../(interno)/sino-notificacoes'

/**
 * Montagem do shell autenticado a partir de um ator já resolvido.
 *
 * Extraído de `(interno)/layout.tsx` porque **dois** lugares precisam dele em
 * posições diferentes da árvore: o layout da área autenticada e a página de
 * endereço não encontrado da raiz, que não tem layout de área aplicável
 * (specs/003-not-found-page/research.md D1).
 *
 * **Recebe `ator` por prop em vez de buscá-lo** (contrato S-01): os dois
 * chamadores obtêm a sessão de formas incompatíveis — o layout usa
 * `exigirSessao()`, que redireciona quem não tem; a página de erro usa
 * `obterSessao()`, que aceita `null` e muda a apresentação. Uma página de erro
 * que redireciona seria defeito, não proteção.
 *
 * Fica em `app/_shell/` e não no barrel do design system porque é `server-only`
 * e consulta o módulo de notificações — `src/shared/ui/index.ts` é importado
 * livremente por Client Components.
 */
export async function ShellAutenticado({ ator, children }: { ator: SessaoAtor; children: ReactNode }) {
    // Notificações são por-usuário e nunca cacheadas (DESIGN.md §7). Valem para
    // todos os perfis, não só staff (feature 002, research D5).
    const [notificacoes, naoLidas] = await Promise.all([listarNotificacoes(ator.userId), contarNaoLidas(ator.userId)])

    return (
        <AppShell
            nome={ator.nome}
            // Filtrado no servidor: o cliente recebe só o que já pode ver.
            itens={itensDeNavegacao(ator.role)}
            rotuloRole={ROTULO_ROLE[ator.role]}
            notificacoes={<SinoNotificacoes notificacoes={notificacoes} naoLidas={naoLidas} />}
        >
            {children}
        </AppShell>
    )
}
