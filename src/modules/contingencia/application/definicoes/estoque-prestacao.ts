import 'server-only'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { limiarEstoqueMinimoGlobal } from '@/src/shared/config/limiares-alerta'
import {
    CONDICOES_ITEM,
    ROTULO_CATEGORIA_ITEM,
    ROTULO_CONDICAO_ITEM,
    ROTULO_UNIDADE_MEDIDA,
    TIPOS_SAIDA,
    type TipoSaida
} from '@/src/modules/estoque/domain/item'
import {
    contarDescartesNoPeriodo,
    contarEntradasNoPeriodo,
    contarSaidasNoPeriodo,
    descartesNoPeriodo,
    entradasNoPeriodo,
    inventarioRelatorio,
    saidasNoPeriodo,
    type Intervalo,
    type LinhaDescarteRelatorio,
    type LinhaEntradaRelatorio,
    type LinhaInventario,
    type LinhaSaidaRelatorio,
    type OrigemMinimo,
    type SituacaoEstoque
} from '@/src/modules/estoque/presentation/queries/relatorios'
import { definirRelatorio, recortar, registrar, type ConsultaRelatorio } from '../definicao-relatorio'
import { formatarData, formatarDataHora, rotulo, simNao } from '../formatacao'
import {
    campoCategoria,
    descreverCategoria,
    enumOpcional,
    esquemaCategoria,
    opcoesDe,
    resolverNomes,
    textoOpcional
} from './comum'

/**
 * Prestação de contas de doações — R-01 a R-04 (specs/023-central-relatorios,
 * US1, FR-015 a FR-017; colunas de data-model.md §4).
 */

const ROTULO_TIPO_SAIDA: Record<TipoSaida, string> = { avulso: 'Avulso', kit: 'Kit' }

const ROTULO_ORIGEM_MINIMO: Record<OrigemMinimo, string> = {
    proprio: 'Próprio',
    padrao: 'Padrão',
    sem_alerta: 'Sem alerta'
}

const ROTULO_SITUACAO: Record<SituacaoEstoque, string> = {
    abaixo: 'Abaixo do mínimo',
    ok: 'OK',
    aguardando: 'Aguardando primeira entrada'
}

const SITUACOES = ['abaixo', 'ok', 'aguardando'] as const

/** Relatórios de histórico sempre têm período; o tipo não sabe disso, a definição sabe. */
function intervaloDe<F>(consulta: ConsultaRelatorio<F>): Intervalo {
    if (!consulta.intervalo) throw new Error('Relatório de histórico consultado sem período.')
    return consulta.intervalo
}

// -- R-01 ----------------------------------------------------------------------

const inventario = definirRelatorio({
    slug: 'inventario',
    camposFiltro: [
        campoCategoria,
        { nome: 'situacao', rotulo: 'Situação', tipo: 'select', opcoes: opcoesDe(SITUACOES, ROTULO_SITUACAO) }
    ],
    esquemaFiltros: z.object({ categoria: esquemaCategoria, situacao: enumOpcional(SITUACOES) }),
    colunas: [
        { cabecalho: 'Item', valor: (l: LinhaInventario) => l.nome, largura: 34 },
        { cabecalho: 'Categoria', valor: (l) => ROTULO_CATEGORIA_ITEM[l.categoria], largura: 22 },
        { cabecalho: 'Unidade', valor: (l) => ROTULO_UNIDADE_MEDIDA[l.unidadeMedida], largura: 12 },
        { cabecalho: 'Saldo atual', valor: (l) => l.saldo, largura: 14 },
        { cabecalho: 'Mínimo aplicado', valor: (l) => l.minimoAplicado, largura: 16 },
        { cabecalho: 'Origem do mínimo', valor: (l) => ROTULO_ORIGEM_MINIMO[l.origemMinimo], largura: 18 },
        { cabecalho: 'Situação', valor: (l) => ROTULO_SITUACAO[l.situacao], largura: 26 }
    ],
    // Cadastro pequeno: a consulta devolve tudo e a página é recortada em
    // memória (ver `inventarioRelatorio`).
    contar: async ({ filtros }) => (await inventarioRelatorio(filtros, limiarEstoqueMinimoGlobal())).length,
    carregar: async ({ filtros }, janela) =>
        recortar(await inventarioRelatorio(filtros, limiarEstoqueMinimoGlobal()), janela),
    descreverFiltros: (f) => [
        ...descreverCategoria(f.categoria),
        ...(f.situacao ? [{ rotulo: 'Situação', valor: ROTULO_SITUACAO[f.situacao] }] : [])
    ]
})

// -- R-02 ----------------------------------------------------------------------

type LinhaSaida = LinhaSaidaRelatorio & { registradoPor: string | null }

