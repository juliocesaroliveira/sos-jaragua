import { randomUUID } from 'node:crypto'
import { inArray } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { descarte, entrada, item, kit, saida, saidaItem, saldoEstoque } from '@/db/schema/estoque'
import { hojeEmSaoPaulo, intervaloUtc } from '@/src/modules/contingencia/domain/periodo'
import type { CategoriaItem } from '../../domain/item'
import {
    contarDescartesNoPeriodo,
    contarEntradasNoPeriodo,
    contarEntregasPorDestino,
    contarSaidasNoPeriodo,
    descartesNoPeriodo,
    contarValidadesRelatorio,
    entradasNoPeriodo,
    entregasPorDestinoRelatorio,
    inventarioRelatorio,
    itensCriticosRelatorio,
    movimentacaoRelatorio,
    saidasNoPeriodo,
    validadesRelatorio
} from './relatorios'

/**
 * Consultas de Estoque da central de relatórios contra o Neon de
 * desenvolvimento (specs/023-central-relatorios, T025).
 *
 * O banco de desenvolvimento é compartilhado e tem dados de outras pessoas.
 * Por isso os movimentos de teste caem em **maio de 2020** — anterior à
 * existência do sistema —, e os filtros de período isolam exatamente o que
 * este arquivo criou. 2020 também evita horário de verão (extinto em 2019):
 * Brasília é UTC−3 o ano inteiro.
 */

const TUDO = { limite: 100_000, deslocamento: 0 }

const criados = {
    usuarios: [] as string[],
    itens: [] as string[],
    kits: [] as string[],
    saidas: [] as string[],
    entradas: [] as string[],
    descartes: [] as string[]
}

let operador: string

beforeEach(async () => {
    operador = randomUUID()
    await db.insert(user).values({
        id: operador,
        name: 'Operador relatórios',
        email: `relatorios-${operador.slice(0, 8)}@exemplo.test`,
        emailVerified: true,
        role: 'membro_defesa_civil'
    })
    criados.usuarios.push(operador)
})

afterEach(async () => {
    if (criados.saidas.length > 0) await db.delete(saida).where(inArray(saida.id, criados.saidas))
    if (criados.entradas.length > 0) await db.delete(entrada).where(inArray(entrada.id, criados.entradas))
    if (criados.descartes.length > 0) await db.delete(descarte).where(inArray(descarte.id, criados.descartes))
    if (criados.kits.length > 0) await db.delete(kit).where(inArray(kit.id, criados.kits))
    if (criados.itens.length > 0) {
        await db.delete(saldoEstoque).where(inArray(saldoEstoque.itemId, criados.itens))
        await db.delete(item).where(inArray(item.id, criados.itens))
    }
    if (criados.usuarios.length > 0) await db.delete(user).where(inArray(user.id, criados.usuarios))
    for (const lista of Object.values(criados)) lista.length = 0
})

async function criarItem(
    nome: string,
    opcoes: { categoria?: CategoriaItem; saldo?: number; estoqueMinimo?: number | null; aguardando?: boolean } = {}
) {
    const [linha] = await db
        .insert(item)
        .values({
            nome: `${nome} ${randomUUID().slice(0, 8)}`,
            categoria: opcoes.categoria ?? 'alimentacao',
            unidadeMedida: 'kg',
            estoqueMinimo:
                opcoes.estoqueMinimo === undefined || opcoes.estoqueMinimo === null
                    ? null
                    : opcoes.estoqueMinimo.toFixed(3),
            aguardandoPrimeiraEntrada: opcoes.aguardando ?? false
        })
        .returning({ id: item.id, nome: item.nome })
    criados.itens.push(linha.id)
    await db.insert(saldoEstoque).values({ itemId: linha.id, quantidadeAtual: (opcoes.saldo ?? 0).toFixed(3) })
    return linha
}

