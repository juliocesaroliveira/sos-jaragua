import 'server-only'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { ROTULO_CATEGORIA_ITEM, ROTULO_UNIDADE_MEDIDA } from '@/src/modules/estoque/domain/item'
import {
    contarEntregasPorDestino,
    entregasPorDestinoRelatorio,
    movimentacaoRelatorio,
    type Intervalo,
    type LinhaEntregaDestino
} from '@/src/modules/estoque/presentation/queries/relatorios'
import { ROTULO_BASE_DEMANDA } from '@/src/modules/logistica/domain/projecao'
import { projecaoAtual } from '@/src/modules/logistica/presentation/queries/dashboard'
import type { ProjecaoKit } from '@/src/modules/logistica/application/use-cases/projetar-demanda'
import {
    contarEvolucaoCrise,
    evolucaoCriseRelatorio,
    type LinhaEvolucaoCrise
} from '@/src/modules/logistica/presentation/queries/relatorios'
import {
    EVENTOS_NOTIFICACAO,
    type CanalNotificacao,
    type EventoNotificacao
} from '@/src/modules/notificacoes/application/ports/notificacao-service'
import {
    contarEnviosNotificacoes,
    enviosNotificacoesRelatorio,
    totaisEnviosNotificacoes,
    type LinhaEnvio,
    type StatusEnvio
} from '@/src/modules/notificacoes/presentation/queries/relatorios'
import type { CategoriaItem, UnidadeMedida } from '@/src/modules/estoque/domain/item'
import { balancoItem, temMovimento, variacao, type BalancoItem } from '../../domain/calculos-consolidados'
import { definirRelatorio, recortar, registrar, type ConsultaRelatorio } from '../definicao-relatorio'
import { formatarDataHora } from '../formatacao'
import { campoCategoria, descreverCategoria, enumOpcional, esquemaCategoria, opcoesDe, resolverNomes } from './comum'

/**
 * Consolidados para o comando da operação — R-07, R-08, R-14, R-15 e R-16
 * (specs/023-central-relatorios, US5, FR-019, FR-029 a FR-031).
 */

function intervaloDe<F>(consulta: ConsultaRelatorio<F>): Intervalo {
    if (!consulta.intervalo) throw new Error('Relatório de histórico consultado sem período.')
    return consulta.intervalo
}

// -- R-07 Movimentação por item --------------------------------------------------

type LinhaBalanco = BalancoItem & {
    nome: string
    categoria: CategoriaItem
    unidadeMedida: UnidadeMedida
}

/** Itens com algum saldo ou movimento no período, com o balanço já fechado. */
async function balancos(intervalo: Intervalo, categoria: CategoriaItem | undefined): Promise<LinhaBalanco[]> {
    const linhas = await movimentacaoRelatorio({ intervalo, categoria })
    return linhas
        .map((l) => ({
            nome: l.nome,
            categoria: l.categoria,
            unidadeMedida: l.unidadeMedida,
            ...balancoItem(l.saldoAtual, l.noPeriodo, l.aposPeriodo)
        }))
        .filter(temMovimento)
}

