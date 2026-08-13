'use server'

import { updateTag } from 'next/cache'
import { z } from '@/src/shared/validacao/zod-ptbr'
import { CACHE_TAGS } from '@/src/shared/cache'
import { erroAction, type ResultadoAction } from '@/src/shared/kernel'
import type { Role } from '@/src/shared/auth/roles'
import { rolesExigidas } from '@/src/shared/auth/rotas'
import { obterSessao } from '@/src/shared/auth/sessao'
import { BASES_DEMANDA } from '../../domain/projecao'
import { criseRepository, metricaKitRepository } from '../../infrastructure/drizzle/logistica-repository'

/**
 * Atualizar os números da crise e configurar a métrica de demanda são
 * atribuições da Defesa Civil (BRD §5). As três actions abaixo só existem
 * dentro da tela `/crise`, então **derivam da regra dessa rota** em vez de
 * repeti-la: separá-las deixaria a coordenação alterando os números sem poder
 * abrir a tela, ou a Defesa Civil abrindo uma tela com os botões em erro.
 */
const ROLES_CRISE: readonly Role[] = rolesExigidas('/crise') ?? []

async function exigir(roles: readonly Role[]) {
    const ator = await obterSessao()
    return ator && roles.includes(ator.role) ? ator : null
}

const esquemaCrise = z.object({
    totalFamiliasAfetadas: z.number().int().min(0).max(10_000_000),
    totalPessoasAfetadas: z.number().int().min(0).max(10_000_000)
})

export type EntradaVariaveisCrise = z.infer<typeof esquemaCrise>

/** BRD §5 / LOG-02 — nova linha append-only a cada atualização. */
export async function atualizarVariaveisCrise(
    entrada: EntradaVariaveisCrise
): Promise<ResultadoAction<{ id: string }>> {
    const ator = await exigir(ROLES_CRISE)
    if (!ator) return erroAction('nao_autorizado', 'Você não tem permissão para atualizar os números da crise.')

    const parse = esquemaCrise.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Informe números inteiros iguais ou maiores que zero.')

    const linha = await criseRepository.registrar({ ...parse.data, atualizadoPor: ator.userId })

    // O painel precisa refletir o novo número na mesma resposta — quem acabou
    // de digitar espera ver o efeito (DESIGN.md §7, read-your-writes).
    updateTag(CACHE_TAGS.dashboardKits)

    return { ok: true, valor: { id: linha.id } }
}

const esquemaMetrica = z.object({
    kitId: z.uuid(),
    baseDemanda: z.enum(BASES_DEMANDA),
    proporcao: z.number().positive().max(1000)
})

/** BR-INT-01 / LOG-03 — associa um kit a uma base de demanda e proporção. */
export async function definirMetricaKit(
    entrada: z.infer<typeof esquemaMetrica>
): Promise<ResultadoAction<{ kitId: string }>> {
    const ator = await exigir(ROLES_CRISE)
    if (!ator) return erroAction('nao_autorizado', 'Você não tem permissão para configurar métricas de demanda.')

    const parse = esquemaMetrica.safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Revise a base de demanda e a proporção.')

    await metricaKitRepository.definir(parse.data)
    updateTag(CACHE_TAGS.dashboardKits)

    return { ok: true, valor: { kitId: parse.data.kitId } }
}

export async function removerMetricaKit(entrada: { kitId: string }): Promise<ResultadoAction<{ kitId: string }>> {
    const ator = await exigir(ROLES_CRISE)
    if (!ator) return erroAction('nao_autorizado', 'Você não tem permissão para remover métricas de demanda.')

    const parse = z.object({ kitId: z.uuid() }).safeParse(entrada)
    if (!parse.success) return erroAction('validacao', 'Kit inválido.')

    await metricaKitRepository.remover(parse.data.kitId)
    updateTag(CACHE_TAGS.dashboardKits)

    return { ok: true, valor: { kitId: parse.data.kitId } }
}
