import { NextResponse } from 'next/server'
import type { Role } from '@/src/shared/auth/roles'
import { rolesExigidas } from '@/src/shared/auth/rotas'
import { obterSessao } from '@/src/shared/auth/sessao'
import { montarPacoteContingencia } from '@/src/modules/contingencia/application/pacote-contingencia'
import { gerarXlsx, nomeDeArquivo } from '@/src/modules/contingencia/infrastructure/planilha'

/**
 * Pacote de Contingência (BR-CON-01, CON-01).
 *
 * **Sempre live, nunca cacheado** (DESIGN.md §15): o objetivo é o snapshot mais
 * atual possível imediatamente antes de uma queda de energia ou de conexão.
 * Servir uma versão cacheada aqui entregaria à equipe um retrato do estoque que
 * já não corresponde ao galpão.
 */
/**
 * Derivado de `REGRAS_DE_ROTA`, não redigitado: esta checagem e a do `proxy.ts`
 * precisam falar da mesma regra, e uma cópia literal aqui significaria que
 * mudar a autorização exige lembrar de mudar os dois lugares.
 */
const ROLES_PERMITIDAS: readonly Role[] = rolesExigidas('/api/contingencia/export') ?? []

export async function GET() {
    const ator = await obterSessao()
    if (!ator || !ROLES_PERMITIDAS.includes(ator.role)) {
        return NextResponse.json({ erro: 'Você não tem permissão para gerar o pacote.' }, { status: 403 })
    }

    const abas = await montarPacoteContingencia()
    const buffer = gerarXlsx(abas)

    return new NextResponse(new Uint8Array(buffer), {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${nomeDeArquivo('pacote-contingencia', 'xlsx')}"`,
            'Cache-Control': 'no-store, must-revalidate'
        }
    })
}
