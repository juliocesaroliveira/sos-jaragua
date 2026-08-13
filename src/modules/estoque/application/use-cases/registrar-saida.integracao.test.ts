import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { item, saida, saidaItem, saldoEstoque } from '@/db/schema/estoque'
import { saidaRepository } from '../../infrastructure/drizzle/estoque-repository'
import { RegistrarSaidaUseCase } from './registrar-saida'

/**
 * TEST-05 — saída de kit contra o Neon de desenvolvimento (DESIGN.md §18).
 *
 * Os dois cenários do BR-EST-04:
 * - **A (sucesso)**: dedução atômica de todos os componentes.
 * - **B (falha)**: bloqueio com déficit por item e **saldo inalterado**.
 *
 * O cenário B é o que justifica o teste de integração: garantir que nada foi
 * gravado exige olhar o banco depois do rollback.
 */
vi.mock('@/src/modules/auditoria', () => ({
    withAudit: <T>(_o: unknown, fn: () => Promise<T>) => fn()
}))

const criados: { itens: string[]; usuarios: string[]; saidas: string[] } = { itens: [], usuarios: [], saidas: [] }

async function criarOperador() {
    const id = randomUUID()
    await db.insert(user).values({
        id,
        name: 'Operador de teste',
        email: `operador-${id.slice(0, 8)}@exemplo.test`,
        emailVerified: true,
        role: 'coordenador'
    })
    criados.usuarios.push(id)
    return id
}

async function criarItemComSaldo(nome: string, saldo: number) {
    const [linha] = await db
        .insert(item)
        .values({ nome: `${nome} ${randomUUID().slice(0, 8)}`, categoria: 'alimentacao', unidadeMedida: 'unidade' })
        .returning({ id: item.id, nome: item.nome })

    await db.insert(saldoEstoque).values({ itemId: linha.id, quantidadeAtual: saldo.toFixed(3) })
    criados.itens.push(linha.id)
    return linha
}

async function saldoDe(itemId: string) {
    const [linha] = await db
        .select({ q: saldoEstoque.quantidadeAtual })
        .from(saldoEstoque)
        .where(eq(saldoEstoque.itemId, itemId))
    return Number(linha.q)
}

afterEach(async () => {
    if (criados.saidas.length > 0) {
        await db.delete(saidaItem).where(inArray(saidaItem.saidaId, criados.saidas))
        await db.delete(saida).where(inArray(saida.id, criados.saidas))
    }
    if (criados.itens.length > 0) {
        await db.delete(saldoEstoque).where(inArray(saldoEstoque.itemId, criados.itens))
        await db.delete(item).where(inArray(item.id, criados.itens))
    }
    if (criados.usuarios.length > 0) {
        await db.delete(user).where(inArray(user.id, criados.usuarios))
    }
    criados.itens.length = 0
    criados.usuarios.length = 0
    criados.saidas.length = 0
})

const useCase = new RegistrarSaidaUseCase(saidaRepository)

describe('Saída de kit — cenário A: sucesso (BR-EST-04)', () => {
    it('deduz todos os componentes na proporção da receita', async () => {
        const operador = await criarOperador()
        const arroz = await criarItemComSaldo('Arroz', 40)
        const feijao = await criarItemComSaldo('Feijão', 30)

        const r = await useCase.executar({
            tipo: 'kit',
            destino: 'Abrigo Teste',
            responsavelTransporte: 'Operador',
            registradoPor: operador,
            kits: [
                {
                    kitId: randomUUID(),
                    nome: 'Cesta',
                    quantidade: 10,
                    componentes: [
                        { itemId: arroz.id, quantidadePorKit: 2 },
                        { itemId: feijao.id, quantidadePorKit: 1 }
                    ]
                }
            ]
        })

        expect(r.ok).toBe(true)
        if (!r.ok) return
        criados.saidas.push(r.valor.saidaId)

        expect(await saldoDe(arroz.id)).toBe(20) // 40 − 10×2
        expect(await saldoDe(feijao.id)).toBe(20) // 30 − 10×1

        // O ledger registra uma linha por item efetivamente deduzido.
        const itens = await db
            .select({ itemId: saidaItem.itemId, quantidade: saidaItem.quantidade })
            .from(saidaItem)
            .where(eq(saidaItem.saidaId, r.valor.saidaId))
        expect(itens).toHaveLength(2)
        expect(Number(itens.find((i) => i.itemId === arroz.id)!.quantidade)).toBe(20)
    })

    it('consolida o mesmo item vindo de dois kits antes de deduzir', async () => {
        const operador = await criarOperador()
        const arroz = await criarItemComSaldo('Arroz', 100)

        const r = await useCase.executar({
            tipo: 'kit',
            destino: 'Abrigo Teste',
            responsavelTransporte: 'Operador',
            registradoPor: operador,
            kits: [
                {
                    kitId: randomUUID(),
                    nome: 'Cesta',
                    quantidade: 10,
                    componentes: [{ itemId: arroz.id, quantidadePorKit: 2 }]
                },
                {
                    kitId: randomUUID(),
                    nome: 'Extra',
                    quantidade: 5,
                    componentes: [{ itemId: arroz.id, quantidadePorKit: 1 }]
                }
            ]
        })

        expect(r.ok).toBe(true)
        if (!r.ok) return
        criados.saidas.push(r.valor.saidaId)

        // 10×2 + 5×1 = 25, deduzido de uma vez.
        expect(await saldoDe(arroz.id)).toBe(75)
        const itens = await db.select().from(saidaItem).where(eq(saidaItem.saidaId, r.valor.saidaId))
        expect(itens).toHaveLength(1)
    })
})

