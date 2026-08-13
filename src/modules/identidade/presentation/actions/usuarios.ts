'use server'

import { revalidateTag, updateTag } from 'next/cache'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { CACHE_TAGS, PERFIL_REVALIDACAO } from '@/src/shared/cache'
import { erroAction, serializar, type ResultadoAction } from '@/src/shared/kernel'
import { normalizarPaginacao, type PaginaDe } from '@/src/shared/paginacao/esquema'
import { ROLES } from '@/src/shared/auth/roles'
import { comAtorDaSessao, obterSessao } from '@/src/shared/auth/sessao'
import { autenticacaoService } from '../../infrastructure/better-auth/autenticacao-service'
import { criarUsuarioRepository } from '../../infrastructure/drizzle/usuario-repository'
import { listarUsuarios, type LinhaUsuario } from '../queries/usuarios'
import { CriarUsuarioUseCase } from '../../application/use-cases/criar-usuario'
import { EditarUsuarioUseCase } from '../../application/use-cases/editar-usuario'

/**
 * Server Actions de Gestão de Usuários (006-user-management-page) —
 * restritas a `administrador` (contracts/gestao-usuarios.md A-03): a
 * revalidação de sessão/role acontece aqui de novo, independentemente do
 * gate da página (`exigirAcessoA`), porque Server Actions não herdam o gate
 * de um Server Component.
 */

const esquemaCriar = z.object({
    nome: z.string().min(1, 'Informe o nome.'),
    email: z.email('Informe um e-mail válido.'),
    senha: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
    role: z.enum(ROLES, { error: 'Selecione o papel.' })
})

/** FR-004 — cadastro de conta (nome, e-mail, senha, papel). */
export async function criarUsuario(entrada: unknown): Promise<ResultadoAction<{ id: string }>> {
    const ator = await obterSessao()
    if (!ator || ator.role !== 'administrador') {
        return erroAction('nao_autorizado', 'Você não tem permissão para cadastrar contas.')
    }

    const parse = esquemaCriar.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Dados de cadastro inválidos.')

    const useCase = new CriarUsuarioUseCase(autenticacaoService, criarUsuarioRepository())
    const resultado = await comAtorDaSessao(ator, () => useCase.executar(parse.data))

    // A conta existe tanto no sucesso quanto no aviso de papel não definido
    // (contracts C-04/C-05) — a listagem precisa refletir isso na mesma
    // resposta em ambos os casos.
    if (resultado.ok || resultado.erro.codigo === 'papel_nao_definido') {
        updateTag(CACHE_TAGS.identidadeListagem)
        revalidateTag(CACHE_TAGS.identidadeListagem, PERFIL_REVALIDACAO)
    }

    return serializar(resultado)
}

const esquemaEditar = z.object({
    id: z.string().min(1),
    nome: z.string().min(1, 'Informe o nome.'),
    role: z.enum(ROLES, { error: 'Selecione o papel.' })
    // Sem `email`/`senha` — a edição não os aceita (FR-010, contracts E-01).
})

/** FR-008 — edição de nome e papel de uma conta já existente. */
export async function editarUsuario(entrada: unknown): Promise<ResultadoAction<{ id: string }>> {
    const ator = await obterSessao()
    if (!ator || ator.role !== 'administrador') {
        return erroAction('nao_autorizado', 'Você não tem permissão para editar contas.')
    }

    const parse = esquemaEditar.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Dados de edição inválidos.')

    const useCase = new EditarUsuarioUseCase(criarUsuarioRepository())
    const resultado = await comAtorDaSessao(ator, () => useCase.executar(parse.data))

    if (resultado.ok) {
        updateTag(CACHE_TAGS.identidadeListagem)
        revalidateTag(CACHE_TAGS.identidadeListagem, PERFIL_REVALIDACAO)
    }

    return serializar(resultado)
}

/**
 * Leitura paginada consumida pelo TanStack Query no cliente
 * (007-datatable-server-pagination, US1).
 *
 * A checagem de sessão/role acontece **aqui** e não dentro de `listarUsuarios`
 * por dois motivos que se somam: uma função `'use cache'` não pode ler
 * `cookies()`/`headers()`, e Server Actions não herdam o gate da página
 * (contracts/leituras-paginadas.md L-02).
 *
 * A entrada é **saneada**, não rejeitada: `page=abc` ou `pageSize=7` viram os
 * valores válidos mais próximos (FR-012).
 */
export async function listarUsuariosAction(entrada: unknown): Promise<ResultadoAction<PaginaDe<LinhaUsuario>>> {
    const ator = await obterSessao()
    if (!ator || ator.role !== 'administrador') {
        return erroAction('nao_autorizado', 'Você não tem permissão para consultar contas.')
    }

    return { ok: true, valor: await listarUsuarios(normalizarPaginacao(entrada)) }
}
