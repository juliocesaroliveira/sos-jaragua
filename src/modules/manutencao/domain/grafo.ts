import type { Vinculo } from './catalogo'

/** Modo escolhido pelo administrador quando há dependentes de histórico (FR-011). */
export type Modo = 'cascata' | 'preservacao'

export type Efeito = 'apagar' | 'redirecionar'

/**
 * O que um vínculo faz com as linhas filhas de linhas que serão apagadas
 * (research D3/D6):
 * - cascata: tudo é apagado, inclusive histórico;
 * - preservação: inseparável é apagado; histórico é redirecionado para o valor
 *   padrão (vazio ou registro padrão).
 */
export function propaga(vinculo: Vinculo, modo: Modo): Efeito {
    if (modo === 'cascata') return 'apagar'
    return vinculo.classificacao === 'inseparavel' ? 'apagar' : 'redirecionar'
}

/**
 * Ordem de `DELETE`: filhos antes dos pais. É o que permite apagar através de
 * vínculos `restrict`/`no action` no modo cascata, e o que deixa o
 * `ON DELETE CASCADE` físico sem nada a fazer — a Danger Zone já apagou (ou
 * redirecionou) cada filho antes, conforme a própria classificação (FR-013).
 *
 * Ciclos não existem no schema atual, mas não podem travar: as tabelas que
 * sobram num ciclo entram ao final, em ordem alfabética.
 */
export function ordemDeExclusao(tabelas: readonly string[], vinculos: readonly Vinculo[]): string[] {
    const pendentes = new Set(tabelas)
    const ordem: string[] = []

    while (pendentes.size > 0) {
        // Pode sair quem não é mais pai de nenhum filho ainda pendente.
        const livres = [...pendentes]
            .filter((t) => !vinculos.some((v) => v.pai === t && v.filho !== t && pendentes.has(v.filho)))
            .sort()
        if (livres.length === 0) {
            ordem.push(...[...pendentes].sort())
            break
        }
        for (const t of livres) {
            ordem.push(t)
            pendentes.delete(t)
        }
    }
    return ordem
}

/**
 * Os conjuntos-alvo de uma ação, mantidos pela infraestrutura (no executor SQL,
 * tabelas temporárias). O domínio decide **o que** propagar e **em que ordem**;
 * a infraestrutura só sabe fazer cada passo.
 *
 * Toda implementação deve: não incluir registros protegidos; não colocar em
 * redirecionamento uma linha que já está para ser apagada.
 */
export interface Conjuntos {
    /**
     * Quantas linhas o conjunto a apagar de `tabela` tem agora. Síncrono: a
     * implementação mantém a contagem em memória a partir do que cada passo
     * devolveu. É o que deixa a expansão pular vínculos sem trabalho a fazer.
     */
    tamanho(tabela: string): number
    /** Filhos (via `vinculo`) de linhas a apagar do pai → apagar. Devolve quantas linhas novas. */
    propagarExclusao(vinculo: Vinculo): Promise<number>
    /** Filhos (via `vinculo`) de linhas a apagar do pai → redirecionar. Devolve quantas novas. */
    propagarRedirecionamento(vinculo: Vinculo): Promise<number>
    /** Remove do redirecionamento de `vinculo` as linhas que acabaram no conjunto a apagar. */
    descartarRedirecionamentosApagados(vinculo: Vinculo): Promise<void>
}

const LIMITE_RODADAS = 100

/**
 * Expande os conjuntos até o ponto fixo (research D6): repete a propagação por
 * todos os vínculos até uma rodada não acrescentar nenhuma linha. Isso cobre
 * profundidade arbitrária e ciclos — uma linha já no conjunto não conta como
 * nova, então a repetição termina.
 *
 * Ao final, **a exclusão prevalece sobre o redirecionamento**: uma linha
 * alcançada por um vínculo inseparável (apagar) e por um histórico
 * (redirecionar) é apagada. A limpeza é feita depois do ponto fixo porque um
 * conjunto a apagar pode crescer depois de o redirecionamento já ter sido
 * calculado.
 *
 * Devolve o número de rodadas, para diagnóstico.
 */
export async function expandir(conjuntos: Conjuntos, vinculos: readonly Vinculo[], modo: Modo): Promise<number> {
    // Tamanho do pai na última vez em que cada vínculo foi propagado. Só vale
    // repropagar quando o pai cresceu desde então — com o banco remoto, cada
    // passo é uma ida à rede, e a maioria dos 30 vínculos parte de conjuntos
    // vazios (o que levava a prévia de segundos a dezenas de segundos).
    const visto = new Map<Vinculo, number>()
    let rodadas = 0
    let cresceu = true

    while (cresceu) {
        if (rodadas >= LIMITE_RODADAS) {
            throw new Error(`Expansão da Danger Zone não convergiu em ${LIMITE_RODADAS} rodadas.`)
        }
        rodadas++
        cresceu = false
        for (const vinculo of vinculos) {
            const tamanhoPai = conjuntos.tamanho(vinculo.pai)
            if (tamanhoPai === 0 || visto.get(vinculo) === tamanhoPai) continue
            visto.set(vinculo, tamanhoPai)
            const novas =
                propaga(vinculo, modo) === 'apagar'
                    ? await conjuntos.propagarExclusao(vinculo)
                    : await conjuntos.propagarRedirecionamento(vinculo)
            if (novas > 0) cresceu = true
        }
    }

    for (const vinculo of vinculos) {
        if (propaga(vinculo, modo) !== 'redirecionar' || !visto.has(vinculo)) continue
        if (conjuntos.tamanho(vinculo.filho) > 0) await conjuntos.descartarRedirecionamentosApagados(vinculo)
    }

    return rodadas
}

/**
 * Tabelas que uma ação sobre `raiz` pode atingir: a própria raiz e, em
 * qualquer profundidade, as filhas por qualquer vínculo. É o conjunto a travar
 * antes de recalcular (research D7) e o que a conferência do catálogo precisa
 * considerar (FR-013a).
 */
export function tabelasAlcancaveis(raiz: string, vinculos: readonly Vinculo[]): string[] {
    const vistas = new Set([raiz])
    const fila = [raiz]
    while (fila.length > 0) {
        const atual = fila.shift()!
        for (const v of vinculos) {
            if (v.pai === atual && !vistas.has(v.filho)) {
                vistas.add(v.filho)
                fila.push(v.filho)
            }
        }
    }
    return [...vistas]
}

/** Nível e vínculo de chegada de cada tabela, por busca em largura a partir da raiz. */
export function niveisAPartirDe(
    raiz: string,
    vinculos: readonly Vinculo[]
): Map<string, { nivel: number; via: Vinculo | null }> {
    const niveis = new Map<string, { nivel: number; via: Vinculo | null }>([[raiz, { nivel: 0, via: null }]])
    const fila = [raiz]
    while (fila.length > 0) {
        const atual = fila.shift()!
        const nivel = niveis.get(atual)!.nivel
        for (const v of vinculos) {
            if (v.pai === atual && !niveis.has(v.filho)) {
                niveis.set(v.filho, { nivel: nivel + 1, via: v })
                fila.push(v.filho)
            }
        }
    }
    return niveis
}
