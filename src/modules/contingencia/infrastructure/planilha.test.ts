import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { gerarCsv, gerarXlsx, nomeDeArquivo, type Aba } from './planilha'

/**
 * Invariantes do arquivo gerado (specs/020-resolver-pendencias,
 * contracts/exportacao-planilhas.md). O XLSX é relido com a própria `exceljs`
 * para conferir o conteúdo, e não os bytes: duas bibliotecas podem gravar o
 * mesmo conteúdo de formas diferentes.
 */

type Linha = { item: string; saldo: number | null }

const COLUNAS: Aba<Linha>['colunas'] = [
    { cabecalho: 'Item', valor: (l) => l.item, largura: 34 },
    { cabecalho: 'Saldo atual', valor: (l) => l.saldo }
]

async function reler(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook()
    // O tipo de `load` espera o `Buffer` do @types/node antigo do exceljs.
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
    return workbook
}

/** Valores de uma linha sem o índice 0, que o exceljs deixa vazio. */
function valores(planilha: ExcelJS.Worksheet, linha: number) {
    return (planilha.getRow(linha).values as unknown[]).slice(1)
}

describe('gerarXlsx', () => {
    it('grava uma aba por Aba, na ordem recebida', async () => {
        const buffer = await gerarXlsx([
            { nome: 'Primeira', colunas: COLUNAS, linhas: [] },
            { nome: 'Segunda', colunas: COLUNAS, linhas: [] }
        ])

        const workbook = await reler(buffer)
        expect(workbook.worksheets.map((p) => p.name)).toEqual(['Primeira', 'Segunda'])
    })

    it('troca caracteres proibidos no nome da aba e corta em 31 caracteres', async () => {
        const buffer = await gerarXlsx([
            { nome: 'Saídas [jan/fev]: lista*?\\ completa de itens', colunas: COLUNAS, linhas: [] }
        ])

        const [planilha] = (await reler(buffer)).worksheets
        expect(planilha.name).not.toMatch(/[[\]:*?/\\]/)
        expect(planilha.name.length).toBeLessThanOrEqual(31)
        expect(planilha.name.startsWith('Saídas  jan fev')).toBe(true)
    })

    it('escreve os cabeçalhos na linha 1 e mantém números como números', async () => {
        const buffer = await gerarXlsx([
            {
                nome: 'Estoque',
                colunas: COLUNAS,
                linhas: [
                    { item: 'Arroz', saldo: 12.5 },
                    { item: 'Feijão', saldo: 3 }
                ]
            }
        ])

        const [planilha] = (await reler(buffer)).worksheets
        expect(valores(planilha, 1)).toEqual(['Item', 'Saldo atual'])
        expect(valores(planilha, 2)).toEqual(['Arroz', 12.5])
        expect(typeof planilha.getRow(3).getCell(2).value).toBe('number')
    })

    it('deixa a célula vazia quando o valor é null ou undefined', async () => {
        const buffer = await gerarXlsx([
            {
                nome: 'Estoque',
                colunas: [...COLUNAS, { cabecalho: 'Observação', valor: () => undefined }],
                linhas: [{ item: 'Cobertor', saldo: null }]
            }
        ])

        const [planilha] = (await reler(buffer)).worksheets
        const linha = planilha.getRow(2)
        expect(linha.getCell(1).value).toBe('Cobertor')
        expect(linha.getCell(2).value).toBeNull()
        expect(linha.getCell(3).value).toBeNull()
    })

    it('usa a largura informada ou max(12, cabeçalho + 2)', async () => {
        const buffer = await gerarXlsx([
            {
                nome: 'Estoque',
                colunas: [...COLUNAS, { cabecalho: 'Responsável pelo transporte do kit', valor: () => null }],
                linhas: []
            }
        ])

        const [planilha] = (await reler(buffer)).worksheets
        expect(planilha.getColumn(1).width).toBe(34)
        expect(planilha.getColumn(2).width).toBe(13) // 'Saldo atual' (11) + 2
        expect(planilha.getColumn(3).width).toBe(36) // 34 + 2
    })

    it('usa largura mínima 12 para cabeçalhos curtos', async () => {
        const buffer = await gerarXlsx([
            { nome: 'Estoque', colunas: [{ cabecalho: 'Un', valor: () => null }], linhas: [] }
        ])

        const [planilha] = (await reler(buffer)).worksheets
        expect(planilha.getColumn(1).width).toBe(12)
    })

    it('congela a linha de cabeçalho', async () => {
        const buffer = await gerarXlsx([{ nome: 'Estoque', colunas: COLUNAS, linhas: [] }])

        const [planilha] = (await reler(buffer)).worksheets
        expect(planilha.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
    })

    it('grava só o cabeçalho quando a aba não tem linhas', async () => {
        const buffer = await gerarXlsx([{ nome: 'Em branco', colunas: COLUNAS, linhas: [] }])

        const [planilha] = (await reler(buffer)).worksheets
        expect(planilha.rowCount).toBe(1)
    })

    it('preserva acentos e cedilha', async () => {
        const buffer = await gerarXlsx([
            { nome: 'Doações', colunas: COLUNAS, linhas: [{ item: 'Água / ação / ç', saldo: 1 }] }
        ])

        const [planilha] = (await reler(buffer)).worksheets
        expect(planilha.name).toBe('Doações')
        expect(planilha.getRow(2).getCell(1).value).toBe('Água / ação / ç')
    })
})

describe('gerarCsv', () => {
    const aba: Aba<Linha> = {
        nome: 'Estoque',
        colunas: COLUNAS,
        linhas: [
            { item: 'Arroz', saldo: 12.5 },
            { item: 'Feijão "carioca"; 1 kg', saldo: null },
            { item: 'Linha\nquebrada', saldo: 3 }
        ]
    }

    it('começa com BOM UTF-8 e usa ; como separador e \\r\\n entre linhas', () => {
        const csv = gerarCsv(aba)
        expect(csv.startsWith('﻿')).toBe(true)
        expect(csv.slice(1).split('\r\n')[0]).toBe('Item;Saldo atual')
    })

    it('usa vírgula como separador decimal e deixa null vazio', () => {
        const linhas = gerarCsv(aba).slice(1).split('\r\n')
        expect(linhas[1]).toBe('Arroz;12,5')
        expect(linhas[2]).toBe('"Feijão ""carioca""; 1 kg";')
    })

    it('envolve em aspas valores com quebra de linha', () => {
        expect(gerarCsv(aba)).toContain('"Linha\nquebrada";3')
    })
})

describe('nomeDeArquivo', () => {
    it('inclui data e hora de São Paulo no nome', () => {
        // 01/10/2026 18:05 UTC = 15:05 em São Paulo
        expect(nomeDeArquivo('inventario', 'xlsx', new Date(Date.UTC(2026, 9, 1, 18, 5)))).toBe(
            'inventario-2026-10-01-15h05.xlsx'
        )
    })
})
