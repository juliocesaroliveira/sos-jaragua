import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { voluntarioPerfil } from '@/db/schema/voluntariado'
import type { NotificacaoService } from '@/src/modules/notificacoes/application/ports/notificacao-service'
import { unidadeDeTrabalho } from '../../infrastructure/drizzle/voluntario-repository'
import { AprovarCandidaturaUseCase } from './aprovar-candidatura'

/**
 * TEST-04 — fluxo completo de aprovação de candidatura contra o Neon de
 * desenvolvimento (DESIGN.md §18).
 *
 * O que só um teste de integração pega: BR-VOL-03 exige que
 * `voluntario_perfil.status` e `user.role` mudem na **mesma transação**. Um
 * mock de repositório não provaria isso.
 */
vi.mock('@/src/modules/auditoria', () => ({
    withAudit: <T>(_o: unknown, fn: () => Promise<T>) => fn()
}))

const notificacoesEnviadas: unknown[] = []
const notificacoesFake: NotificacaoService = {
    async enviar(n) {
        notificacoesEnviadas.push(n)
    },
    async enviarEmLote(ns) {
        notificacoesEnviadas.push(...ns)
    }
}

const criados: string[] = []

/** Cria um usuário + perfil pendente descartáveis, com CPF único por execução. */
async function criarCandidaturaPendente(role: 'usuario' | 'coordenador' = 'usuario') {
    const userId = randomUUID()
    const sufixo = userId.slice(0, 8)

    await db.insert(user).values({
        id: userId,
        name: `Teste ${sufixo}`,
        email: `teste-${sufixo}@exemplo.test`,
        emailVerified: true,
        role
    })

    const [perfil] = await db
        .insert(voluntarioPerfil)
        .values({
            userId,
            nomeCompleto: `Teste ${sufixo}`,
            dataNascimento: '1990-01-01',
            // CPF sintético e único — o índice único não pode colidir entre
            // execuções do teste.
            cpf: `TESTE-${userId}`,
            telefone: '47991234567',
            cep: '89250000',
            bairro: 'Centro',
            profissao: 'Testes',
            veiculoProprio: false,
            disponibilidade: ['manha'],
            status: 'pendente'
        })
        .returning({ id: voluntarioPerfil.id })

    criados.push(userId)
    return { userId, perfilId: perfil.id }
}

afterEach(async () => {
    notificacoesEnviadas.length = 0
    // `voluntario_perfil` cai por cascade do `user`.
    for (const userId of criados.splice(0)) {
        await db.delete(user).where(eq(user.id, userId))
    }
})

describe('AprovarCandidaturaUseCase (integração)', () => {
    it('aprova o perfil e promove a role na mesma transação (BR-VOL-03)', async () => {
        const { userId, perfilId } = await criarCandidaturaPendente()
        const useCase = new AprovarCandidaturaUseCase(unidadeDeTrabalho, notificacoesFake)

        const r = await useCase.executar({ perfilId, aprovadoPor: userId })
        expect(r.ok).toBe(true)

        const [perfil] = await db
            .select({ status: voluntarioPerfil.status, aprovadoEm: voluntarioPerfil.aprovadoEm })
            .from(voluntarioPerfil)
            .where(eq(voluntarioPerfil.id, perfilId))
        const [conta] = await db.select({ role: user.role }).from(user).where(eq(user.id, userId))

        expect(perfil.status).toBe('aprovado')
        expect(perfil.aprovadoEm).not.toBeNull()
        expect(conta.role).toBe('voluntario')
    })

    it('dispara a notificação de triagem concluída', async () => {
        const { userId, perfilId } = await criarCandidaturaPendente()
        const useCase = new AprovarCandidaturaUseCase(unidadeDeTrabalho, notificacoesFake)

        await useCase.executar({ perfilId, aprovadoPor: userId })

        expect(notificacoesEnviadas).toHaveLength(1)
        expect(notificacoesEnviadas[0]).toMatchObject({
            evento: 'triagem_concluida',
            destinatarioUserId: userId
        })
    })

    it('não rebaixa quem já tem role acima de `usuario`', async () => {
        // Um coordenador que também se candidata a voluntário não pode perder
        // o próprio acesso ao ser aprovado.
        const { userId, perfilId } = await criarCandidaturaPendente('coordenador')
        const useCase = new AprovarCandidaturaUseCase(unidadeDeTrabalho, notificacoesFake)

        await useCase.executar({ perfilId, aprovadoPor: userId })

        const [conta] = await db.select({ role: user.role }).from(user).where(eq(user.id, userId))
        expect(conta.role).toBe('coordenador')
    })

    it('devolve erro e não notifica quando a candidatura não existe', async () => {
        const useCase = new AprovarCandidaturaUseCase(unidadeDeTrabalho, notificacoesFake)

        const r = await useCase.executar({ perfilId: randomUUID(), aprovadoPor: randomUUID() })

        expect(r.ok).toBe(false)
        if (r.ok) return
        expect(r.erro.codigo).toBe('nao_encontrado')
        expect(notificacoesEnviadas).toHaveLength(0)
    })
})
