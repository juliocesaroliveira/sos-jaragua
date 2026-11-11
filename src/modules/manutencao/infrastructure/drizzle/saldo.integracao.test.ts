import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { descarte, entrada, item, saida, saidaItem, saldoEstoque } from '@/db/schema/estoque'
import {
    descarteRepository,
    entradaRepository,
    saidaRepository
} from '@/src/modules/estoque/infrastructure/drizzle/estoque-repository'
import { RegistrarEntradaUseCase } from '@/src/modules/estoque/application/use-cases/registrar-entrada'
import { RegistrarSaidaUseCase } from '@/src/modules/estoque/application/use-cases/registrar-saida'
import { RegistrarDescarteUseCase } from '@/src/modules/estoque/application/use-cases/registrar-descarte'
import { recalcularSaldosDeItens } from './executor-conjuntos'

/**
 * Premissa de research D10 (T024): o saldo materializado é exatamente
 * Σ entrada − Σ saída − Σ descarte.
 *
 * Os movimentos são criados **pelos casos de uso do Estoque**, que mantêm o
 * saldo por deltas. Se recalcular a partir do ledger mudar algum saldo, a
 * fórmula da Danger Zone não reflete alguma regra de movimentação — e o
 * recálculo depois de um reset deixaria o estoque errado.
 */
vi.mock('@/src/modules/auditoria', () => ({
    withAudit: <T>(_o: unknown, fn: () => Promise<T>) => fn()
}))

const criados = { itens: [] as string[], usuarios: [] as string[], saidas: [] as string[] }

afterAll(async () => {
    if (criados.itens.length > 0) {
        await db.delete(descarte).where(inArray(descarte.itemId, criados.itens))
        await db.delete(saidaItem).where(inArray(saidaItem.itemId, criados.itens))
        await db.delete(entrada).where(inArray(entrada.itemId, criados.itens))
        await db.delete(saldoEstoque).where(inArray(saldoEstoque.itemId, criados.itens))
        await db.delete(item).where(inArray(item.id, criados.itens))
    }
    if (criados.saidas.length > 0) await db.delete(saida).where(inArray(saida.id, criados.saidas))
    if (criados.usuarios.length > 0) await db.delete(user).where(inArray(user.id, criados.usuarios))
})

async function operador() {
    const id = randomUUID()
    await db.insert(user).values({
        id,
        name: 'Operador saldo',
        email: `saldo-${id.slice(0, 8)}@exemplo.test`,
        emailVerified: true,
        role: 'coordenador'
    })
    criados.usuarios.push(id)
    return id
}

async function saldoGravado(itemId: string) {
    const [l] = await db
        .select({ q: saldoEstoque.quantidadeAtual })
        .from(saldoEstoque)
        .where(eq(saldoEstoque.itemId, itemId))
    return Number(l?.q ?? 0)
}

describe('recalcularSaldosDeItens é invariante sobre o que os casos de uso gravam', () => {
    it('entradas, saída avulsa e descarte: recalcular não muda nenhum saldo', async () => {
        const registradoPor = await operador()
        const entradas = new RegistrarEntradaUseCase(entradaRepository)
        const itens: string[] = []

        for (const [nome, quantidade] of [
            ['Arroz DZ', 50.5],
            ['Água DZ', 120]
        ] as const) {
            const r = await entradas.executar({
                novoItem: {
                    nome: `${nome} ${randomUUID().slice(0, 6)}`,
                    categoria: 'alimentacao',
                    unidadeMedida: 'kg'
                },
                quantidade,
                condicao: 'novo',
                perecivel: false,
                registradoPor
            })
            expect(r.ok).toBe(true)
            if (!r.ok) return
            itens.push(r.valor.itemId)
            criados.itens.push(r.valor.itemId)
            // Segunda entrada no mesmo item.
            await entradas.executar({
                itemId: r.valor.itemId,
                quantidade: 10,
                condicao: 'novo',
                perecivel: false,
                registradoPor
            })
        }

        const s = await new RegistrarSaidaUseCase(saidaRepository).executar({
            tipo: 'avulso',
            destino: 'Abrigo DZ',
            responsavelTransporte: 'Teste',
            registradoPor,
            avulsos: [{ itemId: itens[0], quantidade: 7.25 }]
        })
        expect(s.ok).toBe(true)
        if (s.ok) criados.saidas.push(s.valor.saidaId)

        const d = await new RegistrarDescarteUseCase(descarteRepository).executar({
            itemId: itens[1],
            quantidade: 3,
            motivo: 'avaria',
            registradoPor
        })
        expect(d.ok).toBe(true)

        const antes = await Promise.all(itens.map(saldoGravado))
        expect(antes).toEqual([53.25, 127])

        const recalculado = await db.transaction((tx) => recalcularSaldosDeItens(tx, itens))
        const depois = await Promise.all(itens.map(saldoGravado))

        expect(depois).toEqual(antes)
        expect(recalculado.map((r) => r.resultante).sort((a, b) => a - b)).toEqual([...antes].sort((a, b) => a - b))
    })
})
