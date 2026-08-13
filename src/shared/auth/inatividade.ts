import { ROLES_COM_TIMEOUT_INATIVIDADE, type Role } from './roles'

/**
 * Timeout de inatividade customizado para staff (NFR §3, DESIGN.md §6.3).
 *
 * O better-auth não tem expiração de sessão por role, então o mecanismo é
 * próprio: `session.lastActivityAt` é atualizado a cada requisição autenticada
 * de Coordenador/Membro Defesa Civil, e a sessão é tratada como expirada quando
 * a inatividade ultrapassa `STAFF_INACTIVITY_TIMEOUT_MINUTES`.
 *
 * Mitiga o risco de sessão aberta em computador compartilhado da central de
 * operações. Não se aplica a `voluntario`/`usuario`/`administrador`.
 */
const DEFAULT_TIMEOUT_MINUTOS = 15

export function timeoutInatividadeMinutos(): number {
    const bruto = Number(process.env.STAFF_INACTIVITY_TIMEOUT_MINUTES)
    return Number.isFinite(bruto) && bruto > 0 ? bruto : DEFAULT_TIMEOUT_MINUTOS
}

export function sujeitoATimeout(role: Role | undefined): boolean {
    return role !== undefined && ROLES_COM_TIMEOUT_INATIVIDADE.includes(role)
}

/**
 * `true` quando a sessão deve ser encerrada por inatividade.
 * `lastActivityAt` ausente (sessão recém-criada) nunca expira — a primeira
 * requisição autenticada é quem grava o carimbo.
 */
export function expirouPorInatividade(role: Role | undefined, lastActivityAt: Date | null | undefined): boolean {
    if (!sujeitoATimeout(role)) return false
    if (!lastActivityAt) return false
    const limiteMs = timeoutInatividadeMinutos() * 60_000
    return Date.now() - new Date(lastActivityAt).getTime() > limiteMs
}
