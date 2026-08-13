import type { CategoriaItem, CondicaoItem, TipoSaida, UnidadeMedida } from '../../domain/item'
import type { ComponenteReceita, ItemConsolidado } from '../../domain/receita-kit'

/** Ports do módulo de Estoque (DESIGN.md §4). */

export type Item = {
    id: string
    nome: string
    categoria: CategoriaItem
    unidadeMedida: UnidadeMedida
}

/** Item com o dado necessário para compor a mensagem de déficit (BR-EST-04). */
export type ItemComSaldo = Item & { saldo: number }

export interface ItemRepository {
    buscarPorId(id: string): Promise<Item | null>
    /** Autocomplete por similaridade (índice trigram) — BR-EST-01. */
    buscarPorNome(termo: string, limite?: number): Promise<Item[]>
    criar(dados: { nome: string; categoria: CategoriaItem; unidadeMedida: UnidadeMedida }): Promise<Item>
}

export interface EntradaRepository {
    /**
     * Registra a entrada e incrementa `saldo_estoque` na **mesma transação**
     * (DESIGN.md §9.1). Cria o item quando `novoItem` é informado.
     */
    registrar(entrada: {
        itemId?: string | null
        novoItem?: { nome: string; categoria: CategoriaItem; unidadeMedida: UnidadeMedida } | null
        quantidade: number
        condicao: CondicaoItem
        perecivel: boolean
        dataValidade?: string | null
        kitDestinoId?: string | null
        registradoPor: string
    }): Promise<{ entradaId: string; itemId: string }>
}

/** Item cujo saldo não cobre a necessidade — alimenta a mensagem do BR-EST-04. */
export type Deficit = {
    itemId: string
    nome: string
    unidadeMedida: UnidadeMedida
    disponivel: number
    necessario: number
    faltam: number
}

export interface SaidaRepository {
    /**
     * Executa a saída inteira em **uma** transação: trava os saldos com
     * `FOR UPDATE`, valida, e só então grava e decrementa.
     *
     * Devolve `{ deficits }` quando algum item não cobre a necessidade — nesse
     * caso **nada** é gravado (a transação é revertida).
     */
    registrar(entrada: {
        tipo: TipoSaida
        destino: string
        responsavelTransporte: string
        registradoPor: string
        itens: ItemConsolidado[]
    }): Promise<{ saidaId: string } | { deficits: Deficit[] }>
}

export interface DescarteRepository {
    registrar(entrada: {
        itemId: string
        quantidade: number
        motivo?: string | null
        registradoPor: string
    }): Promise<{ descarteId: string } | { deficits: Deficit[] }>
}

export type Kit = {
    id: string
    nome: string
    descricao: string | null
    ativo: boolean
}

export interface KitRepository {
    listar(apenasAtivos?: boolean): Promise<Kit[]>
    buscarPorId(id: string): Promise<Kit | null>
    criar(dados: { nome: string; descricao?: string | null }): Promise<Kit>
    atualizar(dados: { id: string; nome: string; descricao?: string | null; ativo: boolean }): Promise<Kit | null>
    /** Receita de um kit — os componentes e a quantidade por unidade de kit. */
    receita(kitId: string): Promise<ComponenteReceita[]>
    /** Substitui a receita inteira; `unique(kitId, itemId)` garante a unicidade. */
    definirReceita(kitId: string, componentes: ComponenteReceita[]): Promise<void>
}
