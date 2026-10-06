import type { CategoriaItem, CondicaoItem, TipoSaida, UnidadeMedida } from '../../domain/item'
import type { ComponenteInformado, ComponenteReceita, ItemConsolidado } from '../../domain/receita-kit'

/** Ports do módulo de Estoque (DESIGN.md §4). */

export type Item = {
    id: string
    nome: string
    categoria: CategoriaItem
    unidadeMedida: UnidadeMedida
    /**
     * Mínimo de segurança do item (feature 020, Q3). `null` herda o padrão
     * global; `0` desliga o alerta. Ver `domain/estoque-minimo.ts`.
     */
    estoqueMinimo: number | null
    /**
     * Item criado pelo cadastro de kit que ainda não recebeu entrada (feature
     * 022, FR-015) — fica fora do alerta de estoque crítico.
     */
    aguardandoPrimeiraEntrada: boolean
}

/** Item com o dado necessário para compor a mensagem de déficit (BR-EST-04). */
export type ItemComSaldo = Item & { saldo: number }

export interface ItemRepository {
    buscarPorId(id: string): Promise<Item | null>
    criar(dados: { nome: string; categoria: CategoriaItem; unidadeMedida: UnidadeMedida }): Promise<Item>
    /** `null` volta a herdar o padrão global (feature 020, Q3). */
    definirEstoqueMinimo(id: string, estoqueMinimo: number | null): Promise<void>
}

export interface EntradaRepository {
    /**
     * Registra a entrada e incrementa `saldo_estoque` na **mesma transação**
     * (DESIGN.md §9.1). Cria o item quando `novoItem` é informado.
     */
    registrar(entrada: {
        itemId?: string | null
        novoItem?: {
            nome: string
            categoria: CategoriaItem
            unidadeMedida: UnidadeMedida
            /** Mínimo de segurança informado no cadastro (feature 020, I1). */
            estoqueMinimo?: number | null
        } | null
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

/** Componente que não pôde ser resolvido — a composição inteira é recusada. */
export type ConflitoComposicao = {
    indice: number
    /** `ambiguo`: mais de um item com o nome; `repetido`: o id já está em outra linha. */
    tipo: 'ambiguo' | 'repetido'
}

export type ResultadoComposicao =
    | {
          kit: Kit
          /** Componentes já com o id resolvido, na ordem enviada. */
          receita: ComponenteReceita[]
          itensCriados: Item[]
          vinculos: { indice: number; itemId: string }[]
      }
    | { conflitos: ConflitoComposicao[] }

export interface KitRepository {
    listar(apenasAtivos?: boolean): Promise<Kit[]>
    buscarPorId(id: string): Promise<Kit | null>
    /** Receita de um kit — os componentes e a quantidade por unidade de kit. */
    receita(kitId: string): Promise<ComponenteReceita[]>
    /**
     * Cria ou atualiza o kit e substitui a receita inteira em **uma** transação
     * (feature 022, FR-006). Cada item novo é resolvido pelo nome normalizado,
     * sob lock por nome: nenhum equivalente ⇒ cria (saldo 0, aguardando a
     * primeira entrada); um ⇒ vincula; mais de um ⇒ conflito.
     *
     * Havendo qualquer conflito, nada é gravado. `null` quando `id` não existe.
     */
    salvarComposicao(dados: {
        id?: string
        nome: string
        descricao?: string | null
        ativo: boolean
        componentes: ComponenteInformado[]
    }): Promise<ResultadoComposicao | null>
}
