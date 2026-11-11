'use server'

import { headers } from 'next/headers'
import { revalidateTag, updateTag } from 'next/cache'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { CACHE_TAGS, PERFIL_REVALIDACAO, tagAtividade, tagNotificacoesUsuario } from '@/src/shared/cache'
import { erroAction, serializar, type ResultadoAction } from '@/src/shared/kernel'
import { comAtorDaSessao, obterSessao, type SessaoAtor } from '@/src/shared/auth/sessao'
import { criarLeitorExecucoesManutencao, criarRegistroExecucaoManutencao } from '@/src/modules/auditoria'
import { nomesDeUsuarios } from '@/src/modules/identidade/presentation/queries/usuarios'
import type { PaginaDe } from '@/src/shared/paginacao/esquema'
import { HistoricoUseCase, type LinhaHistorico } from '../../application/use-cases/historico'
import type { Previa, ResultadoExecucao } from '../../domain/previa'
import { GerarPreviaUseCase } from '../../application/use-cases/gerar-previa'
import { ExecutarAcaoUseCase } from '../../application/use-cases/executar-acao'
import { CancelarAcaoUseCase } from '../../application/use-cases/cancelar-acao'
import { InventarioUseCase, type LinhaInventario } from '../../application/use-cases/inventario'
import { ListarRegistrosUseCase, type PaginaRegistros } from '../../application/use-cases/listar-registros'
import { normalizarPaginacao } from '@/src/shared/paginacao/esquema'
import type { AtorDangerZone } from '../../application/use-cases/montar-previa'
import { criarLeitorEsquema } from '../../infrastructure/drizzle/leitor-esquema'
import { criarExecutorConjuntos } from '../../infrastructure/drizzle/executor-conjuntos'
import { ambienteAtual } from '../ambiente'

/**
 * Server Actions da Danger Zone (contracts/acoes-danger-zone.md).
 *
 * Camada fina (Princípio I): Zod de **contrato**, sessão e role, um caso de
 * uso, invalidação de cache. A releitura de sessão acontece aqui de novo,
 * independente do gate da página — Server Actions não herdam o gate de um
 * Server Component (A-00.1).
 */

const NAO_AUTORIZADO = 'Você não tem permissão para usar a Danger Zone.'

type Autorizacao = { ator: SessaoAtor; recusa: null } | { ator: null; recusa: ResultadoAction<never> }

/**
 * Sem sessão válida não há ator comprovado para a trilha (spec, edge case
 * "sessão expira"): a tentativa vai só para o log estruturado, sem chaves nem
 * conteúdo de linhas (contracts C-04).
 */
async function autorizar(acao: string, tabela?: string): Promise<Autorizacao> {
    const ator = await obterSessao()
    if (ator && ator.role === 'administrador') return { ator, recusa: null }

    const cabecalhos = await headers()
    console.warn('[manutencao] tentativa sem sessão válida', {
        acao,
        tabela: tabela ?? null,
        papel: ator?.role ?? null,
        ip: cabecalhos.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
        timestamp: new Date().toISOString()
    })
    return { ator: null, recusa: erroAction('nao_autorizado', NAO_AUTORIZADO) }
}

async function atorDangerZone(sessao: SessaoAtor): Promise<AtorDangerZone> {
    const cabecalhos = await headers()
    return {
        userId: sessao.userId,
        role: sessao.role,
        sessionToken: sessao.sessionToken,
        sessaoCriadaEm: sessao.sessaoCriadaEm,
        ip: cabecalhos.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
        userAgent: cabecalhos.get('user-agent') ?? undefined
    }
}

// -- Contratos de entrada -----------------------------------------------------

const esquemaPedido = z.object({
    acao: z.enum(['resetar_tabela', 'excluir_selecionados']),
    tabela: z.string().min(1).max(64),
    chaves: z.array(z.string().min(1).max(200)).max(500).optional(),
    modo: z.enum(['cascata', 'preservacao']).optional()
})

const esquemaImpressao = z.record(
    z.string(),
    z.object({ apagar: z.number().int().min(0), redirecionar: z.record(z.string(), z.number().int().min(0)) })
)

const esquemaExecucao = z.object({
    pedido: esquemaPedido,
    impressaoDigital: esquemaImpressao,
    confirmacao: z.string().max(200)
})

const esquemaCancelamento = z.object({ pedido: esquemaPedido, impressaoDigital: esquemaImpressao })

const tabelaDe = (entrada: unknown) =>
    typeof entrada === 'object' && entrada !== null && 'pedido' in entrada
        ? String((entrada as { pedido?: { tabela?: unknown } }).pedido?.tabela ?? '')
        : typeof entrada === 'object' && entrada !== null && 'tabela' in entrada
          ? String((entrada as { tabela?: unknown }).tabela ?? '')
          : undefined

