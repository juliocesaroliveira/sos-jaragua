import 'server-only'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { limiarEstoqueMinimoGlobal } from '@/src/shared/config/limiares-alerta'
import { ROTULO_CATEGORIA_ITEM, ROTULO_UNIDADE_MEDIDA } from '@/src/modules/estoque/domain/item'
import {
    contarValidadesRelatorio,
    itensCriticosRelatorio,
    validadesRelatorio,
    type LinhaItemCritico,
    type LinhaValidade
} from '@/src/modules/estoque/presentation/queries/relatorios'
import {
    HORIZONTE_MAXIMO,
    HORIZONTE_MINIMO,
    HORIZONTE_PADRAO,
    diasAteVencer,
    faltaProporcional,
    limiteDeValidade,
    ordenarCriticos,
    situacaoValidade,
    type SituacaoValidade
} from '../../domain/calculos-estoque'
import { definirRelatorio, recortar, registrar } from '../definicao-relatorio'
import { arredondar, formatarData, formatarDataHora } from '../formatacao'
import { campoCategoria, descreverCategoria, esquemaCategoria } from './comum'

/**
 * Antecipar falta e perda de estoque — R-05 e R-06 (specs/023-central-relatorios,
 * US2, FR-018).
 */

// -- R-05 ----------------------------------------------------------------------

const estoqueCritico = definirRelatorio({
    slug: 'estoque-critico',
    camposFiltro: [campoCategoria],
    esquemaFiltros: z.object({ categoria: esquemaCategoria }),
    colunas: [
        { cabecalho: 'Item', valor: (l: LinhaItemCritico) => l.nome, largura: 34 },
        { cabecalho: 'Categoria', valor: (l) => ROTULO_CATEGORIA_ITEM[l.categoria], largura: 22 },
        { cabecalho: 'Unidade', valor: (l) => ROTULO_UNIDADE_MEDIDA[l.unidadeMedida], largura: 12 },
        { cabecalho: 'Saldo', valor: (l) => l.saldo, largura: 12 },
        { cabecalho: 'Mínimo aplicado', valor: (l) => l.limiar, largura: 16 },
        { cabecalho: 'Falta', valor: (l) => arredondar(Math.max(0, l.limiar - l.saldo)), largura: 12 },
        { cabecalho: 'Falta (%)', valor: (l) => Math.round(faltaProporcional(l.saldo, l.limiar) * 100), largura: 11 }
    ],
    contar: async ({ filtros }) => (await itensCriticosRelatorio(filtros, limiarEstoqueMinimoGlobal())).length,
    carregar: async ({ filtros }, janela) =>
        recortar(ordenarCriticos(await itensCriticosRelatorio(filtros, limiarEstoqueMinimoGlobal())), janela),
    descreverFiltros: (f) => descreverCategoria(f.categoria)
})

// -- R-06 ----------------------------------------------------------------------

const ROTULO_SITUACAO_VALIDADE: Record<SituacaoValidade, string> = { vencida: 'Vencida', a_vencer: 'A vencer' }

const MENSAGEM_HORIZONTE = `Informe um número de dias entre ${HORIZONTE_MINIMO} e ${HORIZONTE_MAXIMO}.`

/** Vazio é "use o padrão"; número fora da faixa é erro mostrado no campo. */
const esquemaHorizonte = z.preprocess(
    (valor) => (valor === undefined || valor === '' ? undefined : valor),
    z.coerce
        .number({ error: MENSAGEM_HORIZONTE })
        .int(MENSAGEM_HORIZONTE)
        .min(HORIZONTE_MINIMO, MENSAGEM_HORIZONTE)
        .max(HORIZONTE_MAXIMO, MENSAGEM_HORIZONTE)
        .optional()
)

type LinhaValidadeComSituacao = LinhaValidade & { situacao: SituacaoValidade | null; dias: number }

const validades = definirRelatorio({
    slug: 'validades',
    camposFiltro: [
        {
            nome: 'horizonte',
            rotulo: 'Vencem em até (dias)',
            tipo: 'numero',
            min: HORIZONTE_MINIMO,
            max: HORIZONTE_MAXIMO,
            apoio: `Padrão: ${HORIZONTE_PADRAO} dias. Vencidas sempre aparecem.`
        },
        campoCategoria
    ],
    esquemaFiltros: z.object({ horizonte: esquemaHorizonte, categoria: esquemaCategoria }),
    colunas: [
        {
            cabecalho: 'Situação',
            valor: (l: LinhaValidadeComSituacao) => (l.situacao ? ROTULO_SITUACAO_VALIDADE[l.situacao] : null),
            largura: 12
        },
        { cabecalho: 'Validade', valor: (l) => formatarData(l.dataValidade), largura: 12 },
        { cabecalho: 'Dias até vencer', valor: (l) => l.dias, largura: 16 },
        { cabecalho: 'Item', valor: (l) => l.item, largura: 34 },
        { cabecalho: 'Categoria', valor: (l) => ROTULO_CATEGORIA_ITEM[l.categoria], largura: 22 },
        { cabecalho: 'Quantidade recebida', valor: (l) => l.quantidade, largura: 20 },
        { cabecalho: 'Unidade', valor: (l) => ROTULO_UNIDADE_MEDIDA[l.unidadeMedida], largura: 12 },
        { cabecalho: 'Data da entrada', valor: (l) => formatarDataHora(l.criadoEm), largura: 18 }
    ],
    contar: ({ filtros, hoje }) =>
        contarValidadesRelatorio({
            limite: limiteDeValidade(hoje, filtros.horizonte ?? HORIZONTE_PADRAO),
            categoria: filtros.categoria
        }),
    async carregar({ filtros, hoje }, janela) {
        const horizonte = filtros.horizonte ?? HORIZONTE_PADRAO
        const linhas = await validadesRelatorio(
            { limite: limiteDeValidade(hoje, horizonte), categoria: filtros.categoria },
            janela
        )
        return linhas.map((l) => ({
            ...l,
            situacao: situacaoValidade(l.dataValidade, hoje, horizonte),
            dias: diasAteVencer(l.dataValidade, hoje)
        }))
    },
    descreverFiltros: (f) => [
        { rotulo: 'Vencem em até', valor: `${f.horizonte ?? HORIZONTE_PADRAO} dias` },
        ...descreverCategoria(f.categoria)
    ]
})

export const RELATORIOS_ALERTAS_ESTOQUE = [registrar(estoqueCritico), registrar(validades)]