const movimentacao = definirRelatorio({
    slug: 'movimentacao',
    camposFiltro: [campoCategoria],
    esquemaFiltros: z.object({ categoria: esquemaCategoria }),
    colunas: [
        { cabecalho: 'Item', valor: (l: LinhaBalanco) => l.nome, largura: 34 },
        { cabecalho: 'Categoria', valor: (l) => ROTULO_CATEGORIA_ITEM[l.categoria], largura: 22 },
        { cabecalho: 'Unidade', valor: (l) => ROTULO_UNIDADE_MEDIDA[l.unidadeMedida], largura: 12 },
        { cabecalho: 'Saldo inicial', valor: (l) => l.saldoInicial, largura: 14 },
        { cabecalho: 'Entradas', valor: (l) => l.entradas, largura: 12 },
        { cabecalho: 'Saídas', valor: (l) => l.saidas, largura: 12 },
        { cabecalho: 'Descartes', valor: (l) => l.descartes, largura: 12 },
        { cabecalho: 'Saldo final', valor: (l) => l.saldoFinal, largura: 14 }
    ],
    contar: async (c) => (await balancos(intervaloDe(c), c.filtros.categoria)).length,
    carregar: async (c, janela) => recortar(await balancos(intervaloDe(c), c.filtros.categoria), janela),
    // Contagens, não somas: somar kg com unidades e litros não daria número
    // nenhum que se pudesse ler.
    async resumo(c) {
        const linhas = await balancos(intervaloDe(c), c.filtros.categoria)
        return [
            { rotulo: 'Itens no relatório', valor: linhas.length },
            { rotulo: 'Itens com entrada', valor: linhas.filter((l) => l.entradas > 0).length },
            { rotulo: 'Itens com saída', valor: linhas.filter((l) => l.saidas > 0).length },
            { rotulo: 'Itens com descarte', valor: linhas.filter((l) => l.descartes > 0).length }
        ]
    },
    descreverFiltros: (f) => descreverCategoria(f.categoria)
})

// -- R-08 Entregas por destino ---------------------------------------------------

const entregasPorDestino = definirRelatorio({
    slug: 'entregas-por-destino',
    camposFiltro: [campoCategoria],
    esquemaFiltros: z.object({ categoria: esquemaCategoria }),
    colunas: [
        { cabecalho: 'Destino', valor: (l: LinhaEntregaDestino) => l.destino, largura: 34 },
        { cabecalho: 'Categoria', valor: (l) => ROTULO_CATEGORIA_ITEM[l.categoria], largura: 22 },
        { cabecalho: 'Unidade', valor: (l) => ROTULO_UNIDADE_MEDIDA[l.unidadeMedida], largura: 12 },
        { cabecalho: 'Quantidade entregue', valor: (l) => l.quantidade, largura: 20 },
        { cabecalho: 'Nº de saídas', valor: (l) => l.saidas, largura: 13 }
    ],
    contar: (c) => contarEntregasPorDestino({ intervalo: intervaloDe(c), categoria: c.filtros.categoria }),
    carregar: (c, janela) =>
        entregasPorDestinoRelatorio({ intervalo: intervaloDe(c), categoria: c.filtros.categoria }, janela),
    descreverFiltros: (f) => descreverCategoria(f.categoria)
})

// -- R-14 Evolução da crise ------------------------------------------------------

type LinhaCrise = LinhaEvolucaoCrise & { atualizadoPor: string | null }

const evolucaoCrise = definirRelatorio({
    slug: 'evolucao-crise',
    camposFiltro: [],
    esquemaFiltros: z.object({}),
    colunas: [
        { cabecalho: 'Data', valor: (l: LinhaCrise) => formatarDataHora(l.atualizadoEm), largura: 18 },
        { cabecalho: 'Famílias afetadas', valor: (l) => l.totalFamiliasAfetadas, largura: 18 },
        {
            cabecalho: 'Variação famílias',
            valor: (l) => variacao(l.totalFamiliasAfetadas, l.familiasAnterior),
            largura: 18
        },
        { cabecalho: 'Pessoas afetadas', valor: (l) => l.totalPessoasAfetadas, largura: 18 },
        {
            cabecalho: 'Variação pessoas',
            valor: (l) => variacao(l.totalPessoasAfetadas, l.pessoasAnterior),
            largura: 18
        },
        { cabecalho: 'Atualizado por', valor: (l) => l.atualizadoPor, largura: 28 }
    ],
    contar: (c) => contarEvolucaoCrise(intervaloDe(c)),
    async carregar(c, janela) {
        const linhas = await evolucaoCriseRelatorio(intervaloDe(c), janela)
        const nome = await resolverNomes(linhas, (l) => l.atualizadoPorId)
        return linhas.map((l) => ({ ...l, atualizadoPor: nome(l) }))
    },
    descreverFiltros: () => []
})

// -- R-15 Demanda × capacidade de kits ---------------------------------------------

/**
 * Kits ativos com métrica configurada — os mesmos que o Painel soma no topo
 * (FR-030). `projecaoAtual` é o mesmo caso de uso do Painel, sem o cache: o
 * relatório é do momento (SC-007).
 */