async function criarSaida(
    criadoEm: string,
    itens: { itemId: string; quantidade: number }[],
    opcoes: { tipo?: 'avulso' | 'kit'; destino?: string } = {}
) {
    const [linha] = await db
        .insert(saida)
        .values({
            tipo: opcoes.tipo ?? 'avulso',
            destino: opcoes.destino ?? 'Abrigo Teste',
            responsavelTransporte: 'Motorista',
            registradoPor: operador,
            criadoEm: new Date(criadoEm)
        })
        .returning({ id: saida.id })
    criados.saidas.push(linha.id)
    await db
        .insert(saidaItem)
        .values(itens.map((i) => ({ saidaId: linha.id, itemId: i.itemId, quantidade: i.quantidade.toFixed(3) })))
    return linha.id
}

async function criarEntrada(
    criadoEm: string,
    itemId: string,
    opcoes: {
        quantidade?: number
        condicao?: 'novo' | 'usado_bom_estado'
        kitDestinoId?: string
        perecivel?: boolean
        dataValidade?: string | null
    } = {}
) {
    const [linha] = await db
        .insert(entrada)
        .values({
            itemId,
            quantidade: (opcoes.quantidade ?? 1).toFixed(3),
            condicao: opcoes.condicao ?? 'novo',
            perecivel: opcoes.perecivel ?? true,
            dataValidade: opcoes.dataValidade === undefined ? '2020-12-31' : opcoes.dataValidade,
            kitDestinoId: opcoes.kitDestinoId,
            registradoPor: operador,
            criadoEm: new Date(criadoEm)
        })
        .returning({ id: entrada.id })
    criados.entradas.push(linha.id)
    return linha.id
}

async function criarDescarte(criadoEm: string, itemId: string, motivo: string) {
    const [linha] = await db
        .insert(descarte)
        .values({ itemId, quantidade: '2.000', motivo, registradoPor: operador, criadoEm: new Date(criadoEm) })
        .returning({ id: descarte.id })
    criados.descartes.push(linha.id)
    return linha.id
}

const MAIO_2020 = intervaloUtc({ de: '2020-05-01', ate: '2020-05-31' })

describe('saidasNoPeriodo', () => {
    it('inclui 23h30 de Brasília do último dia e exclui 00h00 do dia seguinte', async () => {
        const arroz = await criarItem('Arroz')
        const dentro = await criarSaida('2020-05-06T02:30:00Z', [{ itemId: arroz.id, quantidade: 3 }]) // 05/05 23:30 BRT
        await criarSaida('2020-05-06T03:00:00Z', [{ itemId: arroz.id, quantidade: 4 }]) // 06/05 00:00 BRT

        const dia5 = intervaloUtc({ de: '2020-05-05', ate: '2020-05-05' })
        const linhas = await saidasNoPeriodo({ intervalo: dia5 }, TUDO)

        expect(linhas.map((l) => l.saidaId)).toEqual([dentro])
        expect(await contarSaidasNoPeriodo({ intervalo: dia5 })).toBe(1)
    })

    it('achata por item, com quem registrou, e filtra por tipo, categoria e destino (sem acento/caixa)', async () => {
        const arroz = await criarItem('Arroz', { categoria: 'alimentacao' })
        const sabao = await criarItem('Sabão', { categoria: 'limpeza' })
        await criarSaida(
            '2020-05-10T15:00:00Z',
            [
                { itemId: arroz.id, quantidade: 2 },
                { itemId: sabao.id, quantidade: 1.5 }
            ],
            { destino: 'Abrigo São João' }
        )
        await criarSaida('2020-05-11T15:00:00Z', [{ itemId: arroz.id, quantidade: 1 }], {
            tipo: 'kit',
            destino: 'Bairro Centro'
        })

        const todas = await saidasNoPeriodo({ intervalo: MAIO_2020 }, TUDO)
        expect(todas).toHaveLength(3)
        expect(todas[0]).toMatchObject({ item: arroz.nome, quantidade: 1, tipo: 'kit', registradoPorId: operador })

        const kits = await saidasNoPeriodo({ intervalo: MAIO_2020, tipo: 'kit' }, TUDO)
        expect(kits.map((l) => l.destino)).toEqual(['Bairro Centro'])

        const limpeza = await saidasNoPeriodo({ intervalo: MAIO_2020, categoria: 'limpeza' }, TUDO)
        expect(limpeza.map((l) => l.item)).toEqual([sabao.nome])

        const porDestino = await saidasNoPeriodo({ intervalo: MAIO_2020, destino: 'sao joao' }, TUDO)
        expect(porDestino).toHaveLength(2)
        expect(await contarSaidasNoPeriodo({ intervalo: MAIO_2020, destino: 'sao joao' })).toBe(2)
    })

    it('descarte nunca aparece como saída (BR-EST-05)', async () => {
        const arroz = await criarItem('Arroz')
        await criarDescarte('2020-05-10T15:00:00Z', arroz.id, 'Vencido')

        expect(await saidasNoPeriodo({ intervalo: MAIO_2020 }, TUDO)).toEqual([])
    })

    it('pagina de forma estável: as janelas cobrem tudo sem repetir', async () => {
        const arroz = await criarItem('Arroz')
        for (let i = 0; i < 5; i++) {
            await criarSaida('2020-05-10T15:00:00Z', [{ itemId: arroz.id, quantidade: i + 1 }])
        }
        const primeira = await saidasNoPeriodo({ intervalo: MAIO_2020 }, { limite: 3, deslocamento: 0 })
        const segunda = await saidasNoPeriodo({ intervalo: MAIO_2020 }, { limite: 3, deslocamento: 3 })
        const ids = [...primeira, ...segunda].map((l) => l.saidaItemId)
        expect(new Set(ids).size).toBe(5)
    })
})

