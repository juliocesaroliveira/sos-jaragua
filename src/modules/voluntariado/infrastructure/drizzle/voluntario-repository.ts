import { eq } from 'drizzle-orm'
import { db, type Transacao } from '@/src/shared/db/postgres'
import { cifrar, decifrar, ehEnvelope, indiceCego } from '@/src/shared/cripto'
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