async function kitsComMetrica(): Promise<{
    kits: ProjecaoKit[]
    familias: number
    pessoas: number
    emDeficit: number
}> {
    const projecao = await projecaoAtual()
    const kits = projecao.kits.filter((k) => k.ativo && k.baseDemanda !== null)
    return {
        kits,
        familias: projecao.crise.totalFamiliasAfetadas,
        pessoas: projecao.crise.totalPessoasAfetadas,
        emDeficit: projecao.kitsEmDeficit
    }
}

const demandaKits = definirRelatorio({
    slug: 'demanda-kits',
    camposFiltro: [],
    esquemaFiltros: z.object({}),
    colunas: [
        { cabecalho: 'Kit', valor: (l: ProjecaoKit) => l.nome, largura: 30 },
        {
            cabecalho: 'Base de demanda',
            valor: (l) => (l.baseDemanda ? ROTULO_BASE_DEMANDA[l.baseDemanda] : null),
            largura: 24
        },
        { cabecalho: 'Proporção', valor: (l) => l.proporcao, largura: 12 },
        { cabecalho: 'Demanda projetada', valor: (l) => l.necessarios, largura: 18 },
        { cabecalho: 'Kits montáveis', valor: (l) => l.possiveis, largura: 15 },
        { cabecalho: 'Déficit', valor: (l) => Math.max(0, l.necessarios - l.possiveis), largura: 10 },
        { cabecalho: 'Atendimento (%)', valor: (l) => l.percentualAtendido, largura: 16 }
    ],
    contar: async () => (await kitsComMetrica()).kits.length,
    carregar: async (_c, janela) => recortar((await kitsComMetrica()).kits, janela),
    async resumo() {
        const { familias, pessoas, emDeficit } = await kitsComMetrica()
        return [
            { rotulo: 'Famílias afetadas', valor: familias },
            { rotulo: 'Pessoas afetadas', valor: pessoas },
            { rotulo: 'Kits em déficit', valor: emDeficit }
        ]
    },
    descreverFiltros: () => []
})

// -- R-16 Envio de notificações ----------------------------------------------------

const ROTULO_TIPO_NOTIFICACAO: Record<EventoNotificacao, string> = {
    triagem_concluida: 'Triagem concluída',
    atividade_atribuida: 'Atividade atribuída',
    alteracao_atividade: 'Alteração de atividade',
    lembrete_turno: 'Lembrete de turno',
    broadcast_urgencia: 'Convocação urgente',
    cadastros_acumulados: 'Cadastros acumulados',
    estoque_critico: 'Estoque crítico',
    deficit_atendimento: 'Déficit de atendimento',
    inscricao_turno: 'Inscrição em turno'
}

const CANAIS = ['email', 'plataforma'] as const satisfies readonly CanalNotificacao[]
const ROTULO_CANAL: Record<CanalNotificacao, string> = { email: 'E-mail', plataforma: 'Plataforma' }

/** "Todos" é opção explícita: sem filtro, a lista mostra as falhas — o motivo de abrir o relatório. */
const SITUACOES_FILTRO = ['falhou', 'pendente', 'enviado', 'todos'] as const
type SituacaoFiltro = (typeof SITUACOES_FILTRO)[number]
const ROTULO_SITUACAO_ENVIO: Record<SituacaoFiltro, string> = {
    falhou: 'Falhou',
    pendente: 'Pendente',
    enviado: 'Enviado',
    todos: 'Todas'
}

type LinhaEnvioComNome = LinhaEnvio & { destinatario: string | null }

function filtrosEnvios(
    c: ConsultaRelatorio<{ tipo?: EventoNotificacao; canal?: CanalNotificacao; status?: SituacaoFiltro }>
) {
    const status = c.filtros.status ?? 'falhou'
    return {
        intervalo: intervaloDe(c),
        tipo: c.filtros.tipo,
        canal: c.filtros.canal,
        status: status === 'todos' ? undefined : (status satisfies StatusEnvio)
    }
}

