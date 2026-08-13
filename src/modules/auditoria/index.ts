import 'server-only'
import { atorAtual, type Ator } from '@/src/shared/contexto/ator'
import type { AcaoAuditada, EntidadeAuditada } from '@/src/shared/db/mongo/audit-logs'
import { registrarAuditoria } from './infrastructure/audit-writer'

export type { AcaoAuditada, EntidadeAuditada }
export { comAtor, atorAtual, type Ator } from '@/src/shared/contexto/ator'

export type OpcoesAuditoria<TResultado> = {
    entidade: EntidadeAuditada
    acao: AcaoAuditada
    /** Tabela concreta afetada (DB_SCHEMA.md §10). */
    tabela: string
    /**
     * Snapshot **antes** da mutação. Uma função, não um valor: só é lida quando
     * há de fato algo a auditar, e a leitura precisa acontecer antes de `fn`.
     */
    dadosAnteriores?: () => Promise<Record<string, unknown> | null>
    /** Extrai o id e o snapshot pós-mutação a partir do resultado de `fn`. */
    extrair: (resultado: TResultado) => { entidadeId: string; dadosNovos: Record<string, unknown> | null }
    /** Ator explícito — usado onde não há escopo `comAtor` (cron, scripts). */
    ator?: Ator
}

/**
 * Wrapper central de auditoria (BR-AUD-01, DESIGN.md §13).
 *
 * Todo caso de uso de escrita em Estoque/Voluntariado/Atividade passa por aqui
 * — **nunca** chamadas ad-hoc espalhadas pelas Server Actions, que é como um
 * caminho de escrita acaba ficando sem log.
 *
 * A auditoria acontece **depois** da mutação e nunca a desfaz: `fn` já
 * cometeu a transação Postgres quando gravamos o log.
 */
export async function withAudit<TResultado>(
    opcoes: OpcoesAuditoria<TResultado>,
    fn: () => Promise<TResultado>
): Promise<TResultado> {
    const ator = opcoes.ator ?? atorAtual()

    // A leitura do "antes" precisa acontecer antes da mutação — e não pode
    // derrubar a operação se falhar.
    let anteriores: Record<string, unknown> | null = null
    if (opcoes.dadosAnteriores) {
        try {
            anteriores = await opcoes.dadosAnteriores()
        } catch (erro) {
            console.error('[auditoria] falha ao capturar dadosAnteriores', {
                entidade: opcoes.entidade,
                tabela: opcoes.tabela,
                erro
            })
        }
    }

    const resultado = await fn()

    // Ator ausente significa operação sem usuário autenticado (cron, seed).
    // Registramos assim mesmo, marcado como `sistema`: a lacuna seria pior.
    const identificacao = ator ?? { userId: 'sistema', role: 'sistema' as const }

    try {
        const { entidadeId, dadosNovos } = opcoes.extrair(resultado)

        await registrarAuditoria({
            timestamp: new Date(),
            entidade: opcoes.entidade,
            entidadeId,
            acao: opcoes.acao,
            userId: identificacao.userId,
            userRole: identificacao.role,
            tabela: opcoes.tabela,
            dadosAnteriores: anteriores,
            dadosNovos,
            metadata: ator?.ip || ator?.userAgent ? { ip: ator.ip, userAgent: ator.userAgent } : undefined
        })
    } catch (erro) {
        // `extrair` pode lançar se o resultado não tiver a forma esperada.
        // Mesmo aqui a operação de negócio prossegue (DESIGN.md §13).
        console.error('[auditoria] falha ao montar registro de auditoria', {
            entidade: opcoes.entidade,
            tabela: opcoes.tabela,
            erro
        })
    }

    return resultado
}