const saidas = definirRelatorio({
    slug: 'saidas',
    camposFiltro: [
        { nome: 'tipo', rotulo: 'Tipo', tipo: 'select', opcoes: opcoesDe(TIPOS_SAIDA, ROTULO_TIPO_SAIDA) },
        { nome: 'destino', rotulo: 'Destino', tipo: 'texto', placeholder: 'Bairro, abrigo ou família' },
        campoCategoria
    ],
    esquemaFiltros: z.object({ tipo: enumOpcional(TIPOS_SAIDA), destino: textoOpcional, categoria: esquemaCategoria }),
    colunas: [
        { cabecalho: 'Data', valor: (l: LinhaSaida) => formatarDataHora(l.criadoEm), largura: 18 },
        { cabecalho: 'Tipo', valor: (l) => ROTULO_TIPO_SAIDA[l.tipo], largura: 10 },
        { cabecalho: 'Destino', valor: (l) => l.destino, largura: 30 },
        { cabecalho: 'Responsável pelo transporte', valor: (l) => l.responsavelTransporte, largura: 28 },
        { cabecalho: 'Item', valor: (l) => l.item, largura: 34 },
        { cabecalho: 'Categoria', valor: (l) => ROTULO_CATEGORIA_ITEM[l.categoria], largura: 22 },
        { cabecalho: 'Quantidade', valor: (l) => l.quantidade, largura: 14 },
        { cabecalho: 'Unidade', valor: (l) => ROTULO_UNIDADE_MEDIDA[l.unidadeMedida], largura: 12 },
        { cabecalho: 'Registrado por', valor: (l) => l.registradoPor, largura: 28 }
    ],
    contar: (c) => contarSaidasNoPeriodo({ intervalo: intervaloDe(c), ...c.filtros }),
    async carregar(c, janela) {
        const linhas = await saidasNoPeriodo({ intervalo: intervaloDe(c), ...c.filtros }, janela)
        const nome = await resolverNomes(linhas, (l) => l.registradoPorId)
        return linhas.map((l) => ({ ...l, registradoPor: nome(l) }))
    },
    descreverFiltros: (f) => [
        ...(f.tipo ? [{ rotulo: 'Tipo', valor: ROTULO_TIPO_SAIDA[f.tipo] }] : []),
        ...(f.destino ? [{ rotulo: 'Destino contém', valor: f.destino }] : []),
        ...descreverCategoria(f.categoria)
    ]
})

// -- R-03 ----------------------------------------------------------------------

type LinhaEntrada = LinhaEntradaRelatorio & { registradoPor: string | null }

const entradas = definirRelatorio({
    slug: 'entradas',
    camposFiltro: [
        campoCategoria,
        { nome: 'condicao', rotulo: 'Condição', tipo: 'select', opcoes: opcoesDe(CONDICOES_ITEM, ROTULO_CONDICAO_ITEM) }
    ],
    esquemaFiltros: z.object({ categoria: esquemaCategoria, condicao: enumOpcional(CONDICOES_ITEM) }),
    colunas: [
        { cabecalho: 'Data', valor: (l: LinhaEntrada) => formatarDataHora(l.criadoEm), largura: 18 },
        { cabecalho: 'Item', valor: (l) => l.item, largura: 34 },
        { cabecalho: 'Categoria', valor: (l) => ROTULO_CATEGORIA_ITEM[l.categoria], largura: 22 },
        { cabecalho: 'Quantidade', valor: (l) => l.quantidade, largura: 14 },
        { cabecalho: 'Unidade', valor: (l) => ROTULO_UNIDADE_MEDIDA[l.unidadeMedida], largura: 12 },
        { cabecalho: 'Condição', valor: (l) => rotulo(ROTULO_CONDICAO_ITEM, l.condicao), largura: 24 },
        { cabecalho: 'Perecível', valor: (l) => simNao(l.perecivel), largura: 11 },
        { cabecalho: 'Validade', valor: (l) => formatarData(l.dataValidade), largura: 12 },
        { cabecalho: 'Kit de destino', valor: (l) => l.kitDestino, largura: 24 },
        { cabecalho: 'Registrado por', valor: (l) => l.registradoPor, largura: 28 }
    ],
    contar: (c) => contarEntradasNoPeriodo({ intervalo: intervaloDe(c), ...c.filtros }),
    async carregar(c, janela) {
        const linhas = await entradasNoPeriodo({ intervalo: intervaloDe(c), ...c.filtros }, janela)
        const nome = await resolverNomes(linhas, (l) => l.registradoPorId)
        return linhas.map((l) => ({ ...l, registradoPor: nome(l) }))
    },
    descreverFiltros: (f) => [
        ...descreverCategoria(f.categoria),
        ...(f.condicao ? [{ rotulo: 'Condição', valor: ROTULO_CONDICAO_ITEM[f.condicao] }] : [])
    ]
})

// -- R-04 ----------------------------------------------------------------------

type LinhaDescarte = LinhaDescarteRelatorio & { registradoPor: string | null }

const descartes = definirRelatorio({
    slug: 'descartes',
    camposFiltro: [campoCategoria],
    esquemaFiltros: z.object({ categoria: esquemaCategoria }),
    colunas: [
        { cabecalho: 'Data', valor: (l: LinhaDescarte) => formatarDataHora(l.criadoEm), largura: 18 },
        { cabecalho: 'Item', valor: (l) => l.item, largura: 34 },
        { cabecalho: 'Categoria', valor: (l) => ROTULO_CATEGORIA_ITEM[l.categoria], largura: 22 },
        { cabecalho: 'Quantidade', valor: (l) => l.quantidade, largura: 14 },
        { cabecalho: 'Unidade', valor: (l) => ROTULO_UNIDADE_MEDIDA[l.unidadeMedida], largura: 12 },
        { cabecalho: 'Motivo', valor: (l) => l.motivo, largura: 36 },
        { cabecalho: 'Registrado por', valor: (l) => l.registradoPor, largura: 28 }
    ],
    contar: (c) => contarDescartesNoPeriodo({ intervalo: intervaloDe(c), ...c.filtros }),
    async carregar(c, janela) {
        const linhas = await descartesNoPeriodo({ intervalo: intervaloDe(c), ...c.filtros }, janela)
        const nome = await resolverNomes(linhas, (l) => l.registradoPorId)
        return linhas.map((l) => ({ ...l, registradoPor: nome(l) }))
    },
    descreverFiltros: (f) => descreverCategoria(f.categoria)
})

export const RELATORIOS_PRESTACAO = [
    registrar(inventario),
    registrar(saidas),
    registrar(entradas),
    registrar(descartes)
]
