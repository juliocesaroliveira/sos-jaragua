'use server'

import { revalidateTag, updateTag } from 'next/cache'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { CACHE_TAGS, PERFIL_REVALIDACAO } from '@/src/shared/cache'
import { erroAction, serializar, type ResultadoAction } from '@/src/shared/kernel'
import { comAtorDaSessao, obterSessao } from '@/src/shared/auth/sessao'
import { unidadeDeTrabalho } from '../../infrastructure/drizzle/voluntario-repository'
import { SubmeterCandidaturaUseCase } from '../../application/use-cases/submeter-candidatura'
import { DISPONIBILIDADES, TIPOS_VEICULO } from '../../domain/candidatura'

/**
 * Camada de apresentação (DESIGN.md §4): parse com Zod, checagem de sessão,
 * **uma** chamada de caso de uso e invalidação de cache. Sem regra de negócio —
 * a validação de CPF/maioridade vive no `domain`.
 */
const esquema = z.object({
    nomeCompleto: z.string().min(1),
    /**
     * Opcional: quando a conta já tem data de nascimento, o formulário nem a
     * envia — e mesmo que envie, o caso de uso descarta (FR-017). **Não existe
     * campo de e-mail aqui de propósito**: o e-mail é lido da sessão e nunca
     * aceito do cliente (FR-019).
     */
    dataNascimento: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
        .optional(),
    cpf: z.string().min(1),
    telefone: z.string().min(1),
    cep: z.string().min(1),
    bairro: z.string().min(1),
    profissao: z.string().min(1),
    restricoesSaude: z.string().optional().nullable(),
    veiculoProprio: z.boolean(),
    tipoVeiculo: z.enum(TIPOS_VEICULO).optional().nullable(),
    disponibilidade: z.array(z.enum(DISPONIBILIDADES)),
    habilidadeIds: z.array(z.uuid())
})

export type EntradaFormularioCandidatura = z.infer<typeof esquema>

export async function submeterCandidatura(
    entrada: EntradaFormularioCandidatura
): Promise<ResultadoAction<{ perfilId: string }>> {
    // Autorização também aqui, e não só no `proxy.ts`: Server Actions são POSTs
    // para a própria rota e podem ser chamadas fora da navegação normal.
    const ator = await obterSessao()
    if (!ator) return erroAction('nao_autenticado', 'Entre na sua conta para enviar a candidatura.')

    const parse = esquema.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Revise os campos do formulário.')

    const useCase = new SubmeterCandidaturaUseCase(unidadeDeTrabalho)
    const resultado = await comAtorDaSessao(ator, () =>
        useCase.executar({
            userId: ator.userId,
            dados: { ...parse.data, dataNascimento: parse.data.dataNascimento ?? '' },
            // Da **sessão**, nunca do corpo do POST: é o que impede que um
            // campo desabilitado adulterado no navegador mude a data de
            // nascimento de uma conta (FR-017).
            dataNascimentoDaConta: ator.dataNascimento
        })
    )

    if (resultado.ok) {
        // A fila de triagem precisa refletir a nova candidatura imediatamente.
        updateTag(CACHE_TAGS.voluntariadoPendentes)
        revalidateTag(CACHE_TAGS.voluntariadoListagem, PERFIL_REVALIDACAO)
    }

    return serializar(resultado.ok ? { ok: true, valor: { perfilId: resultado.valor.id } } : resultado)
}
