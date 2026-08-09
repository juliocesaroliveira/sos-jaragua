import { DomainError, ValidacaoError, falha, ok, type Result, type UseCase } from '@/src/shared/kernel'
import { validarCandidatura, type DadosCandidatura } from '../../domain/candidatura'
import type { PerfilVoluntario, VoluntarioRepository } from '../ports/voluntario-repository'

export type EntradaSubmeterCandidatura = {
    userId: string
    dados: DadosCandidatura
}

/**
 * BR-VOL-01 — submissão pública de candidatura (DESIGN.md §10.1).
 *
 * Cria ou atualiza `voluntario_perfil` com `status = 'pendente'`. O reenvio de
 * uma candidatura rejeitada reaproveita a mesma linha, limpando
 * `aprovadoPor`/`aprovadoEm`/`motivoRejeicao`.
 */
export class SubmeterCandidaturaUseCase implements UseCase<EntradaSubmeterCandidatura, PerfilVoluntario, DomainError> {
    constructor(private readonly voluntarios: VoluntarioRepository) {}

    async executar({ userId, dados }: EntradaSubmeterCandidatura): Promise<Result<PerfilVoluntario, DomainError>> {
        const validacao = validarCandidatura(dados)
        if (!validacao.ok) return validacao

        const candidatura = validacao.valor

        // O CPF é único por voluntário: se já pertence a **outra** conta, a
        // submissão é recusada em vez de sequestrar o perfil alheio.
        const existente = await this.voluntarios.buscarPorCpf(candidatura.cpf)
        if (existente && existente.userId !== userId) {
            return falha(
                new ValidacaoError('Este CPF já possui uma candidatura vinculada a outra conta.', {
                    campos: { cpf: 'CPF já cadastrado.' }
                })
            )
        }

        // Uma candidatura já aprovada não volta para a fila por um reenvio.
        if (existente?.status === 'aprovado') {
            return falha(
                new DomainError('candidatura_ja_aprovada', 'Sua candidatura já foi aprovada — não é preciso reenviar.')
            )
        }

        const perfil = await this.voluntarios.salvarCandidatura({ userId, dados: candidatura })
        return ok(perfil)
    }
}
