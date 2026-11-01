import { and, count, eq, gte, inArray, lt } from 'drizzle-orm'
import { db, type Transacao } from '@/src/shared/db/postgres'
import { cifrar, decifrar, ehEnvelope, indiceCego } from '@/src/shared/cripto'
import { criarUsuarioRepository } from '@/src/modules/identidade/infrastructure/drizzle/usuario-repository'
import { alocacao, turno, voluntarioHabilidade, voluntarioPerfil } from '@/db/schema/voluntariado'
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
 *
 * **Fronteira da criptografia** (feature 024): esta camada é a única que conhece
 * o envelope. A `application` e o `domain` continuam recebendo e entregando
 * `cpf`, `cep` e `dataNascimento` em claro — cifrar é uma preocupação de
 * persistência, e o Princípio I manda que ela não atravesse para dentro.
 */
type Executor = typeof db | Transacao

const COLUNAS_PERFIL = {
    id: voluntarioPerfil.id,
    userId: voluntarioPerfil.userId,
    nomeCompleto: voluntarioPerfil.nomeCompleto,
    cpf: voluntarioPerfil.cpf,
    status: voluntarioPerfil.status
}

type LinhaPerfil = { cpf: string | null }

/**
 * Traduz a linha do banco para o perfil de domínio, decifrando o CPF.
 *
 * Linhas gravadas antes da migração de proteção ainda estão em claro — ler as
 * duas formas mantém a aplicação funcional durante a janela da migração, e o
 * script `proteger-dados-existentes` fecha essa janela.
 *
 * Uma falha de decifragem **propaga** de propósito: significa chave trocada ou
 * dado corrompido, e seguir em frente arriscaria criar um cadastro duplicado por
 * não ter conseguido ler o existente.
 */
function comCpfEmClaro<T extends LinhaPerfil>(linha: T | undefined): T | null {
    if (!linha) return null
    if (linha.cpf === null) return linha
    return { ...linha, cpf: ehEnvelope(linha.cpf) ? decifrar(linha.cpf) : linha.cpf }
}

