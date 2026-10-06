import { randomUUID } from 'node:crypto'
import { count, eq, inArray } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { entrada, item, kit, kitReceitaItem, saldoEstoque } from '@/db/schema/estoque'
import type { ComponenteInformado } from '../../domain/receita-kit'
import { entradaRepository, kitRepository } from '../../infrastructure/drizzle/estoque-repository'
import type { ResultadoComposicao } from '../ports/estoque-repository'

/**
 * Feature 022 — `salvarComposicao` contra o Neon de desenvolvimento.
 *
 * O que só o banco real prova: que um conflito não deixa **nada** gravado
 * (rollback de item, kit e receita — FR-006, SC-002), que o nome novo é
 * resolvido pelo `f_unaccent` do Postgres (FR-009) e que o lock por nome
 * serializa dois salvamentos concorrentes (research R4).
 */
vi.mock('@/src/modules/auditoria', () => ({
    withAudit: <T>(_o: unknown, fn: () => Promise<T>) => fn()
}))

const criados: { itens: string[]; kits: string[]; entradas: string[]; usuarios: string[] } = {
    itens: [],
    kits: [],
    entradas: [],
    usuarios: []
}

/** Sufixo por execução: o Neon de dev é compartilhado e os nomes não podem colidir. */
const sufixo = () => randomUUID().slice(0, 8)

async function criarItem(nome: string) {
    const [linha] = await db
        .insert(item)
        .values({ nome, categoria: 'higiene', unidadeMedida: 'unidade' })
        .returning({ id: item.id, nome: item.nome })
    await db.insert(saldoEstoque).values({ itemId: linha.id, quantidadeAtual: '0' })
    criados.itens.push(linha.id)
    return linha
}

function novo(nome: string): ComponenteInformado {
    return {
        tipo: 'novo',
        novoItem: { nome, categoria: 'higiene', unidadeMedida: 'unidade', estoqueMinimo: null },
        quantidadePorKit: 1
    }
}

function existente(itemId: string, quantidadePorKit = 1): ComponenteInformado {
    return { tipo: 'existente', itemId, quantidadePorKit }
}

/** Registra o que o resultado criou, para o `afterEach` apagar. */
function rastrear(resultado: ResultadoComposicao | null) {
    if (resultado && 'kit' in resultado) {
        criados.kits.push(resultado.kit.id)
        criados.itens.push(...resultado.itensCriados.map((i) => i.id))
    }
    return resultado
}

function sucesso(resultado: ResultadoComposicao | null) {
    if (!resultado || !('kit' in resultado)) throw new Error(`esperava sucesso: ${JSON.stringify(resultado)}`)
    return resultado
}

async function contagens() {
    const [[itens], [kits], [receitas]] = await Promise.all([
        db.select({ n: count() }).from(item),
        db.select({ n: count() }).from(kit),
        db.select({ n: count() }).from(kitReceitaItem)
    ])
    return { itens: itens.n, kits: kits.n, receitas: receitas.n }
}

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

afterEach(async () => {
    // Ordem imposta pelas FKs: entrada e receita referenciam o item com `restrict`.
    if (criados.entradas.length > 0) {
        await db.delete(entrada).where(inArray(entrada.id, criados.entradas))
    }
    if (criados.kits.length > 0) {
        await db.delete(kitReceitaItem).where(inArray(kitReceitaItem.kitId, criados.kits))
        await db.delete(kit).where(inArray(kit.id, criados.kits))
    }
    if (criados.itens.length > 0) {
        await db.delete(saldoEstoque).where(inArray(saldoEstoque.itemId, criados.itens))
        await db.delete(item).where(inArray(item.id, criados.itens))
    }
    if (criados.usuarios.length > 0) {
        await db.delete(user).where(inArray(user.id, criados.usuarios))
    }
    criados.itens.length = 0
    criados.kits.length = 0
    criados.entradas.length = 0
    criados.usuarios.length = 0
})

