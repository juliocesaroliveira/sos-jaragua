'use server'

import { z } from '@/src/shared/validacao/zod-ptbr'
import { erroAction, type ResultadoAction } from '@/src/shared/kernel'
import { normalizarPaginacao, type PaginaDe } from '@/src/shared/paginacao/esquema'
import { podeAcessar } from '@/src/shared/auth/rotas'
import { obterSessao } from '@/src/shared/auth/sessao'
import {
    listarItensLookup,
    listarKitsLookup,
    sugerirItens,
    sugerirKits,
    type ItemComSaldo,
    type KitLookup
} from '../queries/estoque'

/**
 * Leituras do componente Lookup (021, contracts/leituras-lookup.md).
 *
 * Ficam separadas das escritas auditadas de `actions/estoque.ts` pelo mesmo
 * motivo de `listagens.ts`: leitura e escrita têm autorização, cache e
 * tratamento de erro diferentes. O gate de role vive aqui, e não nas queries
 * `'use cache'`, que não podem ler `cookies()`.
 *
 * A permissão é a de leitura do cadastro (`/estoque`), não a do formulário que
 * usa o Lookup (FR-018): nada aqui devolve mais do que a listagem de estoque já
 * mostra a quem tem esse acesso.
 */

/** Termo de busca saneado — entrada inválida vira busca vazia, nunca erro. */
const esquemaTermo = z.string().trim().max(100).catch('')
const esquemaSugestao = z.object({ termo: esquemaTermo }).catch({ termo: '' })

/** Abaixo disso a similaridade não discrimina nada útil (L-01). */
const MINIMO_CARACTERES = 2

async function autorizado(): Promise<boolean> {
    const ator = await obterSessao()
    return podeAcessar('/estoque', ator?.role)
}

const NAO_AUTORIZADO = 'Você não tem permissão para consultar o estoque.'

function lerPagina(entrada: unknown) {
    const { termo } = esquemaSugestao.parse(entrada ?? {})
    return { ...normalizarPaginacao(entrada), termo: termo || undefined }
}

export async function sugerirItensAction(entrada: unknown): Promise<ResultadoAction<ItemComSaldo[]>> {
    if (!(await autorizado())) return erroAction('nao_autorizado', NAO_AUTORIZADO)

    const { termo } = esquemaSugestao.parse(entrada ?? {})
    if (termo.length < MINIMO_CARACTERES) return { ok: true, valor: [] }
    return { ok: true, valor: await sugerirItens(termo) }
}

export async function listarItensLookupAction(entrada: unknown): Promise<ResultadoAction<PaginaDe<ItemComSaldo>>> {
    if (!(await autorizado())) return erroAction('nao_autorizado', NAO_AUTORIZADO)
    return { ok: true, valor: await listarItensLookup(lerPagina(entrada)) }
}

export async function sugerirKitsAction(entrada: unknown): Promise<ResultadoAction<KitLookup[]>> {
    if (!(await autorizado())) return erroAction('nao_autorizado', NAO_AUTORIZADO)

    const { termo } = esquemaSugestao.parse(entrada ?? {})
    if (termo.length < MINIMO_CARACTERES) return { ok: true, valor: [] }
    return { ok: true, valor: await sugerirKits(termo) }
}

export async function listarKitsLookupAction(entrada: unknown): Promise<ResultadoAction<PaginaDe<KitLookup>>> {
    if (!(await autorizado())) return erroAction('nao_autorizado', NAO_AUTORIZADO)
    return { ok: true, valor: await listarKitsLookup(lerPagina(entrada)) }
}
