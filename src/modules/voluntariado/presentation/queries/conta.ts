import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { voluntarioPerfil } from '@/db/schema/voluntariado'
import { decifrar, ehEnvelope, ValorIlegivelError } from '@/src/shared/cripto'
import type { ImpactoExclusao } from '../../application/ports/voluntario-repository'
import { criarVoluntarioRepository } from '../../infrastructure/drizzle/voluntario-repository'

/**
 * Leituras da área de conta do titular (feature 024, US4).
 *
 * **Nunca cacheadas**: dependem de quem está autenticado, e `DESIGN.md` §7
 * proíbe cachear dado derivado de sessão. É também o que permite apresentar os
 * valores completos sem que eles passem por cache algum (research.md D4).
 */

export type DadosDaConta = {
    nome: string
    email: string
    temPerfilVoluntario: boolean
    /** Valores **completos**: o titular tem direito de acesso aos próprios dados. */
    cpf: string | null
    dataNascimento: string | null
    cep: string | null
    telefone: string | null
    bairro: string | null
    profissao: string | null
    /** `true` quando algum valor não pôde ser lido (FR-014). */
    algumIlegivel: boolean
}

/** Decifra para o próprio titular, sinalizando falha em vez de mascarar. */
function emClaro(valor: string | null, falhas: { houve: boolean }): string | null {
    if (valor === null || valor === '') return null
    try {
        return ehEnvelope(valor) ? decifrar(valor) : valor
    } catch (erro) {
        if (erro instanceof ValorIlegivelError) {
            falhas.houve = true
            return null
        }
        throw erro
    }
}

export async function dadosDaConta(userId: string): Promise<DadosDaConta | null> {
    const [conta] = await db
        .select({ nome: user.name, email: user.email })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1)

    if (!conta) return null

    const [perfil] = await db
        .select({
            cpf: voluntarioPerfil.cpf,
            dataNascimento: voluntarioPerfil.dataNascimento,
            cep: voluntarioPerfil.cep,
            telefone: voluntarioPerfil.telefone,
            bairro: voluntarioPerfil.bairro,
            profissao: voluntarioPerfil.profissao
        })
        .from(voluntarioPerfil)
        .where(eq(voluntarioPerfil.userId, userId))
        .limit(1)

    const falhas = { houve: false }

    return {
        nome: conta.nome,
        email: conta.email,
        temPerfilVoluntario: perfil !== undefined,
        cpf: perfil ? emClaro(perfil.cpf, falhas) : null,
        dataNascimento: perfil ? emClaro(perfil.dataNascimento, falhas) : null,
        cep: perfil ? emClaro(perfil.cep, falhas) : null,
        telefone: perfil?.telefone ?? null,
        bairro: perfil?.bairro ?? null,
        profissao: perfil?.profissao ?? null,
        algumIlegivel: falhas.houve
    }
}

/** Impacto da eliminação, para a confirmação de FR-021. */
export async function impactoDaExclusao(userId: string): Promise<ImpactoExclusao> {
    return criarVoluntarioRepository().impactoDaExclusao(userId)
}
