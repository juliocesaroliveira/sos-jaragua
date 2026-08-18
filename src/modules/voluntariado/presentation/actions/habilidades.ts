'use server'

import { revalidateTag, updateTag } from 'next/cache'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { CACHE_TAGS, PERFIL_REVALIDACAO } from '@/src/shared/cache'
import { erroAction, serializar, type ResultadoAction } from '@/src/shared/kernel'
import { normalizarPaginacao, type PaginaDe } from '@/src/shared/paginacao'
import { comAtorDaSessao, obterSessao } from '@/src/shared/auth/sessao'
import type { Role } from '@/src/shared/auth/roles'
import { criarHabilidadeRepository } from '../../infrastructure/drizzle/habilidade-repository'
import {
    CriarHabilidadeUseCase,
    EditarHabilidadeUseCase,
    ExcluirHabilidadeUseCase
} from '../../application/use-cases/gerir-habilidade'
import { listarHabilidadesPaginado, type LinhaHabilidade } from '../queries/habilidades'

/**
 * Server Actions de Gestão de Habilidades (017-gestao-habilidades).
 *
 * A revalidação de sessão/role acontece aqui **de novo**, independentemente do
 * gate da página (`exigirAcessoA`): Server Actions não herdam o gate de um
 * Server Component (Princípio IV, contracts/gestao-habilidades.md A-01).
 */

const ROLES_PERMITIDAS: readonly Role[] = ['membro_defesa_civil', 'coordenador', 'administrador']

/**
 * Devolve o ator quando autorizado, ou a recusa já pronta.
 *
 * A mensagem é específica da operação, mas nunca revela se o registro existe —
 * quem não pode agir não descobre o estado do banco pela mensagem (A-03).
 */
async function autorizar(acao: string) {
    const ator = await obterSessao()
    if (!ator || !ROLES_PERMITIDAS.includes(ator.role)) {
        return { ator: null, recusa: erroAction('nao_autorizado', `Você não tem permissão para ${acao}.`) } as const
    }
    return { ator, recusa: null } as const
}

/**
 * Duas tags, sempre juntas: a listagem desta tela e a lookup que alimenta o
 * formulário de candidatura e o filtro de alocação. Invalidar só a primeira
 * deixaria uma habilidade recém-criada invisível para quem se candidata
 * (FR-016, research.md D6).
 */
function invalidarCaches() {
    for (const tag of [CACHE_TAGS.habilidadesListagem, CACHE_TAGS.lookups]) {
        updateTag(tag)
        revalidateTag(tag, PERFIL_REVALIDACAO)
    }
}

/**
 * Leitura paginada consumida pelo TanStack Query no cliente (US1).
 *
 * A checagem de sessão/role acontece aqui e não dentro de
 * `listarHabilidadesPaginado` porque uma função `'use cache'` não pode ler
 * `cookies()`/`headers()`.
 *
 * A entrada é **saneada, não rejeitada**: `page=abc` ou `pageSize=7` viram os
 * valores válidos mais próximos (L-01.1).
 */
export async function listarHabilidadesAction(entrada: unknown): Promise<ResultadoAction<PaginaDe<LinhaHabilidade>>> {
    const { recusa } = await autorizar('consultar habilidades')
    if (recusa) return recusa

    return { ok: true, valor: await listarHabilidadesPaginado(normalizarPaginacao(entrada)) }
}

/**
 * O esquema aqui é de **contrato**, não de negócio: garante que chegou uma
 * string no campo certo. Os limites de tamanho e a normalização são do
 * `domain/`, que é a autoridade — repetir a regra aqui criaria duas fontes que
 * poderiam divergir (research.md D8).
 */
const esquemaCriar = z.object({ nome: z.string() })

/** FR-006 — cadastro de habilidade (contracts/gestao-habilidades.md C-01). */
export async function criarHabilidade(entrada: unknown): Promise<ResultadoAction<{ id: string }>> {
    const { ator, recusa } = await autorizar('cadastrar habilidades')
    if (recusa) return recusa

    const parse = esquemaCriar.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Dados de cadastro inválidos.')

    const useCase = new CriarHabilidadeUseCase(criarHabilidadeRepository())
    const resultado = await comAtorDaSessao(ator, () => useCase.executar(parse.data))

    if (resultado.ok) invalidarCaches()

    return serializar(resultado.ok ? { ok: true, valor: { id: resultado.valor.id } } : resultado)
}

const esquemaEditar = z.object({ id: z.uuid('Habilidade inválida.'), nome: z.string() })

/** FR-007 — edição do nome (contracts/gestao-habilidades.md E-01). */
export async function editarHabilidade(entrada: unknown): Promise<ResultadoAction<{ id: string }>> {
    const { ator, recusa } = await autorizar('editar habilidades')
    if (recusa) return recusa

    const parse = esquemaEditar.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Dados de edição inválidos.')

    const useCase = new EditarHabilidadeUseCase(criarHabilidadeRepository())
    const resultado = await comAtorDaSessao(ator, () => useCase.executar(parse.data))

    if (resultado.ok) invalidarCaches()

    return serializar(resultado.ok ? { ok: true, valor: { id: resultado.valor.id } } : resultado)
}

const esquemaExcluir = z.object({ id: z.uuid('Habilidade inválida.') })

/** FR-011/FR-012 — exclusão (contracts/gestao-habilidades.md X-01). */
export async function excluirHabilidade(entrada: unknown): Promise<ResultadoAction<{ id: string }>> {
    const { ator, recusa } = await autorizar('excluir habilidades')
    if (recusa) return recusa

    const parse = esquemaExcluir.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Habilidade inválida.')

    const useCase = new ExcluirHabilidadeUseCase(criarHabilidadeRepository())
    const resultado = await comAtorDaSessao(ator, () => useCase.executar(parse.data))

    if (resultado.ok) invalidarCaches()

    return serializar(resultado)
}
