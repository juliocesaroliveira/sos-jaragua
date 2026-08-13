import { desc, eq } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { criseVariaveis, metricaKit } from '@/db/schema/logistica'
import { paraNumero } from '@/src/modules/estoque/domain/quantidade'
import { listarKitsComReceita, saldoPorItem } from '@/src/modules/estoque/presentation/queries/estoque'
import type {
    CriseRepository,
    CriseVariaveis,
    EstoqueQueryPort,
    MetricaKitConfigurada,
    MetricaKitRepository
} from '../../application/ports/logistica-repository'
import type { BaseDemanda } from '../../domain/projecao'

const COLUNAS_CRISE = {
    id: criseVariaveis.id,
    totalFamiliasAfetadas: criseVariaveis.totalFamiliasAfetadas,
    totalPessoasAfetadas: criseVariaveis.totalPessoasAfetadas,
    atualizadoEm: criseVariaveis.atualizadoEm
}

function paraCrise(linha: {
    id: string
    totalFamiliasAfetadas: number
    totalPessoasAfetadas: number
    atualizadoEm: Date
}): CriseVariaveis {
    return { ...linha, atualizadoEm: linha.atualizadoEm.toISOString() }
}

export const criseRepository: CriseRepository = {
    async vigente() {
        const [linha] = await db
            .select(COLUNAS_CRISE)
            .from(criseVariaveis)
            .orderBy(desc(criseVariaveis.atualizadoEm))
            .limit(1)
        return linha ? paraCrise(linha) : null
    },

    async registrar({ totalFamiliasAfetadas, totalPessoasAfetadas, atualizadoPor }) {
        // Append-only (DB_SCHEMA.md §7.1): cada atualização é uma linha nova. O
        // histórico da evolução da crise sai de graça, sem tabela de auditoria
        // dedicada para esta entidade.
        const [linha] = await db
            .insert(criseVariaveis)
            .values({ totalFamiliasAfetadas, totalPessoasAfetadas, atualizadoPor })
            .returning(COLUNAS_CRISE)
        return paraCrise(linha)
    },

    async historico(limite = 20) {
        const linhas = await db
            .select(COLUNAS_CRISE)
            .from(criseVariaveis)
            .orderBy(desc(criseVariaveis.atualizadoEm))
            .limit(limite)
        return linhas.map(paraCrise)
    }
}

export const metricaKitRepository: MetricaKitRepository = {
    async listar() {
        const linhas = await db
            .select({
                id: metricaKit.id,
                kitId: metricaKit.kitId,
                baseDemanda: metricaKit.baseDemanda,
                proporcao: metricaKit.proporcao
            })
            .from(metricaKit)

        return linhas.map((l) => ({
            ...l,
            baseDemanda: l.baseDemanda as BaseDemanda,
            proporcao: paraNumero(l.proporcao)
        }))
    },

    async definir({ kitId, baseDemanda, proporcao }) {
        // `unique(kitId)` no schema: um kit tem no máximo uma métrica de
        // demanda, então o upsert é a operação natural.
        const [linha] = await db
            .insert(metricaKit)
            .values({ kitId, baseDemanda, proporcao: String(proporcao) })
            .onConflictDoUpdate({
                target: metricaKit.kitId,
                set: { baseDemanda, proporcao: String(proporcao) }
            })
            .returning({
                id: metricaKit.id,
                kitId: metricaKit.kitId,
                baseDemanda: metricaKit.baseDemanda,
                proporcao: metricaKit.proporcao
            })

        return {
            ...linha,
            baseDemanda: linha.baseDemanda as BaseDemanda,
            proporcao: paraNumero(linha.proporcao)
        } satisfies MetricaKitConfigurada
    },

    async remover(kitId) {
        await db.delete(metricaKit).where(eq(metricaKit.kitId, kitId))
    }
}

/**
 * Implementação do `EstoqueQueryPort`: Logística lê Estoque **pelas queries
 * públicas** do módulo, nunca pelos repositórios internos (DESIGN.md §3).
 *
 * Como reusa as queries cacheadas de Estoque, o painel herda de graça a
 * invalidação por entrada/saída/descarte já configurada lá.
 */
export const estoqueQueryPort: EstoqueQueryPort = {
    async kitsComReceita() {
        const kits = await listarKitsComReceita()
        return kits.map((k) => ({
            kitId: k.id,
            nome: k.nome,
            ativo: k.ativo,
            componentes: k.componentes.map((c) => ({
                itemId: c.itemId,
                nome: c.nome,
                quantidadePorKit: c.quantidadePorKit
            }))
        }))
    },

    saldoPorItem() {
        return saldoPorItem()
    }
}
