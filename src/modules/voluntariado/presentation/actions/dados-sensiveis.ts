'use server'

import { z } from '@/src/shared/validacao/zod-ptbr'
import { obterSessao } from '@/src/shared/auth/sessao'
import { CAMPOS_SENSIVEIS } from '@/src/shared/mascara/campos-sensiveis'
import { updateTag } from 'next/cache'
import { CACHE_TAGS } from '@/src/shared/cache'
import { criarVoluntarioRepository, unidadeDeTrabalho } from '../../infrastructure/drizzle/voluntario-repository'
import { AnonimizarTitularUseCase } from '../../application/use-cases/anonimizar-titular'
import { RevelarDadoSensivelUseCase } from '../../application/use-cases/revelar-dado-sensivel'

/**
 * Server Actions dos dados sensíveis de voluntário (feature 025).
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

/**
 * Elimina todos os dados do titular autenticado (FR-020 a FR-030).
 *
 * O titular vem **da sessão**, nunca do payload: ninguém elimina a conta de
 * outra pessoa por este caminho. A confirmação explícita é exigida pelo contrato
 * (FR-021) e a interface precisa tê-la obtido antes de chamar.
 */
const esquemaExclusao = z.object({ confirmacao: z.boolean() })

export type RespostaExclusao = { ok: true; jaAnonimizado: boolean } | { ok: false; erro: string }

export async function excluirMeusDados(entrada: unknown): Promise<RespostaExclusao> {
    const parse = esquemaExclusao.safeParse(entrada)
    // A confirmação explícita é parte do contrato (FR-021): sem ela, a ação é
    // recusada aqui também, não só na interface.
    if (!parse.success || parse.data.confirmacao !== true) {
        return { ok: false, erro: MENSAGENS.entrada_invalida! }
    }

    const ator = await obterSessao()
    if (!ator) return { ok: false, erro: MENSAGENS.nao_autenticado! }

    const caso = new AnonimizarTitularUseCase(unidadeDeTrabalho, criarVoluntarioRepository())
    const r = await caso.executar({ titular: { userId: ator.userId, role: ator.role } })

    // As telas que mostram dados deste titular precisam deixar de mostrá-los
    // imediatamente (FR-022) — por isso `updateTag`, não `revalidateTag`.
    updateTag(CACHE_TAGS.voluntariadoPendentes)
    updateTag(CACHE_TAGS.voluntariadoListagem)

    return { ok: true, jaAnonimizado: r.jaAnonimizado }
}
