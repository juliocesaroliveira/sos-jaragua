import { randomUUID } from 'node:crypto'
import { inArray } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { db } from '@/src/shared/db/postgres'
import { user } from '@/db/schema/identidade'
import { criseVariaveis } from '@/db/schema/logistica'
import { notificacao, notificacaoEnvio } from '@/db/schema/notificacoes'
import { intervaloUtc } from '@/src/modules/contingencia/domain/periodo'
import {
    contarEnviosNotificacoes,
    enviosNotificacoesRelatorio,
    totaisEnviosNotificacoes
} from '@/src/modules/notificacoes/presentation/queries/relatorios'
import { contarEvolucaoCrise, evolucaoCriseRelatorio } from './relatorios'

/**
 * R-14 Evolução da crise e R-16 Envio de notificações contra o Neon de
 * desenvolvimento (specs/023-central-relatorios, US5).
 *
 * Linhas em 2020: anteriores a qualquer dado real, então não mudam a crise
 * vigente (a mais recente) nem se misturam com notificações de verdade.
 */

const TUDO = { limite: 1_000, deslocamento: 0 }
const MAIO_2020 = intervaloUtc({ de: '2020-05-01', ate: '2020-05-31' })

const criados = { usuarios: [] as string[], crises: [] as string[] }

afterEach(async () => {
    if (criados.crises.length > 0) await db.delete(criseVariaveis).where(inArray(criseVariaveis.id, criados.crises))
    // Notificações e envios saem junto com o usuário (cascade).
    if (criados.usuarios.length > 0) await db.delete(user).where(inArray(user.id, criados.usuarios))
    criados.usuarios.length = 0
    criados.crises.length = 0
})

async function criarUsuario() {
    const id = randomUUID()
    await db.insert(user).values({ id, name: 'Defesa Civil', email: `rel-log-${id.slice(0, 8)}@exemplo.test` })
    criados.usuarios.push(id)
    return id
}

async function registrarCrise(atualizadoEm: string, familias: number, pessoas: number, autor: string) {
    const [linha] = await db
        .insert(criseVariaveis)
        .values({
            totalFamiliasAfetadas: familias,
            totalPessoasAfetadas: pessoas,
            atualizadoPor: autor,
            atualizadoEm: new Date(atualizadoEm)
        })
        .returning({ id: criseVariaveis.id })
    criados.crises.push(linha.id)
    return linha.id
}

describe('evolucaoCriseRelatorio (R-14)', () => {
    it('ordem cronológica; a primeira do período compara com a última de antes dele', async () => {
        const autor = await criarUsuario()
        await registrarCrise('2020-04-20T12:00:00Z', 90, 300, autor) // antes do período
        const maio1 = await registrarCrise('2020-05-02T12:00:00Z', 100, 350, autor)
        const maio2 = await registrarCrise('2020-05-09T12:00:00Z', 130, 420, autor)

        const doTeste = (await evolucaoCriseRelatorio(MAIO_2020, TUDO)).filter((l) => criados.crises.includes(l.id))

        expect(doTeste.map((l) => l.id)).toEqual([maio1, maio2])
        expect(doTeste[0]).toMatchObject({ totalFamiliasAfetadas: 100, familiasAnterior: 90, pessoasAnterior: 300 })
        expect(doTeste[1]).toMatchObject({ familiasAnterior: 100, pessoasAnterior: 350, atualizadoPorId: autor })
        expect(await contarEvolucaoCrise(MAIO_2020)).toBeGreaterThanOrEqual(2)
    })
})

describe('envios de notificação (R-16)', () => {
    it('lista e conta envios por período, tipo, canal e situação; totais ignoram a situação', async () => {
        const destinatario = await criarUsuario()
        const [notif] = await db
            .insert(notificacao)
            .values({
                destinatarioUserId: destinatario,
                tipo: 'lembrete_turno',
                titulo: 'Lembrete',
                mensagem: 'Seu turno começa amanhã.',
                criadoEm: new Date('2020-05-10T12:00:00Z')
            })
            .returning({ id: notificacao.id })
        await db.insert(notificacaoEnvio).values([
            { notificacaoId: notif.id, canal: 'plataforma', status: 'enviado' },
            { notificacaoId: notif.id, canal: 'email', status: 'falhou', erro: 'Caixa de e-mail inexistente' }
        ])

        const filtro = { intervalo: MAIO_2020, tipo: 'lembrete_turno' as const }
        const falhas = (await enviosNotificacoesRelatorio({ ...filtro, status: 'falhou' }, TUDO)).filter(
            (l) => l.destinatarioUserId === destinatario
        )

        expect(falhas).toEqual([
            expect.objectContaining({ canal: 'email', status: 'falhou', erro: 'Caixa de e-mail inexistente' })
        ])
        expect(await contarEnviosNotificacoes({ ...filtro, canal: 'email', status: 'falhou' })).toBeGreaterThanOrEqual(
            1
        )

        const totais = await totaisEnviosNotificacoes(filtro)
        expect(totais).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ tipo: 'lembrete_turno', canal: 'plataforma', status: 'enviado' }),
                expect.objectContaining({ tipo: 'lembrete_turno', canal: 'email', status: 'falhou' })
            ])
        )
    })
})
