import type { Ambiente, ImpressaoDigital, PedidoAcao } from '../../domain/previa'
import type { RegistroExecucaoManutencao } from '../ports/registro-execucao'
import type { AtorDangerZone } from './montar-previa'

/**
 * Registra o cancelamento explícito na confirmação (C-05, US3 cenário 2).
 *
 * Best-effort: o administrador desistiu, nada foi alterado, e uma falha da
 * auditoria aqui não merece interromper ninguém. Fechar a aba sem cancelar não
 * gera registro — limitação documentada na spec (edge cases).
 */
export class CancelarAcaoUseCase {
    constructor(private readonly deps: { registro: RegistroExecucaoManutencao; novoId?: () => string }) {}

    async executar(entrada: {
        pedido: PedidoAcao
        impressaoDigital: ImpressaoDigital
        ator: AtorDangerZone
        ambiente: Ambiente
    }): Promise<void> {
        const { pedido, ator } = entrada
        try {
            await this.deps.registro.registrarDesfecho({
                execucaoId: (this.deps.novoId ?? (() => crypto.randomUUID()))(),
                fase: 'cancelada',
                ator: { userId: ator.userId, role: ator.role, ip: ator.ip, userAgent: ator.userAgent },
                resumo: {
                    acao: pedido.acao,
                    tabela: pedido.tabela,
                    modo: pedido.modo ?? 'sem_dependentes',
                    ambiente: entrada.ambiente,
                    impressaoDigital: entrada.impressaoDigital,
                    ...(pedido.chaves ? { selecionados: pedido.chaves.length } : {})
                }
            })
        } catch {
            console.error('[manutencao] falha ao registrar cancelamento', { tabela: pedido.tabela })
        }
    }
}
