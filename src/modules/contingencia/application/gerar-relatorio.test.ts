import { describe, expect, it } from 'vitest'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { DomainError } from '@/src/shared/kernel'
import { definirRelatorio, registrar, type ConsultaRelatorio, type RelatorioRegistrado } from './definicao-relatorio'
import { GerarRelatorioUseCase, LIMITE_EXPORTACAO } from './gerar-relatorio'

/**
 * Caso de uso genérico da central (specs/023-central-relatorios, research D2,
 * D8; data-model.md §1 e §3).
 *
 * As definições aqui são falsas e em memória de propósito: o que se testa é o
 * contrato comum — paginação, formatação, cabeçalho do documento, teto de
 * exportação e lotes —, que vale igual para os 17 relatórios. As consultas de
 * cada módulo têm seus próprios testes de integração.
 */

type Linha = { n: number; nome: string; detalhe?: string }

// 08/10/2026 15:00 UTC = 12:00 em Brasília.
const AGORA = new Date(Date.UTC(2026, 9, 8, 15, 0))
const ATOR = { nome: 'Maria Souza' }

function linhas(total: number): Linha[] {
    return Array.from({ length: total }, (_, i) => ({ n: i + 1, nome: `Item ${i + 1}` }))
}

/** Uma definição falsa sobre `dados`, com um filtro opcional e um com validação. */
function definicaoFalsa(dados: Linha[], opcoes: { slug?: 'saidas' | 'inventario'; registro?: Consultas[] } = {}) {
    const registro = opcoes.registro ?? []
    return definirRelatorio({
        slug: opcoes.slug ?? 'saidas',
        camposFiltro: [{ nome: 'minimo', rotulo: 'Mínimo', tipo: 'numero' }],
        esquemaFiltros: z.object({
            // Opcional e tolerante: valor inválido vira ausente.
            minimo: z.coerce.number().int().optional().catch(undefined),
            // Com validação: valor inválido é erro mostrado no campo.
            horizonte: z.coerce.number().int().min(1, 'Informe entre 1 e 365 dias.').max(365).optional()
        }),
        colunas: [
            { cabecalho: 'Número', valor: (l: Linha) => l.n, largura: 10 },
            { cabecalho: 'Nome', valor: (l: Linha) => l.nome }
        ],
        async contar(c) {
            registro.push(c)
            return filtrar(dados, c).length
        },
        async carregar(c, { limite, deslocamento }) {
            return filtrar(dados, c).slice(deslocamento, deslocamento + limite)
        },
        async resumo(c) {
            return [{ rotulo: 'Total', valor: filtrar(dados, c).length }]
        },
        detalhe: (l) =>
            l.detalhe ? [{ campo: 'nome', antes: l.detalhe, depois: l.nome, tipo: 'alterado' as const }] : [],
        descreverFiltros: (f) => (f.minimo !== undefined ? [{ rotulo: 'Mínimo', valor: String(f.minimo) }] : [])
    })
}

type Consultas = ConsultaRelatorio<{ minimo?: number; horizonte?: number }>

function filtrar(dados: Linha[], c: Consultas) {
    return dados.filter((l) => c.filtros.minimo === undefined || l.n >= c.filtros.minimo)
}

function casoDeUso(...relatorios: RelatorioRegistrado[]) {
    const mapa = new Map(relatorios.map((r) => [r.slug, r]))
    return new GerarRelatorioUseCase((slug) => mapa.get(slug as never), 2_000)
}

async function coletar<T>(lotes: AsyncIterable<T[]>): Promise<T[][]> {
    const todos: T[][] = []
    for await (const lote of lotes) todos.push(lote)
    return todos
}

