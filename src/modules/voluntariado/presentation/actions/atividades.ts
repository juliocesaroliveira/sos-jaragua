'use server'

import { revalidateTag, updateTag } from 'next/cache'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { CACHE_TAGS, PERFIL_REVALIDACAO, tagAtividade } from '@/src/shared/cache'
import { erroAction, serializar, type ResultadoAction } from '@/src/shared/kernel'
import type { Role } from '@/src/shared/auth/roles'
import { comAtorDaSessao, obterSessao } from '@/src/shared/auth/sessao'
import { notificacaoService } from '@/src/modules/notificacoes/infrastructure'
import { atividadeRepository } from '../../infrastructure/drizzle/atividade-repository'
import { criarVoluntarioRepository } from '../../infrastructure/drizzle/voluntario-repository'
import {
    AlterarStatusAtividadeUseCase,
    CriarAtividadeUseCase,
    EditarAtividadeUseCase
} from '../../application/use-cases/gerir-atividade'
import { AlocarVoluntarioUseCase, CancelarAlocacaoUseCase } from '../../application/use-cases/alocar-voluntario'
import { gerarTurnosConsecutivos } from '../../domain/turno'

/**
 * Criar atividade, alocar e cancelar são atribuições de Coordenador
 * (BRD §2); Membro Defesa Civil não cria escala.
 */
const ROLES_GESTAO: readonly Role[] = ['coordenador', 'administrador']

async function exigirGestao() {
    const ator = await obterSessao()
    if (!ator || !ROLES_GESTAO.includes(ator.role)) return null
    return ator
}

const esquemaCriar = z.object({
    titulo: z.string().min(1),
    categoriaId: z.uuid(),
    local: z.string().min(1),
    /** Início do primeiro turno, em horário local (`YYYY-MM-DDTHH:mm`). */
    primeiroTurnoInicio: z.string().min(1),
    quantidadeTurnos: z.number().int().min(1).max(12),
    vagasPorTurno: z.number().int().min(1).max(999)
})

export type EntradaCriarAtividade = z.infer<typeof esquemaCriar>

/** BRD §3.3 + BR-VOL-04 — cria a atividade já fragmentada em turnos de 4h. */
export async function criarAtividade(entrada: EntradaCriarAtividade): Promise<ResultadoAction<{ id: string }>> {
    const ator = await exigirGestao()
    if (!ator) return erroAction('nao_autorizado', 'Somente coordenação pode criar atividades.')

    const parse = esquemaCriar.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Revise os campos do formulário.')

    const inicio = new Date(parse.data.primeiroTurnoInicio)
    if (Number.isNaN(inicio.getTime())) {
        return erroAction('validacao', 'Data e hora de início inválidas.')
    }

    const turnos = gerarTurnosConsecutivos(inicio, parse.data.quantidadeTurnos, parse.data.vagasPorTurno)

    const useCase = new CriarAtividadeUseCase(atividadeRepository)
    const resultado = await comAtorDaSessao(ator, () =>
        useCase.executar({
            titulo: parse.data.titulo,
            categoriaId: parse.data.categoriaId,
            local: parse.data.local,
            criadoPor: ator.userId,
            turnos
        })
    )

    if (resultado.ok) updateTag(CACHE_TAGS.atividades)

    return serializar(resultado.ok ? { ok: true, valor: { id: resultado.valor.id } } : resultado)
}

const esquemaEditar = z.object({
    id: z.uuid(),
    titulo: z.string().min(1),
    categoriaId: z.uuid(),
    local: z.string().min(1)
})

export async function editarAtividade(
    entrada: z.infer<typeof esquemaEditar>
): Promise<ResultadoAction<{ id: string }>> {
    const ator = await exigirGestao()
    if (!ator) return erroAction('nao_autorizado', 'Somente coordenação pode editar atividades.')

    const parse = esquemaEditar.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Revise os campos do formulário.')

    const useCase = new EditarAtividadeUseCase(atividadeRepository, notificacaoService)
    const resultado = await comAtorDaSessao(ator, () => useCase.executar(parse.data))

    if (resultado.ok) {
        updateTag(CACHE_TAGS.atividades)
        updateTag(tagAtividade(parse.data.id))
    }

    return serializar(resultado.ok ? { ok: true, valor: { id: resultado.valor.id } } : resultado)
}

const esquemaStatus = z.object({
    id: z.uuid(),
    status: z.enum(['aberta', 'encerrada', 'cancelada'])
})

export async function alterarStatusAtividade(
    entrada: z.infer<typeof esquemaStatus>
): Promise<ResultadoAction<{ id: string }>> {
    const ator = await exigirGestao()
    if (!ator) return erroAction('nao_autorizado', 'Somente coordenação pode alterar o status de atividades.')

    const parse = esquemaStatus.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Status inválido.')

    const useCase = new AlterarStatusAtividadeUseCase(atividadeRepository, notificacaoService)
    const resultado = await comAtorDaSessao(ator, () => useCase.executar(parse.data))

    if (resultado.ok) {
        updateTag(CACHE_TAGS.atividades)
        updateTag(tagAtividade(parse.data.id))
    }

    return serializar(resultado)
}

const esquemaAlocar = z.object({
    atividadeId: z.uuid(),
    turnoId: z.uuid(),
    voluntarioPerfilId: z.uuid()
})

/** BR-VOL-05 — vincula um voluntário aprovado a um turno. */
export async function alocarVoluntario(
    entrada: z.infer<typeof esquemaAlocar>
): Promise<ResultadoAction<{ alocacaoId: string }>> {
    const ator = await exigirGestao()
    if (!ator) return erroAction('nao_autorizado', 'Somente coordenação pode alocar voluntários.')

    const parse = esquemaAlocar.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Dados de alocação inválidos.')

    const useCase = new AlocarVoluntarioUseCase(atividadeRepository, criarVoluntarioRepository(), notificacaoService)
    const resultado = await comAtorDaSessao(ator, () =>
        useCase.executar({
            turnoId: parse.data.turnoId,
            voluntarioPerfilId: parse.data.voluntarioPerfilId,
            alocadoPor: ator.userId
        })
    )

    if (resultado.ok) {
        updateTag(tagAtividade(parse.data.atividadeId))
        revalidateTag(CACHE_TAGS.atividades, PERFIL_REVALIDACAO)
    }

    return serializar(resultado)
}

const esquemaCancelarAlocacao = z.object({ atividadeId: z.uuid(), alocacaoId: z.uuid() })

export async function cancelarAlocacao(
    entrada: z.infer<typeof esquemaCancelarAlocacao>
): Promise<ResultadoAction<{ alocacaoId: string }>> {
    const ator = await exigirGestao()
    if (!ator) return erroAction('nao_autorizado', 'Somente coordenação pode cancelar alocações.')

    const parse = esquemaCancelarAlocacao.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Alocação inválida.')

    const useCase = new CancelarAlocacaoUseCase(atividadeRepository, notificacaoService)
    const resultado = await comAtorDaSessao(ator, () => useCase.executar({ alocacaoId: parse.data.alocacaoId }))

    if (resultado.ok) {
        updateTag(tagAtividade(parse.data.atividadeId))
        revalidateTag(CACHE_TAGS.atividades, PERFIL_REVALIDACAO)
    }

    return serializar(resultado)
}
