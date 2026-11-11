import { DomainError, falha, ok, type Result } from '@/src/shared/kernel'
import type { PaginaDe } from '@/src/shared/paginacao/esquema'
import type { ExecucaoManutencao } from '@/src/modules/auditoria'
import type { NomesDeAtores } from '../ports/nomes-de-atores'

export type LinhaHistorico = ExecucaoManutencao & { ator: string }

export type LeitorExecucoes = {
    listar(janela: { limite: number; deslocamento: number }): Promise<ExecucaoManutencao[]>
    contar(): Promise<number>
}

const ATOR_REMOVIDO = 'Administrador removido'

/**
 * Histórico das ações da Danger Zone (US3, C-06). Lido da trilha de auditoria,
 * não de tabela própria: uma tabela no Postgres seria resetável pela própria
 * Danger Zone (research D16).
 */
export class HistoricoUseCase {
    constructor(private readonly deps: { leitor: LeitorExecucoes; nomes: NomesDeAtores }) {}

    async executar({
        page,
        pageSize
    }: {
        page: number
        pageSize: number
    }): Promise<Result<PaginaDe<LinhaHistorico>, DomainError>> {
        try {
            const [execucoes, total] = await Promise.all([
                this.deps.leitor.listar({ limite: pageSize, deslocamento: (page - 1) * pageSize }),
                this.deps.leitor.contar()
            ])
            const nomes = await this.deps.nomes([...new Set(execucoes.map((e) => e.userId))])
            return ok({
                rows: execucoes.map((e) => ({ ...e, ator: nomes.get(e.userId) ?? ATOR_REMOVIDO })),
                totalCount: total,
                page,
                pageSize
            })
        } catch (erro) {
            if (erro instanceof Error && erro.name === 'AuditoriaIndisponivelError') {
                return falha(
                    new DomainError(
                        'auditoria_indisponivel',
                        'A trilha de auditoria está indisponível no momento. Tente novamente em instantes.'
                    )
                )
            }
            throw erro
        }
    }
}
