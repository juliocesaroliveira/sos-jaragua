import 'server-only'
import { inventarioParaExportacao } from '@/src/modules/estoque/presentation/queries/estoque'
import { COLUNAS_INVENTARIO } from './relatorios'
import type { Aba } from '../infrastructure/planilha'

/**
 * Pacote de Contingência (BR-CON-01, DESIGN.md §15).
 *
 * Quatro abas: o saldo real no momento do download e três formulários **em
 * branco** para anotação manual. O objetivo é a transição imediata para papel
 * quando a conexão cai — por isso as abas em branco trazem só cabeçalhos, sem
 * fórmula ou validação que não sobreviveria à impressão.
 */
type LinhaEmBranco = Record<string, never>

/** Linhas vazias para o operador preencher à mão depois de imprimir. */
const LINHAS_EM_BRANCO = 40

function formulario(nome: string, cabecalhos: { cabecalho: string; largura?: number }[]): Aba<LinhaEmBranco> {
    return {
        nome,
        colunas: cabecalhos.map((c) => ({ ...c, valor: () => null })),
        // O XLSX precisa das linhas materializadas: uma aba só com cabeçalho
        // não dá ao operador onde escrever ao imprimir.
        linhas: Array.from({ length: LINHAS_EM_BRANCO }, () => ({}) as LinhaEmBranco)
    }
}

export async function montarPacoteContingencia(): Promise<Aba<never>[]> {
    const inventario = await inventarioParaExportacao()

    return [
        // 1. Saldo exato no momento do download.
        { nome: 'Estoque atual', colunas: COLUNAS_INVENTARIO, linhas: inventario },

        // 2. Entradas — espelha os campos do BRD §4.1.
        formulario('Entradas (em branco)', [
            { cabecalho: 'Data', largura: 14 },
            { cabecalho: 'Item', largura: 34 },
            { cabecalho: 'Categoria', largura: 22 },
            { cabecalho: 'Condição', largura: 24 },
            { cabecalho: 'Quantidade', largura: 14 },
            { cabecalho: 'Unidade', largura: 12 },
            { cabecalho: 'Perecível (S/N)', largura: 16 },
            { cabecalho: 'Validade', largura: 14 },
            { cabecalho: 'Registrado por', largura: 24 }
        ]),

        // 3. Saídas — espelha os campos do BRD §4.3.
        formulario('Saídas (em branco)', [
            { cabecalho: 'Data', largura: 14 },
            { cabecalho: 'Tipo (Avulso/Kit)', largura: 18 },
            { cabecalho: 'Item ou Kit', largura: 34 },
            { cabecalho: 'Quantidade', largura: 14 },
            { cabecalho: 'Unidade', largura: 12 },
            { cabecalho: 'Destino', largura: 30 },
            { cabecalho: 'Responsável pelo transporte', largura: 28 }
        ]),

        // 4. Turnos de voluntários — espelha BR-VOL-04/05.
        formulario('Turnos (em branco)', [
            { cabecalho: 'Data', largura: 14 },
            { cabecalho: 'Atividade', largura: 30 },
            { cabecalho: 'Local', largura: 28 },
            { cabecalho: 'Turno (início – fim)', largura: 22 },
            { cabecalho: 'Vagas', largura: 10 },
            { cabecalho: 'Voluntário', largura: 30 },
            { cabecalho: 'Telefone', largura: 18 },
            { cabecalho: 'Presença (S/N)', largura: 16 }
        ])
    ] as unknown as Aba<never>[]
}
