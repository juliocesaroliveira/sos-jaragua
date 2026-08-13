import { DomainError, NaoEncontradoError, falha, ok, type Result, type UseCase } from '@/src/shared/kernel'
import { withAudit } from '@/src/modules/auditoria'
import type { NotificacaoService } from '@/src/modules/notificacoes/application/ports/notificacao-service'
import type { UnidadeDeTrabalho } from '../ports/voluntario-repository'

export type EntradaAprovarCandidatura = {
    perfilId: string
    aprovadoPor: string
}

export type SaidaAprovarCandidatura = {
    perfilId: string
    voluntarioUserId: string
    nomeCompleto: string
}

/**
 * BR-VOL-03 — aprovação de candidatura (DESIGN.md §4 trace, §10.1).
 *
 * `voluntario_perfil.status = 'aprovado'` e `user.role = 'voluntario'` mudam na
 * **mesma transação**: um voluntário aprovado sem a role (ou o contrário) seria
 * um estado inconsistente que a UI não sabe representar.
 *
 * A notificação sai **depois** do commit e é best-effort — falhar em avisar não
 * pode desfazer uma aprovação já registrada.
 */
export class AprovarCandidaturaUseCase implements UseCase<
    EntradaAprovarCandidatura,
    SaidaAprovarCandidatura,
    DomainError
> {
    constructor(
        private readonly uow: UnidadeDeTrabalho,
        private readonly notificacoes: NotificacaoService
    ) {}

    async executar({
        perfilId,
        aprovadoPor
    }: EntradaAprovarCandidatura): Promise<Result<SaidaAprovarCandidatura, DomainError>> {
        // BR-AUD-01: transição de status de `voluntario_perfil` é o evento de
        // auditoria mais sensível do módulo — muda a role de alguém.
        const resultado = await withAudit(
            {
                entidade: 'Voluntario',
                acao: 'update',
                tabela: 'voluntario_perfil',
                dadosAnteriores: async () => {
                    const perfil = await this.uow.executar(({ voluntarios }) => voluntarios.buscarPorId(perfilId))
                    return perfil ? { ...perfil } : null
                },
                extrair: (perfil) => ({
                    entidadeId: perfilId,
                    dadosNovos: perfil ? { ...perfil, status: 'aprovado', aprovadoPor } : null
                })
            },
            () =>
                this.uow.executar(async ({ voluntarios, usuarios }) => {
                    const perfil = await voluntarios.buscarPorId(perfilId)
                    if (!perfil) return null

                    await voluntarios.aprovar({ perfilId, aprovadoPor })

                    // Só promove quem ainda é `usuario`: um Coordenador que também é
                    // voluntário não pode ser rebaixado pela aprovação.
                    const roleAtual = await usuarios.buscarRole(perfil.userId)
                    if (roleAtual === 'usuario') {
                        await usuarios.atualizarRole(perfil.userId, 'voluntario')
                    }

                    return perfil
                })
        )

        if (!resultado) return falha(new NaoEncontradoError('Candidatura não encontrada.'))

        await this.notificacoes.enviar({
            evento: 'triagem_concluida',
            destinatarioUserId: resultado.userId,
            titulo: 'Seu cadastro foi aprovado',
            mensagem: `Olá, ${resultado.nomeCompleto}. Seu cadastro foi aprovado — você agora é um voluntário do SOS Jaraguá.`,
            contexto: { voluntarioPerfilId: perfilId }
        })

        return ok({
            perfilId,
            voluntarioUserId: resultado.userId,
            nomeCompleto: resultado.nomeCompleto
        })
    }
}
