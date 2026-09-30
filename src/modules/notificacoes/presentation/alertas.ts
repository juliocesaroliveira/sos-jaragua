import 'server-only'
import { after } from 'next/server'
import { inventarioParaExportacao } from '@/src/modules/estoque/presentation/queries/estoque'
import { projecaoAtual } from '@/src/modules/logistica/presentation/queries/dashboard'
import { contarCandidaturasPendentes } from '@/src/modules/voluntariado/presentation/queries/candidaturas'
import {
    avaliarCadastrosAcumulados,
    avaliarDeficitAtendimento,
    avaliarEstoqueCritico,
    coordenadoresAtivos
} from '../application/use-cases/alertas-coordenador'

/**
 * Quando avaliar os alertas de coordenador (NOT-08, DESIGN.md §12).
 *
 * Cada condição só pode **surgir** depois de certas escritas — estoque crítico
 * depois de saída ou descarte; déficit depois disso ou de mudança em receita,
 * variáveis da crise ou métricas; fila acumulada depois de uma candidatura
 * nova. Avaliar ali, e não a cada abertura do painel ou da fila, troca várias
 * consultas por página aberta por algumas por escrita. O cron diário
 * (`/api/cron/lembrete-turno`) reavalia tudo como rede de segurança — por
 * exemplo, depois de um limiar ser ajustado por variável de ambiente.
 *
 * Tudo roda em `after()`: a resposta da Server Action não espera a avaliação,
 * e uma falha aqui nunca desfaz nem esconde a escrita que já aconteceu.
 */

type AlertasDeEstoque = {
    /** Saída e descarte reduzem saldo; mudanças em kits/crise não. */
    estoqueCritico: boolean
}

/** Agenda a reavaliação de déficit (e, se pedido, de estoque crítico). */
export function agendarAlertasDeEstoque(alertas: AlertasDeEstoque): void {
    after(() => executar('estoque', () => reavaliarAlertasDeEstoque(alertas)))
}

/** Agenda a reavaliação da fila de cadastros pendentes. */
export function agendarAlertaDeCadastros(): void {
    after(() => executar('cadastros', reavaliarAlertaDeCadastros))
}

/** Os três alertas de uma vez — usado pelo cron diário. */
export async function reavaliarTodosOsAlertas(): Promise<void> {
    await Promise.all([
        executar('estoque', () => reavaliarAlertasDeEstoque({ estoqueCritico: true })),
        executar('cadastros', reavaliarAlertaDeCadastros)
    ])
}

async function reavaliarAlertasDeEstoque({ estoqueCritico }: AlertasDeEstoque): Promise<void> {
    const destinatarios = await coordenadoresAtivos()
    if (destinatarios.length === 0) return

    const [projecao, itens] = await Promise.all([
        projecaoAtual(),
        estoqueCritico ? inventarioParaExportacao() : Promise.resolve(null)
    ])

    await Promise.all([
        avaliarDeficitAtendimento(projecao.totalNecessarios, projecao.totalPossiveis, destinatarios),
        itens ? avaliarEstoqueCritico(itens, destinatarios) : undefined
    ])
}

async function reavaliarAlertaDeCadastros(): Promise<void> {
    await avaliarCadastrosAcumulados(await contarCandidaturasPendentes())
}

async function executar(nome: string, avaliar: () => Promise<void>): Promise<void> {
    try {
        await avaliar()
    } catch (erro) {
        console.error(`[alertas] falha ao avaliar alertas de ${nome}`, erro)
    }
}
