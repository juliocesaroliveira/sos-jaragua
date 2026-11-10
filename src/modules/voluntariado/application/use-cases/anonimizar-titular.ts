import { withAudit, type Ator } from '@/src/modules/auditoria'
import type { Role } from '@/src/shared/auth/roles'
import type { ImpactoExclusao, UnidadeDeTrabalho, VoluntarioRepository } from '../ports/voluntario-repository'

/**
 * Eliminação dos próprios dados a pedido do titular (feature 025, FR-020 a
 * FR-030) — LGPD art. 18, VI.
 *
 * **Anonimiza no lugar, nunca apaga.** A análise das chaves estrangeiras
 * (research.md D7) não deixa alternativa: `alocacao.participante_user_id` é
 * cascade e um `DELETE` destruiria o histórico de turnos, enquanto
 * `alocacao.alocado_por`, `atividade.criado_por` e as tabelas de estoque não
 * declaram `onDelete`, então o `DELETE` falharia para quem tem histórico
 * operacional.
 *
 * ## Sobre FR-031
 *
 * O requisito manda impedir que a eliminação deixe sem ator registros que exigem
 * responsável. Com a anonimização no lugar isso é **satisfeito por construção**:
 * a linha de `user` permanece, apenas sem dado pessoal, e toda FK que a
 * referencia continua válida. Não existe estado em que o requisito possa ser
 * violado, então não há checagem a fazer — a decisão de D7 já o garante.
 */

export type EntradaAnonimizacao = {
    titular: { userId: string; role: Role | undefined }
}

export type ResultadoAnonimizacao = { ok: true; jaAnonimizado: boolean }

export class AnonimizarTitularUseCase {
    constructor(
        private readonly uow: UnidadeDeTrabalho,
        private readonly leitura: VoluntarioRepository
    ) {}

    /** Impacto a mostrar antes da confirmação (FR-021). */
    async impacto(userId: string): Promise<ImpactoExclusao> {
        return this.leitura.impactoDaExclusao(userId)
    }

    async executar({ titular }: EntradaAnonimizacao): Promise<ResultadoAnonimizacao> {
        const antes = await this.leitura.impactoDaExclusao(titular.userId)

        // Idempotente: uma segunda solicitação conclui sem erro e sem efeito
        // colateral (FR-025, FR-030). Quem clica duas vezes não recebe erro.
        if (antes.jaAnonimizado) return { ok: true, jaAnonimizado: true }

        const identificacao: Ator = { userId: titular.userId, role: titular.role ?? 'usuario' }

        await withAudit(
            {
                entidade: 'Voluntario',
                acao: 'anonimizar',
                tabela: 'voluntario_perfil',
                ator: identificacao,
                // Nada de "antes": reproduzir na trilha os dados que acabaram de
                // ser eliminados anularia a própria eliminação (FR-029).
                dadosAnteriores: async () => null,
                extrair: (r) => ({
                    entidadeId: r.perfilId ?? titular.userId,
                    dadosNovos: {
                        motivo: 'Eliminação solicitada pelo titular (LGPD art. 18, VI)',
                        turnosFuturosCancelados: antes.turnosFuturosConfirmados,
                        turnosPassadosPreservados: antes.turnosPassados,
                        tinhaPerfilVoluntario: antes.temPerfilVoluntario
                    }
                })
            },
            () =>
                // Tudo em uma transação: perfil e conta não podem ficar em estados
                // diferentes se algo falhar no meio.
                this.uow.executar(async ({ voluntarios, usuarios }) => {
                    const perfil = await voluntarios.anonimizarPerfil(titular.userId)
                    await usuarios.anonimizarConta(titular.userId)
                    return { perfilId: perfil?.perfilId ?? null }
                })
        )

        return { ok: true, jaAnonimizado: false }
    }
}
