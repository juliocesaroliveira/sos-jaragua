import { and, count, eq } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { alocacao, atividade, turno, voluntarioPerfil } from '@/db/schema/voluntariado'
import type {
    Atividade,
    AtividadeRepository,
    DestinatarioAlocacao,
    Turno
} from '../../application/ports/atividade-repository'

const COLUNAS_ATIVIDADE = {
    id: atividade.id,
    titulo: atividade.titulo,
    categoriaId: atividade.categoriaId,
    local: atividade.local,
    status: atividade.status
}

const COLUNAS_TURNO = {
    id: turno.id,
    atividadeId: turno.atividadeId,
    inicio: turno.inicio,
    fim: turno.fim,
    vagas: turno.vagas
}

export const atividadeRepository: AtividadeRepository = {
    async criar({ titulo, categoriaId, local, criadoPor, turnos }) {
        // Atividade e turnos nascem juntos: uma atividade sem escala não é
        // acionável e deixaria a tela de alocação vazia.
        return db.transaction(async (tx) => {
            const [linha] = await tx
                .insert(atividade)
                .values({ titulo, categoriaId, local, criadoPor })
                .returning(COLUNAS_ATIVIDADE)

            if (turnos.length > 0) {
                await tx.insert(turno).values(turnos.map((t) => ({ ...t, atividadeId: linha.id })))
            }

            return linha as Atividade
        })
    },

    async buscarPorId(id) {
        const [linha] = await db.select(COLUNAS_ATIVIDADE).from(atividade).where(eq(atividade.id, id)).limit(1)
        return (linha as Atividade) ?? null
    },

    async atualizar({ id, titulo, categoriaId, local }) {
        const [linha] = await db
            .update(atividade)
            .set({ titulo, categoriaId, local })
            .where(eq(atividade.id, id))
            .returning(COLUNAS_ATIVIDADE)
        return (linha as Atividade) ?? null
    },

    async alterarStatus({ id, status }) {
        await db.update(atividade).set({ status }).where(eq(atividade.id, id))
    },

    async adicionarTurnos({ atividadeId, turnos }) {
        if (turnos.length === 0) return []
        const linhas = await db
            .insert(turno)
            .values(turnos.map((t) => ({ ...t, atividadeId })))
            .returning(COLUNAS_TURNO)
        return linhas as Turno[]
    },

    async buscarTurno(turnoId) {
        const [linha] = await db.select(COLUNAS_TURNO).from(turno).where(eq(turno.id, turnoId)).limit(1)
        return (linha as Turno) ?? null
    },

    async contarConfirmadosNoTurno(turnoId) {
        const [linha] = await db
            .select({ total: count() })
            .from(alocacao)
            .where(and(eq(alocacao.turnoId, turnoId), eq(alocacao.status, 'confirmado')))
        return linha?.total ?? 0
    },

    async alocar({ turnoId, voluntarioPerfilId, alocadoPor }) {
        // `unique(turnoId, voluntarioPerfilId)` é a garantia real contra
        // alocação duplicada (BR-VOL-05); o conflito devolve lista vazia.
        // Uma alocação antes cancelada volta a `confirmado` na mesma linha.
        const [linha] = await db
            .insert(alocacao)
            .values({ turnoId, voluntarioPerfilId, alocadoPor, status: 'confirmado' })
            .onConflictDoUpdate({
                target: [alocacao.turnoId, alocacao.voluntarioPerfilId],
                set: { status: 'confirmado', alocadoPor, lembreteEnviadoEm: null },
                setWhere: eq(alocacao.status, 'cancelado')
            })
            .returning({ id: alocacao.id })

        return linha ? { alocacaoId: linha.id } : null
    },

    async cancelarAlocacao(alocacaoId) {
        await db.update(alocacao).set({ status: 'cancelado' }).where(eq(alocacao.id, alocacaoId))
    },

    async destinatariosDaAtividade(atividadeId) {
        const linhas = await db
            .select({ userId: voluntarioPerfil.userId, nomeCompleto: voluntarioPerfil.nomeCompleto })
            .from(alocacao)
            .innerJoin(turno, eq(alocacao.turnoId, turno.id))
            .innerJoin(voluntarioPerfil, eq(alocacao.voluntarioPerfilId, voluntarioPerfil.id))
            .where(and(eq(turno.atividadeId, atividadeId), eq(alocacao.status, 'confirmado')))

        // Um voluntário pode ocupar vários turnos da mesma atividade — avisar
        // uma vez só.
        const porUsuario = new Map<string, DestinatarioAlocacao>()
        for (const linha of linhas) porUsuario.set(linha.userId, linha)
        return [...porUsuario.values()]
    },

    async destinatarioDaAlocacao(alocacaoId) {
        const [linha] = await db
            .select({ userId: voluntarioPerfil.userId, nomeCompleto: voluntarioPerfil.nomeCompleto })
            .from(alocacao)
            .innerJoin(voluntarioPerfil, eq(alocacao.voluntarioPerfilId, voluntarioPerfil.id))
            .where(eq(alocacao.id, alocacaoId))
            .limit(1)
        return linha ?? null
    }
}
