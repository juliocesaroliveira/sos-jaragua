import { eq } from 'drizzle-orm'
import { db, type Transacao } from '@/src/shared/db/postgres'
import { criarUsuarioRepository } from '@/src/modules/identidade/infrastructure/drizzle/usuario-repository'
import { voluntarioHabilidade, voluntarioPerfil } from '@/db/schema/voluntariado'
import type {
    PerfilVoluntario,
    UnidadeDeTrabalho,
    VoluntarioRepository
} from '../../application/ports/voluntario-repository'

/**
 * Implementação Drizzle do port de Voluntariado (DESIGN.md §5).
 *
 * O port `usuarios` (leitura/escrita de `user.role`) não é implementado
 * aqui — vem de `identidade`, o módulo dono da tabela `user`
 * (006-user-management-page, research.md D6).
 */
type Executor = typeof db | Transacao

const COLUNAS_PERFIL = {
    id: voluntarioPerfil.id,
    userId: voluntarioPerfil.userId,
    nomeCompleto: voluntarioPerfil.nomeCompleto,
    cpf: voluntarioPerfil.cpf,
    status: voluntarioPerfil.status
}

export function criarVoluntarioRepository(executor: Executor = db): VoluntarioRepository {
    return {
        async buscarPorCpf(cpf) {
            const [linha] = await executor
                .select(COLUNAS_PERFIL)
                .from(voluntarioPerfil)
                .where(eq(voluntarioPerfil.cpf, cpf))
                .limit(1)
            return (linha as PerfilVoluntario) ?? null
        },

        async buscarPorId(id) {
            const [linha] = await executor
                .select(COLUNAS_PERFIL)
                .from(voluntarioPerfil)
                .where(eq(voluntarioPerfil.id, id))
                .limit(1)
            return (linha as PerfilVoluntario) ?? null
        },

        async salvarCandidatura({ userId, dados }) {
            const valores = {
                userId,
                nomeCompleto: dados.nomeCompleto,
                dataNascimento: dados.dataNascimento,
                cpf: dados.cpf,
                telefone: dados.telefone,
                cep: dados.cep,
                bairro: dados.bairro,
                profissao: dados.profissao,
                restricoesSaude: dados.restricoesSaude ?? null,
                veiculoProprio: dados.veiculoProprio,
                tipoVeiculo: dados.tipoVeiculo ?? null,
                disponibilidade: dados.disponibilidade,
                status: 'pendente' as const,
                // Reenvio de candidatura rejeitada reaproveita a linha e limpa a
                // decisão anterior (BR-VOL-01, DB_SCHEMA.md §4.2).
                aprovadoPor: null,
                aprovadoEm: null,
                motivoRejeicao: null
            }

            const [perfil] = await executor
                .insert(voluntarioPerfil)
                .values(valores)
                .onConflictDoUpdate({ target: voluntarioPerfil.userId, set: valores })
                .returning(COLUNAS_PERFIL)

            // Habilidades são substituídas por completo: a nova submissão é a
            // verdade, não um acréscimo à anterior.
            await executor.delete(voluntarioHabilidade).where(eq(voluntarioHabilidade.voluntarioPerfilId, perfil.id))
            if (dados.habilidadeIds.length > 0) {
                await executor.insert(voluntarioHabilidade).values(
                    dados.habilidadeIds.map((habilidadeId) => ({
                        voluntarioPerfilId: perfil.id,
                        habilidadeId
                    }))
                )
            }

            return perfil as PerfilVoluntario
        },

        async aprovar({ perfilId, aprovadoPor }) {
            await executor
                .update(voluntarioPerfil)
                .set({ status: 'aprovado', aprovadoPor, aprovadoEm: new Date(), motivoRejeicao: null })
                .where(eq(voluntarioPerfil.id, perfilId))
        },

        async rejeitar({ perfilId, aprovadoPor, motivo }) {
            await executor
                .update(voluntarioPerfil)
                .set({ status: 'rejeitado', aprovadoPor, aprovadoEm: new Date(), motivoRejeicao: motivo })
                .where(eq(voluntarioPerfil.id, perfilId))
        }
    }
}

/** Unidade de trabalho sobre uma transação Drizzle real. */
export const unidadeDeTrabalho: UnidadeDeTrabalho = {
    executar(fn) {
        return db.transaction((tx) =>
            fn({ voluntarios: criarVoluntarioRepository(tx), usuarios: criarUsuarioRepository(tx) })
        )
    }
}
