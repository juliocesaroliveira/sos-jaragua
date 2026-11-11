import type { SnapshotLinha } from '@/src/modules/auditoria'
import type { Vinculo } from '../../domain/catalogo'
import type { Conjuntos } from '../../domain/grafo'
import type { ImpressaoDigital, SaldoPrevisto } from '../../domain/previa'

/**
 * Regra de proteção: linhas de `tabela` cujo `coluna` está em `valores` nunca
 * entram num conjunto a apagar (FR-018, research D14).
 */
export type Protecao = { tabela: string; coluna: string; valores: readonly string[]; descricao: string }

export type Semente = { tabela: string; chaves?: readonly string[] }

/**
 * Uma transação Postgres com os conjuntos-alvo em tabelas temporárias
 * (research D6). Tudo que a prévia mostra e tudo que a execução aplica sai
 * daqui — o mesmo código, para que o executado seja o que foi mostrado.
 */
export interface SessaoConjuntos extends Conjuntos {
    /** `LOCK TABLE … IN SHARE ROW EXCLUSIVE MODE`, em ordem alfabética (research D7). */
    travar(tabelas: readonly string[]): Promise<void>
    /** Cria os conjuntos vazios e semeia o da tabela escolhida, menos os protegidos. */
    semear(semente: Semente, protecoes: readonly Protecao[]): Promise<void>
    /** Quantas linhas da tabela escolhida ficaram de fora por proteção, por regra. */
    protegidosNaRaiz(
        semente: Semente,
        protecoes: readonly Protecao[]
    ): Promise<Array<{ descricao: string; quantidade: number }>>
    contar(): Promise<ImpressaoDigital>
    /** Até `limite` rótulos legíveis das linhas a apagar de `tabela`. */
    amostrar(tabela: string, limite: number): Promise<string[]>
    /** Saldo atual × resultante dos itens cujas movimentações mudam (FR-015a). */
    saldos(): Promise<SaldoPrevisto[]>
    /**
     * Ids cujas tags de cache por id precisam ser invalidadas depois da
     * execução (research D12): atividades cujo quadro muda e usuários atingidos.
     */
    idsParaInvalidar(): Promise<{ atividades: string[]; usuarios: string[] }>
    /** Administradores ativos que sobram depois da ação (FR-018). */
    administradoresRestantes(): Promise<number>
    /** As linhas completas que serão apagadas ou redirecionadas — os snapshots. */
    linhasAfetadas(): AsyncIterable<SnapshotLinha>
    /** Redireciona (histórico) e depois apaga em ordem topológica reversa. Devolve as contagens reais. */
    aplicar(vinculosRedirecionados: readonly Vinculo[]): Promise<ImpressaoDigital>
    /** Recalcula `saldo_estoque` dos itens dados (research D10). */
    recalcularSaldos(itemIds: readonly string[]): Promise<SaldoPrevisto[]>
}

export interface ExecutorConjuntos {
    /**
     * Abre uma transação. Com `confirmar: false` ela termina em rollback mesmo
     * com sucesso (prévia); com `true`, faz commit se `fn` não lançar.
     */
    emTransacao<T>(fn: (sessao: SessaoConjuntos) => Promise<T>, opcoes: { confirmar: boolean }): Promise<T>
}
