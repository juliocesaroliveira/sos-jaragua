import { randomUUID } from 'node:crypto'
import { and, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { alocacao, atividade, atividadeCategoria, turno, voluntarioPerfil } from '@/db/schema/voluntariado'
import { atividadeRepository } from '../../infrastructure/drizzle/atividade-repository'

/**
 * 018-inscricao-atividades — garantias que só o banco real prova (research D3,
 * D11): a última vaga sob concorrência, a mesma pessoa em duas abas, a
 * reativação de alocação cancelada e o backfill da migração 0004.
 *
 * Exercita o repositório direto: é nele que moram a transação e os locks.
 */

const criados = { usuarios: [] as string[], atividades: [] as string[], categorias: [] as string[] }

const agora = () => new Date()
const emHoras = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000)

/** Equipe interna sem perfil — o caminho que só existe com `participante_user_id`. */
async function criarUsuario() {
    const id = randomUUID()
    await db.insert(user).values({
        id,
        name: `Inscrição ${id.slice(0, 8)}`,
        email: `inscricao-${id.slice(0, 8)}@exemplo.test`,
        emailVerified: true,
        role: 'membro_defesa_civil'
    })
    criados.usuarios.push(id)
    return id
}

async function criarAtividade(turnos: Array<{ inicioH: number; vagas: number }>) {
    const criador = await criarUsuario()
    const [categoria] = await db
        .insert(atividadeCategoria)
        .values({ nome: `Categoria ${randomUUID().slice(0, 8)}` })
        .returning({ id: atividadeCategoria.id })
    criados.categorias.push(categoria.id)

    const [linha] = await db
        .insert(atividade)
        .values({ titulo: 'Teste de inscrição', categoriaId: categoria.id, local: 'Centro', criadoPor: criador })
        .returning({ id: atividade.id })
    criados.atividades.push(linha.id)

    const ids = await db
        .insert(turno)
        .values(
            turnos.map((t) => ({
                atividadeId: linha.id,
                inicio: emHoras(t.inicioH),
                fim: emHoras(t.inicioH + 4),
                vagas: t.vagas
            }))
        )
        .returning({ id: turno.id })
    return ids.map((t) => t.id)
}

function inscrever(turnoId: string, participanteUserId: string) {
    return atividadeRepository.inscreverComTrava({
        turnoId,
        participanteUserId,
        voluntarioPerfilId: null,
        agora: agora()
    })
}

async function confirmadosNoTurno(turnoId: string) {
    return db
        .select({ participante: alocacao.participanteUserId, origem: alocacao.origem })
        .from(alocacao)
        .where(and(eq(alocacao.turnoId, turnoId), eq(alocacao.status, 'confirmado')))
}

afterEach(async () => {
    // `turno` e `alocacao` caem por cascade da atividade; usuários por último
    // porque `atividade.criado_por` e `alocacao.alocado_por` os referenciam.
    if (criados.atividades.length) await db.delete(atividade).where(inArray(atividade.id, criados.atividades.splice(0)))
    if (criados.categorias.length) {
        await db.delete(atividadeCategoria).where(inArray(atividadeCategoria.id, criados.categorias.splice(0)))
    }
    if (criados.usuarios.length) await db.delete(user).where(inArray(user.id, criados.usuarios.splice(0)))
})

describe('inscreverComTrava (integração)', () => {
    it('5 pessoas disputando a última vaga: exatamente 1 entra (SC-003)', async () => {
        const [turnoId] = await criarAtividade([{ inicioH: 24, vagas: 1 }])
        const pessoas = await Promise.all(Array.from({ length: 5 }, criarUsuario))

        const resultados = await Promise.all(pessoas.map((p) => inscrever(turnoId, p)))

        expect(resultados.filter((r) => r.ok)).toHaveLength(1)
        const recusas = resultados.filter((r) => !r.ok).map((r) => (r.ok ? null : r.motivo))
        expect(recusas).toEqual(['lotado', 'lotado', 'lotado', 'lotado'])

        const confirmados = await confirmadosNoTurno(turnoId)
        expect(confirmados).toHaveLength(1)
        expect(confirmados[0].origem).toBe('inscricao_propria')
    })

    it('a mesma pessoa 2× em paralelo no mesmo turno: 1 linha, a outra recebe ja_inscrito', async () => {
        const [turnoId] = await criarAtividade([{ inicioH: 24, vagas: 5 }])
        const pessoa = await criarUsuario()

        const resultados = await Promise.all([inscrever(turnoId, pessoa), inscrever(turnoId, pessoa)])

        expect(resultados.filter((r) => r.ok)).toHaveLength(1)
        expect(resultados.find((r) => !r.ok)).toMatchObject({ ok: false, motivo: 'ja_inscrito' })
        expect(await confirmadosNoTurno(turnoId)).toHaveLength(1)
    })

    it('a mesma pessoa em duas abas, turnos diferentes e sobrepostos: 1 entra, a outra recebe conflito_horario', async () => {
        // Dois turnos de atividades distintas no mesmo horário.
        const [turnoA] = await criarAtividade([{ inicioH: 24, vagas: 5 }])
        const [turnoB] = await criarAtividade([{ inicioH: 26, vagas: 5 }])
        const pessoa = await criarUsuario()

        const resultados = await Promise.all([inscrever(turnoA, pessoa), inscrever(turnoB, pessoa)])

        expect(resultados.filter((r) => r.ok)).toHaveLength(1)
        expect(resultados.find((r) => !r.ok)).toMatchObject({ ok: false, motivo: 'conflito_horario' })
    })

    it('turnos encostados da mesma pessoa são aceitos', async () => {
        const [primeiro, segundo] = await criarAtividade([
            { inicioH: 24, vagas: 5 },
            { inicioH: 28, vagas: 5 }
        ])
        const pessoa = await criarUsuario()

        expect((await inscrever(primeiro, pessoa)).ok).toBe(true)
        expect((await inscrever(segundo, pessoa)).ok).toBe(true)
    })

    it('desistir e se inscrever de novo reativa a mesma linha', async () => {
        const [turnoId] = await criarAtividade([{ inicioH: 24, vagas: 1 }])
        const pessoa = await criarUsuario()

        const primeira = await inscrever(turnoId, pessoa)
        expect(primeira.ok).toBe(true)
        if (!primeira.ok) return

        await atividadeRepository.cancelarAlocacao(primeira.alocacaoId)
        const segunda = await inscrever(turnoId, pessoa)

        expect(segunda).toMatchObject({ ok: true, alocacaoId: primeira.alocacaoId })
    })

    it('turno já iniciado é recusado', async () => {
        const [turnoId] = await criarAtividade([{ inicioH: -1, vagas: 5 }])
        const pessoa = await criarUsuario()

        expect(await inscrever(turnoId, pessoa)).toMatchObject({ ok: false, motivo: 'turno_iniciado' })
    })
})

describe('migração 0004 — backfill de participante_user_id', () => {
    it('toda alocação com perfil aponta para o user do próprio perfil', async () => {
        const [divergentes] = await db
            .select({ total: sql<number>`count(*)::int` })
            .from(alocacao)
            .innerJoin(voluntarioPerfil, eq(voluntarioPerfil.id, alocacao.voluntarioPerfilId))
            .where(
                and(isNotNull(alocacao.voluntarioPerfilId), ne(alocacao.participanteUserId, voluntarioPerfil.userId))
            )

        expect(divergentes.total).toBe(0)
    })
})
