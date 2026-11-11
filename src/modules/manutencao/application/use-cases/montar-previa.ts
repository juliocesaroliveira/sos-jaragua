import type { Role } from '@/src/shared/auth/roles'
import { DomainError } from '@/src/shared/kernel'
import {
    REGISTRO_SISTEMA_POR_TABELA,
    ROTULO_REGISTRO_SISTEMA,
    ehRegistroSistema
} from '@/src/shared/kernel/registros-sistema'
import { nomeDoVinculo, tabelaDoCatalogo, type Catalogo, type Vinculo } from '../../domain/catalogo'
import { conferirCatalogo } from '../../domain/conferir-catalogo'
import { AVISO_IRREVERSIVEL, AVISO_TRAVA, alertaDeAcesso, consequenciaDe } from '../../domain/consequencias'
import { expandir, niveisAPartirDe, propaga, tabelasAlcancaveis, type Modo } from '../../domain/grafo'
import {
    temDependentesHistoricos,
    textoConfirmacao,
    truncarAmostra,
    TAMANHO_AMOSTRA,
    type Ambiente,
    type ImpressaoDigital,
    type NoImpacto,
    type PedidoAcao,
    type Previa
} from '../../domain/previa'
import type { Protecao, Semente, SessaoConjuntos } from '../ports/executor-conjuntos'
import type { LeitorEsquema } from '../ports/leitor-esquema'

/**
 * Peças compartilhadas pela prévia e pela execução. A execução **recalcula** a
 * prévia dentro da transação travada e compara; por isso as duas precisam
 * passar pelo mesmo código (research D6/D7).
 */

export type AtorDangerZone = {
    userId: string
    role: Role
    sessionToken: string
    sessaoCriadaEm: Date
    ip?: string
    userAgent?: string
}

export const LIMITE_SELECIONADOS = 500

/** Regras de proteção do executor e dos registros padrão (FR-018, research D14). */
export function protecoesDo(ator: Pick<AtorDangerZone, 'userId' | 'sessionToken'>): Protecao[] {
    return [
        { tabela: 'user', coluna: 'id', valores: [ator.userId], descricao: 'Sua conta' },
        { tabela: 'session', coluna: 'token', valores: [ator.sessionToken], descricao: 'Sua sessão atual' },
        { tabela: 'account', coluna: 'user_id', valores: [ator.userId], descricao: 'Suas contas de login' },
        ...Object.entries(REGISTRO_SISTEMA_POR_TABELA).map(([tabela, id]) => ({
            tabela,
            coluna: 'id',
            valores: [id],
            descricao: `Registro do sistema: ${ROTULO_REGISTRO_SISTEMA[tabela]}`
        }))
    ]
}

/** Validação que não precisa de banco além das FKs: tabela, catálogo, seleção. */
export async function validarPedido(
    pedido: PedidoAcao,
    ator: Pick<AtorDangerZone, 'userId'>,
    catalogo: Catalogo,
    leitor: LeitorEsquema
): Promise<DomainError | null> {
    if (!tabelaDoCatalogo(pedido.tabela) || !catalogo.tabelas.some((t) => t.nome === pedido.tabela)) {
        return new DomainError('tabela_desconhecida', 'Esta tabela não pode ser manipulada pela Danger Zone.')
    }

    const { tabelasBloqueadas } = conferirCatalogo(catalogo, await leitor.fksFisicas())
    const vinculos = new Set<string>()
    for (const tabela of tabelasAlcancaveis(pedido.tabela, catalogo.vinculos)) {
        for (const v of tabelasBloqueadas.get(tabela) ?? []) vinculos.add(v)
    }
    if (vinculos.size > 0) {
        return new DomainError(
            'catalogo_divergente',
            'Há vínculos entre tabelas ainda não classificados na Danger Zone. A ação fica indisponível até o catálogo ser atualizado.',
            { vinculos: [...vinculos] }
        )
    }

    if (pedido.acao === 'excluir_selecionados') {
        const chaves = pedido.chaves ?? []
        if (chaves.length === 0 || chaves.length > LIMITE_SELECIONADOS) {
            return new DomainError('selecao_invalida', `Selecione de 1 a ${LIMITE_SELECIONADOS} registros.`)
        }
        const protegida = chaves.some(
            (c) => ehRegistroSistema(pedido.tabela, c) || (pedido.tabela === 'user' && c === ator.userId)
        )
        if (protegida) {
            return new DomainError(
                'registro_protegido',
                'A seleção inclui um registro que a Danger Zone nunca apaga (sua conta ou um registro do sistema).'
            )
        }
    }
    return null
}

export function sementeDe(pedido: PedidoAcao): Semente {
    return pedido.acao === 'resetar_tabela'
        ? { tabela: pedido.tabela }
        : { tabela: pedido.tabela, chaves: pedido.chaves }
}

/**
 * Semeia e expande até o ponto fixo. Sem modo escolhido, calcula como
 * preservação — é o modo que revela se há dependentes de histórico.
 */
export async function calcularConjuntos(
    sessao: SessaoConjuntos,
    catalogo: Catalogo,
    pedido: PedidoAcao,
    modo: Modo,
    protecoes: readonly Protecao[]
): Promise<ImpressaoDigital> {
    await sessao.semear(sementeDe(pedido), protecoes)
    await expandir(sessao, catalogo.vinculos, modo)
    return sessao.contar()
}

