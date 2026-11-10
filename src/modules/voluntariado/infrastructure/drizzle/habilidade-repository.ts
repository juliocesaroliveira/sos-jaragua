import { asc, count, eq, ne, sql } from 'drizzle-orm'
import { db, type Transacao, ordemAlfabetica } from '@/src/shared/db/postgres'
import { habilidade, voluntarioHabilidade } from '@/db/schema/voluntariado'
import { DuplicadoError, VinculoExistenteError } from '../../domain/habilidade'
import type { Habilidade, HabilidadeRepository } from '../../application/ports/habilidade-repository'

/**
 * Implementação Drizzle do port de Habilidade (017-gestao-habilidades).
 *
 * Concentra a tradução dos códigos de erro do Postgres para erros de domínio —
 * `23505` (índice único) e `23503` (violação de FK). Isso mora aqui, e não no
 * caso de uso, porque é detalhe do driver: o `application/` só conhece
 * `DuplicadoError` e `VinculoExistenteError` (Princípio I).
 */
type Executor = typeof db | Transacao

/** Códigos SQLSTATE que o banco usa para as duas invariantes desta feature. */
const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'

/**
 * SQLSTATE do erro, procurado também na cadeia de `cause`.
 *
 * O drizzle-orm (desde 0.44) embrulha o erro do driver num `DrizzleQueryError`
 * ("Failed query: ...") e guarda o original do Postgres em `cause` — ler só o
 * `code` do erro externo deixava as violações sem tradução e o usuário recebia
 * um erro genérico em vez de "já existe" / "está em uso".
 */
function codigoPostgres(erro: unknown): string | undefined {
    for (let atual = erro, profundidade = 0; profundidade < 5; profundidade++) {
        if (typeof atual !== 'object' || atual === null) return undefined
        if ('code' in atual && typeof atual.code === 'string') return atual.code
        atual = 'cause' in atual ? atual.cause : undefined
    }
    return undefined
}

/** Ordem alfabética do português; o `id` desempata para a paginação ser estável. */
const ORDEM_POR_NOME = [ordemAlfabetica(habilidade.nome), asc(habilidade.id)] as const

/**
 * A checagem prévia no caso de uso cobre o caso comum; esta tradução cobre a
 * corrida em que duas criações passam pela checagem e só o índice único separa
 * as duas (research.md D3). O cliente não distingue os dois caminhos.
 */
async function traduzindoErros<T>(fn: () => Promise<T>): Promise<T> {
    try {
        return await fn()
    } catch (erro) {
        const codigo = codigoPostgres(erro)
        if (codigo === UNIQUE_VIOLATION) throw new DuplicadoError()
        if (codigo === FOREIGN_KEY_VIOLATION) throw new VinculoExistenteError()
        throw erro
    }
}

const COLUNAS = { id: habilidade.id, nome: habilidade.nome, criadoEm: habilidade.criadoEm }

function paraHabilidade(linha: { id: string; nome: string; criadoEm: Date }): Habilidade {
    return { ...linha, criadoEm: linha.criadoEm.toISOString() }
}

export function criarHabilidadeRepository(executor: Executor = db): HabilidadeRepository {
    return {
        async listar({ page, pageSize }) {
            const [linhas, [total]] = await Promise.all([
                executor
                    .select({
                        ...COLUNAS,
                        // `count` da coluna do lado direito do LEFT JOIN — conta 0
                        // para habilidades sem vínculo, que é exatamente o caso
                        // relevante na tela (são as excluíveis).
                        voluntariosVinculados: count(voluntarioHabilidade.id)
                    })
                    .from(habilidade)
                    .leftJoin(voluntarioHabilidade, eq(voluntarioHabilidade.habilidadeId, habilidade.id))
                    .groupBy(habilidade.id)
                    .orderBy(...ORDEM_POR_NOME)
                    .limit(pageSize)
                    .offset((page - 1) * pageSize),
                executor.select({ total: count() }).from(habilidade)
            ])

            return {
                rows: linhas.map((l) => ({ ...paraHabilidade(l), voluntariosVinculados: l.voluntariosVinculados })),
                totalCount: total?.total ?? 0
            }
        },

        async buscarPorId(id) {
            const [linha] = await executor.select(COLUNAS).from(habilidade).where(eq(habilidade.id, id)).limit(1)
            return linha ? paraHabilidade(linha) : null
        },

        async buscarPorNomeNormalizado(nome, ignorarId) {
            // `lower()` dos dois lados, espelhando o índice único — é o que faz
            // esta consulta usar o índice em vez de varrer a tabela.
            const mesmoNome = sql`lower(${habilidade.nome}) = lower(${nome})`
            const [linha] = await executor
                .select(COLUNAS)
                .from(habilidade)
                .where(ignorarId ? sql`${mesmoNome} and ${ne(habilidade.id, ignorarId)}` : mesmoNome)
                .limit(1)
            return linha ? paraHabilidade(linha) : null
        },

        async contarVinculos(id) {
            const [linha] = await executor
                .select({ total: count() })
                .from(voluntarioHabilidade)
                .where(eq(voluntarioHabilidade.habilidadeId, id))
            return linha?.total ?? 0
        },

        async criar({ nome }) {
            return traduzindoErros(async () => {
                const [linha] = await executor.insert(habilidade).values({ nome }).returning(COLUNAS)
                return paraHabilidade(linha!)
            })
        },

        async atualizar({ id, nome }) {
            return traduzindoErros(async () => {
                const [linha] = await executor
                    .update(habilidade)
                    .set({ nome })
                    .where(eq(habilidade.id, id))
                    .returning(COLUNAS)
                return linha ? paraHabilidade(linha) : null
            })
        },

        async excluir(id) {
            return traduzindoErros(async () => {
                const linhas = await executor
                    .delete(habilidade)
                    .where(eq(habilidade.id, id))
                    .returning({ id: habilidade.id })
                return linhas.length > 0
            })
        }
    }
}