const notificacoes = definirRelatorio({
    slug: 'notificacoes',
    camposFiltro: [
        {
            nome: 'tipo',
            rotulo: 'Tipo',
            tipo: 'select',
            opcoes: opcoesDe(EVENTOS_NOTIFICACAO, ROTULO_TIPO_NOTIFICACAO)
        },
        { nome: 'canal', rotulo: 'Canal', tipo: 'select', opcoes: opcoesDe(CANAIS, ROTULO_CANAL) },
        {
            nome: 'status',
            rotulo: 'Situação',
            tipo: 'select',
            placeholder: 'Falhou',
            opcoes: opcoesDe(SITUACOES_FILTRO, ROTULO_SITUACAO_ENVIO)
        }
    ],
    esquemaFiltros: z.object({
        tipo: enumOpcional(EVENTOS_NOTIFICACAO),
        canal: enumOpcional(CANAIS),
        status: enumOpcional(SITUACOES_FILTRO)
    }),
    colunas: [
        { cabecalho: 'Data', valor: (l: LinhaEnvioComNome) => formatarDataHora(l.criadoEm), largura: 18 },
        { cabecalho: 'Tipo', valor: (l) => ROTULO_TIPO_NOTIFICACAO[l.tipo] ?? l.tipo, largura: 24 },
        { cabecalho: 'Canal', valor: (l) => ROTULO_CANAL[l.canal] ?? l.canal, largura: 12 },
        { cabecalho: 'Situação', valor: (l) => ROTULO_SITUACAO_ENVIO[l.status] ?? l.status, largura: 12 },
        { cabecalho: 'Destinatário', valor: (l) => l.destinatario, largura: 28 },
        { cabecalho: 'Erro', valor: (l) => l.erro, largura: 50 }
    ],
    contar: (c) => contarEnviosNotificacoes(filtrosEnvios(c)),
    async carregar(c, janela) {
        const linhas = await enviosNotificacoesRelatorio(filtrosEnvios(c), janela)
        const nome = await resolverNomes(linhas, (l) => l.destinatarioUserId)
        return linhas.map((l) => ({ ...l, destinatario: nome(l) }))
    },
    /**
     * Totais por canal × situação e, quando há falhas, por tipo — ignora o
     * filtro de situação, que é da lista.
     */
    async resumo(c) {
        const { intervalo, tipo, canal } = filtrosEnvios(c)
        const totais = await totaisEnviosNotificacoes({ intervalo, tipo, canal })

        const porCanal = new Map<string, number>()
        const falhasPorTipo = new Map<EventoNotificacao, number>()
        for (const t of totais) {
            const chave = `${ROTULO_CANAL[t.canal]} — ${ROTULO_SITUACAO_ENVIO[t.status].toLowerCase()}`
            porCanal.set(chave, (porCanal.get(chave) ?? 0) + t.total)
            if (t.status === 'falhou') falhasPorTipo.set(t.tipo, (falhasPorTipo.get(t.tipo) ?? 0) + t.total)
        }

        return [
            ...[...porCanal.entries()]
                .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
                .map(([rotulo, valor]) => ({ rotulo, valor })),
            ...[...falhasPorTipo.entries()].map(([tipo, valor]) => ({
                rotulo: `Falhas — ${ROTULO_TIPO_NOTIFICACAO[tipo]}`,
                valor
            }))
        ]
    },
    descreverFiltros: (f) => [
        ...(f.tipo ? [{ rotulo: 'Tipo', valor: ROTULO_TIPO_NOTIFICACAO[f.tipo] }] : []),
        ...(f.canal ? [{ rotulo: 'Canal', valor: ROTULO_CANAL[f.canal] }] : []),
        { rotulo: 'Situação', valor: ROTULO_SITUACAO_ENVIO[f.status ?? 'falhou'] }
    ]
})

export const RELATORIOS_CONSOLIDADOS = [
    registrar(movimentacao),
    registrar(entregasPorDestino),
    registrar(evolucaoCrise),
    registrar(demandaKits),
    registrar(notificacoes)
]