// -- C-01 ---------------------------------------------------------------------

export async function inventarioAction(): Promise<
    ResultadoAction<{ ambiente: ReturnType<typeof ambienteAtual>; tabelas: LinhaInventario[] }>
> {
    const { recusa } = await autorizar('inventario')
    if (recusa) return recusa

    const tabelas = await new InventarioUseCase({ leitor: criarLeitorEsquema() }).executar()
    return { ok: true, valor: { ambiente: ambienteAtual(), tabelas } }
}

// -- C-02 ---------------------------------------------------------------------

const esquemaRegistros = z.object({ tabela: z.string().min(1).max(64), busca: z.string().max(100).optional() })

/** Registros de uma tabela para seleção (US2). Paginação saneada, não rejeitada. */
export async function listarRegistrosAction(entrada: unknown): Promise<ResultadoAction<PaginaRegistros>> {
    const { recusa } = await autorizar('listar_registros', tabelaDe(entrada))
    if (recusa) return recusa

    const parse = esquemaRegistros.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Consulta inválida.')

    const resultado = await new ListarRegistrosUseCase({ leitor: criarLeitorEsquema() }).executar({
        ...normalizarPaginacao(entrada),
        tabela: parse.data.tabela,
        busca: parse.data.busca
    })
    return serializar(resultado)
}

// -- C-03 ---------------------------------------------------------------------

export async function gerarPreviaAction(entrada: unknown): Promise<ResultadoAction<Previa>> {
    const { ator, recusa } = await autorizar('gerar_previa', tabelaDe(entrada))
    if (recusa) return recusa

    const parse = esquemaPedido.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Pedido inválido.')

    const useCase = new GerarPreviaUseCase({ leitor: criarLeitorEsquema(), executor: criarExecutorConjuntos() })
    const resultado = await comAtorDaSessao(ator, async () =>
        useCase.executar({ pedido: parse.data, ator: await atorDangerZone(ator), ambiente: ambienteAtual() })
    )
    return serializar(resultado)
}

// -- C-04 ---------------------------------------------------------------------

export async function executarAcaoAction(entrada: unknown): Promise<ResultadoAction<ResultadoExecucao>> {
    const { ator, recusa } = await autorizar('executar', tabelaDe(entrada))
    if (recusa) return recusa

    const parse = esquemaExecucao.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Pedido de execução inválido.')

    const useCase = new ExecutarAcaoUseCase({
        leitor: criarLeitorEsquema(),
        executor: criarExecutorConjuntos(),
        registro: criarRegistroExecucaoManutencao()
    })
    const resultado = await comAtorDaSessao(ator, async () =>
        useCase.executar({ ...parse.data, ator: await atorDangerZone(ator), ambiente: ambienteAtual() })
    )

    if (resultado.ok) invalidarCaches(resultado.valor.invalidar)
    return serializar(resultado)
}

/**
 * Operação rara e de alcance amplo: invalidar todas as tags é mais simples e
 * mais seguro que derivar o subconjunto exato (research D12).
 */
function invalidarCaches({ atividades, usuarios }: { atividades: string[]; usuarios: string[] }) {
    const tags = [
        ...Object.values(CACHE_TAGS),
        ...atividades.map(tagAtividade),
        ...usuarios.map(tagNotificacoesUsuario)
    ]
    for (const tag of tags) {
        updateTag(tag)
        revalidateTag(tag, PERFIL_REVALIDACAO)
    }
}

// -- C-05 ---------------------------------------------------------------------

export async function cancelarAcaoAction(entrada: unknown): Promise<ResultadoAction<null>> {
    const { ator, recusa } = await autorizar('cancelar', tabelaDe(entrada))
    if (recusa) return recusa

    const parse = esquemaCancelamento.safeParse(entrada)
    if (!parse.success) return { ok: true, valor: null }

    await comAtorDaSessao(ator, async () =>
        new CancelarAcaoUseCase({ registro: criarRegistroExecucaoManutencao() }).executar({
            ...parse.data,
            ator: await atorDangerZone(ator),
            ambiente: ambienteAtual()
        })
    )
    return { ok: true, valor: null }
}

// -- C-06 ---------------------------------------------------------------------

export async function historicoAction(entrada: unknown): Promise<ResultadoAction<PaginaDe<LinhaHistorico>>> {
    const { recusa } = await autorizar('historico')
    if (recusa) return recusa

    const resultado = await new HistoricoUseCase({
        leitor: criarLeitorExecucoesManutencao(),
        nomes: nomesDeUsuarios
    }).executar(normalizarPaginacao(entrada))
    return serializar(resultado)
}
