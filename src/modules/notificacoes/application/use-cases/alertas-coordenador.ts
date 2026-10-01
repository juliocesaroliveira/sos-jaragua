import 'server-only'
import { and, eq, gte, inArray } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { notificacao } from '@/db/schema/notificacoes'
import {
    limiarCadastrosPendentes,
    limiarDeficitPercentual,
    limiarEstoqueMinimoGlobal
} from '@/src/shared/config/limiares-alerta'
import { itensCriticos, type UnidadeMedida } from '@/src/modules/estoque/domain'
import { notificacaoService } from '../../infrastructure'
import { mensagemEstoqueCritico } from '../../domain/mensagem-estoque-critico'
import type { EventoNotificacao } from '../ports/notificacao-service'

/**
 * Alertas para coordenadores (BRD §6, NOT-08). Os limiares vêm de
 * `src/shared/config/limiares-alerta.ts`.
 *
 * Avaliados **depois das escritas que podem disparar a condição** (via
 * `after()`, em `presentation/alertas.ts`), com o cron diário como rede de
 * segurança (DESIGN.md §12). Antes eram avaliados a cada render do painel e da
 * fila — várias consultas e, às vezes, INSERTs por página aberta, mesmo sem
 * nada ter mudado.
 *
 * Idempotência: uma notificação por "condição ativa". Reemitimos o mesmo alerta
 * só depois de `JANELA_REEMISSAO_HORAS` — sem isso, cada refresh de dashboard
 * criaria uma linha nova e o sino viraria ruído.
 */
const JANELA_REEMISSAO_HORAS = 12

/**
 * Coordenadores e administradores ativos — destinatários dos três alertas.
 * Quem avalia mais de um alerta de uma vez busca a lista uma vez só e a repassa.
 */
export async function coordenadoresAtivos(): Promise<string[]> {
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

async function emitir(
    evento: EventoNotificacao,
    titulo: string,
    mensagem: string,
    contexto: Record<string, unknown>,
    destinatariosConhecidos?: string[]
) {
    const destinatarios = destinatariosConhecidos ?? (await coordenadoresAtivos())
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
export async function avaliarCadastrosAcumulados(pendentes: number, destinatarios?: string[]): Promise<void> {
    const limiar = limiarCadastrosPendentes()
    if (pendentes < limiar) return

    await emitir(
        'cadastros_acumulados',
        'Cadastros aguardando triagem',
        `Existem ${pendentes} cadastros de voluntários aguardando aprovação.`,
        { pendentes, limiar },
        destinatarios
    )
}

/** "A capacidade de montagem de kits está X% abaixo da demanda." */
export async function avaliarDeficitAtendimento(
    necessarios: number,
    possiveis: number,
    destinatarios?: string[]
): Promise<void> {
    if (necessarios <= 0) return

    const deficitPercentual = Math.round(((necessarios - possiveis) / necessarios) * 100)
    if (deficitPercentual < limiarDeficitPercentual()) return

    await emitir(
        'deficit_atendimento',
        'Déficit de atendimento',
        `A capacidade de montagem de kits está ${deficitPercentual}% abaixo da demanda de vítimas.`,
        { necessarios, possiveis, deficitPercentual },
        destinatarios
    )
}

/**
 * "O item [Nome] atingiu o estoque mínimo de segurança."
 *
 * O mínimo é **por item** (`item.estoque_minimo`), com o padrão global
 * `ALERTA_ESTOQUE_MINIMO` para os itens sem mínimo próprio (feature 020, Q3).
 * Esta função só compõe: `itensCriticos` (regra, `estoque/domain`) →
 * `mensagemEstoqueCritico` (texto, `notificacoes/domain`) → `emitir`. As duas
 * primeiras são puras e têm teste unitário.
 */
export async function avaliarEstoqueCritico(
    itens: { nome: string; saldo: number; estoqueMinimo: number | null; unidadeMedida: UnidadeMedida }[],
    destinatarios?: string[]
): Promise<void> {
    const alerta = mensagemEstoqueCritico(itensCriticos(itens, limiarEstoqueMinimoGlobal()))
    if (!alerta) return

    await emitir('estoque_critico', alerta.titulo, alerta.mensagem, alerta.contexto, destinatarios)
}
