import 'server-only'
import { z } from '@/src/shared/validacao/zod-ptbr'
import {
    DISPONIBILIDADES,
    ROTULO_DISPONIBILIDADE,
    ROTULO_TIPO_VEICULO,
    TIPOS_VEICULO
} from '@/src/modules/voluntariado/domain/candidatura'
import {
    candidaturasParaResumo,
    capacidadeRelatorio,
    contarOcupacaoTurnos,
    contarParticipacao,
    contarTriagem,
    contarVoluntariosRelatorio,
    ocupacaoParaResumo,
    ocupacaoTurnosRelatorio,
    opcoesFiltrosVoluntariado,
    participacaoRelatorio,
    triagemRelatorio,
    voluntariosRelatorio,
    type Intervalo,
    type LinhaOcupacao,
    type LinhaParticipacao,
    type LinhaTriagem,
    type LinhaVoluntarioRelatorio,
    type StatusAtividade,
    type StatusVoluntario
} from '@/src/modules/voluntariado/presentation/queries/relatorios'
import type { OpcaoFiltro } from '../../domain/catalogo'
import { diasEntre, horasDeSegundos, ocupacaoPercentual, resumoTriagem } from '../../domain/calculos-voluntariado'
import {
    definirRelatorio,
    recortar,
    registrar,
    rotuloDaOpcao,
    type ConsultaRelatorio,
    type FiltroDescrito
} from '../definicao-relatorio'
import { formatarDataHora, simNao } from '../formatacao'
import { enumOpcional, idOpcional, opcoesDe, resolverNomes, textoOpcional } from './comum'

/**
 * Conhecer e acompanhar a força voluntária — R-09 a R-13
 * (specs/023-central-relatorios, US3, FR-024 a FR-028).
 *
 * CPF e restrições de saúde aparecem completos (Clarification Q1); a tela
 * mostra o aviso de LGPD junto da exportação (`contemDadosSensiveis` no
 * catálogo).
 */

const STATUS_VOLUNTARIO = ['pendente', 'aprovado', 'rejeitado'] as const
const ROTULO_STATUS_VOLUNTARIO: Record<StatusVoluntario, string> = {
    pendente: 'Pendente',
    aprovado: 'Aprovado',
    rejeitado: 'Rejeitado'
}

const STATUS_ATIVIDADE = ['aberta', 'encerrada', 'cancelada'] as const
const ROTULO_STATUS_ATIVIDADE: Record<StatusAtividade, string> = {
    aberta: 'Aberta',
    encerrada: 'Encerrada',
    cancelada: 'Cancelada'
}

/** Opções dinâmicas, já com o nome do campo de filtro que cada uma alimenta. */
async function opcoes(): Promise<Record<string, OpcaoFiltro[]>> {
    const o = await opcoesFiltrosVoluntariado()
    return {
        bairro: o.bairros,
        habilidadeId: o.habilidades,
        atividadeId: o.atividades,
        categoriaAtividadeId: o.categoriasAtividade
    }
}

function intervaloDe<F>(consulta: ConsultaRelatorio<F>): Intervalo {
    if (!consulta.intervalo) throw new Error('Relatório de histórico consultado sem período.')
    return consulta.intervalo
}

function descrever(rotulo: string, valor: string | undefined): FiltroDescrito[] {
    return valor ? [{ rotulo, valor }] : []
}

// -- R-09 ----------------------------------------------------------------------

