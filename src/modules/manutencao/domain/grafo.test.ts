import { describe, expect, it } from 'vitest'
import type { Vinculo } from './catalogo'
import { expandir, ordemDeExclusao, propaga, type Conjuntos } from './grafo'

const v = (
    filho: string,
    coluna: string,
    pai: string,
    classificacao: Vinculo['classificacao'],
    obrigatorio = true
): Vinculo => ({
    filho,
    coluna,
    pai,
    obrigatorio,
    regraBanco: 'no action',
    classificacao
})

/**
 * Modelo em memória do que o executor SQL faz com tabelas temporárias. Linhas:
 * `tabela → chave → { coluna: chave do pai }`.
 */
function conjuntosEmMemoria(
    linhas: Record<string, Record<string, Record<string, string | null>>>,
    sementes: Record<string, string[]>,
    protegidos: Record<string, string[]> = {}
) {
    const apagar = new Map<string, Set<string>>(Object.entries(sementes).map(([t, c]) => [t, new Set(c)]))
    const redirecionar = new Map<string, Set<string>>()
    const chaveV = (x: Vinculo) => `${x.filho}.${x.coluna}`
    const protegido = (t: string, c: string) => protegidos[t]?.includes(c) ?? false

    const conjuntos: Conjuntos = {
        tamanho: (t) => apagar.get(t)?.size ?? 0,
        async propagarExclusao(x) {
            const pais = apagar.get(x.pai) ?? new Set()
            const alvo = apagar.get(x.filho) ?? new Set<string>()
            let novas = 0
            for (const [chave, colunas] of Object.entries(linhas[x.filho] ?? {})) {
                const ref = colunas[x.coluna]
                if (ref && pais.has(ref) && !alvo.has(chave) && !protegido(x.filho, chave)) {
                    alvo.add(chave)
                    novas++
                }
            }
            apagar.set(x.filho, alvo)
            return novas
        },
        async propagarRedirecionamento(x) {
            const pais = apagar.get(x.pai) ?? new Set()
            const alvo = redirecionar.get(chaveV(x)) ?? new Set<string>()
            let novas = 0
            for (const [chave, colunas] of Object.entries(linhas[x.filho] ?? {})) {
                const ref = colunas[x.coluna]
                if (ref && pais.has(ref) && !alvo.has(chave) && !(apagar.get(x.filho)?.has(chave) ?? false)) {
                    alvo.add(chave)
                    novas++
                }
            }
            redirecionar.set(chaveV(x), alvo)
            return novas
        },
        async descartarRedirecionamentosApagados(x) {
            const alvo = redirecionar.get(chaveV(x))
            for (const c of apagar.get(x.filho) ?? []) alvo?.delete(c)
        }
    }
    return { conjuntos, apagar, redirecionar }
}

describe('propaga (research D3/D6)', () => {
    it('cascata sempre apaga', () => {
        expect(propaga(v('a', 'b_id', 'b', 'historico'), 'cascata')).toBe('apagar')
        expect(propaga(v('a', 'b_id', 'b', 'inseparavel'), 'cascata')).toBe('apagar')
    })

    it('preservação só apaga inseparáveis; histórico é redirecionado', () => {
        expect(propaga(v('a', 'b_id', 'b', 'historico'), 'preservacao')).toBe('redirecionar')
        expect(propaga(v('a', 'b_id', 'b', 'inseparavel'), 'preservacao')).toBe('apagar')
    })
})

describe('ordemDeExclusao', () => {
    it('apaga filhos antes dos pais, em qualquer profundidade', () => {
        const vinculos = [v('neto', 'filho_id', 'filho', 'inseparavel'), v('filho', 'pai_id', 'pai', 'inseparavel')]
        const ordem = ordemDeExclusao(['pai', 'filho', 'neto', 'solto'], vinculos)
        expect(ordem.indexOf('neto')).toBeLessThan(ordem.indexOf('filho'))
        expect(ordem.indexOf('filho')).toBeLessThan(ordem.indexOf('pai'))
        expect(ordem).toHaveLength(4)
    })

    it('não entra em loop com ciclo e inclui cada tabela uma vez', () => {
        const ordem = ordemDeExclusao(
            ['a', 'b'],
            [v('a', 'b_id', 'b', 'historico', false), v('b', 'a_id', 'a', 'historico', false)]
        )
        expect([...ordem].sort()).toEqual(['a', 'b'])
    })
})

describe('expandir até ponto fixo', () => {
    const vinculos = [
        v('turno', 'atividade_id', 'atividade', 'inseparavel'),
        v('alocacao', 'turno_id', 'turno', 'inseparavel'),
        v('alocacao', 'participante_id', 'user', 'historico'),
        v('atividade', 'criado_por', 'user', 'historico')
    ]
    const linhas = {
        atividade: { a1: { criado_por: 'u1' }, a2: { criado_por: 'u2' } },
        turno: { t1: { atividade_id: 'a1' }, t2: { atividade_id: 'a2' } },
        alocacao: { l1: { turno_id: 't1', participante_id: 'u1' }, l2: { turno_id: 't2', participante_id: 'u1' } }
    }

    it('preservação: apaga inseparáveis em profundidade e redireciona histórico', async () => {
        const m = conjuntosEmMemoria(linhas, { atividade: ['a1'] })
        await expandir(m.conjuntos, vinculos, 'preservacao')
        expect([...(m.apagar.get('turno') ?? [])]).toEqual(['t1'])
        expect([...(m.apagar.get('alocacao') ?? [])]).toEqual(['l1'])
    })

    it('exclusão prevalece sobre redirecionamento', async () => {
        // Apagar u1 e a1 juntos: l1 é alcançada pelo turno (inseparável, apaga)
        // e pelo participante (histórico, redirecionaria). Fica só em apagar.
        const m = conjuntosEmMemoria(linhas, { user: ['u1'], atividade: ['a1'] })
        await expandir(m.conjuntos, vinculos, 'preservacao')
        expect([...(m.apagar.get('alocacao') ?? [])]).toEqual(['l1'])
        expect([...(m.redirecionar.get('alocacao.participante_id') ?? [])]).toEqual(['l2'])
    })

    it('cascata propaga exclusão por todo vínculo', async () => {
        const m = conjuntosEmMemoria(linhas, { user: ['u1'] })
        await expandir(m.conjuntos, vinculos, 'cascata')
        expect([...(m.apagar.get('atividade') ?? [])]).toEqual(['a1'])
        expect([...(m.apagar.get('alocacao') ?? [])].sort()).toEqual(['l1', 'l2'])
        expect([...(m.apagar.get('turno') ?? [])]).toEqual(['t1'])
    })

    it('ciclo artificial termina', async () => {
        const ciclo = [v('a', 'b_id', 'b', 'inseparavel'), v('b', 'a_id', 'a', 'inseparavel')]
        const m = conjuntosEmMemoria({ a: { a1: { b_id: 'b1' } }, b: { b1: { a_id: 'a1' } } }, { a: ['a1'] })
        const rodadas = await expandir(m.conjuntos, ciclo, 'cascata')
        expect([...(m.apagar.get('b') ?? [])]).toEqual(['b1'])
        expect(rodadas).toBeLessThan(5)
    })

    it('registros protegidos nunca entram no conjunto', async () => {
        const m = conjuntosEmMemoria(linhas, { atividade: ['a1'] }, { turno: ['t1'] })
        await expandir(m.conjuntos, vinculos, 'cascata')
        expect(m.apagar.get('turno')?.has('t1')).toBe(false)
    })
})
