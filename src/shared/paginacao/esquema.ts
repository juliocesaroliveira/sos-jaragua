import { z } from '@/src/shared/validacao/zod-ptbr'
import { TAMANHO_PAGINA_PADRAO, ehTamanhoPagina } from './constantes'

/**
 * Saneamento dos parâmetros de paginação (007-datatable-server-pagination).
 *
 * Roda nos **dois** lados da fronteira: no Server Component ao ler
 * `searchParams` e dentro da Server Function ao receber a entrada do cliente.
 * Nunca lança — `page=abc`, `page=0` ou `pageSize=7` viram o valor válido mais
 * próximo em vez de erro ou tela em branco (FR-012). É por isso que cada campo
 * tem seu próprio `.catch()`: um `pageSize` inválido não pode invalidar um
 * `page` que veio correto.
 */

/**
 * `pageSize` é `number`, não `TamanhoPagina`: as opções 5/10/20/50 são uma
 * restrição da **interface**. Leituras internas legítimas usam outros tamanhos
 * (`listarVoluntariosAprovados` pede 200 de uma vez), e amarrá-las ao seletor
 * do rodapé seria acoplar o servidor a uma decisão de tela. O que chega pela
 * URL continua restrito à lista, via `esquemaPaginacao`.
 */
export type ParametrosPaginacao = {
    page: number
    pageSize: number
}

const PADRAO: ParametrosPaginacao = { page: 1, pageSize: TAMANHO_PAGINA_PADRAO }

export const esquemaPaginacao = z
    .object({
        page: z.coerce.number().int().min(1).catch(PADRAO.page),
        // Retorno anotado como `boolean` de propósito: `ehTamanhoPagina` é um
        // type predicate e, sem a anotação, o TS o propaga para o `.refine`,
        // estreitando a saída para a união literal — o que amarraria o tipo do
        // servidor às opções do seletor de tela.
        pageSize: z.coerce
            .number()
            .int()
            .refine((valor): boolean => ehTamanhoPagina(valor))
            .catch(PADRAO.pageSize)
    })
    .catch(PADRAO)

/** Aceita `unknown` porque a origem é sempre externa: URL ou payload de action. */
export function normalizarPaginacao(entrada: unknown): ParametrosPaginacao {
    return esquemaPaginacao.parse(entrada ?? {})
}

/**
 * Página efetivamente servível. Cobre o caso de registros removidos entre dois
 * carregamentos, que deixaria o `page` da URL além do fim — em vez de devolver
 * uma lista vazia, o servidor serve a última página válida.
 */
export function clampPagina({
    page,
    pageSize,
    totalCount
}: {
    page: number
    pageSize: number
    totalCount: number
}): number {
    if (totalCount <= 0) return 1
    const totalPaginas = Math.ceil(totalCount / pageSize)
    return Math.min(Math.max(page, 1), totalPaginas)
}

/**
 * Resultado de qualquer leitura paginada. `page`/`pageSize` são os valores
 * **efetivos** — o cliente precisa saber o que o servidor de fato aplicou
 * quando a entrada foi corrigida (contracts/leituras-paginadas.md L-01.3).
 */
export type PaginaDe<T> = {
    rows: T[]
    totalCount: number
    page: number
    pageSize: number
}

/**
 * Executa uma leitura paginada e corrige a página quando ela ficou além do fim
 * — registros removidos entre dois carregamentos deixariam a URL apontando para
 * uma página vazia. Só refaz a busca quando de fato houve correção.
 *
 * Existe aqui, e não copiado em cada query de módulo, porque a regra é a mesma
 * para todas as listagens (contracts/leituras-paginadas.md L-06).
 */
export async function paginarComClamp<T>(
    params: ParametrosPaginacao,
    buscar: (p: ParametrosPaginacao) => Promise<{ rows: T[]; totalCount: number }>
): Promise<PaginaDe<T>> {
    const { page, pageSize } = params
    const primeira = await buscar(params)
    const pageEfetiva = clampPagina({ page, pageSize, totalCount: primeira.totalCount })

    if (pageEfetiva === page) return { ...primeira, page, pageSize }

    const corrigida = await buscar({ ...params, page: pageEfetiva })
    return { ...corrigida, page: pageEfetiva, pageSize }
}

/** Derivados exibidos pelo rodapé (FR-003). Não trafegam pela rede. */
export function calcularFaixa({ page, pageSize, totalCount }: { page: number; pageSize: number; totalCount: number }) {
    const totalPaginas = totalCount === 0 ? 1 : Math.ceil(totalCount / pageSize)
    const primeiro = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
    const ultimo = Math.min(page * pageSize, totalCount)
    return { totalPaginas, primeiro, ultimo }
}