export function arvoreDe(pedido: PedidoAcao, impressao: ImpressaoDigital, catalogo: Catalogo): NoImpacto[] {
    const niveis = niveisAPartirDe(pedido.tabela, catalogo.vinculos)
    return Object.entries(impressao)
        .map(([tabela, contagem]) => {
            const redirecionar = Object.values(contagem.redirecionar).reduce((a, n) => a + n, 0)
            const posicao = niveis.get(tabela)
            return {
                tabela,
                rotulo: tabelaDoCatalogo(tabela)?.rotulo ?? tabela,
                nivel: posicao?.nivel ?? 1,
                via: posicao?.via ? nomeDoVinculo(posicao.via) : null,
                classificacao: posicao?.via?.classificacao ?? null,
                apagar: contagem.apagar,
                redirecionar
            }
        })
        .filter((no) => no.tabela === pedido.tabela || no.apagar + no.redirecionar > 0)
        .sort((a, b) => a.nivel - b.nivel || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
}

export function totais(impressao: ImpressaoDigital): { apagar: number; alterar: number } {
    let apagar = 0
    let alterar = 0
    for (const c of Object.values(impressao)) {
        apagar += c.apagar
        for (const n of Object.values(c.redirecionar)) alterar += n
    }
    return { apagar, alterar }
}

export function vinculosRedirecionados(catalogo: Catalogo, modo: Modo): Vinculo[] {
    return catalogo.vinculos.filter((v) => propaga(v, modo) === 'redirecionar')
}

/** O valor que um vínculo histórico recebe na preservação (FR-012). */
export function valorPadraoDe(vinculo: Vinculo): string {
    return vinculo.obrigatorio ? (ROTULO_REGISTRO_SISTEMA[vinculo.pai] ?? 'registro padrão') : 'vazio'
}

/** Monta a prévia completa a partir de conjuntos já calculados na sessão. */
export async function montarPrevia(
    sessao: SessaoConjuntos,
    catalogo: Catalogo,
    pedido: PedidoAcao,
    impressao: ImpressaoDigital,
    protecoes: readonly Protecao[],
    ambiente: Ambiente,
    modo: Previa['modo'],
    opcoes: Previa['opcoes']
): Promise<Previa> {
    const arvore = arvoreDe(pedido, impressao, catalogo)
    const temDependentes = temDependentesHistoricos(arvore)
    const modoEfetivo = temDependentes ? modo : 'sem_dependentes'

    const redirecionamentos = catalogo.vinculos
        .map((v) => ({ v, quantidade: impressao[v.filho]?.redirecionar[v.coluna] ?? 0 }))
        .filter(({ quantidade }) => quantidade > 0)
        .map(({ v, quantidade }) => ({
            vinculo: nomeDoVinculo(v),
            tabela: v.filho,
            coluna: v.coluna,
            quantidade,
            valorPadrao: valorPadraoDe(v)
        }))

    const preservados = (await sessao.protegidosNaRaiz(sementeDe(pedido), protecoes))
        .filter((p) => p.quantidade > 0)
        .map((p) => ({ tabela: pedido.tabela, descricao: p.descricao, motivo: 'Nunca é apagado pela Danger Zone.' }))

    const amostras = []
    for (const no of arvore.filter((n) => n.apagar > 0)) {
        amostras.push({
            tabela: no.tabela,
            ...truncarAmostra(await sessao.amostrar(no.tabela, TAMANHO_AMOSTRA), no.apagar)
        })
    }

    const atingidas = arvore.filter((n) => n.apagar > 0).map((n) => n.tabela)
    const consequencias = [
        ...atingidas.map(consequenciaDe).filter((c): c is string => Boolean(c)),
        AVISO_TRAVA,
        AVISO_IRREVERSIVEL
    ]
    const alertas = atingidas.map(alertaDeAcesso).filter((a): a is string => Boolean(a))
    const { apagar, alterar } = totais(impressao)

    return {
        pedido,
        modo: modoEfetivo,
        temDependentes,
        opcoes: temDependentes ? opcoes : null,
        arvore,
        inseparaveis: arvore.filter((n) => n.nivel > 0 && n.classificacao === 'inseparavel' && n.apagar > 0),
        redirecionamentos,
        preservados,
        saldos: await sessao.saldos(),
        amostras,
        consequencias,
        alertas,
        ambiente,
        totalApagar: apagar,
        totalAlterar: alterar,
        textoConfirmacao: textoConfirmacao(pedido),
        impressaoDigital: impressao
    }
}

/** Tabelas a travar na execução: as alcançáveis, o saldo e as que recebem registro padrão. */
export function tabelasATravar(pedido: PedidoAcao, catalogo: Catalogo): string[] {
    const alcance = new Set(tabelasAlcancaveis(pedido.tabela, catalogo.vinculos))
    alcance.add('saldo_estoque')
    for (const v of catalogo.vinculos) {
        if (alcance.has(v.filho) && v.classificacao === 'historico' && v.obrigatorio) alcance.add(v.pai)
    }
    return [...alcance].sort()
}
