/**
 * Projeção de demanda × capacidade (BR-INT-01, BR-INT-02, DESIGN.md §11).
 *
 * Funções puras, sem banco: são a regra que o painel de crise expõe e o ponto
 * onde um erro de conta vira decisão logística errada em campo.
 */

export const BASES_DEMANDA = ['por_familia', 'por_pessoa_desabrigada'] as const
export type BaseDemanda = (typeof BASES_DEMANDA)[number]

export const ROTULO_BASE_DEMANDA: Record<BaseDemanda, string> = {
    por_familia: 'Por família afetada',
    por_pessoa_desabrigada: 'Por pessoa desabrigada'
}

/** Números oficiais da crise informados pela Defesa Civil (BRD §5). */
export type VariaveisCrise = {
    totalFamiliasAfetadas: number
    totalPessoasAfetadas: number
}

export const CRISE_ZERADA: VariaveisCrise = {
    totalFamiliasAfetadas: 0,
    totalPessoasAfetadas: 0
}

export type MetricaKit = {
    baseDemanda: BaseDemanda
    /** Ex.: `1` = um kit por família/pessoa; `0.5` = um a cada duas. */
    proporcao: number
}

/**
 * **Kits Necessários (Demanda)** — BR-INT-01.
 *
 * `por_familia` multiplica pelo total de famílias; `por_pessoa_desabrigada`,
 * pelo total de pessoas. Arredonda **para cima**: meio kit não atende ninguém,
 * e subdimensionar a demanda é o erro caro dos dois.
 */
export function kitsNecessarios(metrica: MetricaKit, crise: VariaveisCrise): number {
    const base = metrica.baseDemanda === 'por_familia' ? crise.totalFamiliasAfetadas : crise.totalPessoasAfetadas

    if (base <= 0 || metrica.proporcao <= 0) return 0
    return Math.ceil(base * metrica.proporcao)
}

/**
 * **Kits Possíveis (Capacidade)** — BR-INT-02.
 *
 * O cálculo (`min` sobre `floor(saldo / quantidadePorKit)`) vive no domínio de
 * Estoque, onde receita e saldo nascem, e é reexportado aqui em vez de
 * reimplementado: duas cópias da mesma conta divergiriam, e é justamente a
 * conta que a coordenação usa para decidir o que buscar.
 *
 * Isto **não** fere a regra de isolamento de DESIGN.md §3 — o que ela proíbe é
 * Logística tocar nos repositórios de Estoque; a dependência Logística →
 * Estoque no nível de função pura é a mesma direção que a spec já declara.
 */
export { kitsPossiveis, type ComponenteReceita } from '@/src/modules/estoque/domain/receita-kit'

/**
 * Componente que está segurando a capacidade do kit — o gargalo.
 *
 * É o que transforma "só dá para montar 3" em "só dá para montar 3 **porque
 * falta arroz**", que é a informação sobre a qual a coordenação consegue agir.
 */
export function componenteGargalo(
    componentes: { itemId: string; quantidadePorKit: number }[],
    saldoPorItem: Map<string, number>
): string | null {
    let gargalo: string | null = null
    let minimo = Infinity

    for (const componente of componentes) {
        if (componente.quantidadePorKit <= 0) continue
        const possiveis = Math.floor((saldoPorItem.get(componente.itemId) ?? 0) / componente.quantidadePorKit)
        if (possiveis < minimo) {
            minimo = possiveis
            gargalo = componente.itemId
        }
    }

    return gargalo
}

/**
 * Percentual da demanda que a capacidade atual cobre (0–100, limitado a 100).
 *
 * Sem demanda declarada não existe percentual — devolve `null` em vez de `0`,
 * porque "0% atendido" e "ainda não sabemos a demanda" são situações
 * diferentes e a tela precisa distingui-las.
 */
export function percentualAtendido(necessarios: number, possiveis: number): number | null {
    if (necessarios <= 0) return null
    return Math.min(100, Math.round((possiveis / necessarios) * 100))
}

/** Há déficit quando a capacidade não cobre a demanda declarada (BRD §6). */
export function temDeficit(necessarios: number, possiveis: number): boolean {
    return necessarios > 0 && possiveis < necessarios
}