describe('pagina()', () => {
    it('formata as células com as colunas da definição e devolve a página pedida', async () => {
        const uc = casoDeUso(registrar(definicaoFalsa(linhas(12))))
        const resultado = await uc.pagina('saidas', { page: '2', pageSize: '5' }, AGORA)

        expect(resultado.ok).toBe(true)
        if (!resultado.ok) return
        expect(resultado.valor.colunas).toEqual(['Número', 'Nome'])
        expect(resultado.valor.rows.map((r) => r.celulas)).toEqual([
            [6, 'Item 6'],
            [7, 'Item 7'],
            [8, 'Item 8'],
            [9, 'Item 9'],
            [10, 'Item 10']
        ])
        expect(resultado.valor).toMatchObject({ totalCount: 12, page: 2, pageSize: 5 })
        expect(resultado.valor.resumo).toEqual([{ rotulo: 'Total', valor: 12 }])
    })

    it('corrige página além do fim para a última página válida', async () => {
        const uc = casoDeUso(registrar(definicaoFalsa(linhas(7))))
        const resultado = await uc.pagina('saidas', { page: '9', pageSize: '5' }, AGORA)

        expect(resultado.ok && resultado.valor.page).toBe(2)
        expect(resultado.ok && resultado.valor.rows.map((r) => r.celulas[0])).toEqual([6, 7])
    })

    it('aplica filtros da definição e o período padrão (últimos 30 dias)', async () => {
        const registro: Consultas[] = []
        const uc = casoDeUso(registrar(definicaoFalsa(linhas(10), { registro })))
        const resultado = await uc.pagina('saidas', { minimo: '9' }, AGORA)

        expect(resultado.ok && resultado.valor.totalCount).toBe(2)
        expect(registro[0].periodo).toEqual({ de: '2026-09-09', ate: '2026-10-08' })
        expect(registro[0].intervalo?.inicio.toISOString()).toBe('2026-09-09T03:00:00.000Z')
        expect(registro[0].hoje).toBe('2026-10-08')
    })

    it('relatório sem período não recebe intervalo', async () => {
        const registro: Consultas[] = []
        const uc = casoDeUso(registrar(definicaoFalsa(linhas(3), { slug: 'inventario', registro })))
        await uc.pagina('inventario', { de: '2026-10-01' }, AGORA)

        expect(registro[0].periodo).toBeNull()
        expect(registro[0].intervalo).toBeNull()
    })

    it('filtro opcional inválido é ignorado em vez de virar erro', async () => {
        const uc = casoDeUso(registrar(definicaoFalsa(linhas(4))))
        const resultado = await uc.pagina('saidas', { minimo: 'abc' }, AGORA)
        expect(resultado.ok && resultado.valor.totalCount).toBe(4)
    })

    it('período inválido é erro de validação no campo, sem consultar', async () => {
        const registro: Consultas[] = []
        const uc = casoDeUso(registrar(definicaoFalsa(linhas(4), { registro })))
        const resultado = await uc.pagina('saidas', { de: '2026-10-06', ate: '2026-10-05' }, AGORA)

        expect(resultado.ok).toBe(false)
        if (resultado.ok) return
        expect(resultado.erro.codigo).toBe('validacao')
        expect(resultado.erro.detalhes).toEqual({
            campos: { de: 'A data inicial deve ser anterior ou igual à final.' }
        })
        expect(registro).toHaveLength(0)
    })

    it('filtro com validação própria devolve o erro no campo', async () => {
        const uc = casoDeUso(registrar(definicaoFalsa(linhas(4))))
        const resultado = await uc.pagina('saidas', { horizonte: '0' }, AGORA)

        expect(resultado.ok).toBe(false)
        if (resultado.ok) return
        expect(resultado.erro.codigo).toBe('validacao')
        expect(resultado.erro.detalhes).toEqual({ campos: { horizonte: 'Informe entre 1 e 365 dias.' } })
    })

    it('relatório desconhecido ou não registrado é `relatorio_invalido`', async () => {
        const uc = casoDeUso(registrar(definicaoFalsa(linhas(1))))
        for (const slug of ['nao-existe', 'auditoria']) {
            const resultado = await uc.pagina(slug, {}, AGORA)
            expect(resultado.ok === false && resultado.erro.codigo, slug).toBe('relatorio_invalido')
        }
    })

    it('sinaliza quando o total passa do limite de exportação', async () => {
        const uc = casoDeUso(registrar(definicaoFalsa(linhas(LIMITE_EXPORTACAO + 1))))
        const resultado = await uc.pagina('saidas', {}, AGORA)
        expect(resultado.ok && resultado.valor.excedeLimiteExportacao).toBe(true)
    })

    it('preenche o detalhe da linha quando a definição o fornece', async () => {
        const dados = [
            { n: 1, nome: 'Novo', detalhe: 'Antigo' },
            { n: 2, nome: 'Igual' }
        ]
        const uc = casoDeUso(registrar(definicaoFalsa(dados)))
        const resultado = await uc.pagina('saidas', {}, AGORA)

        expect(resultado.ok && resultado.valor.rows[0].detalhe).toEqual([
            { campo: 'nome', antes: 'Antigo', depois: 'Novo', tipo: 'alterado' }
        ])
        expect(resultado.ok && resultado.valor.rows[1].detalhe).toBeUndefined()
    })

    it('erro de domínio lançado pela consulta vira falha com o mesmo código', async () => {
        const quebrada = registrar(
            definirRelatorio({
                ...definicaoFalsa([]),
                async contar() {
                    throw new DomainError(
                        'auditoria_indisponivel',
                        'A trilha de auditoria está indisponível no momento.'
                    )
                }
            })
        )
        const resultado = await casoDeUso(quebrada).pagina('saidas', {}, AGORA)
        expect(resultado.ok === false && resultado.erro.codigo).toBe('auditoria_indisponivel')
    })
})

