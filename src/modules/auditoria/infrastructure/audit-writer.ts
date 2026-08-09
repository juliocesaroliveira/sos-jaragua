import 'server-only'
import { colecaoAuditoria, type RegistroAuditoria } from '@/src/shared/db/mongo/audit-logs'

/**
 * Escritor do log de auditoria (BR-AUD-01, DESIGN.md §13).
 *
 * **Política de falha — decisão final da spec: degradar graciosamente.** Se o
 * Mongo estiver indisponível durante a crise, a operação Postgres original já
 * aconteceu e **prossegue**; a falha de auditoria é registrada em log
 * estruturado (visível no Log Stream da Vercel) para reconciliação manual.
 *
 * O trade-off é explícito: disponibilidade das operações críticas de campo
 * (aprovar voluntário, registrar saída) durante um desastre pesa mais que o
 * risco de uma lacuna pontual no log.
 */
const TENTATIVAS = 2 // 1 tentativa + 1 retry (DESIGN.md §13)
const ESPERA_ENTRE_TENTATIVAS_MS = 150

export async function registrarAuditoria(registro: RegistroAuditoria): Promise<boolean> {
    for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
        try {
            await colecaoAuditoria().insertOne(registro)
            return true
        } catch (erro) {
            const ultima = tentativa === TENTATIVAS
            if (!ultima) {
                // Retry curto: cobre falha transitória de rede sem adicionar
                // latência perceptível à operação de campo.
                await new Promise((r) => setTimeout(r, ESPERA_ENTRE_TENTATIVAS_MS))
                continue
            }

            // Log estruturado com o registro completo: é o que permite
            // reconstruir a lacuna manualmente depois.
            console.error('[auditoria] falha ao gravar audit_log — operação de negócio NÃO foi desfeita', {
                entidade: registro.entidade,
                entidadeId: registro.entidadeId,
                acao: registro.acao,
                userId: registro.userId,
                timestamp: registro.timestamp.toISOString(),
                erro: erro instanceof Error ? erro.message : String(erro),
                registro
            })
            return false
        }
    }
    return false
}
