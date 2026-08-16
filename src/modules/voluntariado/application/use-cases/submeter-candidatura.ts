import { DomainError, ValidacaoError, falha, ok, type Result, type UseCase } from '@/src/shared/kernel'
import { withAudit } from '@/src/modules/auditoria'
import { resolverDataNascimento, validarCandidatura, type DadosCandidatura } from '../../domain/candidatura'
import type { PerfilVoluntario, UnidadeDeTrabalho } from '../ports/voluntario-repository'

export type EntradaSubmeterCandidatura = {
    userId: string
    dados: DadosCandidatura
    /**
     * Data de nascimento já registrada na conta (`YYYY-MM-DD`), ou `null`.
     * Vem **da sessão**, nunca do corpo do POST — 011-auto-cadastro-provedor,
     * FR-017.
     */
    dataNascimentoDaConta: string | null
}

/**
 * BR-VOL-01 — submissão pública de candidatura (DESIGN.md §10.1).
 *
 * Cria ou atualiza `voluntario_perfil` com `status = 'pendente'`. O reenvio de
 * uma candidatura rejeitada reaproveita a mesma linha, limpando
 * `aprovadoPor`/`aprovadoEm`/`motivoRejeicao`.
 *
 * **011-auto-cadastro-provedor**: a data de nascimento passou a pertencer à
 * conta (FR-016). Quando a conta já a possui, ela vence o que veio do
 * formulário; quando não, a data informada aqui é gravada em `user` **na mesma
 * transação** do perfil. As duas escritas juntas evitam o estado
 * "candidatura gravada, conta sem data", que faria o campo voltar a aparecer
 * editável no próximo acesso, contradizendo FR-014.
 */
export class SubmeterCandidaturaUseCase implements UseCase<EntradaSubmeterCandidatura, PerfilVoluntario, DomainError> {
    constructor(private readonly uow: UnidadeDeTrabalho) {}

    async executar({
        userId,
        dados,
        dataNascimentoDaConta
    }: EntradaSubmeterCandidatura): Promise<Result<PerfilVoluntario, DomainError>> {
        // A conta é a autoridade sobre a data; o formulário só entra quando ela
        // ainda não tem valor. `?? ''` deixa a mensagem de campo obrigatório
        // com `validarCandidatura`, onde essa regra já mora.
        const dataFinal = resolverDataNascimento(dataNascimentoDaConta, dados.dataNascimento)

        const validacao = validarCandidatura({ ...dados, dataNascimento: dataFinal ?? '' })
        if (!validacao.ok) return validacao

        const candidatura = validacao.valor

        // O CPF é único por voluntário: se já pertence a **outra** conta, a
        // submissão é recusada em vez de sequestrar o perfil alheio.
        const existente = await this.uow.executar(({ voluntarios }) => voluntarios.buscarPorCpf(candidatura.cpf))

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

        const perfil = await withAudit(
            {
                entidade: 'Voluntario',
                // Reenvio reaproveita a linha existente (BR-VOL-01) — o que é
                // `update`, não `create`.
                acao: existente ? 'update' : 'create',
                tabela: 'voluntario_perfil',
                dadosAnteriores: async () => (existente ? { ...existente } : null),
                extrair: (salvo) => ({ entidadeId: salvo.id, dadosNovos: { ...salvo } })
            },
            () =>
                this.uow.executar(async ({ voluntarios, usuarios }) => {
                    const salvo = await voluntarios.salvarCandidatura({ userId, dados: candidatura })

                    // Só grava quando a conta ainda não tinha a data. O
                    // repositório também protege com `is null` no WHERE, mas
                    // não chamar deixa a intenção explícita: a data da conta
                    // não é reescrita a cada reenvio.
                    if (dataNascimentoDaConta === null) {
                        await usuarios.definirDataNascimentoSeAusente(userId, candidatura.dataNascimento)
                    }

                    return salvo
                })
        )

        return ok(perfil)
    }
}
