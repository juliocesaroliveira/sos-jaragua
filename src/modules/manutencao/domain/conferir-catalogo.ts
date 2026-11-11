import { nomeDoVinculo, type Catalogo, type RegraBanco } from './catalogo'

/** Uma FK como o Postgres a declara (lida de `pg_constraint`). */
export type FkFisica = {
    filho: string
    coluna: string
    pai: string
    regraBanco: RegraBanco
    obrigatorio: boolean
}

export type ConferenciaCatalogo = {
    /** Tabela → vínculos divergentes que a envolvem. */
    tabelasBloqueadas: Map<string, string[]>
    divergencias: string[]
}

/**
 * Compara o catálogo com as FKs reais (FR-013a, research D2).
 *
 * Toda divergência **bloqueia** as duas tabelas ligadas, em vez de supor um
 * comportamento: assumir "inseparável" apagaria histórico, e assumir
 * "histórico" poderia violar `NOT NULL` sem registro padrão. Um bloqueio
 * explicado é preferível a uma ação que faz algo diferente do que a prévia disse.
 */
export function conferirCatalogo(catalogo: Catalogo, fks: readonly FkFisica[]): ConferenciaCatalogo {
    const bloqueadas = new Map<string, string[]>()
    const divergencias: string[] = []

    const bloquear = (fk: Pick<FkFisica, 'filho' | 'coluna' | 'pai'>, motivo: string) => {
        const nome = nomeDoVinculo(fk)
        divergencias.push(`${nome}: ${motivo}`)
        for (const tabela of [fk.filho, fk.pai]) {
            const lista = bloqueadas.get(tabela) ?? []
            if (!lista.includes(nome)) lista.push(nome)
            bloqueadas.set(tabela, lista)
        }
    }

    const chave = (x: { filho: string; coluna: string }) => `${x.filho}.${x.coluna}`
    const fisicas = new Map(fks.map((fk) => [chave(fk), fk]))
    const declarados = new Map(catalogo.vinculos.map((v) => [chave(v), v]))

    for (const fk of fks) {
        const declarado = declarados.get(chave(fk))
        if (!declarado) {
            bloquear(fk, 'vínculo não classificado no catálogo')
            continue
        }
        if (declarado.pai !== fk.pai) bloquear(fk, `catálogo aponta para ${declarado.pai}`)
        else if (declarado.obrigatorio !== fk.obrigatorio) bloquear(fk, 'obrigatoriedade diverge do banco')
        else if (declarado.regraBanco !== fk.regraBanco) bloquear(fk, `regra no banco é ${fk.regraBanco}`)
    }

    for (const declarado of catalogo.vinculos) {
        if (!fisicas.has(chave(declarado))) bloquear(declarado, 'não existe no banco')
    }

    return { tabelasBloqueadas: bloqueadas, divergencias }
}
