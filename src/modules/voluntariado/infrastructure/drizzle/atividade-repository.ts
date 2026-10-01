import { and, count, eq, gt, lt, ne, sql } from 'drizzle-orm'
import { db, type Transacao } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { alocacao, atividade, turno, voluntarioPerfil } from '@/db/schema/voluntariado'
import { validarInscricao } from '../../domain/inscricao'
import type {
    Atividade,
    AtividadeRepository,
    DestinatarioAlocacao,
    EntradaAlocacao,
    ResultadoInscricao,
    Turno
} from '../../application/ports/atividade-repository'

const COLUNAS_ATIVIDADE = {
    id: atividade.id,
    titulo: atividade.titulo,
    categoriaId: atividade.categoriaId,
    local: atividade.local,
    status: atividade.status,
    criadoPor: atividade.criadoPor
}

const COLUNAS_TURNO = {
    id: turno.id,
    atividadeId: turno.atividadeId,
    inicio: turno.inicio,
    fim: turno.fim,
    vagas: turno.vagas
}

/**
 * Nome exibido do participante: o do perfil de voluntário quando existe, o da
 * conta para a equipe interna sem perfil (research D1). Leitura de `user`
 * restrita a colunas de exibição — exceção documentada no plan.md
 * (Complexity Tracking, Princípio I).
 */
const NOME_PARTICIPANTE = sql<string>`coalesce(${voluntarioPerfil.nomeCompleto}, ${user.name})`