describe('entradasNoPeriodo', () => {
    it('lista com kit de destino e filtra por categoria e condição', async () => {
        const arroz = await criarItem('Arroz', { categoria: 'alimentacao' })
        const lencol = await criarItem('Lençol', { categoria: 'acomodacao' })
        const [kitBasico] = await db
            .insert(kit)
            .values({ nome: `Kit básico ${randomUUID().slice(0, 8)}` })
            .returning()
        criados.kits.push(kitBasico.id)

        await criarEntrada('2020-05-10T15:00:00Z', arroz.id, { quantidade: 10, kitDestinoId: kitBasico.id })
        await criarEntrada('2020-05-11T15:00:00Z', lencol.id, { condicao: 'usado_bom_estado' })

        const todas = await entradasNoPeriodo({ intervalo: MAIO_2020 }, TUDO)
        expect(todas.map((l) => l.item)).toEqual([lencol.nome, arroz.nome])
        expect(todas[1]).toMatchObject({
            quantidade: 10,
            kitDestino: kitBasico.nome,
            perecivel: true,
            dataValidade: '2020-12-31'
        })

        expect(
            (await entradasNoPeriodo({ intervalo: MAIO_2020, categoria: 'acomodacao' }, TUDO)).map((l) => l.item)
        ).toEqual([lencol.nome])
        expect(await contarEntradasNoPeriodo({ intervalo: MAIO_2020, condicao: 'usado_bom_estado' })).toBe(1)
    })
})

describe('descartesNoPeriodo', () => {
    it('lista com motivo e quem registrou', async () => {
        const arroz = await criarItem('Arroz')
        await criarDescarte('2020-05-10T15:00:00Z', arroz.id, 'Embalagem violada')

        const linhas = await descartesNoPeriodo({ intervalo: MAIO_2020 }, TUDO)
        expect(linhas).toHaveLength(1)
        expect(linhas[0]).toMatchObject({
            item: arroz.nome,
            quantidade: 2,
            motivo: 'Embalagem violada',
            registradoPorId: operador
        })
        expect(await contarDescartesNoPeriodo({ intervalo: MAIO_2020, categoria: 'limpeza' })).toBe(0)
    })
})

