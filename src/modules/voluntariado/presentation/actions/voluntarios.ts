'use server'

import { z } from '@/src/shared/validacao/zod-ptbr'
import { erroAction, type ResultadoAction } from '@/src/shared/kernel'
import { normalizarPaginacao, type PaginaDe } from '@/src/shared/paginacao/esquema'
import { podeAcessar } from '@/src/shared/auth/rotas'
import { obterSessao } from '@/src/shared/auth/sessao'
import { listarVoluntarios, type LinhaVoluntario } from '../queries/candidaturas'

/** Filtros da tela; valor fora da lista é ignorado, não rejeitado (FR-012). */
const esquemaFiltros = z
    .object({
        status: z.enum(['pendente', 'aprovado', 'rejeitado']).optional().catch(undefined),
        habilidadeId: z.string().min(1).optional().catch(undefined)
    })
    .catch({})

/**
 * Leitura paginada da base de voluntários, consumida pelo TanStack Query
 * (007-datatable-server-pagination, US3).
 *
 * O gate de role acontece aqui, e não dentro de `listarVoluntarios`: aquela é
 * uma função `'use cache'`, que não pode ler `cookies()`. Deriva de
 * `REGRAS_DE_ROTA['/voluntarios']` para não existirem duas listas de papéis
 * divergindo em silêncio (contracts/leituras-paginadas.md L-02).
 */
export async function listarVoluntariosAction(entrada: unknown): Promise<ResultadoAction<PaginaDe<LinhaVoluntario>>> {
    const ator = await obterSessao()
    if (!podeAcessar('/voluntarios', ator?.role)) {
        return erroAction('nao_autorizado', 'Você não tem permissão para consultar voluntários.')
    }

    const filtros = { ...normalizarPaginacao(entrada), ...esquemaFiltros.parse(entrada ?? {}) }
    return { ok: true, valor: await listarVoluntarios(filtros) }
}
