import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { gerarCsv, gerarXlsx, nomeDeArquivo, streamCsv, streamXlsx, type Aba } from './planilha'

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

/**
 * Cabeçalho do documento, resumo e proteção contra fórmula
 * (specs/023-central-relatorios, FR-008, FR-011, research D7/D8).
 */
const IDENTIFICACAO = [
    { rotulo: 'Relatório', valor: 'Histórico de saídas' },
    { rotulo: 'Período', valor: '01/10/2026 a 05/10/2026' },
    { rotulo: 'Gerado por', valor: 'Maria' }
]
const RESUMO = [{ rotulo: 'Total entregue', valor: 12.5 }]

async function lerStream(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
    const partes: Uint8Array[] = []
    const leitor = stream.getReader()
    for (;;) {
        const { done, value } = await leitor.read()
        if (done) break
        partes.push(value)
    }
    return Buffer.concat(partes)
}

async function* emLotes<T>(...lotes: T[][]): AsyncIterable<T[]> {
    for (const lote of lotes) yield lote
}

describe('cabeçalho do documento e resumo', () => {
    const aba: Aba<Linha> = {
        nome: 'Saídas',
        colunas: COLUNAS,
        linhas: [{ item: 'Arroz', saldo: 2 }],
        cabecalhoDocumento: IDENTIFICACAO,
        resumo: RESUMO
    }

    it('CSV: identificação, resumo e linha em branco antes da tabela', () => {
        const linhas = gerarCsv(aba).slice(1).split('\r\n')
        expect(linhas).toEqual([
            'Relatório;Histórico de saídas',
            'Período;01/10/2026 a 05/10/2026',
            'Gerado por;Maria',
            'Total entregue;12,5',
            '',
            'Item;Saldo atual',
            'Arroz;2'
        ])
    })

    it('XLSX: identificação no topo, tabela depois e painel congelado abaixo do cabeçalho da tabela', async () => {
        const [planilha] = (await reler(await gerarXlsx([aba]))).worksheets

        expect(valores(planilha, 1)).toEqual(['Relatório', 'Histórico de saídas'])
        expect(valores(planilha, 3)).toEqual(['Gerado por', 'Maria'])
        expect(valores(planilha, 4)).toEqual(['Total entregue', 12.5])
        expect(planilha.getRow(5).values).toEqual([])
        expect(valores(planilha, 6)).toEqual(['Item', 'Saldo atual'])
        expect(valores(planilha, 7)).toEqual(['Arroz', 2])
        expect(planilha.views[0]).toMatchObject({ state: 'frozen', ySplit: 6 })
    })

    it('sem os campos novos, a saída é a de antes (regressão do pacote de contingência, FR-004)', async () => {
        const semCabecalho: Aba<Linha> = { nome: 'Estoque', colunas: COLUNAS, linhas: [{ item: 'Arroz', saldo: 2 }] }

        expect(gerarCsv(semCabecalho).slice(1).split('\r\n')).toEqual(['Item;Saldo atual', 'Arroz;2'])

        const [planilha] = (await reler(await gerarXlsx([semCabecalho]))).worksheets
        expect(valores(planilha, 1)).toEqual(['Item', 'Saldo atual'])
        expect(planilha.rowCount).toBe(2)
        expect(planilha.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
    })
})

describe('proteção contra fórmula (FR-011)', () => {
    const perigosos = ['=1+1', '+5', '-2+3', '@SOMA(A1)', '\tx', '\rx']

    it('CSV: texto que começa com = + - @ TAB ou CR ganha apóstrofo', () => {
        const aba: Aba<{ texto: string }> = {
            nome: 'X',
            colunas: [{ cabecalho: 'Destino', valor: (l) => l.texto }],
            linhas: perigosos.map((texto) => ({ texto }))
        }
        const csv = gerarCsv(aba)
        expect(csv).toContain("'=1+1")
        expect(csv).toContain("'+5")
        expect(csv).toContain("'-2+3")
        expect(csv).toContain("'@SOMA(A1)")
        expect(csv).toContain("'\tx")
        expect(csv).not.toMatch(/(^|\r\n|;)=1\+1/)
    })

    it('CSV: números negativos continuam números, sem apóstrofo', () => {
        const aba: Aba<{ n: number }> = {
            nome: 'X',
            colunas: [{ cabecalho: 'Variação', valor: (l) => l.n }],
            linhas: [{ n: -3.5 }]
        }
        expect(gerarCsv(aba).slice(1).split('\r\n')[1]).toBe('-3,5')
    })

    it('CSV: o cabeçalho do documento também é protegido (filtros vêm do usuário)', () => {
        const aba: Aba<Linha> = {
            nome: 'X',
            colunas: COLUNAS,
            linhas: [],
            cabecalhoDocumento: [{ rotulo: 'Destino', valor: '=HYPERLINK("x")' }]
        }
        expect(gerarCsv(aba)).toContain(`Destino;"'=HYPERLINK(""x"")"`)
    })

    it('XLSX: o texto é gravado como string, nunca como fórmula', async () => {
        const aba: Aba<{ texto: string }> = {
            nome: 'X',
            colunas: [{ cabecalho: 'Destino', valor: (l) => l.texto }],
            linhas: [{ texto: '=1+1' }]
        }
        const [planilha] = (await reler(await gerarXlsx([aba]))).worksheets
        const celula = planilha.getRow(2).getCell(1)
        expect(celula.type).toBe(ExcelJS.ValueType.String)
        expect(celula.value).toBe('=1+1')
    })
})

describe('streaming (research D8)', () => {
    const aba = { nome: 'Saídas', colunas: COLUNAS, cabecalhoDocumento: IDENTIFICACAO }

    it('streamCsv emite o mesmo conteúdo que gerarCsv, lote a lote', async () => {
        const linhas = [
            { item: 'Arroz', saldo: 1 },
            { item: 'Feijão', saldo: 2 },
            { item: '=perigo', saldo: 3 }
        ]
        const transmitido = (await lerStream(streamCsv(aba, emLotes(linhas.slice(0, 2), linhas.slice(2))))).toString(
            'utf8'
        )
        expect(transmitido).toBe(gerarCsv({ ...aba, linhas }))
    })

    it('streamCsv sem linhas ainda entrega identificação e cabeçalho', async () => {
        const transmitido = (await lerStream(streamCsv(aba, emLotes<Linha>()))).toString('utf8')
        expect(transmitido.slice(1).split('\r\n')).toEqual([
            'Relatório;Histórico de saídas',
            'Período;01/10/2026 a 05/10/2026',
            'Gerado por;Maria',
            '',
            'Item;Saldo atual'
        ])
    })

    it('streamXlsx gera uma planilha legível com todas as linhas dos lotes', async () => {
        const buffer = await lerStream(
            streamXlsx(aba, emLotes([{ item: 'Arroz', saldo: 1 }], [{ item: 'Água', saldo: 2.5 }]))
        )
        const [planilha] = (await reler(buffer)).worksheets

        expect(planilha.name).toBe('Saídas')
        expect(valores(planilha, 1)).toEqual(['Relatório', 'Histórico de saídas'])
        expect(valores(planilha, 5)).toEqual(['Item', 'Saldo atual'])
        expect(valores(planilha, 6)).toEqual(['Arroz', 1])
        expect(valores(planilha, 7)).toEqual(['Água', 2.5])
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
