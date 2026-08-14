'use server'

import { z } from '@/src/shared/validacao/zod-ptbr'
import { erroAction, type ResultadoAction } from '@/src/shared/kernel'
import { normalizarPaginacao, type PaginaDe } from '@/src/shared/paginacao/esquema'
import { podeAcessar } from '@/src/shared/auth/rotas'
import { obterSessao } from '@/src/shared/auth/sessao'
import { CATEGORIAS_ITEM } from '../../domain/item'
import { listarEstoque, listarSaidas, type ItemComSaldo, type LinhaSaidaPlana } from '../queries/estoque'

/**
 * Leituras paginadas de Estoque consumidas pelo TanStack Query
 * (007-datatable-server-pagination, US3).
 *
 * Ficam separadas de `actions/estoque.ts` — que concentra as **escritas**
 * auditadas (entrada, saída, descarte) — porque leitura e escrita têm
 * autorização, cache e tratamento de erro diferentes; misturá-las tornaria
 * fácil um dia proteger uma pelo gate da outra.
 *
 * Como em toda leitura desta feature, o gate de role vive aqui e não na query
 * `'use cache'`, que não pode ler `cookies()` (L-02).
 */

const esquemaFiltrosEstoque = z
    .object({
        categoria: z.enum(CATEGORIAS_ITEM).optional().catch(undefined)
    })
    .catch({})

export async function listarEstoqueAction(entrada: unknown): Promise<ResultadoAction<PaginaDe<ItemComSaldo>>> {
    const ator = await obterSessao()
    if (!podeAcessar('/estoque', ator?.role)) {
        return erroAction('nao_autorizado', 'Você não tem permissão para consultar o estoque.')
    }

    const filtros = { ...normalizarPaginacao(entrada), ...esquemaFiltrosEstoque.parse(entrada ?? {}) }
    return { ok: true, valor: await listarEstoque(filtros) }
}

/**
 * Histórico de saídas da aba de `/relatorios`. Usa a leitura paginada, não a de
 * exportação — a tela precisa de uma página por vez (FR-008); o download
 * continua com o conjunto completo.
 */
export async function listarSaidasAction(entrada: unknown): Promise<ResultadoAction<PaginaDe<LinhaSaidaPlana>>> {
    const ator = await obterSessao()
    if (!podeAcessar('/relatorios', ator?.role)) {
        return erroAction('nao_autorizado', 'Você não tem permissão para consultar o histórico de saídas.')
    }

    return { ok: true, valor: await listarSaidas(normalizarPaginacao(entrada)) }
}