describe('inventarioRelatorio', () => {
    it('calcula mínimo aplicado, origem e situação (próprio, padrão, sem alerta, aguardando)', async () => {
        const proprio = await criarItem('Proprio', { saldo: 3, estoqueMinimo: 5 })
        const padrao = await criarItem('Padrao', { saldo: 1_000_000, estoqueMinimo: null })
        const desligado = await criarItem('Desligado', { saldo: 0, estoqueMinimo: 0 })
        const aguardando = await criarItem('Aguardando', { saldo: 0, estoqueMinimo: null, aguardando: true })

        const linhas = await inventarioRelatorio({}, 7)
        const por = (id: string) => linhas.find((l) => l.id === id)

        expect(por(proprio.id)).toMatchObject({
            saldo: 3,
            minimoAplicado: 5,
            origemMinimo: 'proprio',
            situacao: 'abaixo'
        })
        expect(por(padrao.id)).toMatchObject({ minimoAplicado: 7, origemMinimo: 'padrao', situacao: 'ok' })
        expect(por(desligado.id)).toMatchObject({ minimoAplicado: null, origemMinimo: 'sem_alerta', situacao: 'ok' })
        expect(por(aguardando.id)).toMatchObject({ situacao: 'aguardando' })

        const abaixo = await inventarioRelatorio({ situacao: 'abaixo' }, 7)
        expect(abaixo.some((l) => l.id === proprio.id)).toBe(true)
        expect(abaixo.some((l) => l.id === padrao.id)).toBe(false)
    })
})

describe('itensCriticosRelatorio (R-05)', () => {
    it('usa a regra do alerta: mínimo próprio, padrão e desligado; aguardando primeira entrada fica fora', async () => {
        const proprio = await criarItem('Proprio', { saldo: 3, estoqueMinimo: 5 })
        const noLimite = await criarItem('NoLimite', { saldo: 5, estoqueMinimo: 5 })
        const folgado = await criarItem('Folgado', { saldo: 6, estoqueMinimo: 5 })
        const desligado = await criarItem('Desligado', { saldo: 0, estoqueMinimo: 0 })
        const aguardando = await criarItem('Aguardando', { saldo: 0, estoqueMinimo: 5, aguardando: true })

        const linhas = await itensCriticosRelatorio({}, 7)
        const ids = linhas.map((l) => l.id)

        expect(ids).toContain(proprio.id)
        // "Atingiu o mínimo" já conta (`<=`), igual ao alerta.
        expect(ids).toContain(noLimite.id)
        expect(ids).not.toContain(folgado.id)
        expect(ids).not.toContain(desligado.id)
        expect(ids).not.toContain(aguardando.id)
        expect(linhas.find((l) => l.id === proprio.id)).toMatchObject({ saldo: 3, limiar: 5 })
    })

    it('filtra por categoria', async () => {
        const sabao = await criarItem('Sabao', { saldo: 0, estoqueMinimo: 5, categoria: 'limpeza' })
        const ids = (await itensCriticosRelatorio({ categoria: 'agua' }, 7)).map((l) => l.id)
        expect(ids).not.toContain(sabao.id)
    })
})

describe('validadesRelatorio (R-06)', () => {
    it('lista perecíveis vencidas e dentro do horizonte, da validade mais próxima à mais distante', async () => {
        const leite = await criarItem('Leite')
        // "Hoje" fixo em 2020-05-15, horizonte de 30 dias → limite 2020-06-14.
        const vencida = await criarEntrada('2020-05-01T15:00:00Z', leite.id, { dataValidade: '2020-05-10' })
        const dezDias = await criarEntrada('2020-05-01T15:00:00Z', leite.id, { dataValidade: '2020-05-25' })
        await criarEntrada('2020-05-01T15:00:00Z', leite.id, { dataValidade: '2020-07-14' }) // 60 dias
        await criarEntrada('2020-05-01T15:00:00Z', leite.id, { perecivel: false, dataValidade: null })

        // Restringe ao que este teste criou: o banco tem outras doações reais.
        const doTeste = (await validadesRelatorio({ limite: '2020-06-14' }, TUDO)).filter((l) =>
            criados.entradas.includes(l.id)
        )

        expect(doTeste.map((l) => l.id)).toEqual([vencida, dezDias])
        expect(doTeste[0]).toMatchObject({ item: leite.nome, dataValidade: '2020-05-10', quantidade: 1 })
        expect(await contarValidadesRelatorio({ limite: '2020-06-14' })).toBeGreaterThanOrEqual(2)
    })
})

