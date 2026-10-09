'use server'

import { erroAction, serializar, type ResultadoAction } from '@/src/shared/kernel'
import { podeAcessar } from '@/src/shared/auth/rotas'
import { obterSessao } from '@/src/shared/auth/sessao'
import { obterRelatorio } from '../../application/definicoes'
import { GerarRelatorioUseCase, type PaginaRelatorio } from '../../application/gerar-relatorio'

/**
 * Prévia paginada de um relatório da central (specs/023-central-relatorios,
 * contracts/consulta-e-rotas.md), consumida pelo TanStack Query.
 *
 * Camada fina (Princípio I): gate e um caso de uso. O gate é por **relatório**,
 * não por tela: `podeAcessar(relatorio.rota)` é o que impede o membro da Defesa
 * Civil de ler a trilha de auditoria por aqui, já que esta action serve aos 17
 * relatórios (FR-020).
 *
 * A sessão vem antes de qualquer outra resposta: sem ela, a action não diz nem
 * se o relatório pedido existe.
 */
export async function consultarRelatorioAction(entrada: unknown): Promise<ResultadoAction<PaginaRelatorio>> {
    const parametros = paraRegistro(entrada)
    const ator = await obterSessao()
    if (!ator) return erroAction('nao_autorizado', 'Sua sessão expirou. Entre novamente para consultar relatórios.')

    const relatorio = obterRelatorio(parametros.relatorio)
    if (!relatorio) {
        // Sem papel nenhum em `/relatorios`, nem a existência do relatório é informada.
        if (!podeAcessar('/relatorios', ator.role)) return semPermissao()
        return erroAction('relatorio_invalido', 'Relatório não encontrado.')
    }
    if (!podeAcessar(relatorio.rota, ator.role)) return semPermissao()

    const useCase = new GerarRelatorioUseCase(obterRelatorio)
    return serializar(await useCase.pagina(relatorio.slug, parametros))
}

function semPermissao(): ResultadoAction<never> {
    return erroAction('nao_autorizado', 'Você não tem permissão para consultar este relatório.')
}

function paraRegistro(entrada: unknown): Record<string, unknown> {
    return entrada !== null && typeof entrada === 'object' ? (entrada as Record<string, unknown>) : {}
}
