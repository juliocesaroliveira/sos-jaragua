import type { ParametrosPaginacao } from '@/src/shared/paginacao'

/** Port de Habilidade (017-gestao-habilidades, contracts/gestao-habilidades.md). */

export type Habilidade = {
    id: string
    nome: string
    /** ISO 8601 — serializável através da fronteira Server Action → cliente. */
    criadoEm: string
}

/**
 * Linha da listagem. `voluntariosVinculados` vem agregado na mesma consulta
 * (`LEFT JOIN` + `count`), não por uma consulta por linha: um N+1 apareceria
 * justamente numa tela de administração usada durante a crise (research.md D5).
 */
export type LinhaHabilidade = Habilidade & {
    voluntariosVinculados: number
}

export interface HabilidadeRepository {
    listar(params: ParametrosPaginacao): Promise<{ rows: LinhaHabilidade[]; totalCount: number }>

    buscarPorId(id: string): Promise<Habilidade | null>

    /**
     * Comparação por `lower()` — é o que torna "Motosserra" e "motosserra" a
     * mesma habilidade (INV-01). `ignorarId` exclui a própria linha, para que
     * renomear uma habilidade para o próprio nome com outra caixa não seja
     * tratado como duplicata (E-01.2).
     */
    buscarPorNomeNormalizado(nome: string, ignorarId?: string): Promise<Habilidade | null>

    contarVinculos(id: string): Promise<number>

    /** Lança `DuplicadoError` ao receber `23505` do Postgres. */
    criar(entrada: { nome: string }): Promise<Habilidade>

    /** `null` quando o id não existe. Lança `DuplicadoError` em `23505`. */
    atualizar(entrada: { id: string; nome: string }): Promise<Habilidade | null>

    /** `false` quando o id não existe. Lança `VinculoExistenteError` em `23503`. */
    excluir(id: string): Promise<boolean>
}
