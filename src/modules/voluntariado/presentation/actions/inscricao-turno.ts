'use server'

import { updateTag } from 'next/cache'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { CACHE_TAGS, tagAtividade } from '@/src/shared/cache'
import { erroAction, serializar, type ResultadoAction } from '@/src/shared/kernel'
import { ROLES_STAFF, type Role } from '@/src/shared/auth/roles'
import { comAtorDaSessao, obterSessao } from '@/src/shared/auth/sessao'
import { notificacaoService } from '@/src/modules/notificacoes/infrastructure'
import { atividadeRepository } from '../../infrastructure/drizzle/atividade-repository'
import { criarVoluntarioRepository } from '../../infrastructure/drizzle/voluntario-repository'
import { DesistirDeTurnoUseCase, InscreverEmTurnoUseCase } from '../../application/use-cases/inscricao-turno'

/**
 * Inscrição própria em turno (018-inscricao-atividades, contratos I-01/I-02).
 *
 * Mesmos papéis da rota `/voluntariado/atividades-abertas`: todos menos o
 * usuário comum. O participante é **sempre** o usuário da sessão — a entrada
 * não tem campo de usuário nem de perfil (A-02).
 */
const ROLES_INSCRICAO: readonly Role[] = ['voluntario', 'membro_defesa_civil', 'coordenador', 'administrador']

async function exigirParticipante() {
    const ator = await obterSessao()
    if (!ator || !ROLES_INSCRICAO.includes(ator.role)) return null
    return ator
}

function invalidar(atividadeId: string) {
    updateTag(CACHE_TAGS.atividades)
    updateTag(tagAtividade(atividadeId))
}

const esquemaInscrever = z.object({ atividadeId: z.uuid(), turnoId: z.uuid() })

export async function inscreverEmTurno(entrada: unknown): Promise<ResultadoAction<{ alocacaoId: string }>> {
    const ator = await exigirParticipante()
    if (!ator) return erroAction('nao_autorizado', 'Você não tem permissão para se inscrever em turnos.')

    const parse = esquemaInscrever.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Turno inválido.')

    const useCase = new InscreverEmTurnoUseCase(atividadeRepository, criarVoluntarioRepository(), notificacaoService)
    const resultado = await comAtorDaSessao(ator, () =>
        useCase.executar({
            turnoId: parse.data.turnoId,
            participanteUserId: ator.userId,
            nomeParticipante: ator.nome,
            equipeInterna: ROLES_STAFF.includes(ator.role),
            agora: new Date()
        })
    )

    // Recusas por estado (lotado, atividade fechada) também invalidam: a tela
    // do participante estava defasada e precisa refletir o estado real.
    invalidar(parse.data.atividadeId)

    return serializar(resultado)
}

const esquemaDesistir = z.object({ atividadeId: z.uuid(), alocacaoId: z.uuid() })

export async function desistirDeTurno(entrada: unknown): Promise<ResultadoAction<{ alocacaoId: string }>> {
    const ator = await exigirParticipante()
    if (!ator) return erroAction('nao_autorizado', 'Você não tem permissão para se inscrever em turnos.')

    const parse = esquemaDesistir.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Alocação inválida.')

    const useCase = new DesistirDeTurnoUseCase(atividadeRepository, notificacaoService)
    const resultado = await comAtorDaSessao(ator, () =>
        useCase.executar({
            alocacaoId: parse.data.alocacaoId,
            participanteUserId: ator.userId,
            nomeParticipante: ator.nome,
            agora: new Date()
        })
    )

    if (resultado.ok) invalidar(parse.data.atividadeId)

    return serializar(resultado)
}
