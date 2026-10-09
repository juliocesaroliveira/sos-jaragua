import { z } from '@/src/shared/validacao/zod-ptbr'
import { nomesPorIds } from '@/src/modules/identidade/presentation/queries/relatorios'
import { CATEGORIAS_ITEM, ROTULO_CATEGORIA_ITEM, type CategoriaItem } from '@/src/modules/estoque/domain/item'
import type { CampoFiltro, OpcaoFiltro } from '../../domain/catalogo'
import type { FiltroDescrito } from '../definicao-relatorio'
import { USUARIO_NAO_ENCONTRADO } from '../formatacao'

/**
 * Peças repetidas entre as definições de relatório.
 *
 * Os esquemas de filtro opcional usam `.catch(undefined)`: a URL é editável e
 * pode trazer um valor antigo ou digitado à mão — ele é ignorado, não derruba
 * o relatório (mesma regra das listagens, 007-datatable-server-pagination).
 */

/** Enum opcional e tolerante: fora da lista vira ausente. */
export function enumOpcional<const T extends readonly [string, ...string[]]>(valores: T) {
    return z.enum(valores).optional().catch(undefined)
}

/** Texto opcional, aparado; vazio vira ausente. */
export const textoOpcional = z
    .string()
    .trim()
    .transform((v) => v || undefined)
    .optional()
    .catch(undefined)

/** Id opcional (uuid ou id do better-auth): só exige não ser vazio. */
export const idOpcional = z.string().trim().min(1).optional().catch(undefined)

export function opcoesDe<K extends string>(valores: readonly K[], rotulos: Readonly<Record<K, string>>): OpcaoFiltro[] {
    return valores.map((valor) => ({ valor, rotulo: rotulos[valor] }))
}

export const campoCategoria: CampoFiltro = {
    nome: 'categoria',
    rotulo: 'Categoria',
    tipo: 'select',
    opcoes: opcoesDe(CATEGORIAS_ITEM, ROTULO_CATEGORIA_ITEM)
}

export const esquemaCategoria = enumOpcional(CATEGORIAS_ITEM)

export function descreverCategoria(categoria: CategoriaItem | undefined): FiltroDescrito[] {
    return categoria ? [{ rotulo: 'Categoria', valor: ROTULO_CATEGORIA_ITEM[categoria] }] : []
}

/**
 * Resolve nomes de usuário em lote (regra da feature, T017) e devolve um
 * leitor por linha. Um id sem conta — conta removida — vira "usuário não
 * encontrado", nunca célula vazia: vazio pareceria "ninguém registrou".
 *
 * ```ts
 * const nome = await resolverNomes(linhas, (l) => l.registradoPorId)
 * return linhas.map((l) => ({ ...l, registradoPor: nome(l) }))
 * ```
 */
export async function resolverNomes<L>(
    linhas: readonly L[],
    idDe: (linha: L) => string | null | undefined
): Promise<(linha: L) => string | null> {
    const nomes = await nomesPorIds(linhas.map(idDe))
    return (linha) => {
        const id = idDe(linha)
        if (!id) return null
        return nomes.get(id) ?? USUARIO_NAO_ENCONTRADO
    }
}