const voluntarios = definirRelatorio({
    slug: 'voluntarios',
    camposFiltro: [
        {
            nome: 'status',
            rotulo: 'Situação',
            tipo: 'select',
            opcoes: opcoesDe(STATUS_VOLUNTARIO, ROTULO_STATUS_VOLUNTARIO)
        },
        { nome: 'bairro', rotulo: 'Bairro', tipo: 'select' },
        { nome: 'habilidadeId', rotulo: 'Habilidade', tipo: 'select' },
        {
            nome: 'tipoVeiculo',
            rotulo: 'Tipo de veículo',
            tipo: 'select',
            opcoes: opcoesDe(TIPOS_VEICULO, ROTULO_TIPO_VEICULO)
        },
        {
            nome: 'disponibilidade',
            rotulo: 'Disponibilidade',
            tipo: 'select',
            opcoes: opcoesDe(DISPONIBILIDADES, ROTULO_DISPONIBILIDADE)
        }
    ],
    esquemaFiltros: z.object({
        status: enumOpcional(STATUS_VOLUNTARIO),
        bairro: textoOpcional,
        habilidadeId: idOpcional,
        tipoVeiculo: enumOpcional(TIPOS_VEICULO),
        disponibilidade: enumOpcional(DISPONIBILIDADES)
    }),
    colunas: [
        { cabecalho: 'Nome', valor: (l: LinhaVoluntarioRelatorio) => l.nomeCompleto, largura: 30 },
        { cabecalho: 'CPF', valor: (l) => l.cpf, largura: 14 },
        { cabecalho: 'Situação', valor: (l) => ROTULO_STATUS_VOLUNTARIO[l.status], largura: 12 },
        { cabecalho: 'Telefone', valor: (l) => l.telefone, largura: 16 },
        { cabecalho: 'Bairro', valor: (l) => l.bairro, largura: 20 },
        { cabecalho: 'Profissão', valor: (l) => l.profissao, largura: 20 },
        { cabecalho: 'Habilidades', valor: (l) => l.habilidades, largura: 34 },
        { cabecalho: 'Veículo próprio', valor: (l) => simNao(l.veiculoProprio), largura: 16 },
        {
            cabecalho: 'Tipo de veículo',
            valor: (l) => (l.tipoVeiculo ? ROTULO_TIPO_VEICULO[l.tipoVeiculo] : null),
            largura: 16
        },
        {
            cabecalho: 'Disponibilidade',
            valor: (l) => l.disponibilidade.map((d) => ROTULO_DISPONIBILIDADE[d]).join(', '),
            largura: 28
        },
        { cabecalho: 'Restrições de saúde', valor: (l) => l.restricoesSaude, largura: 30 },
        { cabecalho: 'Cadastro em', valor: (l) => formatarDataHora(l.criadoEm), largura: 18 },
        { cabecalho: 'Decisão em', valor: (l) => formatarDataHora(l.decididoEm), largura: 18 }
    ],
    contar: ({ filtros }) => contarVoluntariosRelatorio(filtros),
    carregar: ({ filtros }, janela) => voluntariosRelatorio(filtros, janela),
    descreverFiltros: (f, o) => [
        ...descrever('Situação', f.status && ROTULO_STATUS_VOLUNTARIO[f.status]),
        ...descrever('Bairro', f.bairro),
        ...descrever('Habilidade', f.habilidadeId && rotuloDaOpcao(o, 'habilidadeId', f.habilidadeId)),
        ...descrever('Tipo de veículo', f.tipoVeiculo && ROTULO_TIPO_VEICULO[f.tipoVeiculo]),
        ...descrever('Disponibilidade', f.disponibilidade && ROTULO_DISPONIBILIDADE[f.disponibilidade])
    ],
    opcoesFiltros: opcoes
})

// -- R-10 ----------------------------------------------------------------------

type LinhaTriagemComDias = LinhaTriagem & { dias: number }

const triagem = definirRelatorio({
    slug: 'triagem',
    camposFiltro: [],
    esquemaFiltros: z.object({}),
    colunas: [
        { cabecalho: 'Nome', valor: (l: LinhaTriagemComDias) => l.nomeCompleto, largura: 30 },
        { cabecalho: 'Telefone', valor: (l) => l.telefone, largura: 16 },
        { cabecalho: 'Bairro', valor: (l) => l.bairro, largura: 20 },
        { cabecalho: 'Enviado em', valor: (l) => formatarDataHora(l.enviadoEm), largura: 18 },
        { cabecalho: 'Situação', valor: (l) => ROTULO_STATUS_VOLUNTARIO[l.status], largura: 12 },
        { cabecalho: 'Decidido em', valor: (l) => formatarDataHora(l.decididoEm), largura: 18 },
        { cabecalho: 'Dias até decisão / de espera', valor: (l) => l.dias, largura: 26 }
    ],
    contar: (c) => contarTriagem(intervaloDe(c)),
    async carregar(c, janela) {
        const linhas = await triagemRelatorio(intervaloDe(c), janela)
        return linhas.map((l) => ({
            ...l,
            // Pendente: há quanto tempo espera. Decidida: quanto levou.
            dias:
                l.status === 'pendente' || !l.decididoEm
                    ? diasEntre(l.enviadoEm, c.agora)
                    : diasEntre(l.primeiroEnvio, l.decididoEm)
        }))
    },
    async resumo(c) {
        const resumo = resumoTriagem(await candidaturasParaResumo(intervaloDe(c)))
        return [
            { rotulo: 'Pendentes', valor: resumo.pendentes },
            { rotulo: 'Aprovadas', valor: resumo.aprovadas },
            { rotulo: 'Rejeitadas', valor: resumo.rejeitadas },
            {
                rotulo: 'Tempo médio até decisão',
                valor:
                    resumo.tempoMedioDias === null
                        ? '—'
                        : `${resumo.tempoMedioDias.toLocaleString('pt-BR')} ${resumo.tempoMedioDias === 1 ? 'dia' : 'dias'}`
            }
        ]
    },
    descreverFiltros: () => []
})

