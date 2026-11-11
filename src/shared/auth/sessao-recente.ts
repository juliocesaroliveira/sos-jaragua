/**
 * Janela de "sessão recente" para ações destrutivas (026-danger-zone-admin,
 * FR-003, research D11).
 *
 * Mede a idade do **login** (`session.createdAt`), não da última atividade:
 * navegar não renova a prova de posse da credencial. Fora da janela, a Danger
 * Zone pede um novo login — que funciona igual para quem entra com senha e para
 * quem entra só por provedor social.
 *
 * Módulo puro (sem `server-only`) para poder ser testado sem stubs.
 */
export const JANELA_SESSAO_RECENTE_MS = 15 * 60_000

export function sessaoRecente(
    sessao: { sessaoCriadaEm: Date },
    agora: Date = new Date(),
    limiteMs: number = JANELA_SESSAO_RECENTE_MS
): boolean {
    const idade = agora.getTime() - sessao.sessaoCriadaEm.getTime()
    // Idade negativa (relógio adiantado no servidor de auth) conta como recente
    // só até o limite — não é uma brecha para sessões antigas.
    return Number.isFinite(idade) && idade <= limiteMs && idade > -limiteMs
}