type MotivoRecusa = Extract<ResultadoInscricao, { ok: false }>['motivo']

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

    async alocar(entrada) {
        // `unique(turnoId, participanteUserId)` é a garantia real contra
        // alocação duplicada (BR-VOL-05); o conflito devolve lista vazia.
        // Uma alocação antes cancelada volta a `confirmado` na mesma linha.
        const [linha] = await upsertAlocacao(db, entrada)
        return linha ? { alocacaoId: linha.id } : null
    },

    async inscreverComTrava({ turnoId, participanteUserId, voluntarioPerfilId, agora }) {
        return db.transaction(async (tx): Promise<ResultadoInscricao> => {
            // Ordem fixa dos locks (participante → turno) — sem deadlock entre
            // eles (research D3). O consultivo serializa a mesma pessoa em
            // duas abas; o `FOR UPDATE` serializa a disputa pela última vaga.
            await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${participanteUserId}))`)

            const [turnoTravado] = await tx.select(COLUNAS_TURNO).from(turno).where(eq(turno.id, turnoId)).for('update')
            if (!turnoTravado) return { ok: false, motivo: 'nao_encontrado', mensagem: 'Turno não encontrado.' }

            const [atividadeDoTurno] = await tx
                .select(COLUNAS_ATIVIDADE)
                .from(atividade)
                .where(eq(atividade.id, turnoTravado.atividadeId))
                .limit(1)
            if (!atividadeDoTurno) {
                return { ok: false, motivo: 'nao_encontrado', mensagem: 'Atividade não encontrada.' }
            }

            const [contagem] = await tx
                .select({ total: count() })
                .from(alocacao)
                .where(and(eq(alocacao.turnoId, turnoId), eq(alocacao.status, 'confirmado')))

            const [jaInscrito] = await tx
                .select({ id: alocacao.id })
                .from(alocacao)
                .where(
                    and(
                        eq(alocacao.turnoId, turnoId),
                        eq(alocacao.participanteUserId, participanteUserId),
                        eq(alocacao.status, 'confirmado')
                    )
                )
                .limit(1)

            // Só os turnos que podem conflitar — a decisão final é do domínio.
            const outrosTurnos = await tx
                .select({ titulo: atividade.titulo, inicio: turno.inicio, fim: turno.fim })
                .from(alocacao)
                .innerJoin(turno, eq(turno.id, alocacao.turnoId))
                .innerJoin(atividade, eq(atividade.id, turno.atividadeId))
                .where(
                    and(
                        eq(alocacao.participanteUserId, participanteUserId),
                        eq(alocacao.status, 'confirmado'),
                        ne(alocacao.turnoId, turnoId),
                        lt(turno.inicio, turnoTravado.fim),
                        gt(turno.fim, turnoTravado.inicio)
                    )
                )

            const validacao = validarInscricao({
                turno: turnoTravado,
                atividadeAberta: atividadeDoTurno.status === 'aberta',
                confirmados: contagem?.total ?? 0,
                jaInscrito: Boolean(jaInscrito),
                outrosTurnosDoParticipante: outrosTurnos,
                agora
            })
            if (!validacao.ok) {
                return { ok: false, motivo: validacao.erro.codigo as MotivoRecusa, mensagem: validacao.erro.message }
            }

            const [linha] = await upsertAlocacao(tx, {
                turnoId,
                participanteUserId,
                voluntarioPerfilId,
                alocadoPor: participanteUserId,
                origem: 'inscricao_propria'
            })
            // Inalcançável com o lock do participante; defensivo contra o unique.
            if (!linha) return { ok: false, motivo: 'ja_inscrito', mensagem: 'Você já está inscrito neste turno.' }

            return {
                ok: true,
                alocacaoId: linha.id,
                turno: turnoTravado as Turno,
                atividade: atividadeDoTurno as Atividade
            }
        })
    },

    async buscarAlocacaoDoParticipante(alocacaoId, participanteUserId) {
        const [linha] = await db
            .select({
                alocacaoId: alocacao.id,
                status: alocacao.status,
                turno: COLUNAS_TURNO,
                atividade: COLUNAS_ATIVIDADE
            })
            .from(alocacao)
            .innerJoin(turno, eq(turno.id, alocacao.turnoId))
            .innerJoin(atividade, eq(atividade.id, turno.atividadeId))
            .where(and(eq(alocacao.id, alocacaoId), eq(alocacao.participanteUserId, participanteUserId)))
            .limit(1)
        if (!linha) return null
        return {
            alocacaoId: linha.alocacaoId,
            status: linha.status,
            turno: linha.turno as Turno,
            atividade: linha.atividade as Atividade
        }
    },

    async cancelarAlocacao(alocacaoId) {
        await db.update(alocacao).set({ status: 'cancelado' }).where(eq(alocacao.id, alocacaoId))
    },

    async destinatariosDaAtividade(atividadeId) {
        const linhas = await db
            .select({ userId: alocacao.participanteUserId, nome: NOME_PARTICIPANTE })
            .from(alocacao)
            .innerJoin(turno, eq(alocacao.turnoId, turno.id))
            .innerJoin(user, eq(user.id, alocacao.participanteUserId))
            .leftJoin(voluntarioPerfil, eq(alocacao.voluntarioPerfilId, voluntarioPerfil.id))
            .where(and(eq(turno.atividadeId, atividadeId), eq(alocacao.status, 'confirmado')))

        // Um voluntário pode ocupar vários turnos da mesma atividade — avisar
        // uma vez só.
        const porUsuario = new Map<string, DestinatarioAlocacao>()
        for (const linha of linhas) porUsuario.set(linha.userId, linha)
        return [...porUsuario.values()]
    },

    async destinatarioDaAlocacao(alocacaoId) {
        const [linha] = await db
            .select({ userId: alocacao.participanteUserId, nome: NOME_PARTICIPANTE })
            .from(alocacao)
            .innerJoin(user, eq(user.id, alocacao.participanteUserId))
            .leftJoin(voluntarioPerfil, eq(alocacao.voluntarioPerfilId, voluntarioPerfil.id))
            .where(eq(alocacao.id, alocacaoId))
            .limit(1)
        return linha ?? null
    }
}

/**
 * Insere a alocação ou reativa a cancelada da mesma pessoa no mesmo turno,
 * atualizando origem e autor. Uma alocação **confirmada** não é tocada: o
 * conflito devolve lista vazia.
 */
function upsertAlocacao(
    executor: typeof db | Transacao,
    { turnoId, participanteUserId, voluntarioPerfilId, alocadoPor, origem }: EntradaAlocacao
) {
    return executor
        .insert(alocacao)
        .values({ turnoId, participanteUserId, voluntarioPerfilId, alocadoPor, origem, status: 'confirmado' })
        .onConflictDoUpdate({
            target: [alocacao.turnoId, alocacao.participanteUserId],
            set: { status: 'confirmado', alocadoPor, origem, voluntarioPerfilId, lembreteEnviadoEm: null },
            setWhere: eq(alocacao.status, 'cancelado')
        })
        .returning({ id: alocacao.id })
}
