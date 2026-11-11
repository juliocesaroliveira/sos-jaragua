import { DomainError, falha, ok, type Result } from '@/src/shared/kernel'
import { ehRegistroSistema } from '@/src/shared/kernel/registros-sistema'
import { MARCADOR } from '@/src/shared/mascara'
import { paginarComClamp, type PaginaDe } from '@/src/shared/paginacao/esquema'
import { tabelaDoCatalogo } from '../../domain/catalogo'
import type { LeitorRegistros } from '../ports/leitor-esquema'

export type LinhaRegistro = {
    chave: string
    rotulo: string
    /** Registro padrão: aparece, mas não pode ser selecionado (US2, edge case). */
    sistema: boolean
    valores: Record<string, string | null>
}

export type PaginaRegistros = PaginaDe<LinhaRegistro> & { colunas: string[] }

/**
 * Máscara **completa** dos sensíveis na seleção de registros.
 *
 * Os valores chegam cifrados (feature 025) e a Danger Zone não precisa deles
 * para decidir o que apagar — então nem decifra. Não é atalho para ver dados
 * completos (spec, Assumptions; Princípio IV).
 */
const MASCARA = MARCADOR.repeat(6)

/**
 * Registros de uma tabela para a seleção pontual (C-02, US2).
 *
 * O filtro de colunas é feito duas vezes de propósito: o leitor só seleciona
 * `colunasExibidas`, e aqui qualquer coluna fora dessa lista — credenciais
 * inclusive — é descartada de novo. Um erro no SQL não vira vazamento.
 */
export class ListarRegistrosUseCase {
    constructor(private readonly deps: { leitor: LeitorRegistros }) {}

    async executar(entrada: {
        tabela: string
        page: number
        pageSize: number
        busca?: string
    }): Promise<Result<PaginaRegistros, DomainError>> {
        const tabela = tabelaDoCatalogo(entrada.tabela)
        if (!tabela)
            return falha(
                new DomainError('tabela_desconhecida', 'Esta tabela não pode ser consultada pela Danger Zone.')
            )

        const permitidas = tabela.colunasExibidas.filter((c) => !tabela.colunasCredencial.includes(c))
        const busca = entrada.busca?.trim() || undefined

        const pagina = await paginarComClamp({ page: entrada.page, pageSize: entrada.pageSize }, async (p) => {
            const { linhas, total } = await this.deps.leitor.listarRegistros(tabela.nome, { ...p, busca })
            return {
                rows: linhas.map((l) => ({
                    chave: l.chave,
                    rotulo: l.rotulo,
                    sistema: ehRegistroSistema(tabela.nome, l.chave),
                    valores: Object.fromEntries(
                        permitidas.map((c) => {
                            const valor = l.valores[c] ?? null
                            return [c, valor !== null && tabela.colunasSensiveis.includes(c) ? MASCARA : valor]
                        })
                    )
                })),
                totalCount: total
            }
        })

        return ok({ ...pagina, colunas: permitidas })
    }
}
