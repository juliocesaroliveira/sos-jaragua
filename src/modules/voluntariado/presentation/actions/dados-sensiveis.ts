'use server'

import { z } from '@/src/shared/validacao/zod-ptbr'
import { obterSessao } from '@/src/shared/auth/sessao'
import { CAMPOS_SENSIVEIS } from '@/src/shared/mascara/campos-sensiveis'
import { criarVoluntarioRepository } from '../../infrastructure/drizzle/voluntario-repository'
import { RevelarDadoSensivelUseCase } from '../../application/use-cases/revelar-dado-sensivel'

/**
 * Server Actions dos dados sensíveis de voluntário (feature 024).
 *
 * Camada fina, como o Princípio I exige: parse com Zod, leitura da sessão,
 * chamada a **um** caso de uso. Nenhuma regra de autorização aqui — a Matriz de
 * Visibilidade é avaliada dentro do caso de uso, que é a fonte de verdade.
 *
 * **Nunca cacheada**: lê a sessão, e `DESIGN.md` §7 proíbe cachear dado
 * derivado de sessão. É por isso que este é o único caminho pelo qual texto
 * plano sensível chega ao cliente (research.md D4).
 */

const esquema = z.object({
    perfilId: z.string().uuid(),
    campo: z.enum(CAMPOS_SENSIVEIS)
})

export type RespostaRevelacao = { ok: true; valor: string } | { ok: false; erro: string }

/** Mensagens em pt-BR; nenhuma revela se o registro existe. */
const MENSAGENS: Record<string, string> = {
    sem_permissao: 'Você não tem permissão para ver este dado completo.',
    ilegivel: 'Não foi possível ler este dado.',
    nao_encontrado: 'Dado não disponível.',
    nao_autenticado: 'Sua sessão expirou. Entre novamente.',
    entrada_invalida: 'Não foi possível processar a solicitação.'
}

export async function revelarDadoSensivel(entrada: unknown): Promise<RespostaRevelacao> {
    const parse = esquema.safeParse(entrada)
    if (!parse.success) return { ok: false, erro: MENSAGENS.entrada_invalida! }

    // A sessão é relida aqui, e não herdada do gate da página: Server Actions não
    // herdam o gate de um Server Component (Princípio IV).
    const ator = await obterSessao()
    if (!ator) return { ok: false, erro: MENSAGENS.nao_autenticado! }

    const caso = new RevelarDadoSensivelUseCase(criarVoluntarioRepository())
    const r = await caso.executar({
        perfilId: parse.data.perfilId,
        campo: parse.data.campo,
        ator: { userId: ator.userId, role: ator.role }
    })

    if (r.ok) return { ok: true, valor: r.valor }
    return { ok: false, erro: MENSAGENS[r.erro] ?? MENSAGENS.nao_encontrado! }
}
