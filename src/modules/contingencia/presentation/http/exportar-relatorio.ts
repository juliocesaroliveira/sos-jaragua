import type { Role } from '@/src/shared/auth/roles'
import { podeAcessar, rolesExigidas } from '@/src/shared/auth/rotas'
import { obterSessao } from '@/src/shared/auth/sessao'
import { obterRelatorio } from '../../application/definicoes'
import { GerarRelatorioUseCase } from '../../application/gerar-relatorio'
import { nomeDeArquivo, streamCsv, streamXlsx } from '../../infrastructure/planilha'

/**
 * Exportação de relatórios (BR-REL-01; specs/023-central-relatorios,
 * contracts/exportacao-http.md).
 *
 * É um **Route Handler** e não uma Server Action (DESIGN.md §14): payload
 * binário não é um bom fit para o modelo de retorno de Server Actions. Vive no
 * módulo e não em `app/api/` — que apenas reexporta — pelo mesmo motivo de
 * `notificacoes/presentation/http/`: é `presentation` do módulo dono, e o
 * `vitest` só enxerga `src/**`.
 *
 * **Streaming** (research D8): o corpo de resposta das funções da Vercel é
 * limitado a 4,5 MB, e 50 mil linhas de CSV passam disso. Respostas em stream
 * não têm esse limite, e ler em lotes evita ter o relatório inteiro na memória.
 */

/**
 * Derivado de `REGRAS_DE_ROTA`, não redigitado: esta checagem e a do `proxy.ts`
 * precisam falar da mesma regra. É a primeira barreira; a segunda, por
 * relatório, é `podeAcessar(relatorio.rota)` — o proxy só vê o prefixo
 * `/api/relatorios/export`, comum a todos, e sozinho liberaria a trilha de
 * auditoria ao membro da Defesa Civil (FR-020).
 */
const ROLES_PERMITIDAS: readonly Role[] = rolesExigidas('/api/relatorios/export') ?? []

const FORMATOS = ['xlsx', 'csv'] as const
type Formato = (typeof FORMATOS)[number]

const TIPO_CONTEUDO: Record<Formato, string> = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv; charset=utf-8'
}

/** Código de erro do caso de uso → status HTTP do contrato. */
const STATUS_POR_ERRO: Record<string, number> = {
    validacao: 400,
    relatorio_invalido: 400,
    limite_exportacao: 422,
    auditoria_indisponivel: 503
}

export async function exportarRelatorio(request: Request): Promise<Response> {
    // Re-checagem no servidor mesmo com o `proxy.ts` já filtrando: a rota
    // devolve dados operacionais completos e o proxy decide por cookie
    // (defesa em profundidade, DESIGN.md §6.2).
    const ator = await obterSessao()
    if (!ator || !ROLES_PERMITIDAS.includes(ator.role)) {
        return erro(403, 'Você não tem permissão para exportar relatórios.')
    }

    const parametros = Object.fromEntries(new URL(request.url).searchParams)
    const relatorio = obterRelatorio(parametros.tipo)
    if (!relatorio) return erro(400, 'Tipo de relatório inválido.')
    if (!podeAcessar(relatorio.rota, ator.role)) {
        return erro(403, 'Você não tem permissão para exportar este relatório.')
    }

    const formato = parametros.formato ?? 'xlsx'
    if (!ehFormato(formato)) return erro(400, 'Formato inválido. Use "csv" ou "xlsx".')

    const agora = new Date()
    const resultado = await new GerarRelatorioUseCase(obterRelatorio).completo(relatorio.slug, parametros, ator, agora)
    if (!resultado.ok) return erro(STATUS_POR_ERRO[resultado.erro.codigo] ?? 500, resultado.erro.message)

    const { aba, lotes } = resultado.valor
    const corpo = formato === 'csv' ? streamCsv(aba, lotes) : streamXlsx(aba, lotes)

    return new Response(corpo, {
        headers: {
            'Content-Type': TIPO_CONTEUDO[formato],
            'Content-Disposition': `attachment; filename="${nomeDeArquivo(relatorio.slug, formato, agora)}"`,
            // Relatório é sempre o estado atual — cachear entregaria um
            // retrato velho para quem vai prestar contas (FR-009).
            'Cache-Control': 'no-store'
        }
    })
}

function ehFormato(valor: string): valor is Formato {
    return (FORMATOS as readonly string[]).includes(valor)
}

function erro(status: number, mensagem: string): Response {
    return Response.json({ erro: mensagem }, { status, headers: { 'Cache-Control': 'no-store' } })
}