// -- R-11 ----------------------------------------------------------------------

type LinhaCapacidade = { dimensao: string; valor: string; total: number }

async function linhasCapacidade(bairro: string | undefined): Promise<LinhaCapacidade[]> {
    const contagens = await capacidadeRelatorio({ bairro })
    const veiculos = new Map(contagens.porVeiculo.map((v) => [v.tipoVeiculo, v.total]))
    const disponibilidades = new Map(contagens.porDisponibilidade.map((d) => [d.disponibilidade, d.total]))

    // Todo valor possível aparece, inclusive com zero: "ninguém tem barco"
    // é a informação, não a ausência dela.
    return [
        ...contagens.porHabilidade.map((h) => ({ dimensao: 'Habilidade', valor: h.habilidade, total: h.total })),
        ...TIPOS_VEICULO.map((t) => ({
            dimensao: 'Veículo',
            valor: ROTULO_TIPO_VEICULO[t],
            total: veiculos.get(t) ?? 0
        })),
        ...DISPONIBILIDADES.map((d) => ({
            dimensao: 'Disponibilidade',
            valor: ROTULO_DISPONIBILIDADE[d],
            total: disponibilidades.get(d) ?? 0
        }))
    ]
}

const capacidade = definirRelatorio({
    slug: 'capacidade-habilidades',
    camposFiltro: [{ nome: 'bairro', rotulo: 'Bairro', tipo: 'select' }],
    esquemaFiltros: z.object({ bairro: textoOpcional }),
    colunas: [
        { cabecalho: 'Dimensão', valor: (l: LinhaCapacidade) => l.dimensao, largura: 16 },
        { cabecalho: 'Valor', valor: (l) => l.valor, largura: 30 },
        { cabecalho: 'Voluntários aprovados', valor: (l) => l.total, largura: 22 }
    ],
    contar: async ({ filtros }) => (await linhasCapacidade(filtros.bairro)).length,
    carregar: async ({ filtros }, janela) => recortar(await linhasCapacidade(filtros.bairro), janela),
    descreverFiltros: (f) => descrever('Bairro', f.bairro),
    opcoesFiltros: opcoes
})

// -- R-12 ----------------------------------------------------------------------