describe('Saída de kit — cenário B: bloqueio (BR-EST-04)', () => {
    it('bloqueia, informa o déficit por item e deixa o saldo inalterado', async () => {
        const operador = await criarOperador()
        const arroz = await criarItemComSaldo('Arroz', 40)
        const feijao = await criarItemComSaldo('Feijão', 30)

        const r = await useCase.executar({
            tipo: 'kit',
            destino: 'Abrigo Teste',
            responsavelTransporte: 'Operador',
            registradoPor: operador,
            kits: [
                {
                    kitId: randomUUID(),
                    nome: 'Cesta',
                    quantidade: 25, // exige 50 de arroz, há 40
                    componentes: [
                        { itemId: arroz.id, quantidadePorKit: 2 },
                        { itemId: feijao.id, quantidadePorKit: 1 }
                    ]
                }
            ]
        })

        expect(r.ok).toBe(false)
        if (r.ok) return

        expect(r.erro.codigo).toBe('saida_bloqueada')
        expect(r.erro.message).toContain('Faltam 10 un')
        expect(r.erro.message).toContain(arroz.nome)

        // O componente que **tinha** saldo não pode ter sido deduzido: a saída
        // é tudo-ou-nada.
        expect(await saldoDe(arroz.id)).toBe(40)
        expect(await saldoDe(feijao.id)).toBe(30)

        // E nenhuma linha de saída pode ter sobrado.
        const saidas = await db.select().from(saidaItem).where(eq(saidaItem.itemId, arroz.id))
        expect(saidas).toHaveLength(0)
    })

    it('relata todos os itens deficitários, não só o primeiro', async () => {
        const operador = await criarOperador()
        const arroz = await criarItemComSaldo('Arroz', 1)
        const feijao = await criarItemComSaldo('Feijão', 1)

        const r = await useCase.executar({
            tipo: 'kit',
            destino: 'Abrigo Teste',
            responsavelTransporte: 'Operador',
            registradoPor: operador,
            kits: [
                {
                    kitId: randomUUID(),
                    nome: 'Cesta',
                    quantidade: 10,
                    componentes: [
                        { itemId: arroz.id, quantidadePorKit: 2 },
                        { itemId: feijao.id, quantidadePorKit: 1 }
                    ]
                }
            ]
        })

        expect(r.ok).toBe(false)
        if (r.ok) return

        const deficits = r.erro.detalhes?.deficits as { itemId: string }[]
        expect(deficits).toHaveLength(2)
        // Uma frase por item — o operador precisa saber tudo que falta buscar.
        expect(r.erro.message.match(/Faltam/g)).toHaveLength(2)
    })

    it('bloqueia quando um componente não tem linha de saldo', async () => {
        const operador = await criarOperador()
        const arroz = await criarItemComSaldo('Arroz', 100)
        const inexistente = randomUUID()

        const r = await useCase.executar({
            tipo: 'kit',
            destino: 'Abrigo Teste',
            responsavelTransporte: 'Operador',
            registradoPor: operador,
            kits: [
                {
                    kitId: randomUUID(),
                    nome: 'Cesta',
                    quantidade: 1,
                    componentes: [
                        { itemId: arroz.id, quantidadePorKit: 1 },
                        { itemId: inexistente, quantidadePorKit: 1 }
                    ]
                }
            ]
        })

        expect(r.ok).toBe(false)
        expect(await saldoDe(arroz.id)).toBe(100)
    })
})

describe('Saída avulsa (BR-EST-04)', () => {
    it('deduz itens avulsos e registra o ledger', async () => {
        const operador = await criarOperador()
        const arroz = await criarItemComSaldo('Arroz', 50)

        const r = await useCase.executar({
            tipo: 'avulso',
            destino: 'Família Silva',
            responsavelTransporte: 'Operador',
            registradoPor: operador,
            avulsos: [{ itemId: arroz.id, quantidade: 12.5 }]
        })

        expect(r.ok).toBe(true)
        if (!r.ok) return
        criados.saidas.push(r.valor.saidaId)

        // Quantidade decimal precisa sobreviver ao numeric(14,3).
        expect(await saldoDe(arroz.id)).toBe(37.5)
    })
})
