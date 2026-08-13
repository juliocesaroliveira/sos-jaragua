import {
    DomainError,
    NaoEncontradoError,
    ValidacaoError,
    falha,
    ok,
    type Result,
    type UseCase
} from '@/src/shared/kernel'
import { withAudit } from '@/src/modules/auditoria'
import type { VoluntarioRepository } from '../ports/voluntario-repository'

export type EntradaRejeitarCandidatura = {
    perfilId: string
    aprovadoPor: string
    motivo: string
}

/**
 * BR-VOL-02 — rejeição de candidatura.
 *
 * O motivo é obrigatório: é o que o candidato precisa para corrigir e reenviar
 * (o reenvio é permitido e reaproveita a mesma linha, BR-VOL-01).
 */
export class RejeitarCandidaturaUseCase implements UseCase<EntradaRejeitarCandidatura, { perfilId: string }> {
    constructor(private readonly voluntarios: VoluntarioRepository) {}

    async executar({
        perfilId,
        aprovadoPor,
        motivo
    }: EntradaRejeitarCandidatura): Promise<Result<{ perfilId: string }, DomainError>> {
        const motivoLimpo = motivo.trim()
        if (motivoLimpo.length < 5) {
            return falha(
                new ValidacaoError('Descreva o motivo da rejeição.', {
                    campos: { motivo: 'Informe ao menos 5 caracteres.' }
                })
            )
        }

        const perfil = await this.voluntarios.buscarPorId(perfilId)
        if (!perfil) return falha(new NaoEncontradoError('Candidatura não encontrada.'))

        await withAudit(
            {
                entidade: 'Voluntario',
                acao: 'update',
                tabela: 'voluntario_perfil',
                dadosAnteriores: async () => ({ ...perfil }),
                extrair: () => ({
                    entidadeId: perfilId,
                    dadosNovos: { ...perfil, status: 'rejeitado', aprovadoPor, motivoRejeicao: motivoLimpo }
                })
            },
            () => this.voluntarios.rejeitar({ perfilId, aprovadoPor, motivo: motivoLimpo })
        )

        return ok({ perfilId })
    }
}