describe('completo() — exportação', () => {
    it('monta o cabeçalho do documento na ordem de data-model.md §3', async () => {
        const uc = casoDeUso(registrar(definicaoFalsa(linhas(3))))
        const resultado = await uc.completo('saidas', { minimo: '2', de: '2026-10-01', ate: '2026-10-05' }, ATOR, AGORA)

        expect(resultado.ok).toBe(true)
        if (!resultado.ok) return
        expect(resultado.valor.aba.nome).toBe('Histórico de saídas')
        expect(resultado.valor.aba.cabecalhoDocumento).toEqual([
            { rotulo: 'Relatório', valor: 'Histórico de saídas' },
            { rotulo: 'Período', valor: '01/10/2026 a 05/10/2026' },
            { rotulo: 'Mínimo', valor: '2' },
            { rotulo: 'Gerado em', valor: '08/10/2026, 12:00' },
            { rotulo: 'Gerado por', valor: 'Maria Souza' },
            { rotulo: 'Total de linhas', valor: '2' }
        ])
        expect(resultado.valor.aba.resumo).toEqual([{ rotulo: 'Total', valor: 2 }])
        expect(resultado.valor.aba.colunas.map((c) => c.cabecalho)).toEqual(['Número', 'Nome'])
    })

    it('relatório sem período mostra "—" no período', async () => {
        const uc = casoDeUso(registrar(definicaoFalsa(linhas(1), { slug: 'inventario' })))
        const resultado = await uc.completo('inventario', {}, ATOR, AGORA)
        expect(resultado.ok && resultado.valor.aba.cabecalhoDocumento?.[1]).toEqual({ rotulo: 'Período', valor: '—' })
    })

    it('entrega as linhas em lotes: 5.001 linhas em lotes de 2.000 → 3 lotes', async () => {
        const uc = casoDeUso(registrar(definicaoFalsa(linhas(5_001))))
        const resultado = await uc.completo('saidas', {}, ATOR, AGORA)

        expect(resultado.ok).toBe(true)
        if (!resultado.ok) return
        const lotes = await coletar(resultado.valor.lotes)
        expect(lotes.map((l) => l.length)).toEqual([2_000, 2_000, 1_001])
        expect(lotes.flat()[5_000]).toEqual([5_001, 'Item 5001'])

        // As colunas da aba leem a célula pelo índice.
        expect(resultado.valor.aba.colunas[1].valor(lotes[0][0])).toBe('Item 1')
    })

    it('com 0 linhas a exportação é permitida (só cabeçalho)', async () => {
        const uc = casoDeUso(registrar(definicaoFalsa([])))
        const resultado = await uc.completo('saidas', {}, ATOR, AGORA)

        expect(resultado.ok).toBe(true)
        if (!resultado.ok) return
        expect(resultado.valor.totalLinhas).toBe(0)
        expect(await coletar(resultado.valor.lotes)).toEqual([])
    })

    it(`recusa acima de ${LIMITE_EXPORTACAO} linhas com \`limite_exportacao\``, async () => {
        const uc = casoDeUso(registrar(definicaoFalsa(linhas(LIMITE_EXPORTACAO + 1))))
        const resultado = await uc.completo('saidas', {}, ATOR, AGORA)

        expect(resultado.ok).toBe(false)
        if (resultado.ok) return
        expect(resultado.erro.codigo).toBe('limite_exportacao')
        expect(resultado.erro.message).toBe(
            'O relatório tem 50.001 linhas, acima do limite de 50.000 para exportação. Reduza o período.'
        )
    })

    it('período inválido é erro de validação', async () => {
        const uc = casoDeUso(registrar(definicaoFalsa(linhas(1))))
        const resultado = await uc.completo('saidas', { de: 'ontem' }, ATOR, AGORA)
        expect(resultado.ok === false && resultado.erro.codigo).toBe('validacao')
    })
})