describe('salvarComposicao (feature 022)', () => {
    it('A: cria kit, receita e item novo com saldo 0, aguardando a primeira entrada', async () => {
        const arroz = await criarItem(`Arroz ${sufixo()}`)
        const nomeNovo = `Sabonete líquido ${sufixo()}`

        const r = sucesso(
            rastrear(
                await kitRepository.salvarComposicao({
                    nome: `Kit A ${sufixo()}`,
                    ativo: true,
                    componentes: [existente(arroz.id, 2), novo(nomeNovo)]
                })
            )
        )

        expect(r.itensCriados).toHaveLength(1)
        const criado = r.itensCriados[0]
        expect(criado).toMatchObject({ nome: nomeNovo, aguardandoPrimeiraEntrada: true })

        const [saldo] = await db.select().from(saldoEstoque).where(eq(saldoEstoque.itemId, criado.id))
        expect(Number(saldo.quantidadeAtual)).toBe(0)

        const receita = await kitRepository.receita(r.kit.id)
        expect(receita).toHaveLength(2)
        expect(receita).toEqual(
            expect.arrayContaining([
                { itemId: arroz.id, quantidadePorKit: 2 },
                { itemId: criado.id, quantidadePorKit: 1 }
            ])
        )
    })

    it('B: vincula nome novo idêntico (caixa e acento) a um item existente, sem criar', async () => {
        const s = sufixo()
        const feijao = await criarItem(`Feijão Preto ${s}`)

        const r = sucesso(
            rastrear(
                await kitRepository.salvarComposicao({
                    nome: `Kit B ${s}`,
                    ativo: true,
                    componentes: [novo(`  feijao PRETO ${s} `)]
                })
            )
        )

        expect(r.itensCriados).toHaveLength(0)
        expect(r.vinculos).toEqual([{ indice: 0, itemId: feijao.id }])
        expect(await kitRepository.receita(r.kit.id)).toEqual([{ itemId: feijao.id, quantidadePorKit: 1 }])
    })

    it('C: recusa nome que corresponde a mais de um item e não grava nada', async () => {
        const s = sufixo()
        await criarItem(`Teste Dup ${s}`)
        await criarItem(`teste dup ${s}`)
        const antes = await contagens()

        const r = rastrear(
            await kitRepository.salvarComposicao({
                nome: `Kit C ${s}`,
                ativo: true,
                componentes: [novo(`Outro ${s}`), novo(`Teste Dup ${s}`)]
            })
        )

        expect(r).toEqual({ conflitos: [{ indice: 1, tipo: 'ambiguo' }] })
        expect(await contagens()).toEqual(antes)
    })

    it('D: recusa nome novo que vincula a um item já selecionado em outra linha', async () => {
        const s = sufixo()
        const agua = await criarItem(`Água ${s}`)
        const antes = await contagens()

        const r = rastrear(
            await kitRepository.salvarComposicao({
                nome: `Kit D ${s}`,
                ativo: true,
                componentes: [existente(agua.id), novo(`agua ${s}`)]
            })
        )

        expect(r).toEqual({ conflitos: [{ indice: 1, tipo: 'repetido' }] })
        expect(await contagens()).toEqual(antes)
    })

    it('E: na edição, substitui a receita inteira', async () => {
        const s = sufixo()
        const arroz = await criarItem(`Arroz ${s}`)
        const feijao = await criarItem(`Feijão ${s}`)
        const original = sucesso(
            rastrear(
                await kitRepository.salvarComposicao({
                    nome: `Kit E ${s}`,
                    ativo: true,
                    componentes: [existente(arroz.id)]
                })
            )
        )

        const editado = sucesso(
            await kitRepository.salvarComposicao({
                id: original.kit.id,
                nome: `Kit E editado ${s}`,
                ativo: false,
                componentes: [existente(feijao.id, 3)]
            })
        )

        expect(editado.kit).toMatchObject({ id: original.kit.id, nome: `Kit E editado ${s}`, ativo: false })
        expect(await kitRepository.receita(original.kit.id)).toEqual([{ itemId: feijao.id, quantidadePorKit: 3 }])
    })

    it('F: devolve null para kit inexistente, sem gravar o item novo', async () => {
        const antes = await contagens()

        const r = await kitRepository.salvarComposicao({
            id: randomUUID(),
            nome: 'Fantasma',
            ativo: true,
            componentes: [novo(`Nunca criado ${sufixo()}`)]
        })

        expect(r).toBeNull()
        expect(await contagens()).toEqual(antes)
    })

    it('G: dois salvamentos concorrentes com o mesmo nome novo criam um único item', async () => {
        const s = sufixo()
        const nome = `Lanterna ${s}`

        const [r1, r2] = (
            await Promise.all([
                kitRepository.salvarComposicao({ nome: `Kit G1 ${s}`, ativo: true, componentes: [novo(nome)] }),
                kitRepository.salvarComposicao({ nome: `Kit G2 ${s}`, ativo: true, componentes: [novo(nome)] })
            ])
        ).map((r) => sucesso(rastrear(r)))

        expect(r1.itensCriados.length + r2.itensCriados.length).toBe(1)
        const linhas = await db.select({ id: item.id }).from(item).where(eq(item.nome, nome))
        expect(linhas).toHaveLength(1)
        expect(await kitRepository.receita(r1.kit.id)).toEqual([{ itemId: linhas[0].id, quantidadePorKit: 1 }])
        expect(await kitRepository.receita(r2.kit.id)).toEqual([{ itemId: linhas[0].id, quantidadePorKit: 1 }])
    })

    it('H: a primeira entrada do item criado pelo kit o devolve ao alerta (FR-015)', async () => {
        const operador = await criarOperador()
        const r = sucesso(
            rastrear(
                await kitRepository.salvarComposicao({
                    nome: `Kit H ${sufixo()}`,
                    ativo: true,
                    componentes: [novo(`Cobertor ${sufixo()}`)]
                })
            )
        )
        const criado = r.itensCriados[0]

        const { entradaId } = await entradaRepository.registrar({
            itemId: criado.id,
            quantidade: 1,
            condicao: 'novo',
            perecivel: false,
            registradoPor: operador
        })
        criados.entradas.push(entradaId)

        const [linha] = await db
            .select({ aguardando: item.aguardandoPrimeiraEntrada })
            .from(item)
            .where(eq(item.id, criado.id))
        expect(linha.aguardando).toBe(false)
    })
})
