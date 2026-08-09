import 'server-only'
import { and, eq, gte, inArray } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { notificacao } from '@/db/schema/notificacoes'
import { notificacaoService } from '../../infrastructure'
import type { EventoNotificacao } from '../ports/notificacao-service'

/**
 * Alertas para coordenadores (BRD §6, NOT-08).
 *
 * Gerados **em leitura**, não por job separado (DESIGN.md §12): quem carrega o
 * painel ou a fila é quem avalia a condição. Evita infra de agendamento para
 * três checagens baratas.
 *
 * Idempotência: uma notificação por "condição ativa". Reemitimos o mesmo alerta
 * só depois de `JANELA_REEMISSAO_HORAS` — sem isso, cada refresh de dashboard
 * criaria uma linha nova e o sino viraria ruído.
 */
const JANELA_REEMISSAO_HORAS = 12

/**
 * Limiares provisórios — **pendentes de definição com a Defesa Civil**
 * (ver PENDENCIAS.md §8). São lidos de variável de ambiente para poderem ser
 * ajustados sem deploy enquanto a decisão não vem.
 */
function limiarCadastrosPendentes(): number {
    const bruto = Number(process.env.ALERTA_CADASTROS_PENDENTES)
    return Number.isFinite(bruto) && bruto > 0 ? bruto : 10
}

function limiarEstoqueMinimo(): number {
    const bruto = Number(process.env.ALERTA_ESTOQUE_MINIMO)
    return Number.isFinite(bruto) && bruto >= 0 ? bruto : 5
}

function limiarDeficitPercentual(): number {
    const bruto = Number(process.env.ALERTA_DEFICIT_PERCENTUAL)
    return Number.isFinite(bruto) && bruto > 0 ? bruto : 80
}

/** Coordenadores e administradores ativos — destinatários dos três alertas. */
async function coordenadoresAtivos(): Promise<string[]> {
    const linhas = await db
        .select({ id: user.id })
        .from(user)
        .where(and(inArray(user.role, ['coordenador', 'administrador']), eq(user.ativo, true)))
    return linhas.map((l) => l.id)
}

/** `true` quando o alerta já foi emitido dentro da janela de reemissão. */
async function alertaRecente(evento: EventoNotificacao, destinatarios: string[]): Promise<boolean> {
    if (destinatarios.length === 0) return true

    const desde = new Date(Date.now() - JANELA_REEMISSAO_HORAS * 60 * 60 * 1000)
    const [existente] = await db
        .select({ id: notificacao.id })
        .from(notificacao)
        .where(
            and(
                eq(notificacao.tipo, evento),
                inArray(notificacao.destinatarioUserId, destinatarios),
                gte(notificacao.criadoEm, desde)
            )
        )
        .limit(1)

    return Boolean(existente)
}

async function emitir(evento: EventoNotificacao, titulo: string, mensagem: string, contexto: Record<string, unknown>) {
    const destinatarios = await coordenadoresAtivos()
    if (await alertaRecente(evento, destinatarios)) return

    await notificacaoService.enviarEmLote(
        destinatarios.map((userId) => ({
            evento,
            destinatarioUserId: userId,
            titulo,
            mensagem,
            contexto,
            // Alertas de coordenador são "Plataforma (Alerta)" no BRD §6 —
            // mandá-los por e-mail a cada 12h seria ruído.
            canais: ['plataforma' as const]
        }))
    )
}

/** "Existem X cadastros de voluntários aguardando aprovação." */
export async function avaliarCadastrosAcumulados(pendentes: number): Promise<void> {
    const limiar = limiarCadastrosPendentes()
    if (pendentes < limiar) return

    await emitir(
        'cadastros_acumulados',
        'Cadastros aguardando triagem',
        `Existem ${pendentes} cadastros de voluntários aguardando aprovação.`,
        { pendentes, limiar }
    )
}

/** "A capacidade de montagem de kits está X% abaixo da demanda." */
export async function avaliarDeficitAtendimento(necessarios: number, possiveis: number): Promise<void> {
    if (necessarios <= 0) return

    const deficitPercentual = Math.round(((necessarios - possiveis) / necessarios) * 100)
    if (deficitPercentual < limiarDeficitPercentual()) return

    await emitir(
        'deficit_atendimento',
        'Déficit de atendimento',
        `A capacidade de montagem de kits está ${deficitPercentual}% abaixo da demanda de vítimas.`,
        { necessarios, possiveis, deficitPercentual }
    )
}

/**
 * "O item [Nome] atingiu o estoque mínimo de segurança."
 *
 * O "mínimo de segurança" é hoje um limiar **global** por variável de ambiente:
 * o schema não tem um mínimo por item, e criar essa coluna é decisão de produto
 * ainda aberta (PENDENCIAS.md §8).
 */
export async function avaliarEstoqueCritico(itens: { nome: string; saldo: number }[]): Promise<void> {
    const limiar = limiarEstoqueMinimo()
    const criticos = itens.filter((i) => i.saldo <= limiar)
    if (criticos.length === 0) return

    const nomes = criticos.slice(0, 5).map((i) => i.nome)
    const resto = criticos.length - nomes.length
    const listados = `${nomes.join(', ')}${resto > 0 ? ` e mais ${resto} ${resto === 1 ? 'item' : 'itens'}` : ''}`
    // Concordância: um único item "atingiu", vários "atingiram".
    const verbo = criticos.length === 1 ? 'atingiu' : 'atingiram'

    await emitir(
        'estoque_critico',
        'Estoque crítico',
        `${listados} ${verbo} o estoque mínimo de segurança (${limiar}).`,
        { limiar, itens: criticos.map((i) => i.nome) }
    )
}