describe('movimentacaoRelatorio (R-07)', () => {
    it('separa os movimentos do período dos posteriores; o balanço fecha com o saldo de hoje (SC-003)', async () => {
        // Hoje: 125. Em maio/2020: +50 −30 −5. Em junho/2020: +10.
        const arroz = await criarItem('Arroz', { saldo: 125 })
        await criarEntrada('2020-05-03T15:00:00Z', arroz.id, { quantidade: 50 })
        await criarSaida('2020-05-04T15:00:00Z', [{ itemId: arroz.id, quantidade: 30 }])
        await criarDescarte('2020-05-05T15:00:00Z', arroz.id, 'Vencido') // 2 unidades
        await criarDescarte('2020-05-05T16:00:00Z', arroz.id, 'Molhado') // +2 = 4
        await criarEntrada('2020-06-03T15:00:00Z', arroz.id, { quantidade: 10 })

        const linha = (await movimentacaoRelatorio({ intervalo: MAIO_2020 })).find((l) => l.id === arroz.id)
        expect(linha).toMatchObject({
            saldoAtual: 125,
            noPeriodo: { entradas: 50, saidas: 30, descartes: 4 },
            aposPeriodo: { entradas: 10, saidas: 0, descartes: 0 }
        })

        // Com o período terminando hoje, nada é "posterior": o saldo final
        // do balanço é o saldo de `saldo_estoque`.
        const ateHoje = intervaloUtc({ de: '2020-05-01', ate: hojeEmSaoPaulo() })
        const hoje = (await movimentacaoRelatorio({ intervalo: ateHoje })).find((l) => l.id === arroz.id)
        expect(hoje?.aposPeriodo).toEqual({ entradas: 0, saidas: 0, descartes: 0 })
        expect(hoje?.noPeriodo).toEqual({ entradas: 60, saidas: 30, descartes: 4 })
    })
})

describe('entregasPorDestinoRelatorio (R-08)', () => {
    it('soma por destino sem caixa/espaços, por categoria, e exclui descartes', async () => {
        const arroz = await criarItem('Arroz', { categoria: 'alimentacao' })
        const sabao = await criarItem('Sabao', { categoria: 'limpeza' })
        const destino = `Abrigo ${randomUUID().slice(0, 6)}`

        await criarSaida('2020-05-10T15:00:00Z', [{ itemId: arroz.id, quantidade: 2 }], { destino })
        await criarSaida('2020-05-11T15:00:00Z', [{ itemId: arroz.id, quantidade: 3 }], {
            destino: destino.toLowerCase()
        })
        await criarSaida('2020-05-12T15:00:00Z', [{ itemId: arroz.id, quantidade: 1 }], {
            destino: `  ${destino.replace(' ', '   ')} `
        })
        await criarSaida('2020-05-12T15:00:00Z', [{ itemId: sabao.id, quantidade: 4 }], { destino })
        await criarDescarte('2020-05-12T15:00:00Z', arroz.id, 'Vencido')

        const linhas = (await entregasPorDestinoRelatorio({ intervalo: MAIO_2020 }, TUDO)).filter(
            (l) => l.destino.toLowerCase().replace(/\s+/g, ' ').trim() === destino.toLowerCase()
        )

        expect(linhas).toEqual([
            { destino, categoria: 'alimentacao', unidadeMedida: 'kg', quantidade: 6, saidas: 3 },
            { destino, categoria: 'limpeza', unidadeMedida: 'kg', quantidade: 4, saidas: 1 }
        ])
        expect(await contarEntregasPorDestino({ intervalo: MAIO_2020, categoria: 'limpeza' })).toBe(1)
    })
})