const ocupacao = definirRelatorio({
    slug: 'ocupacao-turnos',
    camposFiltro: [
        { nome: 'atividadeId', rotulo: 'Atividade', tipo: 'select' },
        { nome: 'categoriaAtividadeId', rotulo: 'Categoria da atividade', tipo: 'select' },
        {
            nome: 'statusAtividade',
            rotulo: 'Situação da atividade',
            tipo: 'select',
            opcoes: opcoesDe(STATUS_ATIVIDADE, ROTULO_STATUS_ATIVIDADE)
        },
        { nome: 'apenasComVagas', rotulo: 'Só turnos com vagas abertas', tipo: 'booleano' }
    ],
    esquemaFiltros: z.object({
        atividadeId: idOpcional,
        categoriaAtividadeId: idOpcional,
        statusAtividade: enumOpcional(STATUS_ATIVIDADE),
        apenasComVagas: z.enum(['true']).optional().catch(undefined)
    }),
    colunas: [
        { cabecalho: 'Atividade', valor: (l: LinhaOcupacao) => l.atividade, largura: 30 },
        { cabecalho: 'Categoria', valor: (l) => l.categoria, largura: 22 },
        { cabecalho: 'Local', valor: (l) => l.local, largura: 24 },
        { cabecalho: 'Situação da atividade', valor: (l) => ROTULO_STATUS_ATIVIDADE[l.statusAtividade], largura: 20 },
        { cabecalho: 'Início', valor: (l) => formatarDataHora(l.inicio), largura: 18 },
        { cabecalho: 'Fim', valor: (l) => formatarDataHora(l.fim), largura: 18 },
        { cabecalho: 'Vagas', valor: (l) => l.vagas, largura: 8 },
        { cabecalho: 'Confirmados', valor: (l) => l.confirmados, largura: 13 },
        { cabecalho: 'Ocupação (%)', valor: (l) => ocupacaoPercentual(l.confirmados, l.vagas), largura: 13 }
    ],
    contar: (c) => contarOcupacaoTurnos(filtrosOcupacao(c)),
    carregar: (c, janela) => ocupacaoTurnosRelatorio(filtrosOcupacao(c), janela),
    async resumo(c) {
        const turnos = await ocupacaoParaResumo(filtrosOcupacao(c))
        const comVaga = turnos.filter((t) => t.confirmados < t.vagas).length
        const vagas = turnos.reduce((soma, t) => soma + t.vagas, 0)
        const confirmados = turnos.reduce((soma, t) => soma + t.confirmados, 0)
        return [
            { rotulo: 'Turnos no período', valor: turnos.length },
            { rotulo: 'Turnos com vagas abertas', valor: comVaga },
            { rotulo: 'Ocupação geral (%)', valor: ocupacaoPercentual(confirmados, vagas) }
        ]
    },
    descreverFiltros: (f, o) => [
        ...descrever('Atividade', f.atividadeId && rotuloDaOpcao(o, 'atividadeId', f.atividadeId)),
        ...descrever(
            'Categoria da atividade',
            f.categoriaAtividadeId && rotuloDaOpcao(o, 'categoriaAtividadeId', f.categoriaAtividadeId)
        ),
        ...descrever('Situação da atividade', f.statusAtividade && ROTULO_STATUS_ATIVIDADE[f.statusAtividade]),
        ...descrever('Só turnos com vagas abertas', f.apenasComVagas && 'Sim')
    ],
    opcoesFiltros: opcoes
})

function filtrosOcupacao(
    c: ConsultaRelatorio<{
        atividadeId?: string
        categoriaAtividadeId?: string
        statusAtividade?: StatusAtividade
        apenasComVagas?: 'true'
    }>
) {
    return {
        intervalo: intervaloDe(c),
        atividadeId: c.filtros.atividadeId,
        categoriaAtividadeId: c.filtros.categoriaAtividadeId,
        statusAtividade: c.filtros.statusAtividade,
        apenasComVagas: c.filtros.apenasComVagas === 'true'
    }
}

// -- R-13 ----------------------------------------------------------------------

type LinhaParticipacaoComNome = LinhaParticipacao & { participante: string | null }

const participacao = definirRelatorio({
    slug: 'participacao',
    camposFiltro: [],
    esquemaFiltros: z.object({}),
    colunas: [
        { cabecalho: 'Participante', valor: (l: LinhaParticipacaoComNome) => l.participante, largura: 30 },
        { cabecalho: 'CPF', valor: (l) => l.cpf, largura: 14 },
        { cabecalho: 'Telefone', valor: (l) => l.telefone, largura: 16 },
        { cabecalho: 'Turnos confirmados', valor: (l) => l.turnos, largura: 18 },
        { cabecalho: 'Horas escaladas', valor: (l) => horasDeSegundos(l.segundos), largura: 16 }
    ],
    contar: (c) => contarParticipacao(intervaloDe(c)),
    async carregar(c, janela) {
        const linhas = await participacaoRelatorio(intervaloDe(c), janela)
        const nome = await resolverNomes(linhas, (l) => l.participanteUserId)
        return linhas.map((l) => ({ ...l, participante: nome(l) }))
    },
    descreverFiltros: () => []
})

export const RELATORIOS_VOLUNTARIADO = [
    registrar(voluntarios),
    registrar(triagem),
    registrar(capacidade),
    registrar(ocupacao),
    registrar(participacao)
]
