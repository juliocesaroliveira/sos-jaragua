import type { FkFisica } from '../../domain/conferir-catalogo'

export type ContagemTabela = {
    /** Linhas da tabela, sem os registros padrão. */
    registros: number
    /** Registros padrão presentes (0 ou 1). */
    registrosSistema: number
}

/** Leitura do schema e do volume, fora de transação (inventário, conferência). */
export interface LeitorEsquema extends LeitorRegistros {
    /** FKs reais, de `pg_constraint` (research D2). */
    fksFisicas(): Promise<FkFisica[]>
    contagens(tabelas: readonly string[]): Promise<Record<string, ContagemTabela>>
}

export type RegistroBruto = {
    chave: string
    rotulo: string
    /** Só as `colunasExibidas` do catálogo, já como texto. */
    valores: Record<string, string | null>
}

export type PaginaRegistrosBrutos = { linhas: RegistroBruto[]; total: number }

export interface LeitorRegistros {
    /** Registros de uma tabela, paginados no servidor, com busca no rótulo (C-02). */
    listarRegistros(
        tabela: string,
        filtro: { page: number; pageSize: number; busca?: string }
    ): Promise<PaginaRegistrosBrutos>
}
