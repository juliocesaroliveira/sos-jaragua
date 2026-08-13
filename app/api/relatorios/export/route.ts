import { NextResponse, type NextRequest } from 'next/server'
import type { Role } from '@/src/shared/auth/roles'
import { rolesExigidas } from '@/src/shared/auth/rotas'
import { obterSessao } from '@/src/shared/auth/sessao'
import {
    ehFormato,
    ehTipoRelatorio,
    montarRelatorio,
    ROTULO_TIPO_RELATORIO
} from '@/src/modules/contingencia/application/relatorios'
import { gerarCsv, gerarXlsx, nomeDeArquivo } from '@/src/modules/contingencia/infrastructure/planilha'

/**
 * Exportação de relatórios (BR-REL-01, REL-01/REL-02).
 *
 * É um **Route Handler** e não uma Server Action (DESIGN.md §14): payload
 * binário não é um bom fit para o modelo de retorno de Server Actions.
 */
/**
 * Derivado de `REGRAS_DE_ROTA`, não redigitado: esta checagem e a do `proxy.ts`
 * precisam falar da mesma regra. Uma cópia literal aqui já significaria que
 * mudar a autorização da tela exige lembrar de mudar o download também — e
 * esquecer deixaria os dados alcançáveis por URL direta.
 */
const ROLES_PERMITIDAS: readonly Role[] = rolesExigidas('/api/relatorios/export') ?? []

export async function GET(request: NextRequest) {
    // Re-checagem no servidor mesmo com o `proxy.ts` já filtrando: a rota
    // devolve dados operacionais completos e o proxy decide por cookie
    // (defesa em profundidade, DESIGN.md §6.2).
    const ator = await obterSessao()
    if (!ator || !ROLES_PERMITIDAS.includes(ator.role)) {
        return NextResponse.json({ erro: 'Você não tem permissão para exportar relatórios.' }, { status: 403 })
    }

    const tipo = request.nextUrl.searchParams.get('tipo')
    const formato = request.nextUrl.searchParams.get('formato') ?? 'xlsx'

    if (!ehTipoRelatorio(tipo)) {
        return NextResponse.json({ erro: 'Tipo de relatório inválido. Use "inventario" ou "saidas".' }, { status: 400 })
    }
    if (!ehFormato(formato)) {
        return NextResponse.json({ erro: 'Formato inválido. Use "csv" ou "xlsx".' }, { status: 400 })
    }

    const aba = await montarRelatorio(tipo)
    const prefixo = tipo === 'inventario' ? 'inventario' : 'saidas'

    if (formato === 'csv') {
        return new NextResponse(gerarCsv(aba), {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${nomeDeArquivo(prefixo, 'csv')}"`,
                // Relatório é sempre o estado atual — cachear entregaria um
                // retrato velho para quem vai prestar contas.
                'Cache-Control': 'no-store'
            }
        })
    }

    const buffer = gerarXlsx([aba])

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${nomeDeArquivo(prefixo, 'xlsx')}"`,
            'Cache-Control': 'no-store',
            'X-Relatorio': ROTULO_TIPO_RELATORIO[tipo]
        }
    })
}
