import { and, between, eq, inArray, isNull } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/src/shared/db/postgres'
import { alocacao, atividade, turno, voluntarioPerfil } from '@/db/schema/voluntariado'
import { notificacaoService } from '@/src/modules/notificacoes/infrastructure'

/**
 * Lembrete de turno, 2h antes do início (BRD §6, DESIGN.md §12).
 *
 * É o único evento **baseado em tempo**, sem gatilho natural na aplicação —
 * por isso um cron da Vercel (`vercel.json`) chama esta rota a cada ~15 min.
 *
 * A janela é 105–120 min no futuro (e não "exatamente 120"): o cron não roda em
 * instante exato, e uma janela mais larga que o intervalo entre execuções
 * garante que nenhum turno seja pulado. `lembreteEnviadoEm IS NULL` é o que
 * evita avisar duas vezes quando duas execuções pegam o mesmo turno.
 */
const JANELA_MINIMA_MINUTOS = 105
const JANELA_MAXIMA_MINUTOS = 120

export async function GET(request: NextRequest) {
    const autorizado = verificarSegredo(request)
    if (!autorizado) {
        return NextResponse.json({ erro: 'Não autorizado.' }, { status: 401 })
    }

    const agora = Date.now()
    const inicioJanela = new Date(agora + JANELA_MINIMA_MINUTOS * 60_000)
    const fimJanela = new Date(agora + JANELA_MAXIMA_MINUTOS * 60_000)

    const pendentes = await db
        .select({
            alocacaoId: alocacao.id,
            userId: voluntarioPerfil.userId,
            nomeCompleto: voluntarioPerfil.nomeCompleto,
            titulo: atividade.titulo,
            local: atividade.local,
            inicio: turno.inicio,
            fim: turno.fim,
            atividadeId: atividade.id,
            turnoId: turno.id
        })
        .from(alocacao)
        .innerJoin(turno, eq(turno.id, alocacao.turnoId))
        .innerJoin(atividade, eq(atividade.id, turno.atividadeId))
        .innerJoin(voluntarioPerfil, eq(voluntarioPerfil.id, alocacao.voluntarioPerfilId))
        .where(
            and(
                eq(alocacao.status, 'confirmado'),
                // Atividade cancelada/encerrada não gera lembrete — o voluntário
                // já foi avisado pelo evento de alteração.
                eq(atividade.status, 'aberta'),
                isNull(alocacao.lembreteEnviadoEm),
                between(turno.inicio, inicioJanela, fimJanela)
            )
        )

    if (pendentes.length === 0) {
        return NextResponse.json({ enviados: 0 })
    }

    // Marca **antes** de notificar: se a notificação falhar, o pior caso é um
    // lembrete perdido; marcar depois arriscaria avisar em duplicado a cada
    // execução do cron caso a marcação falhasse.
    //
    // O filtro é só pelos ids já selecionados + `IS NULL` — um `UPDATE` não
    // enxerga as tabelas do join da leitura, e o `IS NULL` ainda protege contra
    // duas execuções concorrentes do cron pegarem a mesma alocação.
    await db
        .update(alocacao)
        .set({ lembreteEnviadoEm: new Date() })
        .where(
            and(
                inArray(
                    alocacao.id,
                    pendentes.map((p) => p.alocacaoId)
                ),
                isNull(alocacao.lembreteEnviadoEm)
            )
        )

    await notificacaoService.enviarEmLote(
        pendentes.map((p) => ({
            evento: 'lembrete_turno' as const,
            destinatarioUserId: p.userId,
            titulo: 'Seu turno começa em 2 horas',
            mensagem: `${p.titulo} — ${p.local}, das ${formatarHora(p.inicio)} às ${formatarHora(p.fim)}.`,
            contexto: { atividadeId: p.atividadeId, turnoId: p.turnoId, alocacaoId: p.alocacaoId }
        }))
    )

    return NextResponse.json({ enviados: pendentes.length })
}

/**
 * O Vercel Cron envia `Authorization: Bearer $CRON_SECRET` (DESIGN.md §12).
 * Sem `CRON_SECRET` configurado a rota fica fechada: uma rota que dispara
 * notificação em massa não pode ficar aberta por esquecimento de configuração.
 */
function verificarSegredo(request: NextRequest): boolean {
    const segredo = process.env.CRON_SECRET
    if (!segredo) {
        console.error('[cron] CRON_SECRET não configurado — rota de lembrete recusada')
        return false
    }
    return request.headers.get('authorization') === `Bearer ${segredo}`
}

const HORA = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
})

function formatarHora(data: Date): string {
    return HORA.format(data)
}