export function criarVoluntarioRepository(executor: Executor = db): VoluntarioRepository {
    return {
        async buscarPorCpf(cpf) {
            // Busca pelo índice cego, não pela coluna cifrada: com IV aleatório, o
            // mesmo CPF gera ciphertexts diferentes e a igualdade sobre `cpf` nunca
            // casaria (research.md D2).
            const [linha] = await executor
                .select(COLUNAS_PERFIL)
                .from(voluntarioPerfil)
                .where(eq(voluntarioPerfil.cpfIndice, indiceCego(cpf)))
                .limit(1)
            return comCpfEmClaro(linha) as PerfilVoluntario | null
        },

        async buscarPorId(id) {
            const [linha] = await executor
                .select(COLUNAS_PERFIL)
                .from(voluntarioPerfil)
                .where(eq(voluntarioPerfil.id, id))
                .limit(1)
            return comCpfEmClaro(linha) as PerfilVoluntario | null
        },

        async buscarPorUserId(userId) {
            const [linha] = await executor
                .select(COLUNAS_PERFIL)
                .from(voluntarioPerfil)
                .where(eq(voluntarioPerfil.userId, userId))
                .limit(1)
            return comCpfEmClaro(linha) as PerfilVoluntario | null
        },

        async buscarDadosSensiveis(perfilId) {
            const [linha] = await executor
                .select({
                    userId: voluntarioPerfil.userId,
                    cpf: voluntarioPerfil.cpf,
                    dataNascimento: voluntarioPerfil.dataNascimento,
                    cep: voluntarioPerfil.cep,
                    anonimizadoEm: voluntarioPerfil.anonimizadoEm
                })
                .from(voluntarioPerfil)
                .where(eq(voluntarioPerfil.id, perfilId))
                .limit(1)

            if (!linha) return null

            // Decifra aqui porque a cripto não atravessa para a `application`
            // (Princípio I). Um `ValorIlegivelError` propaga: o caso de uso o
            // traduz para o estado "ilegível" da apresentação (FR-014).
            const emClaro = (valor: string | null): string | null =>
                valor === null || valor === '' ? null : ehEnvelope(valor) ? decifrar(valor) : valor

            return {
                userId: linha.userId,
                cpf: emClaro(linha.cpf),
                dataNascimento: emClaro(linha.dataNascimento),
                cep: emClaro(linha.cep),
                anonimizadoEm: linha.anonimizadoEm
            }
        },

        async salvarCandidatura({ userId, dados }) {
            const valores = {
                userId,
                nomeCompleto: dados.nomeCompleto,
                // Os três campos sensíveis são cifrados na fronteira de escrita
                // (FR-001). `cpfIndice` é gravado junto, porque é o que sustenta
                // unicidade e `buscarPorCpf` depois que o CPF deixa de ser legível.
                dataNascimento: cifrar(dados.dataNascimento),
                cpf: cifrar(dados.cpf),
                cpfIndice: indiceCego(dados.cpf),
                telefone: dados.telefone,
                cep: cifrar(dados.cep),
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

            // Devolve o CPF em claro: quem chamou passou o valor em claro e a
            // `application` não deve receber envelope de volta.
            return comCpfEmClaro(perfil) as PerfilVoluntario
        },

        async impactoDaExclusao(userId) {
            const [perfil] = await executor
                .select({ id: voluntarioPerfil.id, anonimizadoEm: voluntarioPerfil.anonimizadoEm })
                .from(voluntarioPerfil)
                .where(eq(voluntarioPerfil.userId, userId))
                .limit(1)

            const agora = new Date()

            const [futuros] = await executor
                .select({ total: count() })
                .from(alocacao)
                .innerJoin(turno, eq(turno.id, alocacao.turnoId))
                .where(
                    and(
                        eq(alocacao.participanteUserId, userId),
                        eq(alocacao.status, 'confirmado'),
                        gte(turno.inicio, agora)
                    )
                )

            const [passados] = await executor
                .select({ total: count() })
                .from(alocacao)
                .innerJoin(turno, eq(turno.id, alocacao.turnoId))
                .where(and(eq(alocacao.participanteUserId, userId), lt(turno.inicio, agora)))

            return {
                turnosFuturosConfirmados: futuros?.total ?? 0,
                turnosPassados: passados?.total ?? 0,
                temPerfilVoluntario: perfil !== undefined,
                jaAnonimizado: perfil?.anonimizadoEm !== null && perfil?.anonimizadoEm !== undefined
            }
        },

        async anonimizarPerfil(userId) {
            // As alocações FUTURAS confirmadas são canceladas, liberando a vaga
            // (FR-025). As passadas ficam intactas: são o registro operacional da
            // resposta a desastres que FR-024 manda preservar, e é isso que faz os
            // relatórios de períodos anteriores continuarem fechando.
            const futuros = executor
                .select({ id: turno.id })
                .from(turno)
                .where(gte(turno.inicio, new Date()))

            await executor
                .update(alocacao)
                .set({ status: 'cancelado' })
                .where(
                    and(
                        eq(alocacao.participanteUserId, userId),
                        eq(alocacao.status, 'confirmado'),
                        inArray(alocacao.turnoId, futuros)
                    )
                )

            const [perfil] = await executor
                .select({ id: voluntarioPerfil.id })
                .from(voluntarioPerfil)
                .where(eq(voluntarioPerfil.userId, userId))
                .limit(1)

            // Titular com conta mas sem cadastro de voluntário: nada a anonimizar
            // aqui, e isso não é erro (US4, cenário 8).
            if (!perfil) return null

            // Habilidades declaradas são dado do titular (FR-023).
            await executor.delete(voluntarioHabilidade).where(eq(voluntarioHabilidade.voluntarioPerfilId, perfil.id))

            // `UPDATE`, nunca `DELETE`: a linha permanece para que `alocacao` não
            // seja levada por cascade (research.md D7). `cpfIndice` a nulo libera o
            // índice único — nulos não colidem, então vários titulares anonimizados
            // coexistem.
            await executor
                .update(voluntarioPerfil)
                .set({
                    nomeCompleto: null,
                    cpf: null,
                    cpfIndice: null,
                    dataNascimento: null,
                    telefone: null,
                    cep: null,
                    bairro: null,
                    profissao: null,
                    restricoesSaude: null,
                    anonimizadoEm: new Date()
                })
                .where(eq(voluntarioPerfil.id, perfil.id))

            return { perfilId: perfil.id }
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
