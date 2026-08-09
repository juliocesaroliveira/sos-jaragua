import 'server-only'
import { AsyncLocalStorage } from 'node:async_hooks'
import type { Role } from '@/src/shared/auth/roles'

/**
 * Identidade do ator propagada por requisição (DESIGN.md §13).
 *
 * Sem isto, `withAudit` exigiria receber `actor` explicitamente em toda a
 * cadeia de chamadas — presentation → use case → repositório —, poluindo
 * assinaturas de código que não tem nada a ver com auditoria. O
 * `AsyncLocalStorage` mantém o contexto disponível em qualquer profundidade da
 * mesma cadeia assíncrona, sem variável global compartilhada entre requisições.
 */
export type Ator = {
    userId: string
    role: Role
    ip?: string
    userAgent?: string
}

const armazenamento = new AsyncLocalStorage<Ator>()

/** Executa `fn` com o ator disponível para toda a cadeia assíncrona abaixo. */
export function comAtor<T>(ator: Ator, fn: () => Promise<T>): Promise<T> {
    return armazenamento.run(ator, fn)
}

/**
 * Ator da requisição corrente, ou `null` fora de um escopo `comAtor` — o caso
 * do cron e de scripts, que não têm usuário autenticado.
 */
export function atorAtual(): Ator | null {
    return armazenamento.getStore() ?? null
}
