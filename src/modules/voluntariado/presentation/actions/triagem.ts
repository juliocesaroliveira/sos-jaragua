'use server'

import { revalidateTag, updateTag } from 'next/cache'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { CACHE_TAGS, PERFIL_REVALIDACAO } from '@/src/shared/cache'
import { erroAction, serializar, type ResultadoAction } from '@/src/shared/kernel'
import { ROLES_STAFF } from '@/src/shared/auth/roles'
import { comAtorDaSessao, obterSessao } from '@/src/shared/auth/sessao'
import { notificacaoService } from '@/src/modules/notificacoes/infrastructure'
import { criarVoluntarioRepository, unidadeDeTrabalho } from '../../infrastructure/drizzle/voluntario-repository'
import { AprovarCandidaturaUseCase } from '../../application/use-cases/aprovar-candidatura'
import { RejeitarCandidaturaUseCase } from '../../application/use-cases/rejeitar-candidatura'

const esquemaAprovar = z.object({ perfilId: z.uuid() })
const esquemaRejeitar = z.object({ perfilId: z.uuid(), motivo: z.string().min(1) })

/** BR-VOL-03 — aprovar candidatura (Membro Defesa Civil, Coordenador ou Admin). */
export async function aprovarCandidatura(entrada: {
    perfilId: string
}): Promise<ResultadoAction<{ perfilId: string }>> {
    const ator = await obterSessao()
    if (!ator || !ROLES_STAFF.includes(ator.role)) {
        return erroAction('nao_autorizado', 'Você não tem permissão para aprovar candidaturas.')
    }

    const parse = esquemaAprovar.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Candidatura inválida.')

    const useCase = new AprovarCandidaturaUseCase(unidadeDeTrabalho, notificacaoService)
    const resultado = await comAtorDaSessao(ator, () =>
        useCase.executar({ perfilId: parse.data.perfilId, aprovadoPor: ator.userId })
    )

    if (resultado.ok) {
        // `updateTag`: a candidatura precisa sumir da fila na mesma resposta.
        updateTag(CACHE_TAGS.voluntariadoPendentes)
        revalidateTag(CACHE_TAGS.voluntariadoListagem, PERFIL_REVALIDACAO)
    }

    return serializar(resultado.ok ? { ok: true, valor: { perfilId: resultado.valor.perfilId } } : resultado)
}

/** BR-VOL-02 — rejeitar candidatura, com motivo obrigatório. */
export async function rejeitarCandidatura(entrada: {
    perfilId: string
    motivo: string
}): Promise<ResultadoAction<{ perfilId: string }>> {
    const ator = await obterSessao()
    if (!ator || !ROLES_STAFF.includes(ator.role)) {
        return erroAction('nao_autorizado', 'Você não tem permissão para rejeitar candidaturas.')
    }

    const parse = esquemaRejeitar.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Informe o motivo da rejeição.')

    const useCase = new RejeitarCandidaturaUseCase(criarVoluntarioRepository())
    const resultado = await comAtorDaSessao(ator, () =>
        useCase.executar({
            perfilId: parse.data.perfilId,
            aprovadoPor: ator.userId,
            motivo: parse.data.motivo
        })
    )

    if (resultado.ok) {
        updateTag(CACHE_TAGS.voluntariadoPendentes)
        revalidateTag(CACHE_TAGS.voluntariadoListagem, PERFIL_REVALIDACAO)
    }

    return serializar(resultado)
}
